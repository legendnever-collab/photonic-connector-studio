// Test-only conservation checks. No production reflect/refract, normals, sag,
// intersections, vector arithmetic or Mode solver. Compiled frames are inputs.
import type {Project} from '../../src/project/model';
import {prescription} from '../../src/project/model';
import {compile,frame} from '../../src/surface/model';
import type {Vec} from '../../src/surface/model';
import type {RayPath} from '../../src/surface/trace';
const a=(v:Vec)=>[v.x,v.y,v.z];
const dot=(x:number[],y:number[])=>x.reduce((s,v,i)=>s+v*y[i],0);
const sub=(x:number[],y:number[])=>x.map((v,i)=>v-y[i]);
const scale=(x:number[],s:number)=>x.map(v=>v*s);
const len=(x:number[])=>Math.hypot(...x);
const unit=(x:number[])=>scale(x,1/len(x));
const tangent=(x:number[],n:number[])=>sub(x,scale(n,dot(x,n)));
export const ORACLE_TOLERANCES={direction:2e-9,positionM:2e-11,surfaceM:2e-11};
export function rayOracle(p:Project,path:RayPath){
 const d=prescription(p),surfaces=compile(d),issues:string[]=[];
 let incoming=a(frame(d.source.frame).axes[0]),previous=a(d.source.frame.origin),medium=d.source.n!;
 if(path.status!=='reached'||path.hits.length!==surfaces.length||path.points.length!==path.hits.length+1)issues.push('incomplete-path');
 if(len(sub(a(path.points[0]),previous))>ORACLE_TOLERANCES.positionM)issues.push('source-origin');
 let maxDirectionResidual=0,maxSnellResidual=0,maxSurfaceResidualM=0;
 for(let i=0;i<path.hits.length;i++){
  const h=path.hits[i],s=surfaces[i],point=a(h.point),outgoing=a(h.direction),axes=s.world.axes.map(a);
  if(h.surfaceId!==s.id)issues.push('surface-order');
  if(len(sub(a(path.points[i+1]),point))>ORACLE_TOLERANCES.positionM)issues.push('hit-point');
  const flight=sub(point,previous),forward=dot(flight,incoming),directionResidual=len(sub(unit(flight),incoming));
  maxDirectionResidual=Math.max(maxDirectionResidual,directionResidual);
  if(forward<=0||directionResidual>ORACLE_TOLERANCES.direction)issues.push('free-space-bend');
  const rel=sub(point,a(s.world.origin)),local=axes.map(v=>dot(rel,v)),rho=Math.hypot(local[1],local[2]);
  if(rho>s.aperture+ORACLE_TOLERANCES.positionM)issues.push('aperture');
  let normal=axes[0],residual=Math.abs(local[0]);
  if(s.shape==='sphere'){
   const radial=[local[0]-s.radius,local[1],local[2]];
   residual=Math.abs(len(radial)-Math.abs(s.radius));
   normal=unit([0,1,2].map(k=>axes.reduce((sum,v,j)=>sum+v[k]*radial[j],0)));
  }else if(s.shape!=='plane')issues.push('unsupported-surface');
  maxSurfaceResidualM=Math.max(maxSurfaceResidualM,residual);
  if(residual>ORACLE_TOLERANCES.surfaceM)issues.push('off-surface');
  if(len(outgoing)<1-1e-9||len(outgoing)>1+1e-9)issues.push('nonunit-direction');
  if(Math.abs(medium-s.nBefore!)>1e-10)issues.push('medium-mismatch');
  if(s.interaction==='reflect'||s.interaction==='tir'){
   const expected=sub(incoming,scale(normal,2*dot(incoming,normal)));
   if(len(sub(expected,outgoing))>ORACLE_TOLERANCES.direction)issues.push('reflection-law');
   if(s.interaction==='tir'&&medium*len(tangent(incoming,normal))<=s.outsideIndex!)issues.push('TIR-condition');
  }else if(s.interaction==='refract'){
   const residual=len(sub(scale(tangent(incoming,normal),medium),scale(tangent(outgoing,normal),s.nAfter!)));
   maxSnellResidual=Math.max(maxSnellResidual,residual);
   if(residual>ORACLE_TOLERANCES.direction||dot(incoming,normal)*dot(outgoing,normal)<0)issues.push('Snell-law');
   medium=s.nAfter!;
  }else if(s.interaction==='probe'&&len(sub(incoming,outgoing))>ORACLE_TOLERANCES.direction)issues.push('probe-bend');
  else if(s.interaction!=='probe')issues.push('unsupported-interaction');
  previous=point;incoming=outgoing;
 }
 return {status:issues.length?'FAIL':'PASS',issues,maxDirectionResidual,maxSnellResidual,maxSurfaceResidualM};
}
