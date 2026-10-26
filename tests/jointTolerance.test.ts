import {test,expect} from 'vitest';
import {assessJoint,defaultJointTolerance,jointAxes,jointComponents,jointSamples,perturbJoint} from '../src/design/joint';
import {JointToleranceSchema} from '../src/design/jointContract';
import type {JointTolerance} from '../src/design/jointContract';
import {defaultProblem,problemProject} from '../src/design/engine';
import {ProjectSchema,prescription,serializeProject,parseProject} from '../src/project/model';
import {newPhysicalProject,framePose} from '../src/authoring/commands';
import {applySmfReference} from '../src/authoring/smf';
import {fiberLensFiberProject} from '../src/authoring/starter';
import {defaultRouting} from '../src/routing/contract';
import {portWorld,withPortWorld} from '../src/routing/model';
import {compile,frame,pose,pointToLocal,vectorToLocal} from '../src/surface/model';
import type {Vec} from '../src/surface/model';
import {tensorOverlap} from '../src/project/tensorOverlap';
import {prismFixture} from './prismFixtures';

function blank(){const p=applySmfReference(newPhysicalProject(),'target');if(p.model.kind!=='surface')throw Error();p.model.sourceMode.mfdX=p.model.sourceMode.mfdY=p.model.targetMode.mfdX=p.model.targetMode.mfdY=100e-6;p.sourceBody=p.targetBody=null;p.routing={...defaultRouting(),positionTolerance:1e-3,angleTolerance:.05};return p;}
function zero(p=blank()):JointTolerance{const o=defaultJointTolerance(p);o.samples=8;o.maxCases=8;o.mating.position=[0,0,0];return o;}
function near(a:Vec,b:Vec){for(const k of ['x','y','z'] as const)expect(a[k]).toBeCloseTo(b[k],12);}
// Independent explicit Rz Ry Rx matrix; does not call the frame/rotate implementation.
function rotate(v:Vec,r:number,p:number,y:number):Vec{const c=Math.cos,s=Math.sin;return {x:c(y)*c(p)*v.x+(c(y)*s(p)*s(r)-s(y)*c(r))*v.y+(c(y)*s(p)*c(r)+s(y)*s(r))*v.z,y:s(y)*c(p)*v.x+(s(y)*s(p)*s(r)+c(y)*c(r))*v.y+(s(y)*s(p)*c(r)-c(y)*s(r))*v.z,z:-s(p)*v.x+c(p)*s(r)*v.y+c(p)*c(r)*v.z};}
test('optional joint contract preserves old files; SI state roundtrips and rejects invalid declarations',()=>{
 const p=blank(),o=zero(p),problem={...defaultProblem(p),jointTolerance:o};expect(parseProject(serializeProject(p)).designProblem).toBeUndefined();
 expect(parseProject(serializeProject(problemProject(p,problem,p.routing!))).designProblem?.jointTolerance).toEqual(o);
 for(const change of [{samples:3},{samples:8.5},{seed:-1},{seed:4294967296},{maxCases:0},{extra:true},{mating:{...o.mating,ports:['target','target']}},{assembly:{position:[NaN,0,0],angle:[0,0,0]}}])expect(JointToleranceSchema.safeParse({...o,...change}).success).toBe(false);
 expect(()=>jointAxes(p,{...o,mating:{...o.mating,components:['missing']}})).toThrow('missing');
 expect(()=>jointAxes(p,{...o,mating:{...o.mating,ports:[],position:[1e-6,0,0]}})).toThrow('Select');
});
test('same seed yields bounded joint strata with opposite corners and stable named coordinates',()=>{
 const p=prismFixture('mirrors'),o=zero(p);o.samples=32;o.mating.position=[1e-6,2e-6,3e-6];o.assembly.angle=[.001,.002,.003];
 const a=jointSamples(p,o);expect(a).toEqual(jointSamples(parseProject(serializeProject(p)),o));expect(a[0].normalized.every(x=>x===-1)).toBe(true);expect(a[1].normalized.every(x=>x===1)).toBe(true);
 expect(a).not.toEqual(jointSamples(p,{...o,seed:o.seed+1}));
 for(let j=0;j<a[0].values.length;j++){const strata=a.slice(2).map(v=>Math.floor((v.normalized[j]+1)*15));expect(new Set(strata).size).toBe(30);expect(a.every(v=>Math.abs(v.normalized[j])<=1)).toBe(true);}
 const q=structuredClone(p);prescription(q).assemblies.reverse();expect(jointSamples(q,o)).toEqual(a);
 expect(a.slice(2).some(v=>v.normalized[3]!==v.normalized[6])).toBe(true);
});
test('common rigid motion uses pivot and matrix composition under rotated nested parents without editing nominal data',()=>{
 const p=prismFixture('mirrors'),d=prescription(p);d.assemblies.push({id:'Parent',name:'Parent',kind:'group',parentId:null,frame:pose(.0002,-.0003,.0004,.31,-.27,.19)});d.assemblies.find(a=>a.id==='A')!.parentId='Parent';
 const before=serializeProject(p),o=zero(p);o.mating={ports:['source','target'],components:['A'],pivot:[.001,-.002,.003],position:[3e-6,4e-6,5e-6],angle:[.01,.02,.03]};
 const q=perturbJoint(p,o,jointSamples(p,o)[1]),old=compile(d),next=compile(prescription(q));
 const check=(a:ReturnType<typeof portWorld>,b:ReturnType<typeof portWorld>)=>{const v=rotate({x:a.origin.x-.001,y:a.origin.y+.002,z:a.origin.z-.003},.01,.02,.03);near(b.origin,{x:v.x+.001+3e-6,y:v.y-.002+4e-6,z:v.z+.003+5e-6});a.axes.forEach((axis,i)=>near(b.axes[i],rotate(axis,.01,.02,.03)));};
 check(portWorld(p,'source'),portWorld(q,'source'));check(portWorld(p,'target'),portWorld(q,'target'));check(old[0].world,next[0].world);
 expect(next[1].world).toEqual(old[1].world);expect(prescription(q).assemblies.find(a=>a.id==='Parent')).toEqual(d.assemblies.find(a=>a.id==='Parent'));expect(q.bodies).toEqual(p.bodies);expect(serializeProject(p)).toBe(before);
});
test('individual assembly errors act in nominal local axes before common motion and never honor design locks as zero error',()=>{
 const p=prismFixture('mirrors'),o=zero(p);o.mating.position=[0,4e-6,0];o.mating.components=['A'];o.assembly.position=[1e-6,2e-6,3e-6];o.assembly.angle=[.001,.002,.003];
 p.designProblem=defaultProblem(p);p.designProblem.fixedSurfaces=['A-M'];const q=perturbJoint(p,o,jointSamples(p,o)[1]);
 for(const id of ['A','B']){const a=frame(prescription(p).assemblies.find(a=>a.id===id)!.frame),b=frame(prescription(q).assemblies.find(a=>a.id===id)!.frame);
  const along=(v:Vec)=>({x:a.axes[0].x*v.x+a.axes[1].x*v.y+a.axes[2].x*v.z,y:a.axes[0].y*v.x+a.axes[1].y*v.y+a.axes[2].y*v.z,z:a.axes[0].z*v.x+a.axes[1].z*v.y+a.axes[2].z*v.z});
  const t=along({x:1e-6,y:2e-6,z:3e-6});near(b.origin,{x:a.origin.x+t.x,y:a.origin.y+t.y+(id==='A'?4e-6:0),z:a.origin.z+t.z});
  [{x:1,y:0,z:0},{x:0,y:1,z:0},{x:0,y:0,z:1}].forEach((v,i)=>near(b.axes[i],along(rotate(v,.001,.002,.003))));
 }
 expect(prescription(q).surfaces.slice(0,-1)).toEqual(prescription(p).surfaces.slice(0,-1));
});
test('a shared Output leaf moves only by explicit Port membership; nested optical movers are rejected',()=>{
 const p=prismFixture('mirrors'),d=prescription(p),target=portWorld(p,'target'),b=frame(d.assemblies.find(a=>a.id==='B')!.frame);
 d.surfaces.at(-1)!.assemblyId='B';d.surfaces.at(-1)!.frame=framePose({origin:pointToLocal(b,target.origin),axes:target.axes.map(v=>vectorToLocal(b,v)) as typeof b.axes});
 const o=zero(p);o.mating.ports=[];o.mating.components=['B'];o.mating.position=[1e-6,2e-6,3e-6];o.assembly.angle=[0,.001,0];
 const q=perturbJoint(p,o,jointSamples(p,o)[1]);near(portWorld(q,'target').origin,target.origin);target.axes.forEach((v,i)=>near(portWorld(q,'target').axes[i],v));
 o.mating.ports=['target'];const r=perturbJoint(p,o,jointSamples(p,o)[1]);near(portWorld(r,'target').origin,{x:target.origin.x+1e-6,y:target.origin.y+2e-6,z:target.origin.z+3e-6});
 d.assemblies.find(a=>a.id==='B')!.parentId='A';expect(()=>jointAxes(p,o)).toThrow('leaf');
});
test('whole-system common motion preserves conditional overlap for Mirror and bounded Prism fields',()=>{
 for(const kind of ['mirrors','two'] as const){const p=prismFixture(kind),o=zero(p);o.mating={ports:['source','target'],components:jointComponents(p),pivot:[.004,.001,.002],position:[1e-5,2e-5,3e-5],angle:[.01,.02,.03]};
  const nominal=tensorOverlap(p);expect(nominal.status).toBe('valid');
  for(const sample of jointSamples(p,o)){const v=tensorOverlap(perturbJoint(p,o,sample));expect(v.status,v.status==='not-calculated'?v.reason:'').toBe('valid');if(v.status==='valid'&&nominal.status==='valid')expect(v.eta).toBeCloseTo(nominal.eta,10);}
 }
});
test('simultaneous target displacement matches independent free-space Gaussian integral and differs from OAT',async()=>{
 const p=blank(),o=zero(p);o.mating.position=[0,8e-6,11e-6];const r=await assessJoint(p,o),w=50e-6,lambda=prescription(p).wavelength,L=.01,z=Math.PI*w*w/lambda,a=1+(L/(2*z))**2;
 expect(r.status).toBe('assessed');expect(r.fieldAssessed).toBe(8);const expected=Math.exp(-(8e-6**2+11e-6**2)/(w*w*a))/a;
 expect(r.observations[0].eta).toBeCloseTo(expected,12);expect(r.observations[1].eta).toBeCloseTo(expected,12);
 expect(expected).toBeLessThan(Math.exp(-(11e-6**2)/(w*w*a))/a);
 const both={...o,mating:{...o.mating,ports:['source','target'] as ['source','target']}};const common=await assessJoint(p,both);expect(common.observations.every(v=>Math.abs(v.eta!-common.nominal.eta!)<1e-12)).toBe(true);
});
test('no error, caps, cancellation and unsupported fields cannot be qualified or treated as zero',async()=>{
 const p=blank(),o=zero(p),empty=await assessJoint(p,o);expect(empty.status).toBe('not-assessed');expect(empty.planned).toBe(0);expect(empty.meetsSampleGoals).toBe(false);
 o.mating.position=[0,1e-6,0];o.maxCases=2;const cap=await assessJoint(p,o);expect(cap.status).toBe('partial');expect(cap.tested).toBe(2);expect(cap.planned).toBe(8);expect(cap.meetsSampleGoals).toBe(false);
 let count=0;const cancelled=await assessJoint(p,{...o,maxCases:8},{cancelled:()=>count++>1});expect(cancelled.status).toBe('cancelled');expect(cancelled.tested).toBe(2);expect(cancelled.meetsSampleGoals).toBe(false);
 const lens=fiberLensFiberProject(),local=zero(lens);local.assembly.position=[0,1e-6,0];const unsupported=await assessJoint(lens,local);expect(unsupported.status).toBe('partial');expect(unsupported.fieldAssessed).toBe(0);expect(unsupported.observations.every(v=>v.eta===null)).toBe(true);expect(unsupported.issues.join(' ')).toContain('centered');
 const tilted=zero(lens);tilted.assembly.angle=[0,.001,0];expect((await assessJoint(lens,tilted)).status).toBe('partial');
 if(p.model.kind==='surface')p.model.targetMode.mfdX=null;expect((await assessJoint(p,o)).nominal.eta).toBeNull();
});
test('geometry failures stay separate from a valid field metric and invalidate sample goals',async()=>{
 const p=blank(),o=zero(p);p.routing!.positionTolerance=1e-9;o.minimumOverlap=0;o.mating.position=[0,1e-6,0];
 const before=serializeProject(p),r=await assessJoint(p,o);expect(r.status).toBe('assessed');expect(r.fieldAssessed).toBe(8);expect(r.geometryPassed).toBe(0);expect(r.meetsSampleGoals).toBe(false);expect(serializeProject(p)).toBe(before);expect(ProjectSchema.parse(p)).toEqual(p);
 const moved=withPortWorld(p,'target',pose(.011));const changed=await assessJoint(moved,o);expect(changed.inputSignature).not.toBe(r.inputSignature);expect(changed.coverage).toBe(r.coverage);
 expect((await assessJoint(p,{...o,seed:2})).coverage).not.toBe(r.coverage);
 const sample=jointSamples(p,o)[0];sample.values[0].value=1;expect(()=>perturbJoint(p,o,sample)).toThrow('bounds');
});
