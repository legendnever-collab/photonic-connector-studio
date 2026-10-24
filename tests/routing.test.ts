import {expect,test} from 'vitest';
import {routingExample} from '../src/routing/examples';
import {analyzeRouting} from '../src/routing/analysis';
import {portWorld,withPortWorld,withPortDevice,directionPose} from '../src/routing/model';
import {RoutingSchema,defaultRouting} from '../src/routing/contract';
import {fiberLensFiberProject} from '../src/authoring/starter';
import {framePose} from '../src/authoring/commands';
import {ProjectSchema,serializeProject,parseProject,idealProject} from '../src/project/model';
import {solvePhysicalGaussian} from '../src/project/physicalGaussian';
import {projectTrace} from '../src/project/compute';
import {frame,pose,V,norm,sub,compose,vectorToWorld,pointToWorld} from '../src/surface/model';
import type {Project} from '../src/project/model';
function physical(p:Project){if(p.model.kind!=='surface')throw Error('Expected Physical');return p.model.prescription;}
test.each(['mirrors','prism'] as const)('%s reference: exact 60 µm rise, finite-body reach and correct global incidence',which=>{
 const p=routingExample(which),d=physical(p),r=analyzeRouting(p),trace=projectTrace(p);
 expect(r.status).toBe('evaluated');expect(r.withinTolerance).toBe(true);expect(r.positionError).toBeLessThan(1e-14);expect(r.angleError).toBeLessThan(1e-12);
 expect(d.source.frame.origin.z).toBe(-10e-6);expect(portWorld(p,'target').origin.z).toBe(50e-6);
 expect(r.path!.hits.at(-1)!.direction.x).toBeCloseTo(which==='mirrors'?1:0,13);
 expect(r.path!.hits.at(-1)!.direction.z).toBeCloseTo(which==='prism'?1:0,13);
 expect(trace.status).toBe('valid');expect(trace.reached).toBe(trace.paths.length);
 const n=d.surfaces[0].nAfter!,glass=.0005;
 // Normal entry/exit chief; no geometrical path invented from World X differences after a fold.
 const expected=which==='mirrors'?.01+60e-6+(n-1)*glass:.00404+60e-6+(n-1)*(glass+80e-6);
 expect(r.path!.opl).toBeCloseTo(expected,13);
});
test('reference ray is independent of pupil sample radius/count and mode MFD',()=>{
 const p=routingExample('mirrors'),before=analyzeRouting(p),d=physical(p);
 d.source.radius=10e-6;d.source.samples=1;
 if(p.model.kind==='surface')p.model.sourceMode.mfdX=100e-6;
 const after=analyzeRouting(p);expect(after.path).toEqual(before.path);expect(after.positionError).toBe(before.positionError);expect(after.fingerprint).not.toBe(before.fingerprint);
});
test('Output global position editor preserves parent hierarchy, surface IDs and unrelated optics',()=>{
 const p=routingExample('mirrors'),d=physical(p),old=structuredClone(d),global=pose(.002,.003,-.001,.5,-.3,.2);
 d.assemblies.push({id:'Parent',name:'Parent',parentId:null,kind:'group',frame:global});d.assemblies.at(-2)!.parentId='Parent';
 const expected=pose(.007,-.002,.00004,-.6,.4,.8),next=withPortWorld(p,'target',expected),actual=portWorld(next,'target'),want=frame(expected);
 expect(norm(sub(actual.origin,want.origin))).toBeLessThan(1e-14);
 actual.axes.forEach((a,i)=>expect(norm(sub(a,want.axes[i]))).toBeLessThan(1e-14));
 expect(physical(next).assemblies).toEqual(d.assemblies);expect(physical(next).surfaces.slice(0,-1)).toEqual(old.surfaces.slice(0,-1));expect(physical(next).surfaces.at(-1)!.id).toBe(old.surfaces.at(-1)!.id);
});
test.each(['+X','-X','+Y','-Y','+Z','-Z'] as const)('direction preset %s retains roll and gives the chosen global axis',axis=>{
 const p=directionPose(pose(.01,.02,.03,.4,.3,.7),axis),d=frame(p).axes[0],index='XYZ'.indexOf(axis[1]);
 expect([d.x,d.y,d.z][index]).toBeCloseTo(axis[0]==='+'?1:-1,14);expect(p.rotation.roll).toBe(.7);expect(p.origin).toEqual(V(.01,.02,.03));
});
test('independent target displacement/angle diagnostics do not move optics',()=>{
 const p=routingExample('mirrors'),target=framePose(portWorld(p,'target')),before=structuredClone(physical(p));
 const moved=withPortWorld(p,'target',{...target,origin:{...target.origin,y:3e-6,z:target.origin.z+4e-6}}),r=analyzeRouting(moved);
 expect(r.positionError).toBeCloseTo(5e-6,14);expect(r.offset!.y).toBeCloseTo(-3e-6,14);expect(r.offset!.z).toBeCloseTo(-4e-6,14);expect(r.withinTolerance).toBe(false);
 const tilted=withPortWorld(p,'target',{...target,rotation:{...target.rotation,yaw:Math.PI/180}}),a=analyzeRouting(tilted);expect(a.angleError).toBeCloseTo(Math.PI/180,13);expect(a.withinTolerance).toBe(false);
 expect(physical(p)).toEqual(before);
});
test('wrong-side Output is a 180° incidence mismatch even if its plane is reached',()=>{
 const p=routingExample('mirrors'),world=framePose(portWorld(p,'target')),r=analyzeRouting(withPortWorld(p,'target',directionPose(world,'-X')));
 expect(r.status).toBe('evaluated');expect(r.angleError).toBeCloseTo(Math.PI,14);expect(r.withinTolerance).toBe(false);
});
test('arbitrary rigid rotation/translation preserves errors and OPL for folded paths',()=>{
 const p=routingExample('prism'),d=physical(p),baseline=analyzeRouting(p),g=frame(pose(.02,-.03,.01,.7,-.4,.3));
 d.source.frame=framePose(compose(g,frame(d.source.frame)));
 d.assemblies.push({id:'Global',name:'Global',kind:'group',parentId:null,frame:framePose(g)});
 d.assemblies=d.assemblies.map(a=>a.id!=='Global'&&!a.parentId?{...a,parentId:'Global'}:a);p.routing!.bounds=null;
 const r=analyzeRouting(p);expect(r.status).toBe('evaluated');expect(r.positionError).toBeLessThan(1e-14);expect(r.angleError).toBeLessThan(1e-12);expect(r.path!.opl).toBeCloseTo(baseline.path!.opl,13);
 baseline.path!.points.forEach((v,i)=>expect(norm(sub(r.path!.points[i],pointToWorld(g,v)))).toBeLessThan(1e-14));
 expect(norm(sub(r.path!.hits.at(-1)!.direction,vectorToWorld(g,V(0,0,1))))).toBeLessThan(1e-12);
});
test('finite aperture failure, wrong medium and unmet TIR retain explicit termination',()=>{
 const p=routingExample('mirrors'),d=physical(p);d.surfaces.find(s=>s.id==='M2')!.frame.origin.y=100e-6;
 expect(analyzeRouting(p).status).toBe('blocked');expect(analyzeRouting(p).reason).toMatch(/clipping/);
 const p2=routingExample('prism'),d2=physical(p2);d2.surfaces.find(s=>s.id==='P-TIR')!.outsideIndex=1.49;
 expect(analyzeRouting(p2).reason).toContain('TIR condition not met');
 d2.source.n=1.1;expect(analyzeRouting(p2).reason).toContain('medium mismatch');
});
test('Design Space, keep-out AABB and part count checks affect feasibility without inventing a collision proof',()=>{
 const p=routingExample('mirrors');p.routing!.parts.mirror=1;let r=analyzeRouting(p);expect(r.issues).toContain('mirror: part limit exceeded');expect(r.withinTolerance).toBe(false);
 p.routing!.parts.mirror=2;p.routing!.bounds!.max.x=.003;r=analyzeRouting(p);expect(r.issues.some(x=>x.includes('outside Design Space'))).toBe(true);
 p.routing!.bounds=null;p.routing!.keepOut=[{min:V(.0039,-.0001,-.0001),max:V(.0041,.0001,.0001)}];r=analyzeRouting(p);expect(r.issues.some(x=>x.includes('potential Keep-out'))).toBe(true);expect(r.constraintChecks.join(' ')).toContain('Full solid collision / segment clearance not calculated');
});
test('limits schema rejects inverted boxes, fractional counts and zero tolerances',()=>{
 const r=defaultRouting();expect(RoutingSchema.safeParse({...r,positionTolerance:0}).success).toBe(false);expect(RoutingSchema.safeParse({...r,parts:{...r.parts,lens:1.5}}).success).toBe(false);
 expect(RoutingSchema.safeParse({...r,bounds:{min:V(1),max:V()}}).success).toBe(false);
});
test('old v1 JSON gains no routing or device defaults; new settings roundtrip exactly',()=>{
 const p=fiberLensFiberProject();delete p.authoring!.ports.source.device;delete p.authoring!.ports.target.device;
 const raw=serializeProject(p);expect(serializeProject(parseProject(raw))).toBe(raw);expect(parseProject(raw).routing).toBeUndefined();expect(parseProject(raw).authoring!.ports.target.device).toBeUndefined();
 const next=routingExample('prism');expect(parseProject(serializeProject(next))).toEqual(next);expect(ProjectSchema.parse(next)).toEqual(next);
});
test('PIC device classification removes Fiber body/preset but retains user mode; Gaussian does not claim PIC efficiency',()=>{
 const p=fiberLensFiberProject(),q=withPortDevice(p,'target','pic-grating');expect(q.targetBody).toBeNull();expect(q.authoring!.ports.target.preset).toBeUndefined();
 expect(q.model).toEqual(p.model);const result=solvePhysicalGaussian(q);expect(result.status).toBe('valid');if(result.status==='valid'){expect(result.overlap.status).toBe('not-calculated');if(result.overlap.status!=='valid')expect(result.overlap.reason).toContain('PIC receiving Field');}
});
test('no geometric metrics for invalid body, curved Output or multichannel input',()=>{
 expect(analyzeRouting(idealProject()).status).toBe('unavailable');
 const p=routingExample('mirrors');physical(p).source.channels.rows=3;expect(analyzeRouting(p).reason).toContain('Single-channel');
 physical(p).source.channels.rows=1;physical(p).surfaces.at(-1)!.shape='sphere';expect(analyzeRouting(p).positionError).toBeNull();
 const q=routingExample('prism');physical(q).surfaces.find(s=>s.id==='P-TIR')!.shape='sphere';expect(analyzeRouting(q).status).toBe('unavailable');
});
