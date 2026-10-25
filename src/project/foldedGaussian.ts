import type {Complex} from '../physics';
import {fingerprint,rayleigh} from '../physics';
import {compile,frame,V,add,sub,mul,dot,norm,unit} from '../surface/model';
import type {Vec} from '../surface/model';
import {cross} from '../surface/reportGeometry';
import {traceRay,reflect} from '../surface/trace';
import {bodyGeometry,insideBody} from './geometry';
import {physicalGaussianInput} from './physicalGaussian';
import type {Project} from './model';
export const FOLDED_GAUSSIAN_ID='transported-scalar-gaussian/1.0.0';
type M=[number,number,number,number];
export type QTensor=[Complex,Complex,Complex,Complex];
const c=(re=0,im=0):Complex=>({re,im});
const sum=(a:Complex,b:Complex)=>c(a.re+b.re,a.im+b.im);
const neg=(a:Complex)=>c(-a.re,-a.im);
const times=(a:Complex,b:Complex)=>c(a.re*b.re-a.im*b.im,a.re*b.im+a.im*b.re);
const scale=(a:Complex,b:number)=>c(a.re*b,a.im*b);
const divide=(a:Complex,b:Complex)=>{const n=b.re*b.re+b.im*b.im;if(!Number.isFinite(n)||n===0)throw Error('Singular Gaussian tensor');return c((a.re*b.re+a.im*b.im)/n,(a.im*b.re-a.re*b.im)/n);};
export function inverseQ(q:QTensor):QTensor {const det=sum(times(q[0],q[3]),neg(times(q[1],q[2])));return [divide(q[3],det),divide(neg(q[1]),det),divide(neg(q[2]),det),divide(q[0],det)];}
/** Change transverse coordinates or apply an anamorphic plane interface: Q' = A Q Aᵀ. */
export function transformQ(q:QTensor,a:M):QTensor {
 const out:Complex[]=[];for(let i=0;i<2;i++)for(let j=0;j<2;j++){let z=c();for(let k=0;k<2;k++)for(let l=0;l<2;l++)z=sum(z,scale(q[2*k+l],a[2*i+k]*a[2*j+l]));out.push(z);}return out as QTensor;
}
export function propagateQ(q:QTensor,length:number,n:number):QTensor{return [sum(q[0],c(length/n)),q[1],q[2],sum(q[3],c(length/n))];}
export function powerQ(q:QTensor,power:number):QTensor {const k=inverseQ(q);return inverseQ([sum(k[0],c(-power)),k[1],k[2],sum(k[3],c(-power))]);}
function eig(a:number,b:number,d:number){const delta=Math.hypot(a-d,2*b);return [(a+d+delta)/2,(a+d-delta)/2] as const;}
export type BeamSection={radii:[number,number];curvatures:[number,number];angle:number;waistOffsets:[number,number]|null;waistRadii:[number,number]|null};
/** Principal intensity axes, ordered major then minor; angle measured from transported U toward V. */
export function section(q:QTensor,lambda:number,n:number):BeamSection {
 const k=inverseQ(q),a=-k[0].im,b=-(k[1].im+k[2].im)/2,d=-k[3].im,[high,low]=eig(a,b,d);
 if(!(low>0&&Number.isFinite(high)))throw Error('Gaussian tensor is not positive definite');
 const angle=.5*Math.atan2(2*b,a-d)+Math.PI/2,u=[Math.cos(angle),Math.sin(angle)],v=[-u[1],u[0]];
 const along=(w:number[])=>sum(scale(k[0],w[0]**2),sum(scale(k[1],2*w[0]*w[1]),scale(k[3],w[1]**2)));
 const ku=along(u),kv=along(v),crossPhase=k[0].re*u[0]*v[0]+k[1].re*(u[0]*v[1]+u[1]*v[0])+k[3].re*u[1]*v[1];
 const separable=Math.abs(crossPhase)<=1e-8*Math.max(Math.abs(ku.re),Math.abs(kv.re),a,d,1e-30),qu=divide(c(1),ku),qv=divide(c(1),kv);
 return {radii:[Math.sqrt(lambda/(Math.PI*low)),Math.sqrt(lambda/(Math.PI*high))],curvatures:[ku.re/n,kv.re/n],angle,waistOffsets:separable?[-n*qu.re,-n*qv.re]:null,waistRadii:separable?[Math.sqrt(lambda*qu.im/Math.PI),Math.sqrt(lambda*qv.im/Math.PI)]:null};
}
export type FoldedSample={distance:number;opl:number;point:Vec;direction:Vec;u:Vec;v:Vec;n:number;q:QTensor;beam:BeamSection;surfaceId?:string;side:'before'|'after'};
export type FoldedResult={status:'valid';id:string;fingerprint:string;wavelength:number;samples:FoldedSample[];surfaces:{id:string;interaction:string;before:FoldedSample;after:FoldedSample;tailBound:number|null}[];incident:FoldedSample;warnings:string[];apertureLimited:boolean;positionError:number;angleError:number;outputOffset:Vec;outputDirection:Vec;outputAxes:[Vec,Vec];targetMFD:[number|null,number|null];overlapReason:string}
 |{status:'invalid'|'out-of-domain';id:string;fingerprint:string;reason:string};
export function hasFolds(p:Project){return p.model.kind==='surface'&&p.model.prescription.surfaces.some(s=>s.interaction==='reflect'||s.interaction==='tir');}
export function foldedInput(p:Project){return {physics:physicalGaussianInput(p),sourceGate:p.model.kind==='surface'?{channels:p.model.prescription.source.channels,n:p.model.prescription.source.n}:null};}
/** Scalar paraxial reference about the exact finite chief ray, with a full complex symmetric 2×2 reduced Q=q/n.
 * Flat folds transport both transverse axes, including parity. Curved refraction is centered normal-incidence only.
 * Clipping is diagnosed, never propagated. No TIR/coating phase, delivered power, or mode-overlap claim.
 */
export function solveFoldedGaussian(p:Project):FoldedResult {
 const fp=fingerprint(JSON.stringify(foldedInput(p))),fail=(reason:string,status:'invalid'|'out-of-domain'='out-of-domain'):FoldedResult=>({status,id:FOLDED_GAUSSIAN_ID,fingerprint:fp,reason});
 if(p.model.kind!=='surface')return fail('Physical Surface Project required.');
 const d=p.model.prescription,ports=p.authoring?.ports,port=ports?.source,sm=p.model.sourceMode,lambda=d.wavelength,ss=compile(d);
 if(!port||port.fieldModel!=='gaussian'||port.imported||port.adapter!=='homogeneous-paraxial'||port.phase!=='waist-plane'||port.mediumIndex===null||port.normalization==='unspecified'||port.normalization==='absolute-power'&&port.powerW===null)return fail('Input: Port phase / medium / normalization / adapter are undefined or unsupported. Define a homogeneous Gaussian waist.');
 if(port.device==='pic-edge'||port.device==='pic-grating')return fail('Input PIC emitted field is undefined; a stored Gaussian reference cannot replace the device field.');
 if(sm.mfdX===null||sm.mfdY===null)return fail('Input MFD X / Y is undefined.','invalid');
 if(d.source.channels.rows!==1||d.source.channels.cols!==1||ss.some(s=>s.array))return fail('Single-channel Gaussian only; arrays require per-channel fields.');
 if(d.source.n===null||Math.abs(d.source.n-port.mediumIndex)>1e-10)return fail('Input Port / diagnostic medium mismatch.','invalid');
 if(ss.some(s=>s.interaction==='probe'&&s.shape!=='plane'))return fail('Probe must be planar.');
 const g=bodyGeometry(d,ss,p.bodies);if(g.issues.length)return fail(g.issues.join(' · '),'invalid');
 const source=frame(d.source.frame),path=traceRay({origin:source.origin,direction:source.axes[0],n:port.mediumIndex,channel:'gaussian-chief'},ss,(v,s)=>insideBody(v,s,g));
 if(path.status!=='reached')return fail(`Chief ray blocked: ${path.reason}`,'invalid');
 let q:QTensor=[c(0,rayleigh(sm.mfdX/2,lambda)),c(),c(),c(0,rayleigh(sm.mfdY/2,lambda))],point=source.origin,direction=source.axes[0],u=source.axes[1],v=source.axes[2],n=port.mediumIndex,distance=0,opl=0,tailSum=0;
 const samples:FoldedSample[]=[],surfaces:Extract<FoldedResult,{status:'valid'}>['surfaces']=[],warnings:string[]=[];
 const snapshot=(side:'before'|'after',surfaceId?:string):FoldedSample=>({distance,opl,point,direction,u,v,n,q,beam:section(q,lambda,n),surfaceId,side});
 const divergence=()=>{const [,low]=eig(q[0].im,(q[1].im+q[2].im)/2,q[3].im);return Math.sqrt(lambda/(Math.PI*low))/n;};
 try{
  if(divergence()>.1+1e-12)return fail('Paraxial gate: waist divergence exceeds 0.1 rad.');
  samples.push(snapshot('after'));
  const total=path.points.slice(1).reduce((sum,p,i)=>sum+norm(sub(p,path.points[i])),0);
  for(let index=0;index<ss.length;index++){
   const s=ss[index],hit=path.hits[index],length=norm(sub(hit.point,point)),begin=point,oldQ=q,oldDistance=distance,oldOPL=opl;
   const count=Math.max(1,Math.ceil(180*length/total));
   for(let i=1;i<=count;i++){const l=length*i/count;point=add(begin,mul(direction,l));distance=oldDistance+l;opl=oldOPL+n*l;q=propagateQ(oldQ,l,n);samples.push(snapshot('before',i===count?s.id:undefined));}
   point=hit.point;const before=snapshot('before',s.id),ci=Math.abs(dot(direction,hit.normal));
   if(ci<.1)return fail(`${s.id}: grazing incidence outside the local Gaussian reference.`);
   let tailBound:number|null=null;
   if(s.interaction!=='probe'){
    let margin=s.aperture-Math.hypot(hit.local.y,hit.local.z);
    const solid=g.solids.find(x=>x.body.assemblyId===s.assemblyId);
    if(solid?.body.kind==='prism'){
     const center=mul(solid.faces.flat().reduce(add,V()),1/solid.faces.flat().length);
     for(const face of solid.faces){const raw=cross(sub(face[1],face[0]),sub(face[2],face[0]));if(norm(raw)<1e-24)continue;const normal=mul(unit(raw),Math.sign(dot(raw,sub(center,face[0])))),projection=norm(sub(normal,mul(hit.normal,dot(normal,hit.normal))));if(projection>1e-8)margin=Math.min(margin,dot(normal,sub(point,face[0]))/projection);}
    }else if(solid?.body.kind==='mirror'){
     const body=solid.body;
     margin=Math.min(margin,body.outline==='disc'?body.width/2-Math.hypot(hit.local.y,hit.local.z):Math.min(body.width/2-Math.abs(hit.local.y),body.height/2-Math.abs(hit.local.z)));
    }
    const projected=before.beam.radii[0]/ci;
    tailBound=margin<=0?1:Math.exp(-2*(margin/projected)**2);tailSum+=tailBound;
    if(tailBound>1e-3)warnings.push(`${s.id}: aperture / body tail bound ${(100*tailBound).toPrecision(3)}%; clipping diffraction is not propagated.`);
   }
   if((s.interaction==='reflect'||s.interaction==='tir')&&s.shape!=='plane')return fail(`${s.id}: curved reflecting surfaces require tangential / sagittal optical power.`);
   if(s.interaction==='reflect'||s.interaction==='tir'){
    // An orthogonal reflection reverses handedness: reflect U, negate reflected V, and flip Q_UV.
    u=reflect(u,hit.normal);v=mul(reflect(v,hit.normal),-1);q=transformQ(q,[1,0,0,-1]);
    if(s.interaction==='tir'){
     const critical=Math.asin(s.outsideIndex!/n),incidence=Math.acos(Math.min(1,ci));
     if(incidence-critical<3*divergence())warnings.push(`${s.id}: angular spectrum may cross the critical angle; TIR Gaussian reference only.`);
    }
   }else if(s.interaction==='refract'){
    const nextN=s.nAfter!;
    if(s.shape!=='plane'){
     if(s.shape==='even-asphere'&&((s.conic??0)!==0||Object.values(s.aspheric??{}).some(a=>a!==0)))return fail(`${s.id}: higher-order aspheric phase requires field propagation.`);
     if(dot(direction,hit.normal)<1-1e-10||Math.hypot(hit.local.y,hit.local.z)>1e-10)return fail(`${s.id}: curved refraction must be centered and normal; oblique curved astigmatism is not supported.`);
     const radius=s.radius;if(radius!==0&&2*before.beam.radii[0]/Math.abs(radius)>.2)return fail(`${s.id}: 2w / |R| exceeds 0.2; local aberration outside Gaussian reference.`);
     q=powerQ(q,radius===0?0:(nextN-n)/radius);
    }else if(ci<1-1e-12){
     const tangent=unit(sub(hit.normal,mul(direction,dot(hit.normal,direction)))),sagittal=unit(cross(direction,tangent));
     q=transformQ(q,[dot(tangent,u),dot(tangent,v),dot(sagittal,u),dot(sagittal,v)]);
     const co=Math.abs(dot(hit.direction,hit.normal));q=transformQ(q,[co/ci,0,0,1]);
     u=unit(cross(sagittal,hit.direction));v=sagittal;
    }
    n=nextN;
   }
   direction=hit.direction;
   if(divergence()>.1+1e-12)return fail(`${s.id}: post-surface waist divergence exceeds 0.1 rad.`);
   const after=snapshot('after',s.id);samples.push(after);surfaces.push({id:s.id,interaction:s.interaction,before,after,tailBound});
  }
  const target=ss.at(-1)!.world,last=path.hits.at(-1)!,outDir=V(...target.axes.map(a=>dot(a,direction)) as [number,number,number]);
  const apertureLimited=tailSum>1e-3;
  if(apertureLimited)warnings.unshift('Aperture limited: displayed envelopes are untruncated Gaussian references, not the transmitted field.');
  warnings.push('Scalar paraxial reference about the finite chief ray. Flat mirrors and TIR transport geometry; coating / Fresnel / TIR phase, polarization, Goos–Hänchen shifts and absolute power are omitted.','Distances are geometric arclength; OPL = Σ nL. Waist offsets extrapolate only within the current homogeneous medium; no claim across another surface.');
  const overlapReason=ports?.target.device==='pic-edge'||ports?.target.device==='pic-grating'?'PIC receiving field is undefined. Target MFD is a user reference; device coupling is not calculated.':'Folded mode overlap is not calculated in S3.1; interface phase / polarization and clipping propagation are omitted.';
  return {status:'valid',id:FOLDED_GAUSSIAN_ID,fingerprint:fp,wavelength:lambda,samples,surfaces,incident:samples.at(-1)!,warnings,apertureLimited,positionError:Math.hypot(last.local.y,last.local.z),angleError:Math.atan2(Math.hypot(outDir.y,outDir.z),outDir.x),outputOffset:last.local,outputDirection:outDir,outputAxes:[target.axes[1],target.axes[2]],targetMFD:ports?.target.fieldModel==='gaussian'?[p.model.targetMode.mfdX,p.model.targetMode.mfdY]:[null,null],overlapReason};
 }catch(e){return fail(e instanceof Error?e.message:String(e),'invalid');}
}
