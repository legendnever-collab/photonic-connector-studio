import {test,expect} from 'vitest';
import {newPhysicalProject,framePose} from '../src/authoring/commands';
import {applySmfReference} from '../src/authoring/smf';
import {withPortWorld} from '../src/routing/model';
import {pose,V,frame,compose} from '../src/surface/model';
import {prescription,serializeProject,parseProject} from '../src/project/model';
import {defaultProblem,componentIds} from '../src/design/engine';
import {defaultRouting,defaultSearchOptions} from '../src/routing/contract';
import {defaultSynthesis} from '../src/synthesis/contract';
import {searchSynthesis,applySynthesis,manufacturingSeeds} from '../src/synthesis/engine';
import {emptyTrain,airLensSegments,addLenses,checkFrozen} from '../src/synthesis/construction';
import {prepareRoutingDomain,routeProposals,buildRouteProposal,searchRouting,applyCandidate} from '../src/routing/search';
import {analyzeRouting} from '../src/routing/analysis';
import {tensorOverlap} from '../src/project/tensorOverlap';
import {prismFixture} from './prismFixtures';
function task(x=.016,z=.012){
 let p=withPortWorld(applySmfReference(newPhysicalProject(),'target'),'target',pose(x,0,z));
 if(p.model.kind!=='surface')throw Error('physical');
 p.model.sourceMode={representation:'gaussian',mfdX:.001,mfdY:.001,polarization:'TE'};p.model.targetMode={...p.model.sourceMode};
 p.sourceBody=null;p.targetBody=null;prescription(p).surfaces.at(-1)!.aperture=.004;
 return p;
}
function settings(p:ReturnType<typeof task>){
 const problem={...defaultProblem(p),maxParts:2,maxGenerated:2};problem.tolerance={...problem.tolerance,portPosition:[0,0,0] as [number,number,number],portAngle:[0,0,0] as [number,number,number],componentPosition:[0,0,0] as [number,number,number],componentAngle:[0,0,0] as [number,number,number]};
 const routing={...defaultRouting(),parts:{lens:0,mirror:0,prism:2}};
 const o={...defaultSynthesis(),lensMount:'free' as const,families:['prism2' as const],clearRadius:[.0015,.0015] as [number,number],prismLeg:[.006,.006] as [number,number],budget:128,geometryBudget:32,fitBudget:16};
 return {problem,routing,o};
}
test('blank project generates two real finite Prisms with validated Mode overlap and replayable Apply',()=>{
 const p=task(),{problem,routing,o}=settings(p),before=serializeProject(p),r=searchSynthesis(p,problem,routing,o),c=r.candidates.find(c=>c.qualified);
 expect(c,JSON.stringify(r.rejected)).toBeDefined();expect(c!.eta).toBeGreaterThan(.99);expect(componentIds(c!.project)).toHaveLength(2);
 expect(prescription(c!.project).surfaces.filter(s=>s.interaction==='tir')).toHaveLength(2);
 const next=applySynthesis(p,r,c!.id);expect(tensorOverlap(next).status).toBe('valid');expect(serializeProject(p)).toBe(before);expect(serializeProject(parseProject(serializeProject(next)))).toBe(serializeProject(next));
 const tamper=structuredClone(r);if(tamper.candidates[0].recipe.kind==='generated')tamper.candidates[0].recipe.leg=.005;expect(()=>applySynthesis(p,tamper,tamper.candidates[0].id)).toThrow();
 expect(r.evaluated).toBeLessThanOrEqual(o.budget);expect(r.geometryEvaluated).toBeLessThanOrEqual(o.geometryBudget);
});
test('two-Prism closure handles negative displacement, held-out distance and rigid coordinates',()=>{
 for(const [x,z]of [[.018,-.010],[.014,.014]]){
  const p=task(x,z),{problem,routing,o}=settings(p),r=searchSynthesis(p,problem,routing,o),c=r.candidates.find(c=>c.qualified);expect(c,JSON.stringify(r.rejected)).toBeDefined();
  const copy=structuredClone(c!.project),d=prescription(copy),g=frame({origin:V(.01,-.02,.003),rotation:{roll:.3,pitch:-.2,yaw:.4}});
  d.source.frame=framePose(compose(g,frame(d.source.frame)));for(const a of d.assemblies)if(!a.parentId)a.frame=framePose(compose(g,frame(a.frame)));
  const v=tensorOverlap(copy);expect(v.status).toBe('valid');if(v.status==='valid')expect(v.eta).toBeCloseTo(c!.eta!,10);
 }
});
test('two-Prism routing reuses common family and never redefines unsupported fields as efficiency',()=>{
 const p=task(),{routing}=settings(p);p.routing=routing;
 const options={...defaultSearchOptions(),templates:['prism2' as const],clearRadius:.0015,prismLeg:.006,budget:32},r=searchRouting(p,options);expect(r.candidates.length).toBeGreaterThan(0);expect(()=>applyCandidate(p,r,r.candidates[0].id)).not.toThrow();
 const unknown=structuredClone(p);if(unknown.model.kind==='surface')unknown.model.sourceMode.polarization='unspecified';
 const {problem,o}=settings(unknown),batch=searchSynthesis(unknown,problem,routing,o);expect(batch.candidates.length).toBeGreaterThan(0);expect(batch.candidates.every(c=>c.eta===null&&!c.qualified)).toBe(true);
});
test('part, Keep-out, body/space, manufacturing and tiny-budget gates remain hard limits',()=>{
 const p=task(),{problem,routing,o}=settings(p);
 for(const [pb,rt,op]of [[{...problem,maxGenerated:1},routing,o],[problem,{...routing,parts:{...routing.parts,prism:1}},o],[problem,routing,{...o,prismLeg:[.004,.005] as [number,number]}],[problem,{...routing,keepOut:[{min:V(-1,-1,-1),max:V(1,1,1)}]},o],[problem,{...routing,bounds:{min:V(0,-.0001,0),max:V(.016,.0001,.012)}},o]] as [typeof problem,typeof routing,typeof o][]){
  const r=searchSynthesis(p,pb,rt,op);expect(r.candidates).toHaveLength(0);expect(Object.keys(r.rejected).length).toBeGreaterThan(0);
 }
 const r=searchSynthesis(p,problem,routing,{...o,budget:1,geometryBudget:1});expect(r.status).toBe('budget-exhausted');expect(r.evaluated).toBeLessThanOrEqual(1);
});
test('air segment constructor includes middle Mirror segment, excludes Prism interior, and replays finite geometry',()=>{
 const p=prismFixture('mirrors'),problem=defaultProblem(p),base=emptyTrain(p,problem),opts={...defaultSearchOptions(),templates:['mirror2' as const],clearRadius:.001,prismLeg:.004},domain=prepareRoutingDomain(base,opts,0),q=routeProposals(domain,opts).find(q=>q.blocks.length===2)!;
 const route=buildRouteProposal(domain,opts,q).project,air=airLensSegments(route);expect(air).toEqual([0,1,2]);
 const lens=addLenses(route,1,.001,{...defaultSynthesis(),thickness:[.00005,.0003]},'first',[],[1]);expect(analyzeRouting(lens).withinTolerance).toBe(true);
 const d=prescription(lens);expect(d.surfaces.map(s=>d.assemblies.find(a=>a.id===s.assemblyId)!.kind)).toEqual(['mirror','lens','lens','mirror','target']);
 const prisms=prismFixture('two');prisms.routing={...defaultRouting(),parts:{lens:2,mirror:2,prism:2}};expect(airLensSegments(prisms)).toEqual([0,3,6]);expect(()=>addLenses(prisms,1,.001,defaultSynthesis(),'first',[],[1])).toThrow('air domain');
});
test('locked Mirror and ancestor are exact while an unlocked trailing fold is reconstructed',()=>{
 const p=prismFixture('mirrors'),d=prescription(p),problem=defaultProblem(p);problem.maxParts=2;problem.maxGenerated=1;problem.fixedSurfaces=[d.surfaces[0].id];
 d.assemblies.push({id:'anchor-parent',name:'fixed datum',kind:'group',parentId:null,frame:pose()});d.assemblies.find(a=>a.id==='A')!.parentId='anchor-parent';
 const routing={...defaultRouting(),parts:{lens:0,mirror:2,prism:0}},o={...defaultSynthesis(),families:['mirror1' as const],clearRadius:[.001,.001] as [number,number],budget:128,geometryBudget:32,fitBudget:16};
 const r=searchSynthesis(p,problem,routing,o),c=r.candidates.find(c=>c.recipe.kind==='generated');expect(c,JSON.stringify(r.rejected)).toBeDefined();
 const next=applySynthesis(p,r,c!.id);expect(prescription(next).surfaces[0]).toEqual(d.surfaces[0]);expect(prescription(next).assemblies.find(a=>a.id==='A')).toEqual(d.assemblies.find(a=>a.id==='A'));expect(next.bodies.find(b=>b.assemblyId==='A')).toEqual(p.bodies[0]);
 expect(prescription(next).assemblies.find(a=>a.id==='anchor-parent')).toEqual(d.assemblies.find(a=>a.id==='anchor-parent'));expect(componentIds(next)).toContain('A');expect(componentIds(next)).not.toContain('B');expect(()=>checkFrozen(p,next,problem)).not.toThrow();
 const blocked=searchSynthesis(p,{...problem,maxGenerated:0},routing,o);expect(blocked.candidates.every(c=>c.recipe.kind==='existing')).toBe(true);
});
test('manufacturing sampling uses endpoints plus a third bounded radius; no inflated global budgets',()=>{
 expect(manufacturingSeeds([.0002,.0008])).toEqual([.0002,.0008,.0004]);
 const p=task(),{problem,routing,o}=settings(p),r=searchSynthesis(p,problem,routing,{...o,clearRadius:[.0013,.0015],prismLeg:[.006,.008],geometryBudget:32});
 const sizes=new Set(r.candidates.flatMap(c=>c.recipe.kind==='generated'?[c.recipe.leg]:[]));expect(sizes.size).toBeGreaterThan(1);expect(r.evaluated).toBeLessThanOrEqual(o.budget);expect(r.geometryEvaluated).toBeLessThanOrEqual(32);
});

test('automatic all-air search actually fits middle allocations under the same budget',()=>{
 const p=prismFixture('mirrors'),problem={...defaultProblem(p),maxParts:4,maxGenerated:4};problem.tolerance={...problem.tolerance,portPosition:[0,0,0],portAngle:[0,0,0],componentPosition:[0,0,0],componentAngle:[0,0,0]};
 const r=searchSynthesis(p,problem,{...defaultRouting(),parts:{lens:1,mirror:2,prism:0}},{...defaultSynthesis(),families:['mirror2'],lensMount:'free',lensPlacement:'all-air',clearRadius:[.0008,.0008],budget:512,geometryBudget:8,fitBudget:16});
 expect(r.allocationCoverage.interiorTested).toBeGreaterThan(0);expect(r.evaluated).toBeLessThanOrEqual(512);
 expect(r.candidates.length).toBeGreaterThan(0);for(const c of r.candidates)expect(()=>applySynthesis(p,r,c.id)).not.toThrow();
});

test('generated two-Prism candidate agrees with the independent vector spectrum for TE and TM',async()=>{
 const {oracle}=await import('./prismOracle'),{solveFoldedGaussian}=await import('../src/project/foldedGaussian');
 for(const polarization of ['TE','TM'] as const){
  const p=task();if(p.model.kind==='surface'){p.model.sourceMode.polarization=polarization;p.model.targetMode.polarization=polarization;}
  const {problem,routing,o}=settings(p),r=searchSynthesis(p,problem,routing,o),c=r.candidates.find(c=>c.qualified)!;expect(c).toBeDefined();
  const beam=solveFoldedGaussian(c.project);expect(beam.status).toBe('valid');if(beam.status==='valid'){
   const fine=oracle(c.project,beam.incident.q,96,7),wide=oracle(c.project,beam.incident.q,128,9);expect(Math.abs(fine-wide)).toBeLessThan(1e-9);expect(Math.abs(c.eta!-wide)).toBeLessThan(2e-4);
  }
 }
},30000);

test('incompatible Prism manufacturing bounds do not suppress a feasible Mirror family',()=>{
 const p=task(),{problem,o}=settings(p),routing={...defaultRouting(),parts:{lens:0,mirror:2,prism:2}};
 const r=searchSynthesis(p,problem,routing,{...o,families:['prism2','mirror2'],prismLeg:[.004,.005],budget:64,geometryBudget:16});expect(r.candidates.some(c=>c.topology==='mirror2')).toBe(true);expect(r.candidates.some(c=>c.topology==='prism2')).toBe(false);
});
