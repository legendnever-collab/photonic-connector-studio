import {expect,test} from 'vitest';
import {inverseQ,refractSphericalQ,solveFoldedGaussian,transformQ} from '../src/project/foldedGaussian';
import type {QTensor} from '../src/project/foldedGaussian';
import {fiberLensFiberProject} from '../src/authoring/starter';
import {prescription,serializeProject,parseProject} from '../src/project/model';
import {tensorOverlap} from '../src/project/tensorOverlap';
import {assessJoint,defaultJointTolerance} from '../src/design/joint';
import {framePose} from '../src/authoring/commands';
import {frame,pose,compose} from '../src/surface/model';
import {prismFixture} from './prismFixtures';

// Independent local exact-ray oracle: no application intersection, normal, Snell,
// ABCD, Q or frame routines. Coordinates are [surface normal, tangent, sagittal].
type Vec=[number,number,number];
const dot=(a:Vec,b:Vec)=>a.reduce((s,v,i)=>s+v*b[i],0);
const add=(a:Vec,b:Vec):Vec=>a.map((v,i)=>v+b[i]) as Vec;
const scale=(a:Vec,t:number):Vec=>a.map(v=>v*t) as Vec;
const unit=(a:Vec)=>scale(a,1/Math.hypot(...a));
function exactMap(R:number,n1:number,n2:number,i:number,x:number[]){
 const ci=Math.cos(i),si=Math.sin(i),so=n1/n2*si,co=Math.sqrt(1-so*so);
 const incident:Vec=[ci,si,0],out:Vec=[co,so,0],t:Vec=[-si,ci,0],to:Vec=[-so,co,0],s:Vec=[0,0,1];
 const p=add(scale(t,x[0]),scale(s,x[1])),d=unit(add(incident,add(scale(t,x[2]/n1),scale(s,x[3]/n1))));
 const oc=add(p,[-R,0,0]),b=dot(oc,d),c=dot(oc,oc)-R*R,root=Math.sqrt(b*b-c);
 const roots=[-b-root,-b+root],l=roots.sort((a,b)=>Math.abs(a)-Math.abs(b))[0],hit=add(p,scale(d,l));
 const normal=scale(add([R,0,0],scale(hit,-1)),1/R),cos=dot(d,normal),eta=n1/n2;
 const refracted=add(scale(d,eta),scale(normal,Math.sqrt(1-eta*eta*(1-cos*cos))-eta*cos));
 const atPlane=add(hit,scale(refracted,-dot(hit,out)/dot(refracted,out)));
 return [dot(atPlane,to),dot(atPlane,s),n2*dot(refracted,to)/dot(refracted,out),n2*dot(refracted,s)/dot(refracted,out)];
}
function jacobian(R:number,n1:number,n2:number,i:number,h:number){
 return Array.from({length:4},(_,row)=>Array.from({length:4},(_,col)=>{const step=col<2?h:h/Math.abs(R),x=[0,0,0,0];x[col]=step;const plus=exactMap(R,n1,n2,i,x);x[col]=-step;return (plus[row]-exactMap(R,n1,n2,i,x)[row])/(2*step);}));
}
test.each([0,.001,.025,.05])('sphere Snell differential at %s rad validates both powers, anamorphism and convergence',i=>{
 for(const R of [.005,-.005])for(const [n1,n2]of [[1,1.5],[1.5,1]]){
  const ci=Math.cos(i),co=Math.sqrt(1-(n1/n2*Math.sin(i))**2),delta=n2*co-n1*ci,a=co/ci;
  const expected=[[a,0,0,0],[0,1,0,0],[-delta/(R*ci*co),0,1/a,0],[0,-delta/R,0,1]];
  for(const h of [2e-8,1e-8]){const j=jacobian(R,n1,n2,i,h);j.forEach((row,r)=>row.forEach((v,c)=>expect(Math.abs(v-expected[r][c])/Math.max(1,Math.abs(expected[r][c]))).toBeLessThan(2e-7)));}
  // Compare full complex Q (including cross phase) against the independent ray
  // differential via K'=D K A^-1+C A^-1, not a scalar radius comparison.
  const q:QTensor=[{re:.003,im:.002},{re:.0003,im:.0002},{re:.0003,im:.0002},{re:-.001,im:.004}],k=inverseQ(q),j=jacobian(R,n1,n2,i,1e-8),result=inverseQ(refractSphericalQ(q,n1,n2,R,ci,co));
  result.forEach((v,index)=>{const row=Math.floor(index/2),col=index%2,ratio=j[row+2][row+2]/j[col][col];expect(v.re).toBeCloseTo(k[index].re*ratio+j[row+2][col]/j[col][col],5);expect(v.im).toBeCloseTo(k[index].im*ratio,5);});
 }
});
test('plane limit, index matching, normal limit and reciprocal canonical map retain full tensor',()=>{
 const q:QTensor=[{re:.003,im:.002},{re:.0003,im:.0002},{re:.0003,im:.0002},{re:-.001,im:.004}],ci=Math.cos(.04),co=Math.sqrt(1-(Math.sin(.04)/1.5)**2);
 const plane=refractSphericalQ(q,1,1.5,0,ci,co),expected=transformQ(q,[co/ci,0,0,1]);plane.forEach((v,i)=>{expect(v.re).toBeCloseTo(expected[i].re,12);expect(v.im).toBeCloseTo(expected[i].im,12);});
 const same=refractSphericalQ(q,1.5,1.5,.005,ci,ci);same.forEach((v,i)=>{expect(v.re).toBeCloseTo(q[i].re,12);expect(v.im).toBeCloseTo(q[i].im,12);});
 const out=refractSphericalQ(q,1,1.5,.005,ci,co),back=refractSphericalQ(out,1.5,1,.005,co,ci);back.forEach((v,i)=>{expect(v.re).toBeCloseTo(q[i].re,12);expect(v.im).toBeCloseTo(q[i].im,12);});
 const normal=inverseQ(refractSphericalQ(q,1,1.5,.005,1,1)),k=inverseQ(q);normal.forEach((v,i)=>expect(v.re).toBeCloseTo(k[i].re-(i===0||i===3?100:0),10));
});
test('independent optical-path Hessian gives the outgoing tangential / sagittal phase power',()=>{
 for(const R of [.005,-.005])for(const i of [.001,.025,.05]){
  const n1=1,n2=1.5,ci=Math.cos(i),co=Math.sqrt(1-(n1/n2*Math.sin(i))**2),delta=n2*co-n1*ci;
  // Phase continuity on the exact spherical patch. Tangential Snell terms
  // cancel; the optical path jump is (n1 ci - n2 co) * signed sag.
  const opd=(y:number,z:number)=>-delta*(y*y+z*z)/(R*(1+Math.sqrt(1-(y*y+z*z)/(R*R))));
  for(const h of [2e-7,1e-7]){
   expect((opd(h/co,0)+opd(-h/co,0))/(h*h)).toBeCloseTo(-delta/(R*co*co),5);
   expect((opd(0,h)+opd(0,-h))/(h*h)).toBeCloseTo(-delta/R,5);
  }
 }
});
function misaligned(){const p=fiberLensFiberProject(),a=prescription(p).assemblies[0];a.frame.origin.y=1e-6;a.frame.origin.z=-2e-6;a.frame.rotation.yaw=.002;a.frame.rotation.pitch=-.001;return p;}
test('3D decentered tilted Lens is immutable, deterministic and rigid-motion covariant',()=>{
 const p=misaligned();if(p.model.kind==='surface'){p.model.sourceMode.mfdX=40e-6;p.model.sourceMode.mfdY=80e-6;}prescription(p).source.frame.rotation.roll=.37;
 const json=serializeProject(p),r=solveFoldedGaussian(p),mode=tensorOverlap(p);expect(r.status).toBe('valid');expect(mode.status).toBe('valid');expect(serializeProject(p)).toBe(json);expect(solveFoldedGaussian(parseProject(json))).toEqual(r);if(r.status!=='valid')return;
 expect(Math.abs(r.incident.q[1].im)).toBeGreaterThan(1e-8);
 expect(r.refractions).toHaveLength(2);expect(r.refractions[0].incidenceRad).toBeGreaterThan(0);expect(r.refractions[0].tangentialPower).not.toBe(r.refractions[0].sagittalPower);
 const d=prescription(p),g=frame(pose(.02,-.03,.01,.7,-.4,.3));d.source.frame=framePose(compose(g,frame(d.source.frame)));d.assemblies=d.assemblies.map(a=>({...a,parentId:'Global'}));d.assemblies.push({id:'Global',name:'Global',kind:'group',parentId:null,frame:framePose(g)});
 const next=solveFoldedGaussian(p),nextMode=tensorOverlap(p);expect(next.status).toBe('valid');expect(nextMode.status).toBe('valid');if(next.status!=='valid'||mode.status!=='valid'||nextMode.status!=='valid')return;
 expect(nextMode.eta).toBeCloseTo(mode.eta,10);r.surfaces.forEach((s,i)=>s.after.beam.radii.forEach((w,j)=>expect(next.surfaces[i].after.beam.radii[j]).toBeCloseTo(w,12)));
});
test('50 mrad chief boundary and the near-normal frame limit are continuous for both tilt signs',()=>{
 for(const angle of [-.05001,-.05,-1e-8,0,1e-8,.05,.05001]){
  const p=fiberLensFiberProject(),d=prescription(p);d.assemblies[0].frame.rotation.yaw=angle;d.surfaces.at(-1)!.aperture=.01;
  const r=solveFoldedGaussian(p);if(Math.abs(angle)>.05){expect(r).toMatchObject({status:'out-of-domain',reason:expect.stringContaining('50 mrad')});continue;}
  expect(r.status).toBe('valid');if(r.status!=='valid')continue;
  for(const s of r.surfaces){const dot=(a:{x:number;y:number;z:number},b:{x:number;y:number;z:number})=>a.x*b.x+a.y*b.y+a.z*b.z;expect(dot(s.after.u,s.after.direction)).toBeCloseTo(0,12);expect(dot(s.after.v,s.after.direction)).toBeCloseTo(0,12);}
 }
});
test('Lens joint decenter/tilt has complete field coverage while geometry remains an independent gate',async()=>{
 const p=fiberLensFiberProject(),o=defaultJointTolerance(p);o.samples=o.maxCases=8;o.mating.position=[0,0,0];o.assembly.position=[0,1e-6,2e-6];o.assembly.angle=[0,.001,.002];const r=await assessJoint(p,o);
 expect(r.status).toBe('assessed');expect(r.fieldAssessed).toBe(8);expect(r.observations.every(x=>x.eta!==null&&x.evaluator===r.nominal.evaluator)).toBe(true);expect(r.geometryPassed).toBeLessThan(8);expect(r.meetsSampleGoals).toBe(false);
});
test('incidence, footprint, higher-order profile and aperture boundaries suppress unsupported overlap',()=>{
 const p=misaligned(),d=prescription(p);d.assemblies[0].frame.rotation.yaw=.1;d.surfaces.at(-1)!.aperture=.01;expect(solveFoldedGaussian(p)).toMatchObject({status:'out-of-domain',reason:expect.stringContaining('50 mrad')});expect(tensorOverlap(p).status).toBe('not-calculated');
 const large=misaligned();if(large.model.kind==='surface')large.model.sourceMode.mfdX=8.4e-6;prescription(large).assemblies[0].frame.origin.x=.006;expect(solveFoldedGaussian(large)).toMatchObject({status:'out-of-domain',reason:expect.stringContaining('footprint exceeds 0.2')});
 const asphere=misaligned();prescription(asphere).surfaces[0].shape='even-asphere';prescription(asphere).surfaces[0].conic=-1;expect(tensorOverlap(asphere).status).toBe('not-calculated');
 const clipped=misaligned();prescription(clipped).surfaces[0].aperture=.0005;expect(tensorOverlap(clipped).status).toBe('not-calculated');
});
test('oblique powered Lens plus TIR retains only the geometric envelope until a combined field benchmark exists',()=>{
 const p=prismFixture(),d=prescription(p),base=d.surfaces[0],glass=base.nAfter!;
 d.assemblies.unshift({id:'Lens',name:'Lens',kind:'lens',parentId:null,frame:pose(.001,2e-6,0,.002)});
 d.surfaces.unshift({...base,id:'LF',assemblyId:'Lens',shape:'sphere',radius:.05,frame:pose()}, {...base,id:'LR',assemblyId:'Lens',shape:'sphere',radius:-.05,frame:pose(.0002),nBefore:glass,nAfter:1,materialBefore:'N-BK7',materialAfter:'air'});
 p.bodies.push({assemblyId:'Lens',kind:'lens',outerRadius:.0031});
 expect(solveFoldedGaussian(p).status).toBe('valid');expect(tensorOverlap(p)).toMatchObject({status:'not-calculated',reason:expect.stringContaining('combined field benchmark')});
});
