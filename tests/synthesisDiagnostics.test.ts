import {test,expect,beforeAll} from 'vitest';
import {basicRelayReference} from '../src/authoring/basicRelay';
import {newPhysicalProject} from '../src/authoring/commands';
import {applySmfReference} from '../src/authoring/smf';
import {withPortWorld} from '../src/routing/model';
import {pose} from '../src/surface/model';
import {defaultProblem} from '../src/design/engine';
import {defaultRouting} from '../src/routing/contract';
import {defaultSynthesis} from '../src/synthesis/contract';
import {searchSynthesis,searchSynthesisAsync} from '../src/synthesis/engine';
import type {SynthesisResult} from '../src/synthesis/engine';
import {FAMILY_IDS,configurationIssues,emptyEvidence,issueKind} from '../src/synthesis/diagnostics';
import {familyStatus,candidateGroups} from '../src/synthesis/ExplainedResults';
import {serializeProject} from '../src/project/model';
const p=basicRelayReference(),problem={...defaultProblem(p),maxParts:4,maxGenerated:4},routing=defaultRouting(),options={...defaultSynthesis(),budget:512,geometryBudget:32,fitBudget:64};let result:SynthesisResult;
beforeAll(()=>{result=searchSynthesis(p,problem,routing,options);});
test('parallel axes explain the absent single Prism; disabled two-Prism and count cap remain distinct',()=>{
 const single=result.diagnostics.families.prism1;expect(single.proposals).toBe(0);expect(single.issues.some(v=>v.reason.includes('90°'))).toBe(true);
 const issues=configurationIssues('prism2',options,routing,problem);expect(issues).toHaveLength(2);expect(issues.join(' ')).toContain('선택되지');expect(issues.join(' ')).toContain('Prism 상한 1개');
 const enabled={...options,families:[...options.families,'prism2' as const]};expect(configurationIssues('prism2',enabled,routing,problem)).toHaveLength(1);
 expect(familyStatus(emptyEvidence(),[],null,true)).toBe('설정에서 제외');
});
test('initial geometry and fit counters describe observed work rather than inferring failure from missing retained candidates',()=>{
 expect(FAMILY_IDS.reduce((n,t)=>n+result.diagnostics.families[t].geometryTested,0)).toBe(Object.values(result.families).reduce((a,b)=>a+b,0));
 for(const [t,v]of Object.entries(result.diagnostics.families)){expect(v.geometryPassed).toBeLessThanOrEqual(v.geometryTested);expect(v.fitStarted).toBeLessThanOrEqual(v.fitPlanned);expect(v.fitTested).toBeGreaterThanOrEqual(v.fitStarted);expect(v.accepted).toBeGreaterThanOrEqual(result.candidates.filter(c=>c.topology===t).length);}
 const limited=searchSynthesis(p,problem,routing,{...options,budget:1,geometryBudget:1});expect(limited.status).toBe('budget-exhausted');expect(Object.values(limited.diagnostics.families).some(v=>v.limited)).toBe(true);expect(limited.candidates).toHaveLength(0);
 const found=emptyEvidence();found.accepted=1;expect(familyStatus(found,[],result,false)).toContain('최종');
});
test('geometric Keep-out rejection and component caps are attributed to the actual family',()=>{
 const blocked=searchSynthesis(p,problem,{...routing,keepOut:[{min:{x:-.001,y:-1,z:-1},max:{x:.011,y:1,z:1}}]},{...options,families:['direct']});expect(blocked.candidates).toHaveLength(0);expect(blocked.diagnostics.families.direct.issues.some(v=>v.kind==='geometry')).toBe(true);expect(blocked.diagnostics.families.prism1.issues).toEqual([]);
 const shifted=withPortWorld(p,'target',pose(.01,.0005,0));const capped=searchSynthesis(shifted,{...problem,maxGenerated:0},routing,{...options,families:['mirror2']});expect(capped.diagnostics.families.mirror2.issues.some(v=>v.kind==='parts')).toBe(true);
});
test('actual model-limited Prism candidates record evaluator reasons without declaring the entire family impossible',()=>{
 const q=withPortWorld(applySmfReference(newPhysicalProject(),'target'),'target',pose(.01,0,.005));
 const r=searchSynthesis(q,{...defaultProblem(q),maxParts:4,maxGenerated:4},routing,defaultSynthesis());
 const c=r.candidates.find(c=>c.topology.includes('prism')&&c.eta===null);expect(c).toBeDefined();expect(r.diagnostics.families[c!.topology].issues.some(v=>v.reason===c!.reason&&v.stage==='mode')).toBe(true);expect(familyStatus(r.diagnostics.families[c!.topology],[c!],r,false)).toContain('참고 후보');
},60000);
test('invalid input and cancellation are explicit; diagnostic data does not enter the Project',async()=>{
 const before=serializeProject(p),unknown=newPhysicalProject(),invalid=searchSynthesis(unknown,defaultProblem(unknown),routing,options);expect(invalid.status).toBe('invalid-input');expect(invalid.diagnostics.global[0].reason).toContain('target:');
 const cancelled=await searchSynthesisAsync(p,problem,routing,options,{cancelled:()=>true,progress:()=>{}});expect(cancelled.status).toBe('cancelled');expect(Object.values(cancelled.diagnostics.families).every(v=>v.fitTested===0&&v.accepted===0)).toBe(true);expect(familyStatus(emptyEvidence(),[],cancelled,false)).toContain('폐기');expect(serializeProject(p)).toBe(before);
});
test('grouping preserves every candidate and separates evaluator domains',()=>{
 const c=result.candidates[0];expect(c).toBeDefined();const a=structuredClone(c),b=structuredClone(c);a.id='a';b.id='b';b.comparisonClass='another-field-domain';
 const groups=candidateGroups([c,a,b]);expect(groups.map(g=>g.length)).toEqual([2,1]);expect(groups.flat()).toEqual([c,a,b]);
 expect(issueKind('Unknown evaluator error','fit')).toBe('other');expect(issueKind('Model unsupported: powered / oblique optics after the first TIR.','mode')).toBe('unsupported');expect(issueKind('Out of domain: collimated Prism divergence must be ≤2 mrad internally.','mode')).toBe('domain');
});
