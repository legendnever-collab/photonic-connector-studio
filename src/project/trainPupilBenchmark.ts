import {ProjectSchema,serializeProject} from './model';
import type {Project} from './model';
import {bodyGeometry} from './geometry';
import {compile} from '../surface/model';
import {tensorOverlap} from './tensorOverlap';
import {rayFrame,joinFrames,relativeFrame,tracePupilRay,tubeJacobian} from './pupilRay';
import type {RF,Face} from './pupilRay';
export const TRAIN_PUPIL_ID='finite-ray-pupil/1.0.0';
export const TRAIN_PUPIL_SCOPE='Single-step scalar ray-pupil reference: exact Sphere/Plane refraction and internal glass OPL; projected ray-tube flux; Fresnel input and adjoint target Gaussians. Diffraction within/between Lenses, clipping diffraction, coating/Fresnel throughput and vector fields omitted. Numerical convergence is not a physical accuracy or total-coupling guarantee.';
export type PupilInput={wavelength:number;faces:Face[];launch:number;exit:number;inputW:[number,number];inputC:[number,number];targetW:[number,number];targetC:[number,number];targetCenter:[number,number];targetAxes:number[];lensIds:string[];glassLengths:number[]};
type PhasePoint={y:number;z:number;opd:number;weight:number};
export type PupilSample={grid:number;rays:number;inputPower:number;blockedPower:number;rejectedPower:Record<string,number>;targetCoverage:number;eta:number;linearEta:number;quadraticEta:number;phaseFidelity:number;rmsOPD:number;maxPhaseStep:number;jacobianError:number;minimumJacobian:number;maxIncidence:number;quadratic:{coefficients:number[];center:number[];scale:number[]};opdMap:{y:number;z:number;residual:number}[]};
export type TrainPupilResult={engine:string;inputSignature:string;scope:string;status:'converged'|'unresolved'|'unsupported'|'cancelled';reason:string;lensIds:string[];glassLengths:number[];gaussianEta:number|null;metrics:{sample:PupilSample;history:PupilSample[];etaRefinement:number;opdRefinement:number}|null;physicalEtaErrorBound:null;totalCoupling:null};
export function trainPupilInput(raw:Project):PupilInput{
 const p=ProjectSchema.parse(raw);if(p.model.kind!=='surface')throw Error('Physical Lens Project required.');
 const d=p.model.prescription,ss=d.surfaces,ports=p.authoring?.ports;
 if(p.portArrays?.interface==='evanescent')throw Error('Evanescent field adapter required.');
 if(![3,5].includes(ss.length)||ss.at(-1)!.interaction!=='probe'||ss.at(-1)!.shape!=='plane')throw Error('One or two paired Lenses and a planar Output required.');
 if(ss.some(s=>s.array)||d.source.channels.rows!==1||d.source.channels.cols!==1||p.portArrays&&[p.portArrays.source,p.portArrays.target].some(a=>a.rows*a.cols!==1))throw Error('Single channel only; Array field not implemented.');
 const issues=bodyGeometry(d,compile(d),p.bodies).issues;if(issues.length)throw Error(issues.join(' · '));
 for(const which of ['source','target'] as const){const v=ports?.[which],m=which==='source'?p.model.sourceMode:p.model.targetMode;if(!v||v.device?.startsWith('pic-')||v.fieldModel!=='gaussian'||v.imported||v.adapter!=='homogeneous-paraxial'||v.phase!=='waist-plane'||v.mediumIndex!==1||v.normalization==='unspecified'||v.normalization==='absolute-power'&&v.powerW===null||!m.mfdX||!m.mfdY)throw Error('Explicit air Gaussian waist Ports required; PIC/imported fields unsupported.');if([m.mfdX,m.mfdY].some(w=>d.wavelength/(Math.PI*w/2)>.1))throw Error('Port divergence exceeds 0.1 rad scalar domain.');}
 if(d.source.n!==1||p.model.sourceMode.polarization!=='unspecified'&&p.model.targetMode.polarization!=='unspecified'&&p.model.sourceMode.polarization!==p.model.targetMode.polarization)throw Error('Air ports and compatible scalar polarization required.');
 const source=rayFrame(d.source.frame),assembly=(id:string):RF=>{const a=d.assemblies.find(a=>a.id===id)!;return a.parentId?joinFrames(assembly(a.parentId),rayFrame(a.frame)):rayFrame(a.frame);};
 const frames=ss.map(s=>relativeFrame(source,joinFrames(assembly(s.assemblyId),rayFrame(s.frame)))),end=frames.at(-1)!;
 if(end.a[0][0]<1-1e-12||ss.at(-1)!.nBefore!==1||ss.at(-1)!.nAfter!==1)throw Error('Parallel Input/Output axes in air required.');
 const faces:Face[]=[],lensIds:string[]=[],glassLengths:number[]=[];
 for(let i=0;i<ss.length-1;i+=2){const a=ss[i],b=ss[i+1],f=frames[i],g=frames[i+1],rel=relativeFrame(f,g);
  if(a.assemblyId!==b.assemblyId||d.assemblies.find(x=>x.id===a.assemblyId)?.kind!=='lens'||a.interaction!=='refract'||b.interaction!=='refract'||a.nBefore!==1||!a.nAfter||a.nAfter<=1||b.nBefore!==a.nAfter||b.nAfter!==1)throw Error('Paired air/glass/air Lens faces required.');
  if(rel.o[0]<=0||Math.hypot(rel.o[1],rel.o[2])>1e-10||rel.a[0][0]<1-1e-12||f.a[0][0]<Math.cos(.05))throw Error('Coaxial positive-thickness Lens faces; mechanical tilt ≤50 mrad required.');
  for(const [s,fr] of [[a,f],[b,g]] as const){if(!['sphere','plane'].includes(s.shape))throw Error('Sphere/Plane only; aspheres/folds unsupported.');const radius=s.shape==='plane'?0:s.radius;if(radius&&s.aperture/Math.abs(radius)>.5)throw Error('Aperture / |R| exceeds 0.5 cap.');faces.push({id:s.id,frame:fr,radius,aperture:s.aperture,n1:s.nBefore!,n2:s.nAfter!});}
  lensIds.push(a.assemblyId);glassLengths.push(rel.o[0]);
 }
 const extent=(f:Face)=>f.aperture*Math.hypot(f.frame.a[1][0],f.frame.a[2][0])+(f.radius?Math.abs(f.radius)-Math.sqrt(f.radius*f.radius-f.aperture*f.aperture):0);
 const launch=faces[0].frame.o[0]-extent(faces[0])-1e-6,last=faces.at(-1)!,exit=last.frame.o[0]+extent(last)+1e-6;
 if(!(launch>0&&end.o[0]>exit)||faces.some(f=>f.frame.o[0]-extent(f)<launch||f.frame.o[0]+extent(f)>exit))throw Error('Ports must bracket the finite Lens train.');
 const gaussian=(mfd:number,length:number)=>{const w=mfd/2,zr=Math.PI*w*w/d.wavelength;return [w*Math.sqrt(1+(length/zr)**2),length/(length*length+zr*zr)];};
 const src=[gaussian(p.model.sourceMode.mfdX!,launch),gaussian(p.model.sourceMode.mfdY!,launch)],tar=[gaussian(p.model.targetMode.mfdX!,exit-end.o[0]),gaussian(p.model.targetMode.mfdY!,exit-end.o[0])];
 return {wavelength:d.wavelength,faces,launch,exit,inputW:[src[0][0],src[1][0]],inputC:[src[0][1],src[1][1]],targetW:[tar[0][0],tar[1][0]],targetC:[tar[0][1],tar[1][1]],targetCenter:[end.o[1],end.o[2]],targetAxes:[end.a[1][1],end.a[1][2],end.a[2][1],end.a[2][2]],lensIds,glassLengths};
}
/** Weighted piston/tilt/defocus/astigmatism removal in normalized exit coordinates. */
export function quadraticPhaseFit(points:PhasePoint[]){
 const power=points.reduce((s,p)=>s+p.weight,0),center=['y','z'].map(k=>points.reduce((s,p)=>s+p.weight*p[k as 'y'],0)/power),scale=['y','z'].map((k,i)=>Math.sqrt(points.reduce((s,p)=>s+p.weight*(p[k as 'y']-center[i])**2,0)/power));
 const basis=(y:number,z:number)=>{const a=(y-center[0])/scale[0],b=(z-center[1])/scale[1];return [1,a,b,a*a,a*b,b*b];};
 const mat=Array.from({length:6},()=>Array(7).fill(0) as number[]);
 for(const p of points){const b=basis(p.y,p.z);for(let i=0;i<6;i++){for(let j=0;j<6;j++)mat[i][j]+=p.weight*b[i]*b[j];mat[i][6]+=p.weight*b[i]*p.opd;}}
 for(let i=0;i<6;i++){let pivot=i;for(let j=i+1;j<6;j++)if(Math.abs(mat[j][i])>Math.abs(mat[pivot][i]))pivot=j;[mat[i],mat[pivot]]=[mat[pivot],mat[i]];const den=mat[i][i];if(!(Math.abs(den)>1e-20))throw Error('Degenerate pupil fit');for(let k=i;k<7;k++)mat[i][k]/=den;for(let j=0;j<6;j++)if(j!==i){const c=mat[j][i];for(let k=i;k<7;k++)mat[j][k]-=c*mat[i][k];}}
 const coefficients=mat.map(row=>row[6]);return {coefficients,center,scale,at:(y:number,z:number)=>basis(y,z).reduce((s,v,i)=>s+v*coefficients[i],0)};
}
function legendre(n:number){return Array.from({length:n},(_,i)=>{let x=Math.cos(Math.PI*(i+.75)/(n+.5)),dp=0;for(let j=0;j<30;j++){let p=1,q=0;for(let k=1;k<=n;k++){const old=p;p=((2*k-1)*x*p-(k-1)*q)/k;q=old;}dp=n*(x*p-q)/(x*x-1);const step=p/dp;x-=step;if(Math.abs(step)<1e-15)break;}return {t:(x+1)/2,w:1/((1-x*x)*dp*dp)};}).sort((a,b)=>a.t-b.t);}
export function* integrateTrainPupil(s:PupilInput,n:number):Generator<void,PupilSample,void>{
 if(!Number.isInteger(n)||n<8||n>128)throw Error('Grid must be integer 8–128');
 let rays=0;const ray=(y:number,z:number)=>{rays++;const dy=s.inputC[0]*y,dz=s.inputC[1]*z;if(dy*dy+dz*dz>Math.sin(.3)**2)throw Error('Launch direction outside 0.3 rad benchmark domain');return tracePupilRay(s.faces,[s.launch,y,z],[Math.sqrt(1-dy*dy-dz*dz),dy,dz],s.exit);};
 const chief=ray(0,0),h=Math.min(...s.inputW)*1e-4,near=(y:number,z:number,step:number)=>[ray(y+step,z),ray(y-step,z),ray(y,z+step),ray(y,z-step)],cn=near(0,0,h),jm=tubeJacobian(chief,cn,h).matrix,detJ=jm[0]*jm[3]-jm[1]*jm[2];
 const dm=[(cn[0].direction[1]-cn[1].direction[1])/(2*h),(cn[2].direction[1]-cn[3].direction[1])/(2*h),(cn[0].direction[2]-cn[1].direction[2])/(2*h),(cn[2].direction[2]-cn[3].direction[2])/(2*h)];
 if(!(detJ>1e-6))throw Error('Chief caustic / singular linear pupil');
 const k=2*Math.PI/s.wavelength,count=2*n,rejectedPower:Record<string,number>={},points:(PhasePoint&{area:number;I:number;J:number;row:number;col:number;target:number;targetPhase:number;linear:number;linearPhase:number})[]=[];
 let inputPower=0,blockedPower=0,targetCoverage=0,jacobianError=0,minimumJacobian=Infinity,maxIncidence=0;
 const target=(y:number,z:number)=>{const a=y-s.targetCenter[0],b=z-s.targetCenter[1],u=s.targetAxes[0]*a+s.targetAxes[1]*b,v=s.targetAxes[2]*a+s.targetAxes[3]*b;return {amplitude:Math.sqrt(2/(Math.PI*s.targetW[0]*s.targetW[1]))*Math.exp(-((u/s.targetW[0])**2+(v/s.targetW[1])**2)),phase:k/2*(s.targetC[0]*u*u+s.targetC[1]*v*v)};};
 const rows=legendre(n);
 for(let i=0;i<n;i++){const row=rows[i],r=3.5*Math.sqrt(row.t),area=12.25*s.inputW[0]*s.inputW[1]*Math.PI*row.w/count;
  for(let j=0;j<count;j++){const theta=2*Math.PI*(j+.5)/count,y=s.inputW[0]*r*Math.cos(theta),z=s.inputW[1]*r*Math.sin(theta),I=2/(Math.PI*s.inputW[0]*s.inputW[1])*Math.exp(-2*r*r),weight=I*area;
   try{const center=ray(y,z),a=tubeJacobian(center,near(y,z,h),h),b=tubeJacobian(center,near(y,z,h/2),h/2),J=b.determinant;if(!(b.minimum>1e-6))throw Error('Intermediate caustic / singular tube');
    const err=Math.abs(a.determinant-J)/Math.max(1e-8,Math.abs(J));if(weight>1e-12)jacobianError=Math.max(jacobianError,err);minimumJacobian=Math.min(minimumJacobian,b.minimum);maxIncidence=Math.max(maxIncidence,center.maxIncidence);
    const out=target(center.point[1],center.point[2]),ly=jm[0]*y+jm[1]*z,lz=jm[2]*y+jm[3]*z,lt=target(chief.point[1]+ly,chief.point[2]+lz),linearOPD=chief.direction[1]*ly+chief.direction[2]*lz+.5*(ly*(dm[0]*y+dm[1]*z)+lz*(dm[2]*y+dm[3]*z));
    inputPower+=weight;targetCoverage+=out.amplitude*out.amplitude*J*area;
    points.push({y:center.point[1],z:center.point[2],opd:.5*(s.inputC[0]*y*y+s.inputC[1]*z*z)+center.opl-chief.opl,weight,area,I,J,row:i,col:j,target:out.amplitude,targetPhase:out.phase,linear:Math.sqrt(I*detJ)*lt.amplitude*area,linearPhase:-k*linearOPD+lt.phase});
   }catch(e){const why=e instanceof Error?e.message:String(e);blockedPower+=weight;rejectedPower[why]=(rejectedPower[why]??0)+weight;}
  }yield;
 }
 if(!(inputPower>1e-10)||!points.length)throw Error('Empty pupil');
 const fit=quadraticPhaseFit(points);let er=0,ei=0,lr=0,li=0,qr=0,qi=0,fr=0,fi=0,variance=0,maxPhaseStep=0;
 const samples=new Map<number,{phases:number[];weight:number}>(),opdMap:PupilSample['opdMap']=[];
 for(const p of points){const residual=p.opd-fit.at(p.y,p.z),phase=-k*p.opd+p.targetPhase,quad=-k*fit.at(p.y,p.z)+p.targetPhase,amplitude=Math.sqrt(p.I*p.J)*p.target*p.area;
  er+=amplitude*Math.cos(phase);ei+=amplitude*Math.sin(phase);qr+=amplitude*Math.cos(quad);qi+=amplitude*Math.sin(quad);lr+=p.linear*Math.cos(p.linearPhase);li+=p.linear*Math.sin(p.linearPhase);fr+=p.weight*Math.cos(k*residual);fi+=p.weight*Math.sin(k*residual);variance+=p.weight*residual*residual;
  const v={phases:[phase,quad,p.linearPhase,k*residual],weight:p.weight};samples.set(p.row*count+p.col,v);
  for(const index of [(p.row-1)*count+p.col,p.row*count+p.col-1,...(p.col===count-1?[p.row*count]:[])]){const prev=samples.get(index);if(prev&&Math.max(prev.weight,v.weight)>1e-9)maxPhaseStep=Math.max(maxPhaseStep,...v.phases.map((q,i)=>Math.abs(q-prev.phases[i])));}
  if(p.row%Math.max(1,n/16)===0&&p.col%Math.max(1,count/32)===0)opdMap.push({y:p.y,z:p.z,residual});
 }
 const sample={grid:n,rays,inputPower,blockedPower,rejectedPower,targetCoverage,eta:(er*er+ei*ei)/inputPower,linearEta:(lr*lr+li*li)/inputPower,quadraticEta:(qr*qr+qi*qi)/inputPower,phaseFidelity:(fr*fr+fi*fi)/inputPower**2,rmsOPD:Math.sqrt(variance/inputPower),maxPhaseStep,jacobianError,minimumJacobian,maxIncidence,quadratic:{coefficients:fit.coefficients,center:fit.center,scale:fit.scale},opdMap};
 if(Object.values(sample).some(v=>typeof v==='number'&&!Number.isFinite(v)))throw Error('Non-finite pupil integral');return sample;
}
export async function assessTrainPupil(p:Project,hooks:{cancelled?:()=>boolean;progress?:(n:number)=>void;maxGrid?:32|64|128}={}):Promise<TrainPupilResult>{
 const base:TrainPupilResult={engine:TRAIN_PUPIL_ID,inputSignature:'',scope:TRAIN_PUPIL_SCOPE,status:'unsupported',reason:'',lensIds:[],glassLengths:[],gaussianEta:null,metrics:null,physicalEtaErrorBound:null,totalCoupling:null};
 try{base.inputSignature=serializeProject(p);const input=trainPupilInput(p),limit=hooks.maxGrid??128;if(![32,64,128].includes(limit))throw Error('Unsupported grid budget');base.lensIds=input.lensIds;base.glassLengths=input.glassLengths;const gaussian=tensorOverlap(p);base.gaussianEta=gaussian.status==='valid'?gaussian.eta:null;const history:PupilSample[]=[];
  for(const n of [16,32,64,128].filter(n=>n<=limit)){hooks.progress?.(n);const gen=integrateTrainPupil(input,n);let result:IteratorResult<void,PupilSample>;
   try{do{await new Promise(r=>setTimeout(r,0));if(hooks.cancelled?.())return {...base,status:'cancelled',reason:'Cancelled; no current metric.',metrics:null};result=gen.next();}while(!result.done);}catch(e){return {...base,status:'unresolved',reason:e instanceof Error?e.message:String(e),metrics:null};}
   history.push(result.value);if(history.length<3)continue;
   const a=history.at(-1)!,b=history.at(-2)!,c=history.at(-3)!,keys=['eta','linearEta','quadraticEta','phaseFidelity','inputPower','targetCoverage'] as const,etaRefinement=Math.max(...keys.flatMap(key=>[Math.abs(a[key]-b[key]),Math.abs(b[key]-c[key])])),opdRefinement=Math.max(Math.abs(a.rmsOPD-b.rmsOPD),Math.abs(b.rmsOPD-c.rmsOPD));
   const converged=etaRefinement<2e-5&&opdRefinement<input.wavelength*1e-5&&a.maxPhaseStep<Math.PI&&a.jacobianError<2e-5&&a.blockedPower<1e-7&&Math.abs(a.inputPower-1)<1e-7&&a.targetCoverage>.999&&keys.every(key=>a[key]>=-1e-10&&a[key]<=1+2e-5);
   base.metrics={sample:a,history,etaRefinement,opdRefinement};if(converged)return {...base,status:'converged',reason:'Numerical pupil integral converged; physical accuracy remains unassessed.'};
  }return {...base,status:'unresolved',reason:'Grid / phase / caustic / clipping / target coverage gates did not establish convergence. No accuracy pass.'};
 }catch(e){return {...base,reason:e instanceof Error?e.message:String(e)};}
}
export function trainPupilReport(p:Project,result:TrainPupilResult|null,invalid=false){const current=!!result&&!invalid&&result.engine===TRAIN_PUPIL_ID&&result.inputSignature===serializeProject(p);return {state:!result?'not-calculated':current?'current':'stale',scope:TRAIN_PUPIL_SCOPE,result:current?result:null,physicalEtaErrorBound:null,totalCoupling:null};}
