import {test,expect} from 'vitest';
import {fiberLensFiberProject} from '../src/authoring/starter';
import {lensDesignExample} from '../src/lens/examples';
import {defaultLensOptions,lensDomain,lensValues,buildLensProject,frozenSignature,physical} from '../src/lens/domain';
import {searchLenses,searchLensesAsync,applyLensCandidate,beamMerit,lensDesignFingerprint} from '../src/lens/search';
import {LensOptionsSchema} from '../src/lens/contract';
import {solveFoldedGaussian,transformQ} from '../src/project/foldedGaussian';
import type {QTensor} from '../src/project/foldedGaussian';
import {routingExample} from '../src/routing/examples';
import {framePose} from '../src/authoring/commands';
import {frame,pose,compose,pointToWorld,norm,sub,compile} from '../src/surface/model';
import {ProjectSchema,serializeProject,parseProject,idealProject,withPrescription} from '../src/project/model';
import {analyzeRouting} from '../src/routing/analysis';
import {screenClearance} from '../src/routing/clearance';
import {rayleigh} from '../src/physics';
const starter=fiberLensFiberProject(),options=defaultLensOptions(starter,'relay2'),result=searchLenses(starter,options);
function best(){expect(result.candidates.length).toBeGreaterThan(0);return result.candidates[0];}
const close=(a:number,b:number,tol=1e-8)=>expect(Math.abs(a-b)).toBeLessThan(tol*Math.max(Math.abs(a),Math.abs(b),1e-20));
test('two physical Lenses match the default 10 mm SMF reference within size / phase goals',()=>{
 const c=best(),r=solveFoldedGaussian(c.project);expect(c.merit.goalsMet).toBe(true);expect(c.merit.sizeError).toBeLessThan(.001);expect(c.merit.phaseError).toBeLessThan(.001);expect(r.status).toBe('valid');if(r.status!=='valid')return;expect(r.apertureLimited).toBe(false);c.merit.diameters.forEach(w=>close(w,9.2e-6,.001));expect(result.evaluated).toBeLessThanOrEqual(options.budget);
 const route=analyzeRouting(c.project);expect(route.withinTolerance).toBe(true);expect(screenClearance(c.project,physical(c.project).assemblies.filter(a=>a.kind==='lens').map(a=>a.id),route.path!,options.clearance)).toBeNull();
});
test('Preview is read-only; Apply preserves Ports, material / apertures, hierarchy, source fields and non-variable state',()=>{
 const before=serializeProject(starter),domain=lensDomain(starter,'relay2'),c=best(),next=applyLensCandidate(starter,result,c.id);expect(serializeProject(starter)).toBe(before);
 expect(frozenSignature(next,domain)).toBe(frozenSignature(domain.base,domain));expect(next.authoring).toEqual(starter.authoring);expect(next.sourceBody).toEqual(starter.sourceBody);expect(next.targetBody).toEqual(starter.targetBody);expect(physical(next).surfaces.at(-1)).toEqual(physical(starter).surfaces.at(-1));
 expect(next.routing!.lensSolution!.goalsMet).toBe(true);expect(next.routing!.lensSolution!.designFingerprint).toBe(lensDesignFingerprint(next));expect(next.model.kind==='surface'&&next.model.targetMode).toEqual(starter.model.kind==='surface'&&starter.model.targetMode);
 expect(parseProject(serializeProject(next))).toEqual(next);const changed=withPrescription(next,{...physical(next),wavelength:1550e-9});expect(lensDesignFingerprint(changed)).not.toBe(next.routing!.lensSolution!.designFingerprint);
});
test('complex-Q merit equals an independent scalar Gaussian mismatch and has a unique matched zero',()=>{
 const p=fiberLensFiberProject(),r=solveFoldedGaussian(p);if(r.status!=='valid')throw Error(r.reason);const z=rayleigh(4.6e-6,physical(p).wavelength);
 for(const [real,imag]of [[0,z],[3*z,2*z],[-2*z,.5*z]]){
  const q:QTensor=[{re:real,im:imag},{re:0,im:0},{re:0,im:0},{re:real,im:imag}],modified={...r,incident:{...r.incident,q}},m=beamMerit(modified,p,options),expected=Math.sqrt((real*real+(imag-z)**2)/(imag*z));
  if(expected===0)expect(m.score).toBeCloseTo(0,12);else close(m.score,expected);expect(m.goalsMet).toBe(expected===0);
 }
});
test('a rotated elliptical reference is compared in Output YZ, including cross-axis covariance',()=>{
 const p=fiberLensFiberProject();if(p.model.kind!=='surface')throw Error('Physical');p.model.targetMode.mfdX=20e-6;p.model.targetMode.mfdY=40e-6;
 const r=solveFoldedGaussian(p);if(r.status!=='valid')throw Error(r.reason);const z1=rayleigh(10e-6,r.wavelength),z2=rayleigh(20e-6,r.wavelength),q:QTensor=[{re:0,im:z1},{re:0,im:0},{re:0,im:0},{re:0,im:z2}];
 const exact=beamMerit({...r,incident:{...r.incident,q}},p,options);expect(exact.goalsMet).toBe(true);
 const rotated=transformQ(q,[Math.SQRT1_2,Math.SQRT1_2,-Math.SQRT1_2,Math.SQRT1_2]),m=beamMerit({...r,incident:{...r.incident,q:rotated}},p,options);expect(m.goalsMet).toBe(false);expect(m.sizeError).toBeGreaterThan(.4);
});
test('existing one-Lens search improves the reference but never labels an unmet goal as a solution',()=>{
 const o=defaultLensOptions(starter,'existing');o.budget=512;const r=searchLenses(starter,o);expect(r.candidates.length).toBeGreaterThan(0);expect(r.candidates[0].merit.score).toBeLessThan(r.baseline!.score);expect(r.candidates.every(c=>!c.merit.goalsMet)).toBe(true);expect(r.reason).toContain('not met');
});
test('folded design keeps both Mirrors and PIC reference fixed, with real body clearance and no device efficiency',()=>{
 const p=lensDesignExample(),o=defaultLensOptions(p,'relay2'),r=searchLenses(p,o),c=r.candidates[0];expect(c?.merit.goalsMet).toBe(true);expect(analyzeRouting(c.project).withinTolerance).toBe(true);
 const next=applyLensCandidate(p,r,c.id),old=physical(p),d=physical(next);expect(d.surfaces.filter(s=>s.interaction==='reflect')).toEqual(old.surfaces.filter(s=>s.interaction==='reflect'));expect(d.assemblies.filter(a=>a.kind==='mirror')).toEqual(old.assemblies.filter(a=>a.kind==='mirror'));expect(d.surfaces.at(-1)).toEqual(old.surfaces.at(-1));expect(next.authoring).toEqual(p.authoring);
 const beam=solveFoldedGaussian(next);expect(beam.status).toBe('valid');if(beam.status==='valid'){expect(beam.overlapReason).toContain('PIC receiving field is undefined');expect('overlap' in beam).toBe(false);}
});
test('frozen bounds perform one distinct trial and survive schema / SaveLoad without filling old v1 Projects',()=>{
 const p=applyLensCandidate(starter,result,best().id),o=defaultLensOptions(p,'existing'),domain=lensDomain(p,'existing');o.variables=o.variables.map((v,i)=>({...v,...Object.fromEntries(['position','front','rear','thickness'].map((key,j)=>[key,[domain.slots[i].values[j],domain.slots[i].values[j]]]))}));
 const r=searchLenses(p,o);expect(r.evaluated).toBe(1);expect(r.status).toBe('completed');expect(r.candidates[0].values).toEqual(lensValues(domain));expect(LensOptionsSchema.parse(o)).toEqual(o);expect(ProjectSchema.parse(starter)).not.toHaveProperty('routing.lensSolution');
});
test('stale and tampered previews cannot change fixed conditions, exceed bounds or bypass revalidation',()=>{
 const p=structuredClone(starter);physical(p).source.frame.origin.y=1e-6;expect(()=>applyLensCandidate(p,result,best().id)).toThrow(/Stale/);
 const tampered=structuredClone(result);physical(tampered.candidates[0].project).source.radius*=2;expect(()=>applyLensCandidate(starter,tampered,tampered.candidates[0].id)).toThrow(/tampered|fixed/);
 const over=structuredClone(result);over.candidates[0].values[0]=2;expect(()=>applyLensCandidate(starter,over,over.candidates[0].id)).toThrow(/bounds/);
 const editedMerit=structuredClone(result);editedMerit.candidates[0].merit.score=42;const applied=applyLensCandidate(starter,editedMerit,editedMerit.candidates[0].id);expect(applied.routing!.lensSolution!.score).not.toBe(42);
});
test('tiny fixed Mirror apertures yield no retained feasible candidate rather than fictitious coupling',()=>{
 const p=routingExample('mirrors');p.routing!.bounds=null;const o=defaultLensOptions(p,'relay2');o.budget=128;const r=searchLenses(p,o);expect(r.candidates).toHaveLength(0);expect(r.reason).toContain('not proof');expect(Object.keys(r.rejected).some(k=>k.includes('Aperture'))).toBe(true);
});
test('budget exhaustion, cancellation, missing references, part limits and invalid bounds are distinct',async()=>{
 const small={...options,budget:1},r=searchLenses(starter,small);expect(r.status).toBe('budget-exhausted');expect(r.evaluated).toBe(1);
 const cancelled=await searchLensesAsync(starter,options,{cancelled:()=>true});expect(cancelled.status).toBe('cancelled');expect(cancelled.candidates).toEqual([]);
 const missing=structuredClone(starter);if(missing.model.kind==='surface')missing.model.targetMode.mfdX=null;expect(searchLenses(missing,options)).toMatchObject({status:'unsupported',reason:expect.stringContaining('Output Gaussian')});
 const invalid=structuredClone(options);invalid.variables[0].position=[.009,.001];expect(searchLenses(starter,invalid).status).toBe('unsupported');
 const limited=structuredClone(starter);limited.routing={version:1,positionTolerance:1e-6,angleTolerance:.001,bounds:null,keepOut:[],parts:{lens:1,mirror:2,prism:1}};expect(searchLenses(limited,options)).toMatchObject({status:'unsupported',reason:expect.stringContaining('part limit')});
 expect(searchLenses(idealProject(),options).status).toBe('unsupported');
});
test('source contracts, higher-order Lens shapes, arrays and unclosed routing are explicit unsupported domains',()=>{
 const p=structuredClone(starter);p.authoring!.ports.source.phase='unspecified';expect(searchLenses(p,options)).toMatchObject({status:'unsupported',reason:expect.stringContaining('Port phase')});
 const asphere=structuredClone(starter);physical(asphere).surfaces[0].shape='even-asphere';physical(asphere).surfaces[0].conic=-1;expect(searchLenses(asphere,options)).toMatchObject({status:'unsupported',reason:expect.stringContaining('Sphere / Plane')});
 const array=structuredClone(starter);physical(array).source.channels.rows=3;expect(searchLenses(array,options)).toMatchObject({status:'unsupported',reason:expect.stringContaining('Single-channel')});
 expect(searchLenses(routingExample('search'),options)).toMatchObject({status:'unsupported',reason:expect.stringContaining('chief route')});
});
test('hierarchical rigid transforms preserve parameter rebuilding, frames, objective and Port geometry',()=>{
 const p=applyLensCandidate(starter,result,best().id),baseDomain=lensDomain(p,'existing'),values=lensValues(baseDomain),original=solveFoldedGaussian(p),d=physical(p),g=frame(pose(.02,-.03,.01,.7,-.4,.3));
 d.source.frame=framePose(compose(g,frame(d.source.frame)));d.assemblies=d.assemblies.map(a=>({...a,parentId:'Global'}));d.assemblies.push({id:'Global',name:'Global',kind:'group',parentId:null,frame:framePose(g)});
 const domain=lensDomain(p,'existing'),rebuilt=buildLensProject(domain,values),beam=solveFoldedGaussian(rebuilt);expect(beam.status).toBe('valid');if(beam.status!=='valid'||original.status!=='valid')return;
 beam.incident.beam.radii.forEach((w,i)=>close(w,original.incident.beam.radii[i]));expect(norm(sub(beam.incident.point,pointToWorld(g,original.incident.point)))).toBeLessThan(1e-13);
 const moved=[...values];moved[0]+=.0001;const shifted=buildLensProject(domain,moved),world=compile(physical(shifted))[0].world,old=compile(d)[0].world;expect(norm(sub(world.origin,old.origin))).toBeCloseTo(.0001,12);
});
test('cooperative and synchronous fixed-bound runs agree; low-sampling solver does not change physics',async()=>{
 const p=applyLensCandidate(starter,result,best().id),domain=lensDomain(p,'existing'),o=defaultLensOptions(p,'existing');o.variables=o.variables.map((v,i)=>({...v,...Object.fromEntries(['position','front','rear','thickness'].map((key,j)=>[key,[domain.slots[i].values[j],domain.slots[i].values[j]]]))}));expect(await searchLensesAsync(p,o)).toEqual(searchLenses(p,o));
 const full=solveFoldedGaussian(p),fast=solveFoldedGaussian(p,{sampleSegments:false});expect(full.status).toBe('valid');expect(fast.status).toBe('valid');if(full.status==='valid'&&fast.status==='valid'){expect(fast.incident).toEqual(full.incident);expect(fast.surfaces).toEqual(full.surfaces);}
});
