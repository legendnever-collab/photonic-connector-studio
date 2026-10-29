import {compile,frame,dot,pointToLocal} from '../surface/model';
import type {Frame} from '../surface/model';
import {bodyGeometry} from './geometry';
import {inverseQ,transformQ,powerQ,propagateQ} from './foldedGaussian';
import type {QTensor} from './foldedGaussian';
import {gaussianTensorOverlap} from './tensorOverlap';
import {rayleigh} from '../physics';
import {serializeProject} from './model';
import type {Project} from './model';

export const LENS_BENCHMARK_ID='single-lens-phase-screen/1.0.0';
export const LENS_BENCHMARK_SCOPE='Single Lens collapsed to its front vertex plane; exact spherical thickness phase vs quadratic phase, scalar Fresnel propagation by adjoint Gaussian overlap. Internal glass propagation, oblique refraction, Fresnel/coating losses and vector fields omitted. Screen-model comparison only; physical accuracy / total coupling are not established.';
export const SCREEN_ETA_THRESHOLD=.01;
export type ScreenInput={wavelength:number;indexDelta:number;frontRadius:number;rearRadius:number;aperture:number;inputQ:QTensor;targetQ:QTensor;inputCenter:[number,number];targetCenter:[number,number]};
export type ScreenSample={radialNodes:number;angularNodes:number;pupilFraction:number;exactEta:number;quadraticPupilEta:number;phaseFidelity:number;referenceFidelity:number;rmsPhase:number;maxPhaseStep:number};
type Metrics={sample:ScreenSample;analyticEta:number;numericalErrorEstimate:number;estimatedDeviationInterval:[number,number];referenceGate:'within-threshold'|'exceeds-threshold'|'unresolved';threshold:number;history:ScreenSample[]};
export type LensBenchmark={engine:string;inputSignature:string;scope:string;status:'converged'|'unresolved'|'unsupported'|'cancelled';reason:string;metrics:Metrics|null;lensId:string|null;thickness:number|null;physicalEtaErrorBound:null;totalCoupling:null};

/** Legendre nodes and weights on [0,1]. Integrate in t=r^2/a^2 so
 * dA=a^2/2 dt dtheta and the circular aperture has no pixel staircase. */
function legendre(n:number){
 const out:{t:number;w:number}[]=[];
 for(let i=0;i<n;i++){
  let x=Math.cos(Math.PI*(i+.75)/(n+.5)),dp=0;
  for(let j=0;j<30;j++){let p=1,prev=0;for(let k=1;k<=n;k++){const old=p;p=((2*k-1)*x*p-(k-1)*prev)/k;prev=old;}dp=n*(x*p-prev)/(x*x-1);const step=p/dp;x-=step;if(Math.abs(step)<1e-15)break;}
  out.push({t:(1+x)/2,w:1/((1-x*x)*dp*dp)});
 }
 return out.sort((a,b)=>a.t-b.t);
}
/** Stable exact spherical sag minus its quadratic term. R=0 is a plane. */
export function sphericalExcess(radius:number,r2:number){
 if(radius===0)return 0;
 if(r2<0||r2>=radius*radius)throw Error('Sphere phase outside its forward cap.');
 return r2*r2/(2*radius**3*(1+Math.sqrt(1-r2/(radius*radius)))**2);
}
function field(q:QTensor,lambda:number,center:[number,number]){
 const k=inverseQ(q),det=k[0].im*k[3].im-k[1].im*k[2].im;
 if(!(k[0].im<0&&det>0))throw Error('Invalid positive Gaussian field.');
 const norm=Math.sqrt(2*Math.sqrt(det)/lambda),scale=Math.PI/lambda;
 return (y:number,z:number)=>{const u=y-center[0],v=z-center[1],a=u*u,b=2*u*v,c=v*v;return {amplitude:norm*Math.exp(scale*(k[0].im*a+k[1].im*b+k[3].im*c)),phase:-scale*(k[0].re*a+k[1].re*b+k[3].re*c)};};
}
/** Independent pupil-plane integral. Conjugate the target back-propagated by
 * the SAME scalar Fresnel operator. No sampling of a sub-micron focal plane. */
export function integratePhaseScreen(s:ScreenInput,n:number):ScreenSample{
 if(!Number.isInteger(n)||n<8||n>512)throw Error('Radial grid must be an integer in [8,512].');
 const input=field(s.inputQ,s.wavelength,s.inputCenter),target=field(s.targetQ,s.wavelength,s.targetCenter),k=2*Math.PI/s.wavelength;
 const power=s.indexDelta*((s.frontRadius?1/s.frontRadius:0)-(s.rearRadius?1/s.rearRadius:0));
 const count=2*n,angles=Array.from({length:count},(_,j)=>({c:Math.cos(2*Math.PI*(j+.5)/count),s:Math.sin(2*Math.PI*(j+.5)/count)}));
 let pupil=0,ar=0,ai=0,er=0,ei=0,qr=0,qi=0,m1=0,m2=0,maxStep=0;
 let previousPhase:number[]|null=null,previousQuadratic:number[]|null=null,previousWeight:number[]|null=null,previousResidual=0,previousInputWeight=0;
 for(const row of legendre(n)){
  const r2=s.aperture*s.aperture*row.t,r=Math.sqrt(r2),area=s.aperture*s.aperture*Math.PI*row.w/count;
  const quadratic=k*power*r2/2,residual=-k*s.indexDelta*(sphericalExcess(s.rearRadius,r2)-sphericalExcess(s.frontRadius,r2)),phases:number[]=[],quadraticPhases:number[]=[],weights:number[]=[];let inputWeight=0;
  for(let j=0;j<count;j++){
   const y=r*angles[j].c,z=r*angles[j].s,a=input(y,z),b=target(y,z),I=a.amplitude*a.amplitude,ab=a.amplitude*b.amplitude,phase=a.phase-b.phase+quadratic;
   pupil+=I*area;ar+=I*area*Math.cos(residual);ai+=I*area*Math.sin(residual);m1+=I*area*residual;m2+=I*area*residual*residual;
   er+=ab*area*Math.cos(phase+residual);ei+=ab*area*Math.sin(phase+residual);qr+=ab*area*Math.cos(phase);qi+=ab*area*Math.sin(phase);
   phases.push(phase+residual);quadraticPhases.push(phase);weights.push(ab*s.aperture*s.aperture);inputWeight=Math.max(inputWeight,I*s.aperture*s.aperture);
   if(previousPhase&&Math.max(weights[j],previousWeight![j])>1e-8)maxStep=Math.max(maxStep,Math.abs(phases[j]-previousPhase[j]),Math.abs(phase-previousQuadratic![j]));
   if(j&&Math.max(weights[j],weights[j-1])>1e-8)maxStep=Math.max(maxStep,Math.abs(phases[j]-phases[j-1]));
  }
  if(Math.max(weights[0],weights.at(-1)!)>1e-8)maxStep=Math.max(maxStep,Math.abs(phases[0]-phases.at(-1)!));
  if(previousPhase&&Math.max(inputWeight,previousInputWeight)>1e-8)maxStep=Math.max(maxStep,Math.abs(residual-previousResidual));
  previousPhase=phases;previousQuadratic=quadraticPhases;previousWeight=weights;previousResidual=residual;previousInputWeight=inputWeight;
 }
 if(!(pupil>1e-10)||!Number.isFinite(pupil))throw Error('Pupil field is unresolved or effectively empty.');
 const fidelity=(ar*ar+ai*ai)/pupil;
 const result={radialNodes:n,angularNodes:count,pupilFraction:pupil,exactEta:(er*er+ei*ei)/pupil,quadraticPupilEta:(qr*qr+qi*qi)/pupil,phaseFidelity:fidelity/pupil,referenceFidelity:fidelity,rmsPhase:Math.sqrt(Math.max(0,m2/pupil-(m1/pupil)**2)),maxPhaseStep:maxStep};
 if(!Object.values(result).every(Number.isFinite))throw Error('Non-finite screen integral.');
 return result;
}
const aligned=(a:Frame,b:Frame)=>dot(a.axes[0],b.axes[0])>1-1e-12;
function rotation(a:Frame,b:Frame):[number,number,number,number]{return [dot(a.axes[1],b.axes[1]),dot(a.axes[1],b.axes[2]),dot(a.axes[2],b.axes[1]),dot(a.axes[2],b.axes[2])];}
/** Scope is deliberately structural, not the current Gaussian solver's success.
 * Clipping is part of this benchmark; tilted faces / folds never become screens. */
export function lensBenchmarkInput(p:Project){
 if(p.model.kind!=='surface')throw Error('Physical single-Lens Project required.');
 const d=p.model.prescription,ss=compile(d),ports=p.authoring?.ports;
 if(ss.length!==3||ss[0].interaction!=='refract'||ss[1].interaction!=='refract'||ss[2].interaction!=='probe'||ss[0].assemblyId!==ss[1].assemblyId||d.assemblies.find(a=>a.id===ss[0].assemblyId)?.kind!=='lens')throw Error('Benchmark supports one two-face Lens followed by one Output plane; folds / multi-Lens paths are unsupported.');
 if(ss.some(s=>s.array)||d.source.channels.rows!==1||d.source.channels.cols!==1)throw Error('Single-channel field required.');
 const issues=bodyGeometry(d,ss,p.bodies).issues;if(issues.length)throw Error(issues.join(' · '));
 for(const which of ['source','target'] as const){const port=ports?.[which],mode=which==='source'?p.model.sourceMode:p.model.targetMode;
  if(!port||port.device==='pic-edge'||port.device==='pic-grating'||port.fieldModel!=='gaussian'||port.imported||port.adapter!=='homogeneous-paraxial'||port.phase!=='waist-plane'||port.mediumIndex===null||port.normalization==='unspecified'||port.normalization==='absolute-power'&&port.powerW===null||mode.mfdX===null||mode.mfdY===null)throw Error('Explicit homogeneous Gaussian waist Ports required; undefined / PIC / imported fields are unsupported.');
  if([mode.mfdX,mode.mfdY].some(w=>d.wavelength/(Math.PI*port.mediumIndex!*w!/2)>.1))throw Error('Port divergence exceeds the 0.1 rad scalar domain.');
 }
 if(p.model.sourceMode.polarization!=='unspecified'&&p.model.targetMode.polarization!=='unspecified'&&p.model.sourceMode.polarization!==p.model.targetMode.polarization)throw Error('Polarization mismatch is outside the scalar benchmark.');
 const [front,rear,output]=ss,axis=front.world,source=frame(d.source.frame),end=output.world,relative=pointToLocal(axis,rear.world.origin);
 if(!aligned(axis,rear.world)||!aligned(axis,source)||!aligned(axis,end)||Math.hypot(relative.y,relative.z)>1e-10)throw Error('Parallel Input / Output axes and coaxial Lens faces required; tilt is unsupported by the phase-screen benchmark.');
 if(output.shape!=='plane')throw Error('Output must be planar.');
 for(const s of [front,rear])if(s.shape==='even-asphere'&&((s.conic??0)!==0||Object.values(s.aspheric??{}).some(x=>x!==0)))throw Error('Only spherical or planar Lens profiles are benchmarked.');
 const n=ports!.source.mediumIndex!,glass=front.nAfter,aperture=Math.min(front.aperture,rear.aperture);
 if(glass===null||front.nBefore!==n||rear.nBefore!==glass||rear.nAfter!==n||output.nBefore!==n||output.nAfter!==n||ports!.target.mediumIndex!==n||d.source.n!==n)throw Error('One homogeneous exterior medium and consistent Lens indices required.');
 const radii=[front,rear].map(s=>s.shape==='plane'?0:s.radius);
 if(radii.some(r=>r!==0&&aperture/Math.abs(r)>.5))throw Error('Screen aperture / |R| exceeds the 0.5 benchmark cap.');
 const start=pointToLocal(axis,source.origin),finish=pointToLocal(axis,end.origin);
 if(start.x>=0||finish.x<=relative.x||relative.x<=0)throw Error('Input must precede a positive-thickness Lens and Output must follow it.');
 const q=(mfdX:number,mfdY:number,length:number):QTensor=>[{re:length/n,im:rayleigh(mfdX/2,d.wavelength)},{re:0,im:0},{re:0,im:0},{re:length/n,im:rayleigh(mfdY/2,d.wavelength)}];
 const inputQ=transformQ(q(p.model.sourceMode.mfdX!,p.model.sourceMode.mfdY!,-start.x),rotation(axis,source)),targetQ=transformQ(q(p.model.targetMode.mfdX!,p.model.targetMode.mfdY!,-finish.x),rotation(axis,end));
 const screen:ScreenInput={wavelength:d.wavelength,indexDelta:glass-n,frontRadius:radii[0],rearRadius:radii[1],aperture,inputQ,targetQ,inputCenter:[start.y,start.z],targetCenter:[finish.y,finish.z]};
 const power=(glass-n)*((radii[0]?1/radii[0]:0)-(radii[1]?1/radii[1]:0)),outQ=transformQ(propagateQ(powerQ(inputQ,power),finish.x,n),rotation(end,axis)),a=rotation(end,axis);
 const h=[start.y*(1-finish.x*power/n)-finish.y,start.z*(1-finish.x*power/n)-finish.z],slope=[-power*start.y/n,-power*start.z/n],rotate=(v:number[]):[number,number]=>[a[0]*v[0]+a[1]*v[1],a[2]*v[0]+a[3]*v[1]];
 const analyticEta=gaussianTensorOverlap(outQ,d.wavelength,n,[p.model.targetMode.mfdX!,p.model.targetMode.mfdY!],rotate(h),rotate(slope)).eta;
 return {screen,analyticEta,lensId:front.assemblyId,thickness:relative.x};
}
export async function assessLensBenchmark(p:Project,hooks:{cancelled?:()=>boolean;progress?:(n:number)=>void;maxRadialNodes?:128|256|384|512}={}):Promise<LensBenchmark>{
 const base:LensBenchmark={engine:LENS_BENCHMARK_ID,inputSignature:serializeProject(p),scope:LENS_BENCHMARK_SCOPE,status:'unsupported',reason:'',metrics:null,lensId:null,thickness:null,physicalEtaErrorBound:null,totalCoupling:null};
 try{
  const limit=hooks.maxRadialNodes??512;if(![128,256,384,512].includes(limit))throw Error('Unsupported grid budget.');
  const input=lensBenchmarkInput(p);base.lensId=input.lensId;base.thickness=input.thickness;const history:ScreenSample[]=[];
  for(const n of [32,64,128,256,384,512].filter(n=>n<=limit)){
   await new Promise(resolve=>setTimeout(resolve,0));if(hooks.cancelled?.())return {...base,status:'cancelled',reason:'Cancelled; no current benchmark metric.'};hooks.progress?.(n);
   let sample:ScreenSample;
   try{sample=integratePhaseScreen(input.screen,n);}catch(e){if(n<limit)continue;return {...base,status:'unresolved',reason:`Numerical pupil integral unavailable at the grid cap: ${e instanceof Error?e.message:String(e)}`};}
   history.push(sample);
   if(history.length<3)continue;
   const prev=history.at(-2)!,prior=history.at(-3)!,keys=['pupilFraction','exactEta','quadraticPupilEta','phaseFidelity','referenceFidelity'] as const;
   const error=Math.max(...keys.map(k=>Math.abs(sample[k]-prev[k])),...keys.map(k=>Math.abs(prev[k]-prior[k])));
   const physical=keys.every(k=>sample[k]>=-1e-10&&sample[k]<=1+1e-8),resolved=physical&&error<2e-6&&sample.maxPhaseStep<Math.PI;
   if(!resolved&&n<limit)continue;
   const F=Math.min(1,Math.max(0,sample.referenceFidelity)),lo=Math.sqrt(Math.max(0,1-Math.min(1,F+error))),hi=Math.sqrt(Math.max(0,1-Math.max(0,F-error)));
   const referenceGate=!resolved?'unresolved':hi<=SCREEN_ETA_THRESHOLD?'within-threshold':lo>SCREEN_ETA_THRESHOLD?'exceeds-threshold':'unresolved';
   return {...base,status:resolved?'converged':'unresolved',reason:resolved?'Converged screen-model comparison; physical accuracy remains unassessed.':'Grid refinement / phase resolution did not establish convergence; no accuracy pass.',metrics:{sample,analyticEta:input.analyticEta,numericalErrorEstimate:error,estimatedDeviationInterval:[lo,hi],referenceGate,threshold:SCREEN_ETA_THRESHOLD,history}};
  }
  return {...base,status:'unresolved',reason:'Grid budget exhausted.'};
 }catch(e){return {...base,reason:e instanceof Error?e.message:String(e)};}
}
export function lensBenchmarkReport(p:Project,result:LensBenchmark|null,invalid=false){
 const current=!!result&&!invalid&&result.engine===LENS_BENCHMARK_ID&&result.inputSignature===serializeProject(p);
 return {state:!result?'not-calculated':current?'current':'stale',scope:LENS_BENCHMARK_SCOPE,result:current?result:null,physicalEtaErrorBound:null,totalCoupling:null};
}
