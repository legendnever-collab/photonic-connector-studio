import {bodyGeometry} from '../project/geometry';
import {radialBounds} from '../surface/evaluator';
import {prescription} from '../project/model';
import type {Project} from '../project/model';
import {compile,pointToWorld,V,sub,frame} from '../surface/model';
import type {Vec,Frame} from '../surface/model';
import type {RayPath} from '../surface/trace';
import type {Box} from './contract';
const axes=['x','y','z'] as const;
export function envelope(points:Vec[]):Box{return {min:V(...axes.map(k=>Math.min(...points.map(p=>p[k]))) as [number,number,number]),max:V(...axes.map(k=>Math.max(...points.map(p=>p[k]))) as [number,number,number])};}
export function expanded(b:Box,gap:number):Box{return {min:V(b.min.x-gap,b.min.y-gap,b.min.z-gap),max:V(b.max.x+gap,b.max.y+gap,b.max.z+gap)};}
export function boxOverlap(a:Box,b:Box){return axes.every(k=>a.max[k]>b.min[k]+1e-12&&a.min[k]<b.max[k]-1e-12);}
export function insideBox(a:Box,b:Box){return axes.every(k=>a.min[k]>=b.min[k]-1e-12&&a.max[k]<=b.max[k]+1e-12);}
function cylinderBox(f:Frame,radius:number,x0:number,x1:number):Box {
 const ends=[pointToWorld(f,V(x0)),pointToWorld(f,V(x1))],b=envelope(ends);
 for(const k of axes){const extent=radius*Math.hypot(f.axes[1][k],f.axes[2][k]);b.min[k]-=extent;b.max[k]+=extent;}return b;
}
/** Closed segment/ray slab intersection, including grazing; parameter is segment fraction or ray distance. */
export function lineBox(origin:Vec,direction:Vec,box:Box,lo=0,hi=Infinity):[number,number]|null {
 for(const k of axes){if(Math.abs(direction[k])<1e-15){if(origin[k]<box.min[k]||origin[k]>box.max[k])return null;continue;}
  const a=(box.min[k]-origin[k])/direction[k],b=(box.max[k]-origin[k])/direction[k];lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));if(lo>hi)return null;
 }return [lo,hi];
}
/** Conservative broad-phase screening. False positives are allowed, never reported as exact solid collision. */
export function screenClearance(p:Project,generatedIds:string[],path:RayPath,gap:number,generatedBounds?:Box):string|null {
 const d=prescription(p),ss=compile(d),g=bodyGeometry(d,ss,p.bodies,p.sourceBody,p.targetBody),boxes=new Map<string,Box>();
 for(const id of new Set(g.faces.map(f=>f.bodyId).filter((v):v is string=>!!v))){
  const points=g.faces.filter(f=>f.bodyId===id).flatMap(f=>f.points),body=p.bodies.find(b=>b.assemblyId===id);
  // Radial interval bounds also include unsampled interior Sag extrema of fixed Lens faces.
  if(body?.kind==='lens')for(const s of ss.filter(s=>s.assemblyId===id)){
   const [lo,hi]=radialBounds(s,0,body.outerRadius);
   points.push(...[lo,hi].flatMap(x=>[-body.outerRadius,body.outerRadius].flatMap(y=>[-body.outerRadius,body.outerRadius].map(z=>pointToWorld(s.world,V(x,y,z))))));
  }
  const first=ss.find(s=>s.assemblyId===id);
  boxes.set(id,body?.kind==='mirror'&&body.outline==='disc'&&first?cylinderBox(first.world,body.width/2,-body.thickness,0):
   id==='@source'&&p.sourceBody?cylinderBox(frame(d.source.frame),p.sourceBody.radius,-p.sourceBody.length,0):
   id==='@target'&&p.targetBody?cylinderBox(ss.at(-1)!.world,p.targetBody.radius,0,p.targetBody.length):envelope(points));
 }
 const bounds=p.routing?.bounds,obstacles=p.routing?.keepOut??[];
 for(const id of generatedIds){const a=boxes.get(id);if(!a)return 'Generated body envelope unavailable';
  if((bounds??generatedBounds)&&!insideBox(a,(bounds??generatedBounds)!))return 'Generated body outside Design Space (conservative bounds)';
 }
 for(const [id,a]of boxes)for(const [other,b]of boxes)if(id<other&&boxOverlap(expanded(a,gap),b))return 'Potential component clearance conflict (AABB)';
 for(const [id,box]of boxes){if(id==='@source'||id==='@target')continue;
  if(bounds&&!insideBox(box,bounds))return 'Fixed or generated body outside Design Space (conservative bounds)';
  if(obstacles.some(b=>boxOverlap(expanded(box,gap),b)))return 'Potential body / Keep-out conflict (AABB)';
 }
 for(let i=0;i<path.points.length-1;i++){
  const a=path.points[i],direction=sub(path.points[i+1],a),start=i?ss.find(s=>s.id===path.hits[i-1]?.surfaceId)?.assemblyId:'@source',end=ss.find(s=>s.id===path.hits[i]?.surfaceId)?.assemblyId;
  if(obstacles.some(b=>lineBox(a,direction,expanded(b,gap),0,1)))return 'Reference segment intersects Keep-out box';
  for(const [id,b]of boxes){if(id===start||id===end||id==='@target'&&i===path.points.length-2)continue;
   if(lineBox(a,direction,expanded(b,gap),1e-8,1-1e-8))return 'Potential unintended body crossing (AABB)';
  }
 }
 return null;
}
