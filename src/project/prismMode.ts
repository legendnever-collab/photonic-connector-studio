import type {Project} from './model';
import type {FoldedResult,QTensor} from './foldedGaussian';
import type {Overlap} from './physicalGaussian';
import {compile,frame,dot} from '../surface/model';
import {add,mul,unit} from '../surface/model';
import type {Vec} from '../surface/model';
import {cross} from '../surface/reportGeometry';
import {reflect,refract} from '../surface/trace';
import {materialIndex} from '../surface/materials';

export const PRISM_MODE_ID='phase-only-angular-spectrum/1.0.0';
export const MODE_SCOPE='Conditional normalized Mode Overlap · unit-amplitude interfaces / ideal Mirror; Transmission and Total Coupling not calculated.';
type Valid=Extract<FoldedResult,{status:'valid'}>;

/** e^(+iωt), electric-field s / p (p = s × propagation). Overall π parity
 * of reflected p is immaterial for a pure polarization; its angular phase is not. */
export function tirPhase(cosine:number,ratio:number,pol:'s'|'p'){
 const g2=1-cosine*cosine-ratio*ratio;
 if(!(cosine>0&&cosine<1&&ratio>0&&ratio<1&&g2>0))throw Error('Angular spectrum crosses the critical angle.');
 return 2*Math.atan2(Math.sqrt(g2),cosine*(pol==='p'?ratio*ratio:1));
}

/** Parseval integral of two normalized Gaussian angular spectra. Fourier kernel
 * exp(+ik0 α·x); incident spectrum exp(+ik0 αᵀQα/2 + ik0 α·h).
 * Whiten the real Gaussian weight; integrate the angular phase, never chief-only.
 * This adapter reuses the transported Q, not a second geometry / Gaussian solver. */
export function spectralOverlap(q:QTensor,lambda:number,mfd:[number,number],h:[number,number],phase:(a:number,b:number)=>number,N=64,window=8){
 const k=2*Math.PI/lambda,t=mfd.map(d=>Math.PI*(d/2)**2/lambda);
 const a=q[0].im+t[0],b=(q[1].im+q[2].im)/2,d=q[3].im+t[1],det=a*d-b*b;
 const detQ=q[0].im*q[3].im-q[1].im*q[2].im;
 if(!(a>0&&det>0&&detQ>0))throw Error('Angular Gaussian covariance is not positive definite.');
 // A=L Lᵀ, α=L^(-T) ξ / sqrt(k).
 const l=Math.sqrt(a),m=b/l,n=Math.sqrt(d-m*m),step=2*window/N;
 let re=0,im=0;
 for(let i=0;i<N;i++)for(let j=0;j<N;j++){
  const x=-window+(i+.5)*step,y=-window+(j+.5)*step;
  const v=y/(n*Math.sqrt(k)),u=(x/Math.sqrt(k)-m*v)/l;
  const ph=k*((q[0].re*u*u+(q[1].re+q[2].re)*u*v+q[3].re*v*v)/2+h[0]*u+h[1]*v)+phase(u,v);
  const weight=Math.exp(-(x*x+y*y)/2)*step*step/(2*Math.PI);
  re+=weight*Math.cos(ph);im+=weight*Math.sin(ph);
 }
 const eta=4*Math.sqrt(detQ*t[0]*t[1])/det*(re*re+im*im);
 if(!Number.isFinite(eta)||eta>1+1e-8)throw Error('Angular overlap normalization / convergence failed.');
 return Math.max(0,Math.min(1,eta));
}

/** Chief polarization is explicitly defined by the Port frame: TE=local Y,
 * TM=local Z. A label match alone does not establish co-polarization after folds. */
export function polarizationTransport(p:Project,r:Valid){
 if(p.model.kind!=='surface')throw Error('Physical Project required.');
 const sm=p.model.sourceMode,tm=p.model.targetMode;
 if(sm.polarization==='unspecified'||tm.polarization==='unspecified')throw Error('Input undefined: Prism requires explicit Input and Output TE / TM (Port local Y / Z).');
 const ss=compile(p.model.prescription),source=frame(p.model.prescription.source.frame);
 let e=source.axes[sm.polarization==='TE'?1:2];
 const polarizations=new Map<string,'s'|'p'>();let plane:Vec|null=null;
 for(let i=0;i<ss.length;i++){
  const s=ss[i],hit=r.surfaces[i],normal=s.world.axes[0];
  if(s.interaction==='reflect'||s.interaction==='tir'){
   const axis=unit(cross(hit.before.direction,normal));
   if(plane&&Math.abs(dot(plane,axis))<1-1e-9)throw Error('Model unsupported: non-coplanar fold polarization transport.');
   plane=axis;const along=Math.abs(dot(e,axis));
   if(along>1-1e-9)polarizations.set(s.id,'s');
   else if(along<1e-9)polarizations.set(s.id,'p');
   else throw Error('Model unsupported: mixed s/p polarization; use a validated vector field model.');
   e=reflect(e,normal);
  }else if(s.interaction==='refract'&&Math.abs(dot(hit.before.direction,hit.after.direction))<1-1e-10){
   throw Error('Model unsupported: oblique refracting polarization transport.');
  }
 }
 const target=r.outputAxes[tm.polarization==='TE'?0:1];
 if(Math.abs(dot(e,target))<1-1e-9)throw Error('Model unsupported: transported polarization does not match the Output Port axis. Port polarization was not changed.');
 return polarizations;
}

export function prismOverlap(p:Project,r:Valid,q:QTensor,base:Extract<Overlap,{status:'valid'}>):Overlap{
 const no=(reason:string):Overlap=>({status:'not-calculated',reason});
 if(p.model.kind!=='surface')return no('Model unsupported: Physical Project required.');
 try{
  const d=p.model.prescription,ss=compile(d),tir=ss.filter(s=>s.interaction==='tir');
  if(tir.length<1||tir.length>2)throw Error('Model unsupported: only 1 Prism, Mirror + Prism, or 2 Prism trains.');
  if(ss.filter(s=>s.interaction==='reflect').length>(tir.length===1?1:0))throw Error('Model unsupported: unvalidated Prism / Mirror train combination.');
  const pol=polarizationTransport(p,r),first=ss.findIndex(s=>s.interaction==='tir');
  if(r.angleError>1e-9)throw Error('Out of domain: Prism Output plane must be normal to the chief ray.');
  if(r.incident.n!==1||p.authoring?.ports.source.mediumIndex!==1)throw Error('Model unsupported: Prism train requires air Ports.');
  if(r.wavelength<1260e-9||r.wavelength>1625e-9)throw Error('Out of domain: validated Prism wavelength range is 1260–1625 nm.');
  const summaries:{id:string;polarization:'s'|'p';phaseRad:number;criticalMarginRad:number;divergenceRad:number}[]=[];
  let shiftBound=0,paraxialPhaseBound=0;
  for(let i=0;i<ss.length;i++){
   const s=ss[i],v=r.surfaces[i],normal=s.world.axes[0];
   if(i>=first&&s.interaction==='refract'&&(s.shape!=='plane'||Math.abs(dot(v.before.direction,normal))<1-1e-10))throw Error('Model unsupported: powered / oblique optics after the first TIR.');
   if(s.interaction!=='tir')continue;
   const entry=ss[i-1],exit=ss[i+1],n=v.before.n;
   if(!entry||!exit||entry.assemblyId!==s.assemblyId||exit.assemblyId!==s.assemblyId||entry.interaction!=='refract'||exit.interaction!=='refract'||entry.shape!=='plane'||exit.shape!=='plane'||Math.abs(dot(r.surfaces[i-1].before.direction,entry.world.axes[0]))<1-1e-10||Math.abs(dot(r.surfaces[i+1].before.direction,exit.world.axes[0]))<1-1e-10||r.surfaces[i-1].before.n!==1||r.surfaces[i+1].after.n!==1||!p.bodies.some(b=>b.assemblyId===s.assemblyId&&b.kind==='prism'))throw Error('Model unsupported: finite normal-entry / normal-exit Prism required.');
   if(Math.abs(n-materialIndex('N-BK7',r.wavelength))>1e-9||s.outsideIndex!==1)throw Error('Model unsupported: only BK7 / air TIR is validated.');
   const qi=v.before.q,lo=(qi[0].im+qi[3].im-Math.hypot(qi[0].im-qi[3].im,qi[1].im+qi[2].im))/2;
   const divergence=Math.sqrt(r.wavelength/(Math.PI*lo))/n,cosine=Math.abs(dot(v.before.direction,normal)),theta=Math.acos(cosine),margin=theta-Math.asin(1/n);
   if(Math.abs(theta-Math.PI/4)>1e-8)throw Error('Model unsupported: only right-angle Prism (45° chief TIR) is validated.');
   if(margin<=8*divergence)throw Error('Out of domain: critical-angle margin must exceed 8 × angular 1/e amplitude divergence.');
   if(divergence>.002)throw Error('Out of domain: collimated Prism divergence must be ≤2 mrad internally.');
   const eigen=pol.get(s.id)!;
   summaries.push({id:s.id,polarization:eigen,phaseRad:tirPhase(cosine,1/n,eigen),criticalMarginRad:margin,divergenceRad:divergence});
   // Deliberately conservative GH displacement reserve for finite apertures.
   const lower=theta-8*divergence,g=Math.sqrt(Math.sin(lower)**2-1/(n*n));
   shiftBound+=4/(2*Math.PI/r.wavelength*n*g)*n*n;
  }
  // Phase-only approximation: retain existing clipping gates, with an extra
  // conservative reserve for the phase-induced centroid shift at every face.
  let tail=0;
  for(let i=first-1;i<ss.length;i++){
   const s=ss[i],v=r.surfaces[i],w=v.before.beam.radii[0]/Math.abs(dot(v.before.direction,s.world.axes[0]));
   if(v.tailBound!==null&&v.tailBound>0){const margin=Math.sqrt(-Math.log(v.tailBound)/2)*w-shiftBound;tail+=margin<=0?1:Math.exp(-2*(margin/w)**2);}
   const length=v.before.distance-(i?r.surfaces[i-1].after.distance:0),qq=v.before.q;
   const low=(qq[0].im+qq[3].im-Math.hypot(qq[0].im-qq[3].im,qq[1].im+qq[2].im))/2;
   const div=Math.sqrt(r.wavelength/(Math.PI*low))/v.before.n;
   paraxialPhaseBound+=2*Math.PI/r.wavelength*v.before.n*length*(4*div)**4/8;
  }
  if(tail>1e-3)throw Error('Out of domain: aperture tail plus TIR shift reserve exceeds 0.1%.');
  if(paraxialPhaseBound>1e-3)throw Error('Out of domain: post-TIR paraxial phase error budget exceeded.');
  // Backwards spectral direction transport uses actual Surface normals and
  // normal-interface Snell mapping; phase depends on both angular coordinates.
  const phase=(a:number,b:number)=>{
   if(a*a+b*b>=1)throw Error('Out of domain: evanescent Output spectrum.');
   let k=add(mul(r.incident.direction,Math.sqrt(1-a*a-b*b)),add(mul(r.outputAxes[0],a),mul(r.outputAxes[1],b))),sum=0;
   for(let i=ss.length-1;i>=first;i--){
    const s=ss[i],v=r.surfaces[i],normal=s.world.axes[0];
    if(s.interaction==='reflect'||s.interaction==='tir'){
     k=reflect(k,normal);
     if(s.interaction==='tir')sum+=tirPhase(Math.abs(dot(k,normal)),s.outsideIndex!/v.before.n,pol.get(s.id)!);
    }else if(s.interaction==='refract'){
     const back=refract(mul(k,-1),normal,v.after.n,v.before.n);
     if(!back)throw Error('Out of domain: reverse spectral refraction failed.');k=mul(back,-1);
    }
   }return sum;
  };
  const mode=p.model.targetMode,mfd:[number,number]=[mode.mfdX!,mode.mfdY!],h:[number,number]=[r.outputOffset.y,r.outputOffset.z];
  // Avoid false convergence from highly oscillatory phase (Nyquist alias).
  const k0=2*Math.PI/r.wavelength,minIm=Math.min(q[0].im,q[3].im)-Math.abs(q[1].im);
  if(!(minIm>0)||Math.max(...q.map(z=>Math.abs(z.re)))/minIm>2||Math.hypot(...h)*Math.sqrt(k0/minIm)>4)throw Error('Out of domain: Prism overlap quadrature phase / displacement bandwidth exceeded.');
  const coarse=spectralOverlap(q,r.wavelength,mfd,h,phase,32,7),eta=spectralOverlap(q,r.wavelength,mfd,h,phase,64,8),error=Math.abs(coarse-eta);
  if(error>1e-7)throw Error('Out of domain: Prism angular sampling / window did not converge.');
  const logEta=Math.log(eta);
  return {...base,eta,logEta,lossDB:-10*logEta/Math.LN10,underflow:eta===0,scope:MODE_SCOPE,comparisonClass:'explicit-copolarized-phase-only',domain:{evaluator:PRISM_MODE_ID,prisms:summaries,quadratureError:error,paraxialPhaseBound,modelEtaTolerance:2e-4,transmission:null,totalCoupling:null,assumptions:'Right-angle BK7 / isolated air interface, 1260–1625 nm; coplanar pure s/p, TE=Port Y / TM=Port Z; unit-amplitude interfaces; fixed chief polarization basis approximation ≤2 mrad. Angular TIR phase integrated; Gaussian envelope is the unshifted Q reference.'}};
 }catch(e){return no(e instanceof Error?e.message:String(e));}
}
