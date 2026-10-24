import {expect,test} from 'vitest';
import {fiberLensFiberProject} from '../src/authoring/starter';
import {framePose} from '../src/authoring/commands';
import {solvePhysicalGaussian,normalizedIncidentField} from '../src/project/physicalGaussian';
import type {PhysicalGaussian} from '../src/project/physicalGaussian';
import {projectTrace} from '../src/project/compute';
import {projectExample,withPrescription,prescription,serializeProject,parseProject,withMode,modes} from '../src/project/model';
import type {Project} from '../src/project/model';
import {compose,frame,pose} from '../src/surface/model';
function valid(p=fiberLensFiberProject()){const r=solvePhysicalGaussian(p);expect(r.status,JSON.stringify(r)).toBe('valid');return r as Extract<PhysicalGaussian,{status:'valid'}>;}
function near(a:number,b:number,tol=1e-10){expect(Math.abs(a-b)).toBeLessThan(tol*Math.max(1,Math.abs(b)));}
function mutate(fn:(p:Project)=>void){const p=fiberLensFiberProject();fn(p);return p;}

test('thick BK7 lens matches independently multiplied ordinary [h,theta] ABCD',()=>{
 const p=fiberLensFiberProject(),d=prescription(p),n=d.surfaces[0].nAfter!,lambda=d.wavelength,w0=p.model.kind==='surface'?p.model.sourceMode.mfdX!/2:0;
 // Ordinary q: translate d, refract [1,0,(n1-n2)/(R*n2),n1/n2].
 const mm=(a:number[],b:number[])=>[a[0]*b[0]+a[1]*b[2],a[0]*b[1]+a[1]*b[3],a[2]*b[0]+a[3]*b[2],a[2]*b[1]+a[3]*b[3]];
 const m=[[1,.0045,0,1],[1,0,(1-n)/(.005*n),1/n],[1,.001,0,1],[1,0,(n-1)/(-.005),n],[1,.0045,0,1]].reduce((a,b)=>mm(b,a),[1,0,0,1]);
 const zR=Math.PI*w0*w0/lambda,den=m[3]**2+(m[2]*zR)**2,qre=(m[1]*m[3]+m[0]*m[2]*zR*zR)/den,qim=zR/den;
 const r=valid(p);r.matrix.forEach((v,i)=>near(v,m[i]));near(r.incident.y.radius,Math.sqrt(lambda/Math.PI*(qre*qre+qim*qim)/qim),1e-13);near(r.incident.y.curvature,qre/(qre*qre+qim*qim));near(r.incident.y.waistX,r.incident.x-qre);expect(r.overlap.status).toBe('valid');
 // Same physical height, refractive index changes curvature and Rayleigh range.
 for(const id of ['S1','S2']){const at=r.samples.filter(s=>s.surfaceId===id);near(at[0].y.radius,at.at(-1)!.y.radius,1e-13);}
});
test('plane slab preserves reduced q / width at interfaces and uses d/n rather than optical path',()=>{
 const p=mutate(p=>{if(p.model.kind==='surface')for(const s of p.model.prescription.surfaces)s.shape='plane';});const r=valid(p),d=prescription(p),n=d.surfaces[0].nAfter!,L=.009+.001/n,w0=9.2e-6/2,zR=Math.PI*w0*w0/d.wavelength;
 near(r.matrix[1],L,1e-13);near(r.incident.y.radius,w0*Math.hypot(1,L/zR),1e-13);const s1=r.samples.filter(s=>s.surfaceId==='S1');near(s1.at(-1)!.y.curvature,s1[0].y.curvature/n);
});
test('common rigid transform and hierarchy preserve fields; no World-X sorting',()=>{
 const p=fiberLensFiberProject(),r=valid(p),d=prescription(p),root=pose(.2,-.1,.05,2.7,.6,-.4),rootFrame=frame(root);
 const moved=withPrescription(p,{...d,source:{...d.source,frame:framePose(compose(rootFrame,frame(d.source.frame)))},assemblies:[...d.assemblies.map(a=>({...a,parentId:'Root'})),{id:'Root',name:'Root',kind:'group',parentId:null,frame:root}]});
 const b=valid(moved);near(b.incident.y.radius,r.incident.y.radius,1e-13);near(b.incident.y.curvature,r.incident.y.curvature);expect(b.overlap.status).toBe('valid');if(b.overlap.status==='valid'&&r.overlap.status==='valid')near(b.overlap.logEta,r.overlap.logEta);
});
test('source MFD and prescription edits change field; diagnostic settings / Fiber shells / Alignment draft do not',()=>{
 const p=fiberLensFiberProject(),r=valid(p),ray=projectTrace(p),changed=withMode(p,'source',{...modes(p).source,mfdX:10e-6});expect(valid(changed).incident.y.radius).not.toBe(r.incident.y.radius);expect(projectTrace(changed).paths).toEqual(ray.paths);
 for(const fn of [(p:Project)=>{prescription(p).surfaces[0].radius=.006;},(p:Project)=>{prescription(p).surfaces[1].frame.origin.x=.0011;},(p:Project)=>{prescription(p).assemblies.find(a=>a.id==='Output')!.frame.origin.x=.011;}])expect(valid(mutate(fn)).incident.y.radius).not.toBe(r.incident.y.radius);
 const d=prescription(p),custom=withPrescription(p,{...d,surfaces:d.surfaces.map(s=>s.id==='S1'?{...s,nAfter:1.55}:s)});expect(valid(custom).incident.y.radius).not.toBe(r.incident.y.radius);
 const other=mutate(p=>{const d=prescription(p);d.source.radius=.0002;d.source.samples=9;d.source.n=1.3;d.source.channels.rows=3;d.source.channels.cols=3;p.sourceBody=null;p.targetBody=null;p.authoring!.alignment.delta.origin.y=20e-6;});expect(valid(other)).toEqual(r);expect(parseProject(serializeProject(p))).toEqual(p);
});
test('propagation survives missing target mode while overlap is withheld; old projects are never filled implicitly',()=>{
 const p=withMode(fiberLensFiberProject(),'target',{...modes(fiberLensFiberProject()).target,mfdX:null,mfdY:null}),r=valid(p);expect(r.overlap.status).toBe('not-calculated');expect(r.samples.length).toBeGreaterThan(1);const legacy=projectExample('lens'),raw=serializeProject(legacy);expect(solvePhysicalGaussian(legacy).status).toBe('out-of-domain');expect(serializeProject(legacy)).toBe(raw);
});
test.each([
 ['unknown phase',(p:Project)=>{p.authoring!.ports.source.phase='unspecified';}],
 ['confined input',(p:Project)=>{p.authoring!.ports.source.adapter='near-field-em-required';}],
 ['imported input',(p:Project)=>{p.authoring!.ports.source.fieldModel='imported-complex';}],
 ['fold',(p:Project)=>{prescription(p).surfaces[0].interaction='reflect';}],
 ['surface decenter',(p:Project)=>{prescription(p).surfaces[1].frame.origin.y=1e-6;}],
 ['port large tilt',(p:Project)=>{prescription(p).source.frame.rotation.yaw=.06;}],
 ['port roll',(p:Project)=>{prescription(p).source.frame.rotation.roll=.01;}],
 ['medium discontinuity',(p:Project)=>{prescription(p).surfaces[1].nBefore=1.6;}],
 ['backwards order',(p:Project)=>{prescription(p).assemblies.find(a=>a.id==='Output')!.frame.origin.x=.004;}],
 ['clipping',(p:Project)=>{prescription(p).surfaces[0].aperture=.0001;}],
 ['high NA',(p:Project)=>{if(p.model.kind==='surface')p.model.sourceMode.mfdX=2e-6;}],
] as const)('%s returns no stale field or overlap',(_,fn)=>{const r=solvePhysicalGaussian(mutate(fn));expect(r.status).not.toBe('valid');expect(r).not.toHaveProperty('samples');expect(r).not.toHaveProperty('overlap');});

test('normalized complex-field quadrature independently verifies overlap with curvature, offset and tilt',()=>{
 // A short air-only train gives manageable scales for direct quadrature.
 const p=fiberLensFiberProject(),d=prescription(p);const short=withPrescription({...p,bodies:[]},{...d,assemblies:d.assemblies.map(a=>a.id==='Output'?{...a,frame:pose(80e-6,2e-6,-1e-6,.003,-.002)}:a),surfaces:[d.surfaces.at(-1)!]});
 const r=valid(short);expect(r.overlap.status).toBe('valid');if(r.overlap.status!=='valid')return;
 const o=r.overlap,wY=o.targetY,wZ=o.targetZ,range=12*Math.max(r.incident.y.radius,r.incident.z.radius,wY,wZ),N=640,step=2*range/N;let rr=0,ii=0,power=0;
 for(let j=0;j<N;j++)for(let k=0;k<N;k++){const y=-range+(j+.5)*step,z=-range+(k+.5)*step,e=normalizedIncidentField(r,y,z),t=Math.sqrt(2/(Math.PI*wY*wZ))*Math.exp(-((y/wY)**2+(z/wZ)**2));rr+=e.re*t*step*step;ii+=e.im*t*step*step;power+=(e.re*e.re+e.im*e.im)*step*step;}
 near(power,1,1e-10);near(rr*rr+ii*ii,o.eta,1e-10);
 // Tilt / position has the correct signed effect, and normalized overlap remains ≤1.
 expect(o.angleY).toBeCloseTo(-Math.tan(.003),7);expect(o.offsetY).toBeCloseTo(2e-6,12);expect(o.eta).toBeGreaterThan(0);expect(o.eta).toBeLessThan(1);
});
test('polarization or unknown target contract withholds only overlap',()=>{
 const p=mutate(p=>{if(p.model.kind==='surface'){p.model.sourceMode.polarization='TE';p.model.targetMode.polarization='TM';}});expect(valid(p).overlap.status).toBe('not-calculated');p.authoring!.ports.target.phase='unspecified';expect(valid(p).overlap.status).toBe('not-calculated');
});

test('air-only defocus overlap agrees with closed-form identical-waist benchmark; non-air q uses vacuum lambda',()=>{
 const p=fiberLensFiberProject(),d=prescription(p),L=1e-4,lambda=d.wavelength,w=9.2e-6/2;
 for(const n of [1,1.5]){
  const train=structuredClone(p);train.bodies=[];train.authoring!.ports.source.mediumIndex=n;train.authoring!.ports.target.mediumIndex=n;
  const r=valid(withPrescription(train,{...d,assemblies:d.assemblies.map(a=>a.id==='Output'?{...a,frame:pose(L)}:a),surfaces:[{...d.surfaces.at(-1)!,materialBefore:undefined,materialAfter:undefined,nBefore:n,nAfter:n}]}));
  const zR=Math.PI*n*w*w/lambda;expect(r.overlap.status).toBe('valid');if(r.overlap.status==='valid')near(r.overlap.eta,1/(1+(L/(2*zR))**2),1e-12);near(r.incident.y.radius,w*Math.hypot(1,L/zR),1e-13);
 }
});
test('source offset and slope obey independent refraction matrices; numerical underflow keeps finite loss',()=>{
 const p=mutate(p=>{prescription(p).source.frame=pose(0,2e-6,-1e-6,.001);});const r=valid(p),n=prescription(p).surfaces[0].nAfter!,power=(n-1)/.005;
 let h=2e-6,theta=Math.tan(.001);h+=.0045*theta;theta=(theta-power*h)/n;h+=.001*theta;theta=n*theta-power*h;h+=.0045*theta;
 near(r.incident.heightY,h,1e-13);near(r.incident.slopeY,theta,1e-13);
 const far=valid(mutate(p=>{prescription(p).assemblies.find(a=>a.id==='Output')!.frame.origin.y=.1;}));expect(far.overlap.status).toBe('valid');if(far.overlap.status==='valid'){expect(far.overlap.eta).toBe(0);expect(far.overlap.underflow).toBe(true);expect(Number.isFinite(far.overlap.lossDB)).toBe(true);}
});
