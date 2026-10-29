import {test,expect} from 'vitest';
import {basicRelayReference} from '../src/authoring/basicRelay';
import {framePose} from '../src/authoring/commands';
import {withPortWorld,portWorld} from '../src/routing/model';
import {prescription,serializeProject,parseProject} from '../src/project/model';
import {compose,frame,pose,pointToWorld,norm,sub} from '../src/surface/model';
import {defaultLensOptions,lensDomain,lensValues,buildLensProject,lensBounds} from '../src/lens/domain';
import {alignLensChief} from '../src/lens/alignment';
import {searchLenses,applyLensCandidate} from '../src/lens/search';
import {analyzeRouting} from '../src/routing/analysis';
import {tensorOverlap} from '../src/project/tensorOverlap';
import {defaultProblem} from '../src/design/engine';
import {defaultSynthesis} from '../src/synthesis/contract';
import {defaultRouting} from '../src/routing/contract';
import {searchSynthesis,applySynthesis} from '../src/synthesis/engine';
import {alignedDirectSeed} from '../src/synthesis/construction';

function offset(z:number,y=0){const p=basicRelayReference(),f=framePose(portWorld(p,'target'));f.origin.z=z;f.origin.y=y;return withPortWorld(p,'target',f);}
const settings=()=>({...defaultSynthesis(),lensMount:'free' as const,lensAlignment:{decenter:.001,tilt:.02},families:['direct' as const],budget:512,fitBudget:64,geometryBudget:8});
function seed(z:number,y=0){const p=offset(z,y);return alignedDirectSeed(p,{...defaultProblem(p),maxParts:4,maxGenerated:4},settings(),.0002);}

test.each([0,1e-8,-1e-8,1e-6,-1e-6,10e-6,-10e-6,50e-6,-50e-6,100e-6,-100e-6,500e-6])('exact chief correction supports signed offset %s m without moving either Port',z=>{
 const p=seed(z,z/3),before=serializeProject(p),o=defaultLensOptions(p,'existing',true),domain=lensDomain(p,'existing',true),r=alignLensChief(domain,lensValues(domain),o),route=analyzeRouting(r.project);
 expect(route.positionError).toBeLessThan(1.01e-9);expect(route.angleError).toBeLessThan(1.01e-7);expect(route.withinTolerance).toBe(true);
 expect(prescription(r.project).source).toEqual(prescription(p).source);expect(portWorld(r.project,'target')).toEqual(portWorld(p,'target'));expect(r.project.authoring).toEqual(p.authoring);expect(serializeProject(p)).toBe(before);
 expect(serializeProject(buildLensProject(domain,r.values))).toBe(serializeProject(r.project));
 // Geometry may close outside the Gaussian field domain; never promote it.
 if(Math.abs(z)===500e-6)expect(tensorOverlap(r.project).status).toBe('not-calculated');
});

test('tilt-only correction works at 1 µm with translations frozen; bounds and immutable Lens locks are enforced',()=>{
 const p=offset(1e-6),o=defaultLensOptions(p,'existing',true);o.alignment!.decenter=0;
 const domain=lensDomain(p,'existing',true),r=alignLensChief(domain,lensValues(domain),o);
 expect(r.values.slice(8).filter((_,i)=>i%4<2)).toEqual([0,0,0,0]);expect(Math.max(...r.values.slice(8).map(Math.abs))).toBeGreaterThan(1e-4);
 expect(analyzeRouting(r.project).positionError).toBeLessThan(1e-9);expect(tensorOverlap(r.project).status).toBe('valid');
 o.alignment!.tilt=0;expect(()=>alignLensChief(domain,lensValues(domain),o)).toThrow('bounds');
 o.alignment={decenter:.001,tilt:.02,fixed:domain.slots.map(s=>s.id)};expect(()=>alignLensChief(domain,lensValues(domain),o)).toThrow('bounds');
});

test('independent vector-Snell / sphere oracle verifies the entire tilted four-surface train',()=>{
 // Deliberately do not call the application frame, normal, intersection or
 // refraction code in this oracle. Test both signed and cross-plane offsets.
 type V=[number,number,number];type F={o:V;a:[V,V,V]};
 const add=(a:V,b:V)=>a.map((v,i)=>v+b[i]) as V,scale=(a:V,t:number)=>a.map(v=>v*t) as V,dot=(a:V,b:V)=>a.reduce((s,v,i)=>s+v*b[i],0),unit=(a:V)=>scale(a,1/Math.hypot(...a));
 const vector=(f:F,p:V)=>add(add(scale(f.a[0],p[0]),scale(f.a[1],p[1])),scale(f.a[2],p[2])),local=(f:F,p:V)=>f.a.map(a=>dot(a,p)) as V;
 const make=(p:{origin:{x:number;y:number;z:number};rotation:{roll:number;pitch:number;yaw:number}}):F=>{
  const {roll:r,pitch:t,yaw:y}=p.rotation,c=Math.cos,s=Math.sin;
  const rotate=([x,v,w]:V):V=>{const b=v*c(r)-w*s(r),z=v*s(r)+w*c(r),a=x*c(t)+z*s(t);return [a*c(y)-b*s(y),a*s(y)+b*c(y),-x*s(t)+z*c(t)];};
  return {o:[p.origin.x,p.origin.y,p.origin.z],a:[rotate([1,0,0]),rotate([0,1,0]),rotate([0,0,1])]};
 };
 for(const z of [-1e-6,1e-6]){
  const p=offset(z,z/2),o=defaultLensOptions(p,'existing',true);o.alignment!.decenter=0;
  const domain=lensDomain(p,'existing',true),aligned=alignLensChief(domain,lensValues(domain),o),d=prescription(aligned.project),source=make(d.source.frame);let point=source.o,direction=source.a[0],n=1;
  for(const s of d.surfaces){
   const assembly=d.assemblies.find(a=>a.id===s.assemblyId)!;expect(assembly.parentId).toBeNull();
   const a=make(assembly.frame),b=make(s.frame),f:F={o:add(a.o,vector(a,b.o)),a:b.a.map(v=>vector(a,v)) as F['a']},p=local(f,add(point,scale(f.o,-1))),v=local(f,direction);
   let distance=-p[0]/v[0];
   if(s.shape==='sphere'){
    const oc=add(p,[-s.radius,0,0]),B=dot(oc,v),C=dot(oc,oc)-s.radius*s.radius,root=Math.sqrt(B*B-C);
    const roots=[-B-root,-B+root].filter(t=>t>0).sort((x,y)=>Math.abs(p[0]+x*v[0])-Math.abs(p[0]+y*v[0]));distance=roots[0];
   }
   const hit=add(p,scale(v,distance));point=add(f.o,vector(f,hit));
   if(s.interaction==='refract'){
    const normal=s.shape==='plane'?[1,0,0] as V:scale(add([s.radius,0,0],scale(hit,-1)),1/s.radius),ci=dot(v,normal),eta=n/s.nAfter!;
    const refracted=add(scale(v,eta),scale(normal,Math.sqrt(1-eta*eta*(1-ci*ci))-eta*ci));direction=unit(vector(f,refracted));n=s.nAfter!;
   }else {
    expect(Math.hypot(hit[1],hit[2])).toBeLessThan(1e-9);const dir=local(f,direction);expect(Math.hypot(dir[1],dir[2])).toBeLessThan(1e-7);
   }
  }
  const actual=analyzeRouting(aligned.project);expect(norm(sub(actual.path!.points.at(-1)!,{x:point[0],y:point[1],z:point[2]}))).toBeLessThan(1e-12);
 }
});

test('front-vertex coordinate contract preserves nested rotated frames, replay and tiny pose perturbations',()=>{
 const p=seed(50e-6,-10e-6),o=defaultLensOptions(p,'existing',true),base=lensDomain(p,'existing',true),r=alignLensChief(base,lensValues(base),o),g=frame(pose(.02,-.03,.01,.7,-.4,.3)),q=structuredClone(p),d=prescription(q);
 d.source.frame=framePose(compose(g,frame(d.source.frame)));d.assemblies.forEach(a=>{if(!a.parentId)a.parentId='Global';});d.assemblies.push({id:'Global',name:'Global',kind:'group',parentId:null,frame:framePose(g)});
 const domain=lensDomain(q,'existing',true),rebuilt=buildLensProject(domain,r.values),a=analyzeRouting(r.project),b=analyzeRouting(rebuilt);
 expect(norm(sub(b.path!.points.at(-1)!,pointToWorld(g,a.path!.points.at(-1)!)))).toBeLessThan(1e-12);
 expect(b.positionError).toBeLessThan(1e-9);expect(serializeProject(parseProject(serializeProject(rebuilt)))).toBe(serializeProject(rebuilt));
});

test('50 µm synthesis yields a real two-Lens candidate; frozen Ports, full validation and tamper checks survive Apply',()=>{
 const p=offset(50e-6),pb={...defaultProblem(p),maxParts:4,maxGenerated:4},o=settings(),r=searchSynthesis(p,pb,defaultRouting(),o),c=r.candidates.find(c=>c.recipe.kind==='aligned-direct'&&c.qualified);
 expect(c,JSON.stringify(r.rejected)).toBeDefined();expect(c!.eta).toBeGreaterThan(.99);expect(r.alignmentEvaluated).toBeGreaterThan(0);expect(r.evaluated).toBeLessThanOrEqual(o.budget);
 const q=applySynthesis(p,r,c!.id);expect(portWorld(q,'target')).toEqual(portWorld(p,'target'));expect(prescription(q).source).toEqual(prescription(p).source);expect(q.synthesis!.solution!.qualified).toBe(true);
 expect(prescription(q).assemblies.filter(a=>a.kind==='lens'&&prescription(q).surfaces.some(s=>s.assemblyId===a.id))).toHaveLength(2);
 const tamper=structuredClone(r),bad=tamper.candidates.find(x=>x.id===c!.id)!;bad.values[8]=.003;bad.seal=JSON.stringify([bad.recipe,bad.values]);expect(()=>applySynthesis(p,tamper,bad.id)).toThrow('bounds');
 const moved=structuredClone(r);prescription(moved.candidates.find(x=>x.id===c!.id)!.project).assemblies.at(-1)!.frame.origin.z+=1e-6;expect(()=>applySynthesis(p,moved,c!.id)).toThrow();
},30000);

test('Lens Design replay includes pose variables, rejects altered bounds and independently checks the receiving field',()=>{
 const p=offset(1e-6),o=defaultLensOptions(p,'existing',true),domain=lensDomain(p,'existing',true);o.budget=1;
 o.variables.forEach((v,i)=>{for(const [j,k]of (['position','front','rear','thickness'] as const).entries())v[k]=[domain.slots[i].values[j],domain.slots[i].values[j]];});
 const r=searchLenses(p,o),c=r.candidates[0];expect(c).toBeDefined();expect(c.values).toHaveLength(lensBounds(o).length);
 const q=applyLensCandidate(p,r,c.id);expect(tensorOverlap(q).status).toBe('valid');expect(analyzeRouting(q).withinTolerance).toBe(true);
 const edited=structuredClone(r);edited.candidates[0].values[8]=.002;expect(()=>applyLensCandidate(p,edited,c.id)).toThrow('bounds');
 const moved=structuredClone(r);prescription(moved.candidates[0].project).assemblies[0].frame.rotation.yaw+=1e-6;expect(()=>applyLensCandidate(p,moved,c.id)).toThrow(/tampered|fixed/);
});

test.each([-100e-6,100e-6])('bounded search recovers signed %s m offset at fit 256 without moving Ports',z=>{
 const p=offset(z),before=serializeProject(p),o={...defaultSynthesis(),lensMount:'free' as const,lensAlignment:{decenter:.001,tilt:.02},budget:2048,geometryBudget:32,fitBudget:256},r=searchSynthesis(p,{...defaultProblem(p),maxParts:4,maxGenerated:4},defaultRouting(),o),c=r.candidates.find(c=>c.recipe.kind==='aligned-direct'&&c.qualified);
 expect(c,JSON.stringify(r.rejected)).toBeDefined();expect(c!.eta).toBeGreaterThan(.999);expect(c!.merit!.goalsMet).toBe(true);expect(r.evaluated).toBeLessThanOrEqual(o.budget);expect(serializeProject(p)).toBe(before);
 const q=applySynthesis(p,r,c!.id);expect(portWorld(q,'target')).toEqual(portWorld(p,'target'));expect(prescription(q).source).toEqual(prescription(p).source);expect(analyzeRouting(q).withinTolerance).toBe(true);
},30000);

test('local fit exhaustion remains partial even with unused global optical / geometry budget',()=>{
 const p=offset(100e-6),o={...settings(),fitBudget:256},r=searchSynthesis(p,{...defaultProblem(p),maxParts:4,maxGenerated:4},defaultRouting(),o);
 expect(r.evaluated).toBeLessThan(o.budget-4);expect(r.geometryEvaluated).toBeLessThan(o.geometryBudget);expect(r.diagnostics.families.direct.limited).toBe(true);expect(r.status).toBe('budget-exhausted');expect(r.candidates.some(c=>c.qualified)).toBe(false);expect(r.reason).toContain('nominal Mode goals are not met');expect(r.reason).toContain('coverage is partial');
},30000);

test('disabled compensation, part caps, Keep-out and fixed Lens surfaces cannot be bypassed by the new direct seed',()=>{
 const p=offset(50e-6),pb={...defaultProblem(p),maxParts:4,maxGenerated:4},routing=defaultRouting(),o={...settings(),budget:64,fitBudget:16};
 for(const r of [searchSynthesis(p,pb,routing,{...o,lensAlignment:undefined}),searchSynthesis(p,{...pb,maxGenerated:0},routing,o),searchSynthesis(p,pb,{...routing,keepOut:[{min:{x:0,y:-1,z:-1},max:{x:.011,y:1,z:1}}]},o),searchSynthesis(p,{...pb,fixedSurfaces:prescription(p).surfaces.slice(0,4).map(s=>s.id)},routing,o)])expect(r.candidates).toHaveLength(0);
},30000);
