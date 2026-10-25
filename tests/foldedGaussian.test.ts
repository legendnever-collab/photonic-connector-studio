import {expect,test} from 'vitest';
import {solveFoldedGaussian,section,transformQ,propagateQ,powerQ,inverseQ} from '../src/project/foldedGaussian';
import type {QTensor,FoldedResult} from '../src/project/foldedGaussian';
import {routingExample} from '../src/routing/examples';
import {fiberLensFiberProject} from '../src/authoring/starter';
import {framePose} from '../src/authoring/commands';
import {pose,frame,compose,V,unit,add,mul,sub,norm,dot} from '../src/surface/model';
import {refract} from '../src/surface/trace';
import {serializeProject,parseProject,ProjectSchema,withPrescription} from '../src/project/model';
import type {Project} from '../src/project/model';
import {solvePhysicalGaussian} from '../src/project/physicalGaussian';
import {rayleigh,abcd,beam} from '../src/physics';
const L=1310e-9;
function d(p:Project){if(p.model.kind!=='surface')throw Error('Physical');return p.model.prescription;}
function valid(r:FoldedResult){if(r.status!=='valid')throw Error(r.reason);return r;}
function unfoldedFixture(which:'mirrors'|'prism'='mirrors'){
 const p=routingExample(which),s=d(p);s.surfaces=s.surfaces.slice(2);s.assemblies=s.assemblies.filter(a=>a.kind!=='lens');p.bodies=p.bodies.filter(b=>b.kind!=='lens');
 if(p.model.kind==='surface'){p.model.sourceMode.mfdX=80e-6;p.model.sourceMode.mfdY=100e-6;}return p;
}
function expectClose(a:number,b:number,tol=1e-9){expect(Math.abs(a-b)).toBeLessThan(tol*Math.max(Math.abs(a),Math.abs(b),1e-30));}
test.each(['mirrors','prism'] as const)('%s preserves unfolded reduced Q and independent Σ L/n propagation',which=>{
 const p=unfoldedFixture(which),r=valid(solveFoldedGaussian(p));
 const reduced=r.surfaces.reduce((sum,s,i)=>sum+(s.before.distance-(i?r.surfaces[i-1].after.distance:0))/s.before.n,0),qy={re:reduced,im:rayleigh(40e-6,L)},qz={re:reduced,im:rayleigh(50e-6,L)};
 const expected=[beam(qy,L,0).radius,beam(qz,L,0).radius].sort((a,b)=>b-a);
 r.incident.beam.radii.forEach((w,i)=>expectClose(w,expected[i]));
 expectClose(r.incident.opl,r.surfaces.reduce((sum,s,i)=>sum+(s.before.distance-(i?r.surfaces[i-1].after.distance:0))*s.before.n,0));
 for(const s of r.samples){expect(norm(s.u)).toBeCloseTo(1,12);expect(norm(s.v)).toBeCloseTo(1,12);expect(dot(s.u,s.direction)).toBeCloseTo(0,12);expect(dot(s.v,s.direction)).toBeCloseTo(0,12);expect(dot(s.u,s.v)).toBeCloseTo(0,12);}
 expect(r.incident.distance).toBeGreaterThan(d(p).surfaces.at(-1)!.frame.origin.x);expect(r.positionError).toBeLessThan(1e-14);
});
test('reflection parity flips cross phase and transports an elliptical rolled section without inventing astigmatism',()=>{
 const q:QTensor=[{re:.01,im:.002},{re:.003,im:.0005},{re:.003,im:.0005},{re:.02,im:.004}],r=transformQ(q,[1,0,0,-1]);expect(r[1]).toEqual({re:-.003,im:-.0005});
 section(q,L,1).radii.forEach((w,i)=>expectClose(w,section(r,L,1).radii[i]));
 const rotated=transformQ(q,[Math.cos(.7),Math.sin(.7),-Math.sin(.7),Math.cos(.7)]);
 section(q,L,1).radii.forEach((w,i)=>expectClose(w,section(rotated,L,1).radii[i]));
});
test('tensor propagation and spherical power reduce to independent scalar ABCD, including curvature and waist',()=>{
 const y={re:.001,im:.002},z={re:-.0005,im:.004},q:QTensor=[y,{re:0,im:0},{re:0,im:0},z],n=1.5,power=120;
 const result=powerQ(propagateQ(q,.003,n),power),expected=[y,z].map(v=>abcd(v,[1,.003/n,-power,1-power*.003/n]));
 [0,3].forEach((k,i)=>{expectClose(result[k].re,expected[i].re);expectClose(result[k].im,expected[i].im);});
 const s=section(result,L,n);expect(s.waistOffsets).not.toBeNull();expect(s.waistRadii).not.toBeNull();
 const expectedR=expected.map(q=>beam(q,L,0).radius).sort((a,b)=>b-a);s.radii.forEach((w,i)=>expectClose(w,expectedR[i]));
});
test('plane interface oblique anamorphism agrees with independent tangential / sagittal matrices',()=>{
 const p=unfoldedFixture(),doc=d(p),n=1.5,normal=frame(pose(0,0,0,Math.PI/4)).axes[0],out=refract(V(1),normal,1,n)!,P=V(.001,0,-10e-6),M=add(P,mul(out,.001)),final=V(1),Q=add(M,V(.001)),mirrorNormal=unit(sub(out,final));
 doc.assemblies=[{id:'G',name:'G',kind:'group',parentId:null,frame:pose()}];
 const base=doc.surfaces[0],surface=(id:string,origin:typeof P,yaw:number,interaction:'refract'|'reflect'|'probe',before:number,after:number)=>({...base,id,assemblyId:'G',frame:pose(origin.x,origin.y,origin.z,yaw),interaction,nBefore:before,nAfter:after,materialBefore:undefined,materialAfter:undefined,aperture:.005});
 doc.surfaces=[surface('entry',P,Math.PI/4,'refract',1,n),surface('fold',M,Math.atan2(mirrorNormal.y,mirrorNormal.x),'reflect',n,n),surface('output',Q,0,'probe',n,n)];p.bodies=[];p.authoring!.ports.target.mediumIndex=n;
 const r=valid(solveFoldedGaussian(p)),ci=Math.abs(dot(V(1),normal)),co=Math.abs(dot(out,normal)),a=co/ci;
 const q0y={re:.001,im:rayleigh(40e-6,L)},q0z={re:.001,im:rayleigh(50e-6,L)};
 const expected=[beam({re:a*a*q0y.re+.002/n,im:a*a*q0y.im},L,0).radius,beam({re:q0z.re+.002/n,im:q0z.im},L,0).radius].sort((a,b)=>b-a);
 r.incident.beam.radii.forEach((w,i)=>expectClose(w,expected[i]));expect(r.surfaces[0].after.beam.radii[0]).toBeGreaterThan(r.surfaces[0].before.beam.radii[0]);
});
test('normal refracting Lens before the first fold agrees with the validated coaxial solver at the same plane',()=>{
 const p=routingExample('mirrors'),r=valid(solveFoldedGaussian(p)),straight=structuredClone(p),doc=d(straight);doc.surfaces=doc.surfaces.slice(0,2).concat({...doc.surfaces.at(-1)!,frame:pose(0,0,0)});doc.assemblies=doc.assemblies.filter(a=>a.kind!=='mirror');doc.assemblies.at(-1)!.frame=pose(.003,0,-10e-6);straight.bodies=straight.bodies.filter(b=>b.kind!=='mirror');
 // S0 Lens aperture is too small for this SMF: enlarge only the straight reference optical radius / body consistently.
 for(const s of doc.surfaces.slice(0,2))s.aperture=.001;straight.bodies[0]={assemblyId:doc.assemblies[0].id,kind:'lens',outerRadius:.0012};
 const reference=solvePhysicalGaussian(straight);expect(reference.status).toBe('valid');if(reference.status!=='valid')return;
 const exit=r.surfaces[1].after,q=propagateQ(exit.q,.001,exit.n),s=section(q,L,exit.n);expectClose(s.radii[0],reference.incident.y.radius);expectClose(s.curvatures[0],reference.incident.y.curvature);
});
test('rigid global rotation and translation preserve all beam radii, distances, OPL and transformed centers',()=>{
 const p=unfoldedFixture('prism'),r=valid(solveFoldedGaussian(p)),doc=d(p),g=frame(pose(.02,-.03,.01,.7,-.4,.3));doc.source.frame=framePose(compose(g,frame(doc.source.frame)));doc.assemblies=doc.assemblies.map(a=>({...a,parentId:'Global'}));doc.assemblies.push({id:'Global',name:'Global',kind:'group',parentId:null,frame:framePose(g)});
 const next=valid(solveFoldedGaussian(p));r.surfaces.forEach((s,i)=>s.after.beam.radii.forEach((w,j)=>expectClose(w,next.surfaces[i].after.beam.radii[j])));expectClose(r.incident.distance,next.incident.distance);expectClose(r.incident.opl,next.incident.opl);
});
test('finite aperture / prism depth clipping stays visible as an untruncated reference with no efficiency',()=>{
 const p=unfoldedFixture('prism'),r=valid(solveFoldedGaussian(p));expect(r.apertureLimited).toBe(true);expect(r.warnings.join(' ')).toMatch(/clipping diffraction/);expect(r.overlapReason).toContain('PIC');expect('overlap' in r).toBe(false);
 const body=p.bodies.find(b=>b.kind==='prism')!;if(body.kind==='prism')body.depth=2e-6;const small=valid(solveFoldedGaussian(p));expect(small.surfaces.some(s=>(s.tailBound??0)>.99)).toBe(true);
});
test('geometric clipping / medium mismatch / unmet TIR terminate instead of reusing an old envelope',()=>{
 const p=unfoldedFixture('prism'),doc=d(p);doc.surfaces.find(s=>s.interaction==='tir')!.outsideIndex=1.49;expect(solveFoldedGaussian(p)).toMatchObject({status:'invalid',reason:expect.stringContaining('TIR condition not met')});
 doc.source.n=1.1;expect(solveFoldedGaussian(p)).toMatchObject({status:'invalid',reason:expect.stringContaining('medium mismatch')});
});
test('sampling / mechanical shell edits do not alter the field; MFD, wavelength and material do',()=>{
 const p=unfoldedFixture(),before=valid(solveFoldedGaussian(p));d(p).source.radius*=3;d(p).source.samples=1;p.sourceBody!.radius*=2;const after=valid(solveFoldedGaussian(p));expect(after).toEqual(before);
 if(p.model.kind==='surface')p.model.sourceMode.mfdX!*=1.5;expect(valid(solveFoldedGaussian(p)).fingerprint).not.toBe(before.fingerprint);
 const next=withPrescription(p,{...d(p),wavelength:1550e-9});expect(valid(solveFoldedGaussian(next)).incident.beam.radii).not.toEqual(after.incident.beam.radii);
});
test('strict SaveLoad roundtrip, no Project writes, source gates and old coaxial behavior preserved',()=>{
 const p=routingExample('mirrors'),json=serializeProject(p),result=solveFoldedGaussian(p);expect(solveFoldedGaussian(parseProject(json))).toEqual(result);expect(serializeProject(p)).toBe(json);expect(ProjectSchema.parse(p)).toEqual(p);
 p.authoring!.ports.source.phase='unspecified';expect(solveFoldedGaussian(p).status).toBe('out-of-domain');p.authoring!.ports.source.phase='waist-plane';d(p).source.channels.rows=3;expect(solveFoldedGaussian(p).status).toBe('out-of-domain');
 expect(solvePhysicalGaussian(fiberLensFiberProject()).status).toBe('valid');
});
test('curved / higher-order / excessive divergence domains are explicit',()=>{
 const p=routingExample('mirrors'),doc=d(p);doc.surfaces[0].shape='even-asphere';doc.surfaces[0].conic=-1;expect(solveFoldedGaussian(p)).toMatchObject({status:'out-of-domain',reason:expect.stringContaining('aspheric phase')});
 const q=unfoldedFixture();if(q.model.kind==='surface')q.model.sourceMode.mfdX=1e-6;expect(solveFoldedGaussian(q)).toMatchObject({status:'out-of-domain',reason:expect.stringContaining('divergence')});
});
test('nonseparable cross phase suppresses misleading independent waist extrapolation',()=>{
 const q:QTensor=[{re:.003,im:.001},{re:.001,im:0},{re:.001,im:0},{re:.007,im:.002}];expect(section(q,L,1).waistOffsets).toBeNull();
 const inv=inverseQ(inverseQ(q));inv.forEach((z,i)=>{expectClose(z.re,q[i].re);expect(z.im).toBeCloseTo(q[i].im,13);});
});
test('a centered normal Lens after a 90° fold agrees with an independent scalar matrix chain',()=>{
 const p=unfoldedFixture(),doc=d(p),base=doc.surfaces[0],glass=1.5;
 doc.assemblies=[{id:'G',name:'G',kind:'group',parentId:null,frame:pose()}];p.bodies=[];
 const make=(id:string,x:number,y:number,yaw:number,kind:'plane'|'sphere',interaction:'reflect'|'refract'|'probe',n1:number,n2:number,radius=.005)=>({...base,id,assemblyId:'G',frame:pose(x,y,-10e-6,yaw),shape:kind,interaction,nBefore:n1,nAfter:n2,materialBefore:undefined,materialAfter:undefined,aperture:.001,radius});
 doc.surfaces=[make('fold',.002,0,-Math.PI/4,'plane','reflect',1,1),make('front',.002,.002,Math.PI/2,'sphere','refract',1,glass),make('rear',.002,.0025,Math.PI/2,'sphere','refract',glass,1,-.005),make('output',.002,.006,Math.PI/2,'plane','probe',1,1)];
 const r=valid(solveFoldedGaussian(p)),expected=[40e-6,50e-6].map(w=>{let q={re:.004,im:rayleigh(w,L)};q=abcd(q,[1,0,-100,1]);q={...q,re:q.re+.0005/glass};q=abcd(q,[1,0,-100,1]);q={...q,re:q.re+.0035};return beam(q,L,0).radius;}).sort((a,b)=>b-a);
 r.incident.beam.radii.forEach((w,i)=>expectClose(w,expected[i]));expect(r.angleError).toBeLessThan(1e-12);
});
test('Output roll and transverse offset retain the beam-normal field and separate the Port reference coordinates',()=>{
 const p=unfoldedFixture(),r=valid(solveFoldedGaussian(p)),target=d(p).assemblies.at(-1)!;target.frame.rotation.roll=.7;target.frame.origin.y+=3e-6;const next=valid(solveFoldedGaussian(p));
 expect(next.incident.beam.radii).toEqual(r.incident.beam.radii);expectClose(next.positionError,3e-6);expect(next.outputAxes).not.toEqual(r.outputAxes);expect(next.overlapReason).toContain('PIC');
});
