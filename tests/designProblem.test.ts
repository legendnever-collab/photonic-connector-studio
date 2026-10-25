import {test,expect} from 'vitest';
import {fiberLensFiberProject} from '../src/authoring/starter';
import {routingExample} from '../src/routing/examples';
import {defaultRouting} from '../src/routing/contract';
import {defaultProblem,problemProject,assessDesign,runProblem,applyProblemCandidate,componentIds} from '../src/design/engine';
import {ProblemSchema} from '../src/design/contract';
import {ProjectSchema,serializeProject,parseProject,prescription} from '../src/project/model';
import {defaultLensOptions,lensDomain,lensValues,buildLensProject} from '../src/lens/domain';
import {searchLenses} from '../src/lens/search';
import {solvePhysicalGaussian} from '../src/project/physicalGaussian';
const starter=fiberLensFiberProject(),defaults=defaultProblem(starter),route=defaultRouting();
const nominalFit=searchLenses(starter,defaults.lens!);
const matched=nominalFit.candidates[0].project;
function zero(){return {portPosition:[0,0,0] as [number,number,number],portAngle:[0,0,0] as [number,number,number],componentPosition:[0,0,0] as [number,number,number],componentAngle:[0,0,0] as [number,number,number]};}
test('Problem is optional strict v1 state and exact JSON roundtrips without migrating old files',()=>{
 expect(parseProject(serializeProject(starter)).designProblem).toBeUndefined();const p=problemProject(starter,defaults,route);expect(parseProject(serializeProject(p))).toEqual(p);expect(ProblemSchema.safeParse({...defaults,extra:true}).success).toBe(false);expect(ProblemSchema.safeParse({...defaults,maxParts:1.5}).success).toBe(false);expect(ProblemSchema.safeParse({...defaults,tolerance:{...defaults.tolerance,portPosition:[-1,0,0]}}).success).toBe(false);
});
test('matched current four-Surface Project has real conditional scalar overlap and OAT endpoints degrade it',async()=>{
 const o=defaultProblem(matched);o.tolerance={...o.tolerance,...zero(),portPosition:[0,1e-6,0]};const before=serializeProject(matched),r=await assessDesign(matched,o);
 expect(componentIds(matched)).toHaveLength(2);expect(prescription(matched).surfaces.slice(0,-1)).toHaveLength(4);expect(r.nominal.referenceGoals).toBe(true);expect(r.nominal.eta).toBeGreaterThan(.99);expect(r.planned).toBe(4);expect(r.status).toBe('assessed');expect(r.worstEta).toBeLessThan(r.nominal.eta!);expect(r.fieldAssessed).toBe(4);expect(serializeProject(matched)).toBe(before);
 const independent=solvePhysicalGaussian(matched);expect(independent.status==='valid'&&independent.overlap.status==='valid'&&independent.overlap.eta).toBe(r.nominal.eta);
});
test('zero tolerances and incomplete case caps never claim robustness or Yield',async()=>{
 const o=defaultProblem(matched);o.tolerance={...o.tolerance,...zero()};const none=await assessDesign(matched,o);expect(none.status).toBe('not-assessed');expect(none.qualified).toBe(false);
 o.tolerance.portPosition=[1e-6,1e-6,1e-6];o.tolerance.maxCases=1;const partial=await assessDesign(matched,o);expect(partial.planned).toBe(12);expect(partial.tested).toBe(1);expect(partial.status).toBe('partial');expect(partial.qualified).toBe(false);
});
test('folded PIC and unsupported Lens tilt stay partial rather than invented Gaussian coupling',async()=>{
 const p=routingExample('prism'),o=defaultProblem(p);o.tolerance={...o.tolerance,...zero(),portPosition:[0,1e-7,0]};const r=await assessDesign(p,o);expect(r.nominal.eta).toBeNull();expect(r.status).toBe('partial');expect(r.qualified).toBe(false);expect(r.fieldAssessed).toBe(0);
 const m=defaultProblem(matched);m.tolerance={...m.tolerance,...zero(),componentAngle:[0,.001,0]};const tilted=await assessDesign(matched,m);expect(tilted.status).toBe('partial');expect(tilted.fieldAssessed).toBeLessThan(tilted.planned);
});
test('fully frozen Lens values preserve exact source local frames and Surface rows',()=>{
 const domain=lensDomain(starter,'existing');expect(serializeProject(buildLensProject(domain,lensValues(domain)))).toBe(serializeProject(domain.base));
 expect(()=>buildLensProject(domain,[-1,...lensValues(domain).slice(1)])).toThrow('outside');
});
test('current Project Lens bounds, full Surface locks, Apply and stale guards are enforced',async()=>{
 const o=defaultProblem(starter);o.lens=defaultLensOptions(starter,'existing');o.lens.budget=1;o.fixedSurfaces=[prescription(starter).surfaces[0].id];o.tolerance={...o.tolerance,...zero(),portPosition:[0,1e-7,0]};
 const r=await runProblem(starter,o,route,'search');expect(r.candidates.length,r.reason).toBeGreaterThan(0);expect(r.candidates[0].project.model).toEqual(starter.model);const applied=applyProblemCandidate(starter,r,r.candidates[0].id);expect(applied.model).toEqual(starter.model);expect(applied.designProblem).toEqual(o);expect(parseProject(serializeProject(applied))).toEqual(applied);
 const changed=structuredClone(starter);prescription(changed).name+=' edited';expect(()=>applyProblemCandidate(changed,r,r.candidates[0].id)).toThrow('Stale');const tamper=structuredClone(r);tamper.lensBatch!.options.variables[0].front=[-500,500];expect(()=>applyProblemCandidate(starter,tamper,r.candidates[0].id)).toThrow('bounds');
},15000);
test('new / total part limits, Keep-out and removal of locked rows reject otherwise valid candidates',async()=>{
 const p=routingExample('search'),o=defaultProblem(p);o.strategy='route';o.routes.templates=['mirror2'];o.routes.budget=64;o.tolerance={...o.tolerance,...zero()};
 let r=await runProblem(p,{...o,maxGenerated:0},p.routing!,'search');expect(r.candidates).toHaveLength(0);expect(r.rejected.join(' ')).toContain('component limit');
 const allowed=await runProblem(p,o,p.routing!,'search');expect(allowed.candidates.length,allowed.reason).toBeGreaterThan(0);const before=serializeProject(p),next=applyProblemCandidate(p,allowed,allowed.candidates[0].id);expect(next.authoring).toEqual(p.authoring);expect(serializeProject(p)).toBe(before);
 const locked={...o,fixedSurfaces:[prescription(p).surfaces.find(s=>s.interaction==='reflect')!.id]};r=await runProblem(p,locked,p.routing!,'search');expect(r.candidates).toHaveLength(0);expect(r.rejected.join(' ')).toContain('Fixed Surface');
 const bounded={...route,bounds:{min:{x:.002,y:-.01,z:-.01},max:{x:.003,y:.01,z:.01}}};const l=defaultProblem(starter);l.lens!.budget=1;r=await runProblem(starter,l,bounded,'search');expect(r.candidates).toHaveLength(0);
},15000);
test('assessment is read-only and cancellation discards candidate previews',async()=>{
 const before=serializeProject(matched),o=defaultProblem(matched);const r=await runProblem(matched,o,route,'assessment');expect(r.candidates).toHaveLength(1);expect(()=>applyProblemCandidate(matched,r,'current')).toThrow('unavailable');expect(serializeProject(matched)).toBe(before);
 const aborted=await runProblem(starter,defaults,route,'search',{cancelled:()=>true});expect(aborted.status).toBe('cancelled');expect(aborted.candidates).toHaveLength(0);
 const over=await assessDesign(matched,{...o,maxParts:0});expect(over.nominal.routeOK).toBe(false);expect(over.qualified).toBe(false);expect(ProjectSchema.parse(matched)).toEqual(matched);
},15000);
