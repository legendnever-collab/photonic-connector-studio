import {add,sub,mul,norm,V,pointToWorld} from './model';
import type {Prescription,Vec} from './model';
import type {Trace} from './trace';
import type {Project} from '../project/model';
import type {ReportGeometry} from './reportGeometry';
import type {PhysicalGaussian} from '../project/physicalGaussian';
import type {FoldedResult} from '../project/foldedGaussian';

export type ReportBeamSample={point:Vec;u:Vec;v:Vec;radii:[number,number];surfaceId?:string;side:'before'|'after'};
export function reportBeamSamples(physical:PhysicalGaussian,folded:FoldedResult|null):ReportBeamSample[]{
 if(folded?.status==='valid')return folded.samples.map(s=>({point:s.point,u:add(mul(s.u,Math.cos(s.beam.angle)),mul(s.v,Math.sin(s.beam.angle))),v:add(mul(s.u,-Math.sin(s.beam.angle)),mul(s.v,Math.cos(s.beam.angle))),radii:s.beam.radii,surfaceId:s.surfaceId,side:s.side}));
 if(physical.status!=='valid')return [];
 return physical.samples.map(s=>({point:pointToWorld(physical.frame,V(s.x,s.heightY,s.heightZ)),u:physical.frame.axes[1],v:physical.frame.axes[2],radii:[s.y.radius,s.z.radius],surfaceId:s.surfaceId,side:s.side}));
}
export const mm=(v:number)=>`${(v*1e3).toPrecision(4)} mm`;
export const diameterText=(s:ReportBeamSample)=>s.radii.map(r=>(2*r*1e6).toPrecision(4)).join(' × ')+' µm';
function box(ps:Vec[]){return {lo:V(...(['x','y','z'] as const).map(k=>Math.min(...ps.map(p=>p[k]))) as [number,number,number]),hi:V(...(['x','y','z'] as const).map(k=>Math.max(...ps.map(p=>p[k]))) as [number,number,number])};}
export type DetailRegion={ids:string[];surfaceIds:string[];name:string;points:Vec[];dimensions:string[];gap:string|null;measurements:{a:Vec;b:Vec;label:string}[]};
/** Read-only world geometry; connected nearby components share a region. No inferred solids. */
export function reportDetailRegions(doc:Prescription,trace:Trace,geometry:Pick<ReportGeometry,'faces'>,project:Project):DetailRegion[]{
 if(project.model.kind!=='surface')return [];
 const parts=doc.assemblies.filter(a=>a.kind==='lens'||a.kind==='prism').flatMap(a=>{
  const ss=trace.surfaces.filter(s=>s.assemblyId===a.id);if(!ss.length)return [];
  const ids=new Set(ss.map(s=>s.id)),points=geometry.faces.filter(f=>ids.has(f.surfaceId)&&!f.illustrative).flatMap(f=>f.points);
  if(!points.length)return [];
  const b=project.bodies.find(b=>b.assemblyId===a.id),dimensions:string[]=[],measurements:DetailRegion['measurements']=[];
  if(a.kind==='lens'&&ss.length===2){dimensions.push(`t = ${mm(norm(sub(ss[1].world.origin,ss[0].world.origin)))}`);dimensions.push(`R1 / R2 = ${ss.map(s=>s.shape==='plane'?'∞':mm(s.radius)).join(' / ')}`);}
  if(b?.kind==='lens'){
   dimensions.push(`Body Ø ${mm(2*b.outerRadius)} · Clear Ø ${mm(2*ss[0].aperture)}`);
   const front=ss[0].world.origin,rear=ss[1]?.world.origin??front,u=ss[0].world.axes[1],z=ss[0].world.axes[2],axis=ss[0].world.axes[0];
   measurements.push({a:add(front,mul(z,b.outerRadius*1.15)),b:add(rear,mul(z,b.outerRadius*1.15)),label:`t ${mm(norm(sub(rear,front)))}`});
   const center=sub(front,mul(axis,b.outerRadius*.3));measurements.push({a:sub(center,mul(u,b.outerRadius)),b:add(center,mul(u,b.outerRadius)),label:`Ø ${mm(2*b.outerRadius)}`});
  }
  if(b?.kind==='prism'){dimensions.push(`Prism depth = ${mm(b.depth)}`);const z=ss[0].world.axes[2],center=ss[0].world.origin;measurements.push({a:sub(center,mul(z,b.depth/2)),b:add(center,mul(z,b.depth/2)),label:`depth ${mm(b.depth)}`});}
  if(!b)dimensions.push('Body undefined · optical Surfaces only');
  return [{ids:[a.id],surfaceIds:ss.map(s=>s.id),name:a.name,points,dimensions,gap:null as string|null,measurements}];
 });
 // Conservative world AABB proximity groups nearby components transitively for presentation only.
 const groups=parts.map(p=>({...p}));let changed=true;
 while(changed){changed=false;for(let i=0;i<groups.length&&!changed;i++)for(let j=i+1;j<groups.length;j++){
  const a=box(groups[i].points),b=box(groups[j].points),distance=Math.hypot(...(['x','y','z'] as const).map(k=>Math.max(0,a.lo[k]-b.hi[k],b.lo[k]-a.hi[k]))),span=Math.max(norm(sub(a.hi,a.lo)),norm(sub(b.hi,b.lo)));
  if(distance>span*.08)continue;
  groups[i]={ids:[...groups[i].ids,...groups[j].ids],surfaceIds:[...groups[i].surfaceIds,...groups[j].surfaceIds],name:groups[i].name+' + '+groups[j].name,points:[...groups[i].points,...groups[j].points],dimensions:[...groups[i].dimensions,...groups[j].dimensions],gap:null,measurements:[...groups[i].measurements,...groups[j].measurements]};groups.splice(j,1);changed=true;break;
 }}
 for(const g of groups){
  const own=trace.surfaces.filter(s=>g.surfaceIds.includes(s.id)),first=own[0],last=own.at(-1)!;
  const firstIndex=trace.surfaces.indexOf(first),lastIndex=trace.surfaces.indexOf(last),previous=trace.surfaces[firstIndex-1],next=trace.surfaces[lastIndex+1];
  const gaps=[`${previous?.id??'Input'} → ${first.id}: ${mm(norm(sub(first.world.origin,previous?.world.origin??doc.source.frame.origin)))}`];
  if(next)gaps.push(`${last.id} → ${next.id}: ${mm(norm(sub(last.world.origin,next.world.origin)))}`);
  g.gap='Vertex distances · '+gaps.join(' · ');
 }
 return groups;
}
