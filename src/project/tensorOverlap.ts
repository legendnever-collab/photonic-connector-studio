import {prismOverlap,polarizationTransport,MODE_SCOPE} from './prismMode';
import {inverseQ,transformQ,solveFoldedGaussian,SPHERICAL_REFERENCE_SCOPE} from './foldedGaussian';
import type {QTensor,FoldedResult} from './foldedGaussian';
import type {Complex} from '../physics';
import type {Overlap} from './physicalGaussian';
import type {Project} from './model';
import {dot} from '../surface/model';
export const TENSOR_OVERLAP_ID='conditional-tensor-gaussian-overlap/1.1.0';
const c=(re=0,im=0):Complex=>({re,im});
const add=(a:Complex,b:Complex)=>c(a.re+b.re,a.im+b.im);
const mul=(a:Complex,b:Complex)=>c(a.re*b.re-a.im*b.im,a.re*b.im+a.im*b.re);
const scale=(a:Complex,b:number)=>c(a.re*b,a.im*b);
const sub=(a:Complex,b:Complex)=>add(a,scale(b,-1));
const div=(a:Complex,b:Complex)=>{const d=b.re*b.re+b.im*b.im;return c((a.re*b.re+a.im*b.im)/d,(a.im*b.re-a.re*b.im)/d);};
/** Closed normalized complex Gaussian integral on one transverse plane. Q=q/n; e^(+iωt).
 * Uses target-waist-scaled coordinates, full cross phase, offset and relative slope.
 * No throughput, clipping diffraction, coating, polarization or device response. */
export function gaussianTensorOverlap(q:QTensor,lambda:number,n:number,mfd:[number,number],h:[number,number]=[0,0],slope:[number,number]=[0,0]):Extract<Overlap,{status:'valid'}>{
 if(![lambda,n,...mfd].every(v=>Number.isFinite(v)&&v>0)||![...h,...slope].every(Number.isFinite))throw Error('Invalid Gaussian overlap inputs');
 const w=mfd.map(v=>v/2),k=2*Math.PI/lambda,inv=inverseQ(q);
 const H=inv.map((z,i)=>scale(c(-z.im,z.re),k*w[Math.floor(i/2)]*w[i%2]));
 const detH=H[0].re*H[3].re-H[1].re*H[2].re;
 if(!(H[0].re>0&&detH>0)||Math.hypot(H[1].re-H[2].re,H[1].im-H[2].im)>1e-8*Math.max(1,...H.map(z=>Math.hypot(z.re,z.im))))throw Error('Gaussian tensor must be symmetric and positive definite');
 const M=H.map((z,i)=>add(z,c(i===0||i===3?2:0))),det=sub(mul(M[0],M[3]),mul(M[1],M[2]));
 const x=h.map((v,i)=>v/w[i]),b=[0,1].map(i=>add(add(scale(H[2*i],x[0]),scale(H[2*i+1],x[1])),c(0,-k*n*slope[i]*w[i])));
 const y=[div(sub(mul(M[3],b[0]),mul(M[1],b[1])),det),div(sub(mul(M[0],b[1]),mul(M[2],b[0])),det)];
 const constant=H[0].re*x[0]**2+(H[1].re+H[2].re)*x[0]*x[1]+H[3].re*x[1]**2;
 let logEta=Math.log(4)+.5*Math.log(detH*4)-Math.log(Math.hypot(det.re,det.im))-constant+add(mul(b[0],y[0]),mul(b[1],y[1])).re;
 if(!Number.isFinite(logEta)||logEta>1e-10)throw Error('Gaussian overlap normalization failed');
 logEta=Math.min(0,logEta);const eta=Math.exp(logEta);
 return {status:'valid',eta,logEta,lossDB:-10*logEta/Math.LN10,underflow:eta===0,targetY:w[0],targetZ:w[1],offsetY:-h[0],offsetZ:-h[1],angleY:slope[0],angleZ:slope[1]};
}
export function tensorOverlap(p:Project,r:FoldedResult=solveFoldedGaussian(p,{sampleSegments:false})):Overlap{
 const no=(reason:string):Overlap=>({status:'not-calculated',reason:/^(Input undefined|Input invalid|Model unsupported|Out of domain):/.test(reason)?reason:`${/undefined|Select an Output/.test(reason)?'Input undefined':/mismatch|medium differs/.test(reason)?'Input invalid':/unsupported|requires|not evaluated|only/.test(reason)?'Model unsupported':'Out of domain'}: ${reason}`});
 if(p.model.kind!=='surface')return no('Model unsupported: Physical Project required.');
 for(const which of ['source','target'] as const){
  const port=p.authoring?.ports[which],mode=which==='source'?p.model.sourceMode:p.model.targetMode;
  if(port&&(port.fieldModel!=='gaussian'||port.imported||port.adapter==='near-field-em-required'))return no(`Model unsupported: ${which} imported / confined field requires its dedicated field adapter.`);
  if(port&&(port.device==='pic-edge'||port.device==='pic-grating'))return no(`Input undefined: PIC ${which==='target'?'receiving':'emitted'} field is undefined; Gaussian MFD is a user reference, not device coupling.`);
  if(!port||port.phase==='unspecified'||port.adapter==='unspecified'||port.mediumIndex===null||port.normalization==='unspecified'||port.normalization==='absolute-power'&&port.powerW===null||mode.mfdX===null||mode.mfdY===null)return no(`Input undefined: ${which} Gaussian Mode / phase / medium / normalization. Select an explicit reference.`);
 }
 if(r.status!=='valid')return no(r.reason);
 const d=p.model.prescription,port=p.authoring?.ports.target,mode=p.model.targetMode,sm=p.model.sourceMode;
 if(!port||port.fieldModel!=='gaussian'||port.imported||port.adapter!=='homogeneous-paraxial'||port.phase!=='waist-plane'||port.normalization==='unspecified'||port.normalization==='absolute-power'&&port.powerW===null||!mode.mfdX||!mode.mfdY)return no('Output Gaussian Mode / phase / normalization is undefined. Select an Output SMF reference.');
 if(port.device==='pic-edge'||port.device==='pic-grating')return no('PIC receiving field is undefined; Gaussian MFD is a user reference, not device coupling.');
 if(port.mediumIndex!==r.incident.n)return no('Output Mode medium differs from the incident medium.');
 const prism=d.surfaces.some(s=>s.interaction==='tir');
 if(r.apertureLimited)return no('Aperture-limited untruncated reference; clipping propagation is not evaluated.');
 if(r.outputDirection.x<=0||Math.hypot(r.outputDirection.y,r.outputDirection.z)/r.outputDirection.x>.05+1e-12)return no('Output relative slope exceeds the 50 mrad first-order plane domain.');
 if([mode.mfdX,mode.mfdY].some(v=>r.wavelength/(Math.PI*r.incident.n*v/2)>.1+1e-12))return no('Output Mode divergence exceeds 0.1 rad.');
 const a:[number,number,number,number]=[dot(r.outputAxes[0],r.incident.u),dot(r.outputAxes[0],r.incident.v),dot(r.outputAxes[1],r.incident.u),dot(r.outputAxes[1],r.incident.v)];
 try{const q=transformQ(r.incident.q,a),base=gaussianTensorOverlap(q,r.wavelength,r.incident.n,[mode.mfdX,mode.mfdY],[r.outputOffset.y,r.outputOffset.z],[r.outputDirection.y/r.outputDirection.x,r.outputDirection.z/r.outputDirection.x]);
  // The TIR angular-spectrum benchmark does not yet cover oblique powered interfaces.
  if(prism&&r.refractions.some(s=>s.incidenceRad>1e-5))return no('Model unsupported: oblique spherical Lens combined with TIR requires a combined field benchmark.');
  if(prism){const result=prismOverlap(p,r,q,base);return result.status==='valid'?result:no(result.reason);}
  let comparisonClass='scalar-assumed-copolarized';
  if(sm.polarization!=='unspecified'&&mode.polarization!=='unspecified'){polarizationTransport(p,r);comparisonClass='explicit-copolarized-phase-only';}
  return {...base,scope:MODE_SCOPE,comparisonClass,...(r.refractions.length?{gaussianReference:{evaluator:TENSOR_OVERLAP_ID,surfaces:r.refractions,assumptions:SPHERICAL_REFERENCE_SCOPE,physicalEtaErrorBound:null,transmission:null,totalCoupling:null}}:{})};}catch(e){return no(e instanceof Error?e.message:String(e));}
}
