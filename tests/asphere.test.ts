import {test,expect} from 'vitest';
import {sag,evaluateSurface,surfaceNormal,radialBounds,positiveThickness,coefficientScale} from '../src/surface/evaluator';
import type {Profile} from '../src/surface/evaluator';
import {asphereRoot,IntersectionFailure,ROOT_RESIDUAL} from '../src/surface/asphereIntersection';
import {compile,frame,pose,V,unit,pointToWorld,pointToLocal,vectorToWorld,compose,PrescriptionSchema,norm,sub} from '../src/surface/model';
import type {Compiled} from '../src/surface/model';
import {intersect,traceRay} from '../src/surface/trace';
import {fiberLensFiberProject} from '../src/authoring/starter';
import {prescription,withPrescription,serializeProject,parseProject,projectExample} from '../src/project/model';
import {projectTrace} from '../src/project/compute';
import {bodyGeometry} from '../src/project/geometry';
import {reportGeometry} from '../src/surface/reportGeometry';
import {framePose,rowCommand,saveBuildingBlock,insertBuildingBlock} from '../src/authoring/commands';
import {solvePhysicalGaussian} from '../src/project/physicalGaussian';
const asphere=(radius=.005,conic=0,aspheric={a4:0,a6:0,a8:0}):Profile=>({shape:'even-asphere',radius,conic,aspheric});
const close=(a:number,b:number,tol=1e-12)=>expect(Math.abs(a-b)).toBeLessThan(tol);
function surface(profile:Profile):Compiled{return {...compile(prescription(fiberLensFiberProject()))[0],...profile,world:frame(pose()),aperture:.001};}
// Independent direct sag formula in mm, with no imports from the evaluator.
function reference(mmR:number,K:number,A:number[],y:number,z:number){const r2=y*y+z*z,c=mmR===0?0:1/mmR;return c*r2/(1+Math.sqrt(1-(1+K)*c*c*r2))+A[0]*r2**2+A[1]*r2**3+A[2]*r2**4;}
function asphericProject(){const p=fiberLensFiberProject(),d=prescription(p);return withPrescription(p,{...d,source:{...d.source,radius:.0004},surfaces:d.surfaces.map((s,i)=>i===0?{...s,...asphere(.005,-1,{a4:2e7,a6:1e12,a8:-1e17})}:s)});}

test.each([.005,-.005])('Sphere limit: Sag / Normal / intersection agree at signed R=%s',R=>{
 for(let i=0;i<=20;i++){
  const y=.001*i/20,z=y*.2,r2=y*y+z*z,expected=R-Math.sign(R)*Math.sqrt(R*R-r2),s=asphere(R),n=surfaceNormal(s,y,z)!,den=Math.abs(R);
  close(sag(s,y,z),expected,1e-17);close(n.x,Math.sqrt(R*R-r2)/den);close(n.y,-y/R);close(n.z,-z/R);
  const a=surface(s),b={...a,shape:'sphere' as const,conic:undefined,aspheric:undefined},ray={origin:V(-.002,y,z),direction:V(1),n:1,channel:'0'};
  const ai=intersect(ray,a),bi=intersect(ray,b);if(Math.hypot(y,z)>a.aperture){expect(ai).toBeNull();continue;}expect(ai).not.toBeNull();expect(bi).not.toBeNull();close(ai!.t,bi!.t,ROOT_RESIDUAL*2);
 }
});
test.each([-1,-2,.5])('Conic K=%s obeys independent quadric and analytic gradient',K=>{
 const R=.004,s=asphere(R,K),y=.0007,z=-.0004,e=evaluateSurface(s,y,z)!;
 close((1+K)*e.sag*e.sag-2*R*e.sag+y*y+z*z,0,1e-18);
 const denominator=R-(1+K)*e.sag;close(e.dy,y/denominator,1e-14);close(e.dz,z/denominator,1e-14);
});
test('A4 / A6 / A8 SI conversion and gradient match independent mm formula and central differences',()=>{
 const a=[.03,-.002,.0004],s=asphere(-.006,-1.3,{a4:a[0]*1e9,a6:a[1]*1e15,a8:a[2]*1e21}),y=.00065,z=-.00033,e=evaluateSurface(s,y,z)!;
 close(e.sag,reference(-6,-1.3,a,y*1e3,z*1e3)*1e-3,1e-17);expect([4,6,8].map(x=>coefficientScale(x as 4|6|8))).toEqual([1e9,1e15,1e21]);
 const step=1e-8,dy=(reference(-6,-1.3,a,(y+step)*1e3,z*1e3)-reference(-6,-1.3,a,(y-step)*1e3,z*1e3))*1e-3/(2*step),dz=(reference(-6,-1.3,a,y*1e3,(z+step)*1e3)-reference(-6,-1.3,a,y*1e3,(z-step)*1e3))*1e-3/(2*step);
 close(e.dy,dy,1e-9);close(e.dz,dz,1e-9);close(Math.hypot(e.normal.x,e.normal.y,e.normal.z),1,1e-15);
});
test('flat-base polynomial and pure plane are finite at the axis and at clear radius',()=>{
 const s=asphere(0,-1,{a4:2e8,a6:0,a8:0});close(sag(s,.001,0),.0002,1e-17);expect(surfaceNormal(s,0,0)).toEqual(V(1));
 close(asphereRoot(V(-.002,.0004,0),V(1),s,.001)!, .002+sag(s,.0004,0),ROOT_RESIDUAL*2);close(asphereRoot(V(-.002,.0004,0),V(1),asphere(0),.001)!, .002,1e-15);
});
test('oblique aspheric root matches independent bisection and residual, including signed curvature',()=>{
 for(const R of [-.006,.006]){
  const K=-1.3,a=[.03,-.002,.0004],s=asphere(R,K,{a4:a[0]*1e9,a6:a[1]*1e15,a8:a[2]*1e21}),p=V(-.002,.0004,-.0002),d=unit(V(1,.08,.02));
  let lo=0,hi=.003;for(let i=0;i<100;i++){const t=(lo+hi)/2,f=p.x+t*d.x-reference(R*1e3,K,a,(p.y+t*d.y)*1e3,(p.z+t*d.z)*1e3)*1e-3;if(f>0)hi=t;else lo=t;}
  const root=asphereRoot(p,d,s,.001)!;close(root,(lo+hi)/2,ROOT_RESIDUAL*2);close(p.x+root*d.x-sag(s,p.y+root*d.y,p.z+root*d.z),0,ROOT_RESIDUAL*1.1);
 }
});
test('multiple intersections choose nearest positive root; grazing never jumps to an unchecked root',()=>{
 const s=asphere(0,0,{a4:1.6e9,a6:0,a8:0});close(asphereRoot(V(.0001,-.001,0),V(0,1,0),s,.001)!, .0005,ROOT_RESIDUAL*2);
 expect(()=>asphereRoot(V(0,-.001,0),V(0,1,0),s,.001)).toThrow(IntersectionFailure);
 const path=traceRay({origin:V(0,-.001,0),direction:V(0,1,0),n:1,channel:'0'},[surface(s)]);expect(path.status).toBe('blocked');expect(path.reason).toContain('numerical intersection unavailable');expect(path.hits).toEqual([]);
});
test('finite disk, behind ray and wrong conic cap are not accepted as optical intersections',()=>{
 expect(asphereRoot(V(-.002,.0011,0),V(1),asphere(),.001)).toBeNull();expect(asphereRoot(V(.006,0,0),V(1),asphere(),.001)).toBeNull();
 expect(asphereRoot(V(-.002,0,0),V(-1),asphere(),.001)).toBeNull();
});
test('radial interval bounds enclose non-monotonic sag and slope factors',()=>{
 const s=asphere(.004,-2,{a4:5e9,a6:-5e15,a8:2e20});
 for(let j=0;j<20;j++){const lo=j*.001/20,hi=(j+1)*.001/20,b=radialBounds(s,lo,hi),g=radialBounds(s,lo,hi,'gradient-factor');for(let i=0;i<=50;i++){const r=lo+(hi-lo)*i/50,e=evaluateSurface(s,r,0)!;expect(e.sag).toBeGreaterThanOrEqual(b[0]-1e-16);expect(e.sag).toBeLessThanOrEqual(b[1]+1e-16);if(r>0){expect(e.dy/r).toBeGreaterThanOrEqual(g[0]-1e-10);expect(e.dy/r).toBeLessThanOrEqual(g[1]+1e-10);}}}
});
test('lens interior crossing is detected even when vertex and edge thickness are positive',()=>{
 const front=asphere(0,0,{a4:5e9,a6:-5e15,a8:0}),rear={shape:'plane' as const,radius:.005};close(sag(front,.001,0),0,1e-17);expect(positiveThickness(front,rear,.0005,.001)).toBe(false);
 const p=fiberLensFiberProject(),d=prescription(p),next=withPrescription({...p,bodies:[{kind:'lens',assemblyId:'Starter-Lens',outerRadius:.001}]},{...d,surfaces:d.surfaces.map((s,i)=>i===0?{...s,...front}:i===1?{...s,...rear,frame:pose(.0005)}:s)});expect(projectTrace(next).status).toBe('invalid');
});
test('schema rejects unsupported polynomial fields / bad conic domain; body tests full outer radius',()=>{
 const p=fiberLensFiberProject(),d=prescription(p),bad={...d,surfaces:d.surfaces.map((s,i)=>i===0?{...s,...asphere(.001,1)}:s)};expect(()=>PrescriptionSchema.parse(bad)).toThrow('Conic domain');
 expect(()=>PrescriptionSchema.parse({...d,surfaces:d.surfaces.map((s,i)=>i===0?{...s,conic:-1}:s)})).toThrow('Even Asphere');
 expect(()=>PrescriptionSchema.parse({...d,surfaces:d.surfaces.map((s,i)=>i===0?{...s,...asphere(),aspheric:{a4:0,a6:0,a8:0,a2:1}}:s)})).toThrow();
 const extended=withPrescription({...p,bodies:[{kind:'lens',assemblyId:'Starter-Lens',outerRadius:.0016}]},{...d,surfaces:d.surfaces.map((s,i)=>i===0?{...s,...asphere(.002,1)}:s)});expect(projectTrace(extended).status).toBe('invalid');
});
test('world intersection normal and point are covariant under a rotated/decentered Surface frame',()=>{
 const a=surface(asphere(.006,-1,{a4:2e7,a6:0,a8:0})),f=frame(pose(.1,-.05,.02,.3,-.4,.2)),ray={origin:V(-.002,.0003,-.0002),direction:unit(V(1,.04,-.03)),n:1,channel:'0'},hit=intersect(ray,a)!;
 const moved=intersect({...ray,origin:pointToWorld(f,ray.origin),direction:vectorToWorld(f,ray.direction)},{...a,world:f})!;close(norm(sub(moved.point,pointToWorld(f,hit.point))),0,1e-13);close(norm(sub(moved.normal,vectorToWorld(f,hit.normal))),0,1e-12);
});
test('trace, Report caps and finite body annuli consume the same Sag in nested frames',()=>{
 const p=asphericProject(),d=prescription(p),root=pose(.1,-.05,.02,.4,-.3,.2),f=frame(root),moved=withPrescription(p,{...d,source:{...d.source,frame:framePose(compose(f,frame(d.source.frame)))},assemblies:[...d.assemblies.map(a=>({...a,parentId:'Root'})),{id:'Root',name:'Root',kind:'group',parentId:null,frame:root}]}),trace=projectTrace(moved),ss=compile(prescription(moved));expect(trace.status).toBe('valid');expect(trace.reached).toBe(trace.paths.length);
 const report=reportGeometry(prescription(moved),trace,false),body=bodyGeometry(prescription(moved),ss,moved.bodies);expect(body.issues).toEqual([]);
 const front=ss[0];for(const face of report.faces.filter(x=>x.surfaceId===front.id&&x.role==='optical-cap'))for(const p of face.points){const q=pointToLocal(front.world,p);close(q.x,sag(front,q.y,q.z),1e-13);}
 for(const h of trace.paths.flatMap(p=>p.hits).filter(h=>h.surfaceId===front.id))close(h.local.x,sag(front,h.local.y,h.local.z),ROOT_RESIDUAL*1.1);
 const plain=projectTrace(p);trace.paths.forEach((path,i)=>{expect(path.status).toBe(plain.paths[i].status);close(path.opl,plain.paths[i].opl,1e-12);});
 expect(body.faces.every(face=>face.points.every(p=>Number.isFinite(p.x+p.y+p.z)))).toBe(true);
});
test('aspheric coefficients alter geometric rays while Gaussian remains an explicitly scoped vertex reference',()=>{
 const p=fiberLensFiberProject(),d=prescription(p),zero=withPrescription(p,{...d,surfaces:d.surfaces.map((s,i)=>i===0?{...s,...asphere()}:s)}),g=solvePhysicalGaussian(p),z=solvePhysicalGaussian(zero);expect(g.status).toBe('valid');expect(z.status).toBe('valid');if(g.status==='valid'&&z.status==='valid'){close(g.incident.y.radius,z.incident.y.radius,1e-15);expect(z.overlap.status).toBe('valid');}
 const changed=asphericProject(),r=solvePhysicalGaussian(changed);expect(r.status).toBe('valid');if(r.status==='valid'){expect(r.higherOrder).toBe(true);expect(r.overlap.status).toBe('not-calculated');close(r.incident.y.radius,g.status==='valid'?g.incident.y.radius:NaN,1e-15);}
 const rays=projectTrace(changed),base=projectTrace(withPrescription(p,{...d,source:{...d.source,radius:.0004}}));expect(rays.paths[0].points.at(-1)).not.toEqual(base.paths[0].points.at(-1));
});
test('old JSON stays byte-identical; new profile survives SaveLoad / row copy / Building Block reuse',()=>{
 const old=projectExample('compound'),raw=serializeProject(old);expect(serializeProject(parseProject(raw))).toBe(raw);expect(raw).not.toContain('aspheric');const p=asphericProject(),saved=serializeProject(p);expect(serializeProject(parseProject(saved))).toBe(saved);
 const copied=rowCommand(p,'S1','duplicate','asphere-copy');expect(prescription(copied.project).surfaces.find(s=>s.id===copied.selection)?.aspheric).toEqual(prescription(p).surfaces[0].aspheric);
 const blank=rowCommand(p,'S1','before','blank-asphere');expect(prescription(blank.project).surfaces.find(s=>s.id===blank.selection)?.aspheric).toBeUndefined();
 const block=saveBuildingBlock(p,'S1','aspheric-block'),inserted=insertBuildingBlock(block,block.buildingBlocks![0].id,pose(.007),'S2','asph-reuse');expect(prescription(inserted.project).surfaces.find(s=>s.id===inserted.selection)?.aspheric).toEqual(prescription(p).surfaces[0].aspheric);
});

test('an unresolved earlier tangency cannot be bypassed in favor of a later transverse root',()=>{
 const s=asphere(0,0,{a4:2e8,a6:-2e8/(.0005**2),a8:0});expect(()=>asphereRoot(V(0,-.00025,0),V(0,1,0),s,.001)).toThrow(IntersectionFailure);
});
test('scene fit bounds enclose an interior aspheric sag extremum rather than only the rim',async()=>{
 const {sceneBounds}=await import('../src/surface/Scene');const p=fiberLensFiberProject(),d=prescription(p),profile=asphere(0,0,{a4:5e9,a6:-5e15,a8:0}),next=withPrescription({...p,bodies:[]},{...d,surfaces:d.surfaces.map((s,i)=>i===0?{...s,...profile}:s)}),trace=projectTrace(next),bounds=sceneBounds(prescription(next),trace),front=trace.surfaces[0],peak=pointToWorld(front.world,V(sag(front,Math.sqrt(2/3)*.001,0),Math.sqrt(2/3)*.001,0));
 expect(Math.min(...bounds.points.map(p=>p.x))).toBeLessThanOrEqual(peak.x);expect(Math.max(...bounds.points.map(p=>p.x))).toBeGreaterThanOrEqual(peak.x);
});

test('a decentered and tilted Aspheric Lens assembly keeps the finite body and exact Ray normals',()=>{
 const p=asphericProject(),d=prescription(p),moved=withPrescription(p,{...d,surfaces:d.surfaces.map((s,i)=>i===d.surfaces.length-1?{...s,aperture:.001}:s),assemblies:d.assemblies.map(a=>a.id==='Starter-Lens'?{...a,frame:pose(.0045,.0001,-.00005,.02,-.01)}:a)}),trace=projectTrace(moved);expect(trace.status).toBe('valid');expect(trace.reached).toBe(trace.paths.length);expect(trace.centroidLocal!.y).not.toBe(0);
 const front=trace.surfaces[0];for(const hit of trace.paths.flatMap(p=>p.hits).filter(h=>h.surfaceId==='S1')){const n=surfaceNormal(front,hit.local.y,hit.local.z)!;close(norm(sub(hit.normal,vectorToWorld(front.world,n))),0,1e-12);}
 expect(solvePhysicalGaussian(moved).status).toBe('out-of-domain');
});
