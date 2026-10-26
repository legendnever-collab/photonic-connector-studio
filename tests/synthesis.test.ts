import {test,expect,beforeAll} from 'vitest';
import type {SynthesisResult} from '../src/synthesis/engine';
import {newPhysicalProject} from '../src/authoring/commands';
import {applySmfReference} from '../src/authoring/smf';
import {withPortWorld} from '../src/routing/model';
import {pose} from '../src/surface/model';
import {defaultProblem} from '../src/design/engine';
import {defaultRouting} from '../src/routing/contract';
import {defaultSynthesis} from '../src/synthesis/contract';
import {searchSynthesis,applySynthesis} from '../src/synthesis/engine';
import {serializeProject} from '../src/project/model';
export function blank(x=.01,z=.005){return withPortWorld(applySmfReference(newPhysicalProject(),'target'),'target',pose(x,0,z));}
const p=blank(),problem={...defaultProblem(p),maxParts:4,maxGenerated:4},routing={...defaultRouting(),bounds:{min:{x:0,y:-.003,z:-.002},max:{x:.01,y:.003,z:.007}}},o=defaultSynthesis(),before=serializeProject(p);let r:SynthesisResult;
beforeAll(()=>{r=searchSynthesis(p,problem,routing,o);},120000);
test('blank 5 mm offset generates Lens/Mirror structure and matches the fixed SMF Mode',()=>{

 expect(serializeProject(p)).toBe(before);expect(r.candidates.some(c=>c.qualified)).toBe(true);expect(r.refinements).toBeGreaterThan(0);const c=r.candidates.find(c=>c.qualified)!;expect(c.eta).toBeGreaterThan(.9);expect(()=>applySynthesis(p,r,c.id)).not.toThrow();expect(r.evaluated).toBeLessThanOrEqual(o.budget);
},120000);

test('different offset sign and distances meet Mode goals within a bounded search',async()=>{
 for(const [x,z]of [[.012,-.003],[.008,.002],[.01,0]]){
  const p=blank(x,z),problem={...defaultProblem(p),maxParts:4,maxGenerated:4},o=defaultSynthesis();problem.tolerance={...problem.tolerance,portPosition:[0,0,0],portAngle:[0,0,0],componentPosition:[0,0,0],componentAngle:[0,0,0]};
  const r=searchSynthesis(p,problem,defaultRouting(),o);
  expect(r.candidates.some(c=>c.qualified),`${x}/${z} ${JSON.stringify(r.rejected)}`).toBe(true);expect(r.evaluated).toBeLessThanOrEqual(o.budget);await new Promise(resolve=>setTimeout(resolve,0));
 }
},120000);

test('Preview and Apply preserve Ports; tampered/stale settings/geometry are rejected; provenance roundtrips',async()=>{
 const {parseProject}=await import('../src/project/model'),c=r.candidates.find(c=>c.qualified)!,next=applySynthesis(p,r,c.id);
 expect(serializeProject(parseProject(serializeProject(next)))).toBe(serializeProject(next));expect(serializeProject(p)).toBe(before);
 const altered=structuredClone(p);altered.model.kind==='surface'&&(altered.model.targetMode.mfdX=10e-6);expect(()=>applySynthesis(altered,r,c.id)).toThrow('Stale');
 const changed=structuredClone(r);changed.options.clearRadius[0]*=.5;expect(()=>applySynthesis(p,changed,c.id)).toThrow('settings');
 const tamper=structuredClone(r),ct=tamper.candidates.find(v=>v.id===c.id)!;ct.values[0]+=.0001;expect(()=>applySynthesis(p,tamper,c.id)).toThrow('parameters');
 const tamper2=structuredClone(r);tamper2.candidates.find(v=>v.id===c.id)!.project.bodies=[];expect(()=>applySynthesis(p,tamper2,c.id)).toThrow();
 expect(r.candidates.some(c=>c.topology.includes('prism')&&c.eta===null&&/Prism|TIR|polarization/.test(c.reason))).toBe(true);
 expect(r.candidates.filter(c=>c.qualified).every(c=>c.oat.status!=='assessed'||c.oat.fieldAssessed===c.oat.planned)).toBe(true);
 expect(r.placementFeedback.some(c=>c.supported===2&&c.tested===2)).toBe(true);
});
test('budget, undefined field, part count, Keep-out and cancellation retain honest outcomes',async()=>{
 const unknown=newPhysicalProject(),missing=searchSynthesis(unknown,defaultProblem(unknown),defaultRouting(),o);expect(missing.status).toBe('invalid-input');expect(missing.candidates).toHaveLength(0);
 const tiny=searchSynthesis(p,problem,routing,{...o,budget:1,geometryBudget:1});expect(tiny.status).toBe('budget-exhausted');expect(tiny.evaluated).toBeLessThanOrEqual(1);
 const capped=searchSynthesis(p,{...problem,maxGenerated:0},routing,{...o,budget:64,geometryBudget:32});expect(capped.candidates).toHaveLength(0);
 const blocked=searchSynthesis(p,problem,{...routing,keepOut:[{min:{x:0,y:-1,z:-1},max:{x:.011,y:1,z:1}}]},{...o,budget:64,geometryBudget:32});expect(blocked.candidates).toHaveLength(0);
 const {searchSynthesisAsync}=await import('../src/synthesis/engine');const abort=await searchSynthesisAsync(p,problem,routing,o,{cancelled:()=>true,progress:()=>{}});expect(abort.status).toBe('cancelled');expect(abort.candidates).toHaveLength(0);expect(serializeProject(p)).toBe(before);
});
test('known four-Surface initial train can be fitted; full Surface and interval locks remain exact',async()=>{
 const {fiberLensFiberProject}=await import('../src/authoring/starter'),{searchLenses}=await import('../src/lens/search'),{prescription}=await import('../src/project/model');
 const seed=fiberLensFiberProject(),d=defaultProblem(seed),matched=searchLenses(seed,d.lens!).candidates[0].project,opt=defaultProblem(matched);opt.lens!.template='existing';opt.fixedSurfaces=[prescription(matched).surfaces[0].id];
 opt.tolerance={...opt.tolerance,portPosition:[0,0,0],portAngle:[0,0,0],componentPosition:[0,0,0],componentAngle:[0,0,0]};
 const batch=searchSynthesis(matched,opt,defaultRouting(),{...o,budget:256,fitBudget:64}),c=batch.candidates[0];expect(c).toBeDefined();const after=applySynthesis(matched,batch,c.id);expect(prescription(after).surfaces.slice(0,2)).toEqual(prescription(matched).surfaces.slice(0,2));expect(after.bodies[0]).toEqual(matched.bodies[0]);expect(c.oat.status).toBe('not-assessed');
 opt.fixedSurfaces=[];const {lensDomain,defaultLensOptions}=await import('../src/lens/domain');opt.lens=defaultLensOptions(matched,'existing');const domain=lensDomain(matched,'existing');for(const [i,v]of opt.lens.variables.entries())for(const [j,key]of (['position','front','rear','thickness'] as const).entries())v[key]=[domain.slots[i].values[j],domain.slots[i].values[j]];
 const interval=searchSynthesis(matched,opt,defaultRouting(),{...o,budget:64,fitBudget:32});expect(interval.candidates.length).toBeGreaterThan(0);const frozen=applySynthesis(matched,interval,interval.candidates[0].id);expect(prescription(frozen)).toEqual(prescription(matched));expect(frozen.bodies).toEqual(matched.bodies);
});
test('different Output direction yields a one-Mirror Mode solution; common rigid transforms preserve it',async()=>{
 const {compile,frame,compose,V}=await import('../src/surface/model'),{framePose}=await import('../src/authoring/commands'),{tensorOverlap}=await import('../src/project/tensorOverlap'),{solveFoldedGaussian}=await import('../src/project/foldedGaussian'),{prescription}=await import('../src/project/model');
 const port=pose(.005,0,.005);port.rotation.pitch=-Math.PI/2;const input=withPortWorld(blank(),'target',port),opts={...o,families:['mirror1'] as const};
 const result=searchSynthesis(input,{...defaultProblem(input),maxParts:3,maxGenerated:3},defaultRouting(),{...opts,families:[...opts.families],budget:512,geometryBudget:16,fitBudget:64}),c=result.candidates.find(c=>c.qualified);expect(c,result.reason).toBeDefined();
 const copy=structuredClone(c!.project),doc=prescription(copy),global=frame({origin:V(.002,-.003,.001),rotation:{roll:.2,pitch:.3,yaw:-.4}});
 doc.source.frame=framePose(compose(global,frame(doc.source.frame)));for(const a of doc.assemblies)if(!a.parentId)a.frame=framePose(compose(global,frame(a.frame)));
 const eta=tensorOverlap(copy),old=tensorOverlap(c!.project);expect(eta.status).toBe('valid');if(eta.status==='valid'&&old.status==='valid')expect(eta.eta).toBeCloseTo(old.eta,10);
 const beam=solveFoldedGaussian(copy);expect(beam.status).toBe('valid');expect(compile(doc).at(-1)!.world.origin).not.toEqual(compile(prescription(c!.project)).at(-1)!.world.origin);
});
test('generated folded train agrees with independent physical-q thick-interface matrices',async()=>{
 const {analyzeRouting}=await import('../src/routing/analysis'),{solveFoldedGaussian}=await import('../src/project/foldedGaussian'),{prescription}=await import('../src/project/model'),{norm,sub}=await import('../src/surface/model');
 const c=r.candidates.find(c=>c.qualified)!,d=prescription(c.project),path=analyzeRouting(c.project).path!,beam=solveFoldedGaussian(c.project);let n=1,re=0,im=Math.PI*(9.2e-6/2)**2/d.wavelength;
 for(let i=0;i<d.surfaces.length;i++){
  const s=d.surfaces[i],L=norm(sub(path.points[i+1],path.points[i]));re+=L;
  if(s.interaction==='refract'){
   const next=s.nAfter!,C=s.shape==='plane'?0:-(next-n)/(next*s.radius),D=n/next,den=(C*re+D)**2+(C*im)**2;
   const nr=(re*(C*re+D)+C*im*im)/den,ni=im*D/den;re=nr;im=ni;n=next;
  }
 }
 expect(beam.status).toBe('valid');if(beam.status==='valid'){expect(beam.incident.q[0].re).toBeCloseTo(re/n,12);expect(beam.incident.q[0].im).toBeCloseTo(im/n,12);}
});
test('resynthesis allocates new replacement IDs instead of concealing generated-part counts',async()=>{
 const {componentIds}=await import('../src/design/engine'),initial=applySynthesis(p,r,r.candidates.find(c=>c.qualified)!.id),old=new Set(componentIds(initial)),pb={...defaultProblem(initial),maxParts:4,maxGenerated:4};
 pb.tolerance={...pb.tolerance,portPosition:[0,0,0],portAngle:[0,0,0],componentPosition:[0,0,0],componentAngle:[0,0,0]};
 const batch=searchSynthesis(initial,pb,routing,{...o,families:['mirror2'],clearRadius:[.0005,.0005],budget:512,fitBudget:16,geometryBudget:16}),generated=batch.candidates.filter(c=>c.recipe.kind==='generated');
 expect(generated.length).toBeGreaterThan(0);for(const c of generated){expect(componentIds(c.project).every(id=>!old.has(id))).toBe(true);expect(()=>applySynthesis(initial,batch,c.id)).not.toThrow();}
 const blocked=searchSynthesis(initial,{...pb,maxGenerated:0},routing,{...o,families:['mirror2'],clearRadius:[.0005,.0005],budget:64,fitBudget:16,geometryBudget:16});expect(blocked.candidates.every(c=>c.recipe.kind==='existing')).toBe(true);
});
