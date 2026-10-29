import type {Project} from '../project/model';
import {compile,frame,vectorToLocal} from '../surface/model';
import {traceRay} from '../surface/trace';
import {bodyGeometry,insideBody} from '../project/geometry';
import {buildLensProject,lensBounds,physical} from './domain';
import type {LensDomain} from './domain';
import type {LensOptions} from './contract';

/** Bounded chief-ray correction, not a thin-Lens or paraxial ray approximation.
 * Four residuals at the fixed receiving plane: Y/Z position and Y/Z slope.
 * Trial surfaces, aperture intersections and Snell refraction are exact. The
 * Gaussian and collision gates remain independent and run after correction.
 * Offsets are relative to each original front vertex; Ports never move.
 */
export function alignLensChief(domain:LensDomain,shape:number[],o:LensOptions,onTrace:()=>void=()=>{}):{project:Project;values:number[]} {
 if(!o.alignment)return {project:buildLensProject(domain,shape),values:shape};
 const size=4*domain.slots.length,limits=lensBounds(o).slice(size),scales=limits.map(([a,b],i)=>Math.max(b-a,i%4<2?1e-6:1e-3));
 const clamp=(x:number,i:number)=>Math.max(limits[i][0]/scales[i],Math.min(limits[i][1]/scales[i],x));
 const posTolerance=Math.min(1e-9,(domain.base.routing?.positionTolerance??1e-6)*.01),angleTolerance=Math.min(1e-7,(domain.base.routing?.angleTolerance??.001)*.01);
 let count=0;
 const evaluate=(x:number[])=>{
  if(count>=160)return null;count++;onTrace();
  try{
   const values=[...shape.slice(0,size),...x.map((v,i)=>v*scales[i])],project=buildLensProject(domain,values),d=physical(project),ss=compile(d),g=bodyGeometry(d,ss,project.bodies);
   if(g.issues.length)return null;
   const f=frame(d.source.frame),path=traceRay({origin:f.origin,direction:f.axes[0],n:d.source.n!,channel:'lens-alignment'},ss,(p,s)=>insideBody(p,s,g));
   if(path.status!=='reached')return null;
   const hit=path.hits.at(-1)!,v=vectorToLocal(ss.at(-1)!.world,hit.direction);if(v.x<=0)return null;
   const residual=[hit.local.y/1e-4,hit.local.z/1e-4,v.y/v.x/.01,v.z/v.x/.01];
   const cost=Math.hypot(...residual);
   return {values,project,residual,cost,closed:Math.hypot(hit.local.y,hit.local.z)<=posTolerance&&Math.atan2(Math.hypot(v.y,v.z),v.x)<=angleTolerance};
  }catch{return null;}
 };
 let x=limits.map(([a,b])=>Math.max(a,Math.min(b,0))).map((v,i)=>v/scales[i]),best=evaluate(x);
 if(!best)throw Error('Lens alignment seed has no finite chief path through the actual apertures.');
 // Prefer transverse translations; introduce pitch/yaw only when needed.
 for(const tilt of [false,true]){
  const active=limits.flatMap(([a,b],i)=>b>a&&(tilt||i%4<2)?[i]:[]);
  for(let iteration=0;iteration<12&&!best.closed&&count<160;iteration++){
   const columns=active.map(i=>{
    const h=1e-4,plus=[...x],minus=[...x];plus[i]=clamp(x[i]+h,i);minus[i]=clamp(x[i]-h,i);
    const a=evaluate(plus),b=evaluate(minus),span=plus[i]-minus[i];
    if(a&&b&&span>0)return a.residual.map((v,j)=>(v-b.residual[j])/span);
    if(a&&plus[i]!==x[i])return a.residual.map((v,j)=>(v-best!.residual[j])/(plus[i]-x[i]));
    if(b&&minus[i]!==x[i])return b.residual.map((v,j)=>(best!.residual[j]-v)/(x[i]-minus[i]));
    return best!.residual.map(()=>0);
   });
   if(!active.length)break;
   const n=best.residual.length,matrix=Array.from({length:n},(_,r)=>Array.from({length:n+1},(_,c)=>c===n?-best!.residual[r]:columns.reduce((s,v)=>s+v[r]*v[c],0)+(r===c?1e-10:0)));
   // Pivoted solve (J Jᵀ + λI) u = -r, then minimum-norm step Jᵀu.
   for(let i=0;i<n;i++){
    let pivot=i;for(let j=i+1;j<n;j++)if(Math.abs(matrix[j][i])>Math.abs(matrix[pivot][i]))pivot=j;
    [matrix[i],matrix[pivot]]=[matrix[pivot],matrix[i]];const d=matrix[i][i];
    for(let j=i;j<=n;j++)matrix[i][j]/=d;
    for(let k=0;k<n;k++)if(k!==i){const f=matrix[k][i];for(let j=i;j<=n;j++)matrix[k][j]-=f*matrix[i][j];}
   }
   const step=columns.map(v=>v.reduce((s,c,j)=>s+c*matrix[j][n],0)),factor=Math.min(1,.25/Math.max(1e-30,...step.map(Math.abs)));
   let improved=false;
   for(const damping of [1,.5,.25,.125,.0625]){
    const next=[...x];active.forEach((i,k)=>next[i]=clamp(x[i]+step[k]*factor*damping,i));const trial=evaluate(next);
    if(trial&&trial.cost<best.cost-1e-13){x=next;best=trial;improved=true;break;}
   }
   if(!improved)break;
  }
  if(best.closed)break;
 }
 if(!best.closed)throw Error('Lens decenter / tilt bounds did not close the chief route; bounded correction is not proof of impossibility.');
 return {project:best.project,values:best.values};
}
