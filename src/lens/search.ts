import {ProjectSchema,serializeProject,projectFingerprint} from '../project/model';
import type {Project} from '../project/model';
import {solveFoldedGaussian,inverseQ,transformQ} from '../project/foldedGaussian';
import type {QTensor,FoldedResult} from '../project/foldedGaussian';
import {dot} from '../surface/model';
import {rayleigh} from '../physics';
import {analyzeRouting} from '../routing/analysis';
import {screenClearance} from '../routing/clearance';
import {defaultRouting} from '../routing/contract';
import {lensDomain,lensValues,buildLensProject,frozenSignature,physical,lensBounds} from './domain';
import type {LensDomain} from './domain';
import {alignLensChief} from './alignment';
import {LensOptionsSchema} from './contract';
import type {LensOptions} from './contract';
export const LENS_SEARCH_ID='bounded-lens-reference/1.0.0' as const;
export type ValidBeam=Extract<FoldedResult,{status:'valid'}>;
export type BeamMerit={score:number;diameters:[number,number];sizeError:number;phaseError:number;outputQ:QTensor;goalsMet:boolean};
export type LensCandidate={id:string;project:Project;values:number[];merit:BeamMerit;addedIds:string[]};
export type LensResult={engine:typeof LENS_SEARCH_ID;status:'completed'|'budget-exhausted'|'cancelled'|'unsupported';reason:string;inputSignature:string;inputFingerprint:string;options:LensOptions;evaluated:number;alignmentEvaluated:number;rejected:Record<string,number>;candidates:LensCandidate[];baseline:BeamMerit|null};
const clamp=(v:number,lo=0,hi=1)=>Math.max(lo,Math.min(hi,v));
function bounds(o:LensOptions):[number,number][]{return o.variables.flatMap(v=>[v.position,v.front,v.rear,v.thickness]);}
function normalize(values:number[],o:LensOptions){return bounds(o).map(([lo,hi],i)=>hi===lo?0:clamp((values[i]-lo)/(hi-lo)));}
function denormalize(x:number[],o:LensOptions){return bounds(o).map(([lo,hi],i)=>lo+clamp(x[i])*(hi-lo));}
export function lensDesignFingerprint(p:Project){const q=ProjectSchema.parse(structuredClone(p));if(q.routing)delete q.routing.lensSolution;return projectFingerprint(q);}
/** Dimensionless complex-Q distance to the prescribed Gaussian waist; never an optical efficiency. */
export function beamMerit(r:ValidBeam,p:Project,o:Pick<LensOptions,'diameterTolerance'|'phaseTolerance'>):BeamMerit {
 if(p.model.kind!=='surface')throw Error('Physical Project required.');
 const m=p.model.targetMode,w=[m.mfdX!/2,m.mfdY!/2],z=w.map(v=>rayleigh(v,r.wavelength)),s=r.incident;
 const a:[number,number,number,number]=[dot(r.outputAxes[0],s.u),dot(r.outputAxes[0],s.v),dot(r.outputAxes[1],s.u),dot(r.outputAxes[1],s.v)],q=transformQ(s.q,a),k=inverseQ(q);
 // Positive Gaussian-Q mismatch: ||(Im Z)^(-1/2)(Z-iI)||_F², Z=D^-1 Q D^-1.
 // This penalizes both spot size and phase without the spurious broad-beam minimum of |Q-iQ_target|.
 const qReal=q.map((v,i)=>v.re/Math.sqrt(z[Math.floor(i/2)]*z[i%2])),qImag=q.map((v,i)=>v.im/Math.sqrt(z[Math.floor(i/2)]*z[i%2]));
 const detB=qImag[0]*qImag[3]-qImag[1]*qImag[2];if(!(detB>0))throw Error('Output reduced Q is not positive definite.');
 const invB=[qImag[3]/detB,-qImag[1]/detB,-qImag[2]/detB,qImag[0]/detB];let square=0;
 for(const E of [qReal,qImag.map((v,i)=>v-(i===0||i===3?1:0))])for(let j=0;j<2;j++){const x=E[j],y=E[2+j];square+=x*x*invB[0]+x*y*(invB[1]+invB[2])+y*y*invB[3];}
 const aI=-k[0].im,bI=-(k[1].im+k[2].im)/2,dI=-k[3].im,det=aI*dI-bI*bI;if(!(det>0))throw Error('Output Gaussian covariance is not positive definite.');
 const factor=r.wavelength/Math.PI,c00=factor*dI/det,c01=-factor*bI/det,c11=factor*aI/det;
 const A=c00/w[0]**2,B=c01/(w[0]*w[1]),D=c11/w[1]**2,delta=Math.hypot(A-D,2*B),high=(A+D+delta)/2,low=(A+D-delta)/2;
 const sizeError=Math.max(Math.abs(Math.sqrt(Math.max(0,high))-1),Math.abs(Math.sqrt(Math.max(0,low))-1));
 const F=k[0].re*z[0],G=(k[1].re+k[2].re)/2*Math.sqrt(z[0]*z[1]),H=k[3].re*z[1],phaseError=(Math.abs(F+H)+Math.hypot(F-H,2*G))/2;
 return {score:Math.sqrt(Math.max(0,square)/2),diameters:[2*Math.sqrt(c00),2*Math.sqrt(c11)],sizeError,phaseError,outputQ:q,goalsMet:sizeError<=o.diameterTolerance&&phaseError<=o.phaseTolerance};
}
function prepare(input:Project,o:LensOptions,forward=solveFoldedGaussian){
 const domain=lensDomain(input,o.template,!!o.alignment),d=physical(domain.base),target=domain.base.authoring!.ports.target,m=domain.base.model.kind==='surface'?domain.base.model.targetMode:null;
 if(target.fieldModel!=='gaussian'||target.imported||target.adapter!=='homogeneous-paraxial'||target.phase!=='waist-plane'||!m?.mfdX||!m.mfdY)throw Error('Define the Output Gaussian reference MFD, homogeneous adapter and waist-plane phase first. PIC MFD remains a user reference.');
 if([m.mfdX,m.mfdY].some(v=>d.wavelength/(Math.PI*v/2)>.1+1e-12))throw Error('Output reference divergence exceeds the paraxial 0.1 rad limit.');
 if(o.variables.length!==domain.slots.length||o.variables.some((v,i)=>v.id!==domain.slots[i].id))throw Error('Lens variable IDs / order do not match the selected template. Reset Lens bounds.');
 o.variables.forEach((v,i)=>{const s=domain.slots[i];if(v.position[0]<s.legal[0]-1e-12||v.position[1]>=s.legal[1]||v.thickness[0]<=0||v.thickness[1]>.1||v.front.some(c=>Math.abs(c)>1e6)||v.rear.some(c=>Math.abs(c)>1e6))throw Error(`${s.id}: variable bounds are outside the fixed free-space segment / supported curvature and thickness.`);});
 if(o.alignment?.fixed.some(id=>!domain.slots.some(s=>s.id===id)))throw Error('Unknown frozen Lens alignment ID.');
 const r=forward(domain.base,{sampleSegments:false});
 if(r.status!=='valid'){
  const repairable=domain.slots.some(s=>[s.frontId,s.rearId].some(id=>r.reason.startsWith(`${id}: 2w`)||!!o.alignment&&r.reason.startsWith(`${id}: spherical chief incidence`)))||r.reason.includes('post-surface waist divergence');
  if(!repairable)throw Error(r.reason);
 }
 if(!o.alignment&&(analyzeRouting(domain.base).angleError??Math.PI)>1e-5)throw Error('Lens reference matching requires normal Output incidence; first close the geometric route.');
 return {domain,baseline:r.status==='valid'?beamMerit(r,domain.base,o):null};
}
/** Bounded multistart Nelder–Mead. Yields one normalized trial at a time; no async work changes a Project. */
function* simplex(start:number[],active:number[],allowance:number):Generator<number[],boolean,number>{
 type Vertex={x:number[];f:number};let used=0;
 const evaluate=function*(x:number[]):Generator<number[],Vertex,number>{const point=x.map(v=>clamp(v));const f=yield point;used++;return {x:point,f};};
 let vertices:Vertex[]=[];vertices.push(yield* evaluate(start));
 for(const i of active){if(used>=allowance)return false;const x=[...start];x[i]=clamp(x[i]+(x[i]>.85?-.08:.08));vertices.push(yield* evaluate(x));}
 if(!active.length)return true;
 while(used<allowance){
  vertices.sort((a,b)=>a.f-b.f);const best=vertices[0],worst=vertices.at(-1)!,nextWorst=vertices.at(-2)!;
  if(Math.max(...vertices.map(v=>Math.hypot(...active.map(i=>v.x[i]-best.x[i]))))<1e-5)return true;
  const centroid=start.map((_,i)=>vertices.slice(0,-1).reduce((sum,v)=>sum+v.x[i],0)/active.length),at=(scale:number)=>centroid.map((v,i)=>v+scale*(v-worst.x[i]));
  const reflected=yield* evaluate(at(1));if(used>=allowance)return false;
  if(reflected.f<best.f){const expanded=yield* evaluate(at(2));vertices[vertices.length-1]=expanded.f<reflected.f?expanded:reflected;}
  else if(reflected.f<nextWorst.f)vertices[vertices.length-1]=reflected;
  else {const outside=reflected.f<worst.f,target=outside?reflected.x:worst.x,contracted=yield* evaluate(centroid.map((v,i)=>v+.5*(target[i]-v)));
   if(contracted.f<(outside?reflected.f:worst.f))vertices[vertices.length-1]=contracted;
   else for(let j=1;j<vertices.length&&used<allowance;j++)vertices[j]=yield* evaluate(vertices[j].x.map((v,i)=>(v+best.x[i])/2));
  }
 }
 return false;
}
/** Analytic thin-lens seeds are only starting guesses; every retained design uses real S1/glass/S2 validation. */
function seeds(domain:LensDomain,o:LensOptions):number[][]{
 const original=lensValues(domain),result=[normalize(original,o)],d=physical(domain.base),source=domain.base.model.kind==='surface'?domain.base.model.sourceMode:null,target=domain.base.model.kind==='surface'?domain.base.model.targetMode:null;
 if(!source?.mfdX||!target?.mfdX)return result;
 const zIn=rayleigh(source.mfdX/2,d.wavelength),zOut=rayleigh(target.mfdX/2,d.wavelength),L=domain.total;
 const value=(slot:number,key:0|1|2|3,v:number)=>{const [lo,hi]=bounds(o)[4*slot+key];return clamp(v,lo,hi);};
 for(const f of [.15,.2,.25,.3,.35,.45,.5,.65,.8]){
  const x=[...original],s1=value(0,0,L*f);x[0]=s1;
  const thin1=(power:number)=>{x[1]=value(0,1,power/(2*(domain.slots[0].glass-1)));x[2]=value(0,2,-power/(2*(domain.slots[0].glass-1)));};
  if(domain.slots.length===1){const a=s1+x[3]/2,b=L-a;thin1(a/(a*a+zIn*zIn)+b/(b*b+zOut*zOut));result.push(normalize(x,o));continue;}
  for(const g of [.55,.65,.75,.8,.85]){
   const y=[...x],s2=value(1,0,L*g),a=s1+y[3]/2,b=L-s2-y[7]/2,D=s2+y[7]/2-a;if(D<=0||b<=0)continue;
   const real=a/(a*a+zIn*zIn),imag=zIn/(a*a+zIn*zIn),targetImag=zOut/(b*b+zOut*zOut),rad=imag/targetImag-D*D*imag*imag;
   if(rad<0)continue;
   for(const sign of [1,-1]){
    const h=(-1+sign*Math.sqrt(rad))/D,power1=real-h,den=(1+D*h)**2+(D*imag)**2,realBefore2=(h*(1+D*h)+D*imag*imag)/den,power2=realBefore2+b/(b*b+zOut*zOut);
    const powers=[power1,power2],v=[...y];v[4]=s2;for(let i=0;i<2;i++){v[4*i+1]=value(i,1,powers[i]/(2*(domain.slots[i].glass-1)));v[4*i+2]=value(i,2,-powers[i]/(2*(domain.slots[i].glass-1)));}
    result.push(normalize(v,o));
   }
  }
 }
 if(o.alignment){
  // Include powered-front / powered-rear real Lens starts. Symmetric biconvex
  // relays can lie at the local-footprint boundary before a small decenter.
  // Interleave bending choices at each axial placement. Appending every bent
  // Lens after all symmetric starts starves them under small budgets.
  const starts=result.splice(0);
  for(const seed of starts){
   result.push(seed);
   for(const fraction of [0,1,.25,.75]){
    const x=denormalize(seed,o);for(let i=0;i<domain.slots.length;i++){
     const power=x[4*i+1]-x[4*i+2],share=i===0?fraction:1-fraction;
     x[4*i+1]=value(i,1,power*share);x[4*i+2]=value(i,2,-power*(1-share));
    }result.push(normalize(x,o));
   }
  }
 }
 return result.filter((x,i)=>result.findIndex(y=>x.every((v,j)=>Math.abs(v-y[j])<1e-9))===i);
}
export function* lensSearch(input:Project,raw:LensOptions,forward=solveFoldedGaussian):Generator<{evaluated:number;retained:number;alignmentEvaluated:number},LensResult,void>{
 const batch:LensResult={engine:LENS_SEARCH_ID,status:'unsupported',reason:'',inputSignature:serializeProject(input),inputFingerprint:projectFingerprint(input),options:structuredClone(raw),evaluated:0,alignmentEvaluated:0,rejected:{},candidates:[],baseline:null};
 let o:LensOptions,domain:LensDomain;
 try{o=LensOptionsSchema.parse(raw);const p=prepare(input,o,forward);domain=p.domain;batch.baseline=p.baseline;}catch(e){batch.reason=e instanceof Error?e.message:String(e);return batch;}
 const reject=(reason:string)=>{batch.rejected[reason]=(batch.rejected[reason]??0)+1;},evaluated:{x:number[];f:number}[]=[],seen=new Map<string,number>();
 const evaluate=(x:number[])=>{
  const key=x.map(v=>v.toPrecision(12)).join('|'),known=seen.get(key);if(known!==undefined)return known;
  batch.evaluated++;let cost=1e12;
  try{
   const shape=denormalize(x,o),{project,values}=alignLensChief(domain,shape,o,()=>batch.alignmentEvaluated++),beam=forward(project,{sampleSegments:false});if(beam.status!=='valid')throw Error(beam.reason);
   const merit=beamMerit(beam,project,o),tails=beam.surfaces.reduce((sum,s)=>sum+(s.tailBound??0),0);
   cost=merit.score+10*Math.log1p(tails/.001);
   if(beam.apertureLimited)reject('Aperture / body tail bound exceeds 0.1%');
   else {
    const route=analyzeRouting(project);if(route.status!=='evaluated'||!route.withinTolerance||!route.path)throw Error('Candidate violates geometric route / part / space limits.');
    const clearance=screenClearance(project,domain.slots.map(s=>s.id),route.path,o.clearance);if(clearance){reject(clearance);cost+=1e6;}
    else {
     const candidate:LensCandidate={id:`lens-${batch.evaluated}`,project,values,merit,addedIds:domain.addedIds},similar=batch.candidates.findIndex(c=>Math.hypot(...normalize(c.values,o).map((v,i)=>v-x[i]))<.025);
     if(similar>=0){if(batch.candidates[similar].merit.score>merit.score)batch.candidates[similar]=candidate;}else batch.candidates.push(candidate);
     batch.candidates.sort((a,b)=>a.merit.score-b.merit.score);batch.candidates=batch.candidates.slice(0,6);
    }
   }
  }catch(e){reject(e instanceof Error?e.message:String(e));}
  seen.set(key,cost);evaluated.push({x,f:cost});return cost;
 };
 // Pose correction is nested inside each trial. Reserve local-fit evaluations
 // instead of spending the entire allowance enumerating asymmetric starts.
 const seedLimit=o.alignment?Math.min(o.budget,Math.max(12,Math.min(128,Math.floor(o.budget/3)))):o.budget;
 for(const x of seeds(domain,o)){if(batch.evaluated>=seedLimit)break;evaluate(x);yield {evaluated:batch.evaluated,retained:batch.candidates.length,alignmentEvaluated:batch.alignmentEvaluated};}
 const starts=evaluated.sort((a,b)=>a.f-b.f).filter((v,i,list)=>list.slice(0,i).every(u=>Math.hypot(...v.x.map((x,j)=>x-u.x[j]))>.05)).slice(0,2),active=bounds(o).flatMap(([lo,hi],i)=>hi>lo?[i]:[]);
 let finished=true;
 for(let i=0;i<starts.length;i++){
  if(batch.evaluated>=o.budget){finished=false;break;}
  const allowance=Math.max(1,Math.floor((o.budget-batch.evaluated)/(starts.length-i))),optimizer=simplex(starts[i].x,active,allowance);let step=optimizer.next();
  while(!step.done){if(batch.evaluated>=o.budget){finished=false;break;}const f=evaluate(step.value);yield {evaluated:batch.evaluated,retained:batch.candidates.length,alignmentEvaluated:batch.alignmentEvaluated};step=optimizer.next(f);}if(!step.done||!step.value)finished=false;
 }
 batch.status=finished&&batch.evaluated<o.budget?'completed':'budget-exhausted';
 batch.reason=batch.candidates.some(c=>c.merit.goalsMet)?'Reference goals met within the tested Lens bounds; no global optimum or device coupling claim.':batch.candidates.length?'Best tested Gaussian reference candidates; requested size / phase goals are not met.':'No aperture-feasible candidate found in these Lens bounds. This is not proof of impossibility. Enlarge apertures or change the architecture.';
 if(batch.status==='budget-exhausted')batch.reason+=' Budget exhausted; coverage is partial.';
 return batch;
}
export function searchLenses(input:Project,o:LensOptions):LensResult{const it=lensSearch(input,o);let step=it.next();while(!step.done)step=it.next();return step.value;}
export async function searchLensesAsync(input:Project,o:LensOptions,hooks:{cancelled?:()=>boolean;progress?:(v:{evaluated:number;retained:number})=>void}={}):Promise<LensResult>{
 const it=lensSearch(structuredClone(input),structuredClone(o));let step=it.next();while(!step.done){hooks.progress?.(step.value);await new Promise(r=>setTimeout(r,0));if(hooks.cancelled?.()){return {engine:LENS_SEARCH_ID,status:'cancelled',reason:'Cancelled. Preview candidates discarded; Project unchanged.',inputSignature:serializeProject(input),inputFingerprint:projectFingerprint(input),options:o,evaluated:step.value.evaluated,alignmentEvaluated:0,rejected:{},candidates:[],baseline:null};}step=it.next();}return step.value;
}
export function applyLensCandidate(current:Project,batch:LensResult,id:string):Project {
 if(serializeProject(current)!==batch.inputSignature)throw Error('Stale Lens candidates. Run Lens Design again.');
 if(batch.status==='cancelled'||batch.status==='unsupported')throw Error('No applicable Lens result.');
 const candidate=batch.candidates.find(c=>c.id===id);if(!candidate)throw Error('Lens candidate unavailable.');
 const o=LensOptionsSchema.parse(batch.options),{domain}=prepare(current,o);
 if(candidate.values.length!==lensBounds(o).length||lensBounds(o).some(([lo,hi],i)=>!Number.isFinite(candidate.values[i])||candidate.values[i]<lo-1e-12||candidate.values[i]>hi+1e-12))throw Error('Candidate changed a frozen variable or exceeded its bounds.');
 const rebuilt=buildLensProject(domain,candidate.values);
 if(frozenSignature(domain.base,domain)!==frozenSignature(candidate.project,domain)||serializeProject(rebuilt)!==serializeProject(candidate.project))throw Error('Candidate altered a fixed condition or was tampered with.');
 const beam=solveFoldedGaussian(rebuilt,{sampleSegments:false}),route=analyzeRouting(rebuilt);if(beam.status!=='valid'||beam.apertureLimited||route.status!=='evaluated'||!route.withinTolerance||!route.path)throw Error('Candidate failed current optical validation.');
 const error=screenClearance(rebuilt,domain.slots.map(s=>s.id),route.path,o.clearance);if(error)throw Error(error);
 const merit=beamMerit(beam,rebuilt,o),next:Project={...rebuilt,routing:{...(rebuilt.routing??defaultRouting())}};
 next.routing!.lensSolution={engine:LENS_SEARCH_ID,baselineFingerprint:batch.inputFingerprint,designFingerprint:lensDesignFingerprint(next),evaluated:batch.evaluated,score:merit.score,goalsMet:merit.goalsMet,options:o};
 return ProjectSchema.parse(next);
}
