/** D2.8-A test-only diagnostics. No candidate qualification or Solver gate changes.
 * Ray flux is geometrical, not a diffracted field or delivered Mode coupling.
 */
import {prescription} from '../../src/project/model';
import type {Project} from '../../src/project/model';
import {compile,frame,V,pointToWorld,vectorToWorld,sub,dot,norm} from '../../src/surface/model';
import type {Vec} from '../../src/surface/model';
import {traceRay} from '../../src/surface/trace';
import {bodyGeometry,insideBody} from '../../src/project/geometry';
import {trainPupilInput,integrateTrainPupil} from '../../src/project/trainPupilBenchmark';
import {propagateQ,powerQ,section} from '../../src/project/foldedGaussian';
import type {QTensor} from '../../src/project/foldedGaussian';
import type {Cylinder} from './clearanceOracle';

/** Exact interval intersection of a closed segment and opaque finite cylinder.
 * Physical solid, gap=0: mechanical clearance is not an optical absorption shell.
 * Independent of D2.7's separating-axis and distance-minimization predicates. */
export function cylinderEntry(a:Vec,b:Vec,c:Cylinder):number|null {
 const d=sub(b,a),p=sub(a,c.front),x=dot(p,c.normal),dx=dot(d,c.normal);
 let lo=0,hi=1;
 if(Math.abs(dx)<1e-16){if(x>1e-14||x< -c.thickness-1e-14)return null;}
 else {const u=(-c.thickness-x)/dx,v=-x/dx;lo=Math.max(lo,Math.min(u,v));hi=Math.min(hi,Math.max(u,v));if(lo>hi)return null;}
 const y={x:p.x-x*c.normal.x,y:p.y-x*c.normal.y,z:p.z-x*c.normal.z},v={x:d.x-dx*c.normal.x,y:d.y-dx*c.normal.y,z:d.z-dx*c.normal.z};
 const A=dot(v,v),B=dot(y,v),C=dot(y,y)-c.radius*c.radius;
 if(A<1e-30)return C<=0?lo:null;
 const disc=B*B-A*C;if(disc<0)return null;
 const root=Math.sqrt(Math.max(0,disc)),u=(-B-root)/A,w=(-B+root)/A;
 lo=Math.max(lo,u);hi=Math.min(hi,w);return lo<=hi?lo:null;
}
export function mirrorBodies(p:Project){const ss=compile(prescription(p));return p.bodies.flatMap(b=>{
 if(b.kind!=='mirror')return [];if(b.outline!=='disc')throw Error('Disc Mirror diagnostic only');
 const f=ss.find(s=>s.assemblyId===b.assemblyId)!;return [{id:b.assemblyId,front:f.world.origin,normal:f.world.axes[0],radius:b.width/2,thickness:b.thickness}];
});}
/** The legacy pupil adapter supplies the unchanged input waist propagation and
 * independent source-relative Lens frames. It does NOT support the folded train.
 * This prefix view is diagnostic data, never an edited candidate / Port contract. */
export function launchInput(p:Project){
 const q=structuredClone(p),d=prescription(q),first=d.surfaces[0].assemblyId;
 d.surfaces=[...d.surfaces.filter(s=>s.assemblyId===first),d.surfaces.at(-1)!];q.bodies=q.bodies.filter(b=>b.assemblyId===first);
 return trainPupilInput(q);
}
export type RayFlux={grid:number;rays:number;sampledPower:number;tailPower:number;passed:number;aperture:number;shadow:number;other:number;reasons:Record<string,number>;shadowByBody:Record<string,number>;maxLaunchAngle:number;sequentialReached:number;scope:string};
/** Equal bins in normalized radius; integrate each annular weight exactly.
 * 4n midpoint azimuths. Domain r<=3.5w omits exp(-24.5) input power, reported.
 * Gaussian phase gradient launch matches D2.6 finite-ray pupil convention. */
export function rayFlux(p:Project,n:number,local?:{w:number;origin:Vec;direction:Vec;u:Vec;v:Vec}):RayFlux {
 if(!Number.isInteger(n)||n<8||n>512)throw Error('Grid 8–512 required');
 const d=prescription(p),ss=compile(d),g=bodyGeometry(d,ss,p.bodies),src=frame(d.source.frame),s=local?null:launchInput(p),bodies=mirrorBodies(p);
 if(g.issues.length)throw Error(g.issues.join('; '));
 if(ss.some(s=>s.interaction==='tir'||!['sphere','plane'].includes(s.shape)))throw Error('No Prism / asphere reference');
 const wx=local?.w??s!.inputW[0],wz=local?.w??s!.inputW[1],count=4*n;
 const out:RayFlux={grid:n,rays:0,sampledPower:1-Math.exp(-24.5),tailPower:Math.exp(-24.5),passed:0,aperture:0,shadow:0,other:0,reasons:{},shadowByBody:{},maxLaunchAngle:0,sequentialReached:0,scope:'Geometrical source-weighted ray flux; no post-launch diffraction, Fresnel/coating loss, phase interference or Mode overlap'};
 for(let i=0;i<n;i++){
  const r=3.5*(i+.5)/n,weight=(Math.exp(-24.5*(i/n)**2)-Math.exp(-24.5*((i+1)/n)**2))/count;
  for(let j=0;j<count;j++){
   const theta=2*Math.PI*(j+.5)/count,y=wx*r*Math.cos(theta),z=wz*r*Math.sin(theta),dy=local?0:s!.inputC[0]*y,dz=local?0:s!.inputC[1]*z;
   out.rays++;const angle=Math.asin(Math.min(1,Math.hypot(dy,dz)));out.maxLaunchAngle=Math.max(out.maxLaunchAngle,angle);
   if(angle>.3){out.other+=weight;out.reasons['Launch direction outside D2.6 0.3 rad domain']=(out.reasons['Launch direction outside D2.6 0.3 rad domain']??0)+weight;continue;}
   const origin=local?{x:local.origin.x+local.u.x*y+local.v.x*z,y:local.origin.y+local.u.y*y+local.v.y*z,z:local.origin.z+local.u.z*y+local.v.z*z}:pointToWorld(src,V(s!.launch,y,z));
   const direction=local?.direction??vectorToWorld(src,V(Math.sqrt(1-dy*dy-dz*dz),dy,dz));
   const path=traceRay({origin,direction,n:1,channel:'finite-beam'},ss,(v,f)=>insideBody(v,f,g));
   if(path.status==='reached')out.sequentialReached+=weight;
   let shadow:string|null=null;
   for(let k=0;k<path.points.length-1&&!shadow;k++){
    const start=k?ss[k-1].assemblyId:null,end=ss[k]?.assemblyId;
    let earliest=Infinity;
    for(const c of bodies){if(c.id===start||c.id===end&&dot(sub(path.points[k+1],path.points[k]),c.normal)<0)continue;const t=cylinderEntry(path.points[k],path.points[k+1],c);if(t!==null&&t<earliest){earliest=t;shadow=c.id;}}
   }
   if(shadow){out.shadow+=weight;out.shadowByBody[shadow]=(out.shadowByBody[shadow]??0)+weight;}
   else if(path.status==='reached')out.passed+=weight;
   else {const key=/clipping/.test(path.reason)?'aperture':'other';out[key]+=weight;out.reasons[path.reason]=(out.reasons[path.reason]??0)+weight;}
  }
 }
 return out;
}
/** Formal first-order extrapolation; NOT a bypass of solveFoldedGaussian gates.
 * Centered circular, normal spherical refraction / planar Mirror only. */
export function paraxialSections(p:Project){
 const d=prescription(p);if(p.model.kind!=='surface'||!p.model.sourceMode.mfdX||p.model.sourceMode.mfdX!==p.model.sourceMode.mfdY)throw Error('Circular Gaussian source required');
 const ss=compile(d),src=frame(d.source.frame),path=traceRay({origin:src.origin,direction:src.axes[0],n:1,channel:'formal-reference'},ss);
 if(path.status!=='reached')throw Error(path.reason);
 const zr=Math.PI*(p.model.sourceMode.mfdX/2)**2/d.wavelength;let q:QTensor=[{re:0,im:zr},{re:0,im:0},{re:0,im:0},{re:0,im:zr}],n=1;
 return ss.map((s,i)=>{
  const length=norm(sub(path.points[i+1],path.points[i]));q=propagateQ(q,length,n);const beam=section(q,d.wavelength,n),incoming=i?path.hits[i-1].direction:src.axes[0],ci=Math.abs(dot(incoming,path.hits[i].normal));
  const footprintRatio=s.interaction==='refract'&&s.shape==='sphere'?2*beam.radii[0]/ci/Math.abs(s.radius):null;
  const row={id:s.id,interaction:s.interaction,w:beam.radii[0],curvature:beam.curvatures[0],radiusOfCurvature:beam.curvatures[0]===0?null:1/beam.curvatures[0],ci,projectedAperture:s.aperture*ci,footprintRadius:beam.radii[0]/ci,footprintRatio,gaussianFootprintGate:footprintRatio===null||footprintRatio<=.2,tailBound:Math.exp(-2*(s.aperture*ci/beam.radii[0])**2)};
  if(s.interaction==='refract'){if(ci<1-1e-10)throw Error('Normal Lens only');if(s.shape==='sphere')q=powerQ(q,(s.nAfter!-n)/s.radius);n=s.nAfter!;}else if(s.interaction!=='reflect'&&s.interaction!=='probe')throw Error('Planar Mirrors only');
  return row;
 });
}
/** Positive-term erf series; avoids subtractive cancellation. For |x|>=6,
 * the omitted complementary tail is <exp(-36)/(6 sqrt(pi)). */
function erf(x:number){const a=Math.abs(x);if(a>=6)return Math.sign(x);let term=a,sum=a;for(let n=1;n<256;n++){term*=2*a*a/(2*n+1);sum+=term;if(term<Math.abs(sum)*1e-16)break;}return Math.sign(x)*2/Math.sqrt(Math.PI)*Math.exp(-a*a)*sum;}
export function projectedMask(w:number,h:number,degrees:number,clear=200e-6,body=220e-6,steps=4096){
 if(!(w>0&&h>0&&degrees>0&&degrees<90&&body>=clear)||steps%2)throw Error('Centered parallel double-fold mask domain');
 const s=Math.sin(degrees*Math.PI/360);
 if(h<=body*s)throw Error('Chief shadowed: outside positive central-gap reference domain');
 const f=(y:number,shadow:boolean)=>{
  const aperture=s*Math.sqrt(Math.max(0,clear*clear-y*y)),gap=h-s*Math.sqrt(Math.max(0,body*body-y*y)),z=shadow?Math.min(aperture,gap):aperture;
  return Math.sqrt(2/Math.PI)/w*Math.exp(-2*(y/w)**2)*erf(Math.SQRT2*z/w);
 };
 // y=clear sin(t) removes the circular-edge square-root derivative singularity.
 const integrate=(shadow:boolean)=>{let sum=0;for(let i=0;i<=steps;i++){const t=-Math.PI/2+Math.PI*i/steps,y=clear*Math.sin(t);sum+=(i===0||i===steps?1:i%2?4:2)*f(y,shadow)*clear*Math.cos(t);}return sum*Math.PI/steps/3;};
 const apertureTransmission=integrate(false),clearTransmission=integrate(true);
 return {apertureTransmission,clearTransmission,shadowAfterAperture:apertureTransmission-clearTransmission,centralHalfGap:h-body*s,projectedHalfAperture:clear*s,scope:'Parallel constant-radius incident Gaussian, centered identical disc folds; local geometrical mask integral, not propagation or coupling'};
}

export const FLUX_REFINEMENT_TOLERANCE=2e-3;
export function fluxConvergence(history:RayFlux[]){
 const h=history.slice(-3),keys=['passed','aperture','shadow','other','sequentialReached'] as const;
 const valid=h.length===3&&h.every((v,i)=>i===0||v.grid===h[i-1].grid*2);
 const maxChange=valid?Math.max(...keys.flatMap(k=>[Math.abs(h[2][k]-h[1][k]),Math.abs(h[1][k]-h[0][k])])):null;
 return {status:valid&&maxChange!==null&&maxChange<FLUX_REFINEMENT_TOLERANCE?'converged':'unresolved',maxChange,tolerance:FLUX_REFINEMENT_TOLERANCE,physicalErrorBound:null,scope:'Observed successive ray-flux refinement; not a rigorous error bound, field convergence, or a 0.1% clipping qualification'};
}

/** Reuse the D2.6 ray-pupil phase/OPL/Jacobian reference on the first Lens ONLY.
 * Target-dependent overlap fields are deliberately not exported for this prefix.
 * Weighted phase after quadratic removal is not an end-to-end Mode estimate. */
export function lensPrefixPhase(p:Project,n:number){
 const input=launchInput(p),it=integrateTrainPupil(input,n);let r=it.next();while(!r.done)r=it.next();
 const v=r.value,c=v.quadratic.coefficients,s=v.quadratic.scale;
 return {grid:n,inputPower:v.inputPower,blockedPower:v.blockedPower,rejectedPower:v.rejectedPower,rmsOPD:v.rmsOPD,phaseFidelity:v.phaseFidelity,minimumJacobian:v.minimumJacobian,jacobianError:v.jacobianError,
  bestQuadraticCurvature:[2*c[3]/(s[0]*s[0]),2*c[5]/(s[1]*s[1])],exitFromSource:input.exit,scope:'First Lens exit plane only; geometric OPL plus paraxial incident phase, no between-surface diffraction; no target overlap or total coupling'};
}
