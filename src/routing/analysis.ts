import type {Project} from '../project/model';
import {prescription,projectFingerprint} from '../project/model';
import {bodyGeometry,insideBody} from '../project/geometry';
import {traceRay,surfaceRing,SURFACE_SOLVER_ID} from '../surface/trace';
import type {RayPath} from '../surface/trace';
import {compile,frame,vectorToLocal,V} from '../surface/model';
import type {Vec} from '../surface/model';
import {defaultRouting} from './contract';
import type {Box} from './contract';
export const ROUTING_ID='port-routing-diagnostic/1.0.0';
export type RoutingResult={id:string;solver:string;fingerprint:string;status:'evaluated'|'blocked'|'unavailable';reason:string;path:RayPath|null;
 positionError:number|null;offset:Vec|null;angleError:number|null;direction:Vec|null;withinTolerance:boolean|null;issues:string[];constraintChecks:string[]};
const axes=['x','y','z'] as const;
const contained=(b:Box,p:Vec)=>axes.every(k=>p[k]>=b.min[k]-1e-12&&p[k]<=b.max[k]+1e-12);
function bounds(points:Vec[]):Box {return {min:V(...axes.map(k=>Math.min(...points.map(p=>p[k]))) as [number,number,number]),max:V(...axes.map(k=>Math.max(...points.map(p=>p[k]))) as [number,number,number])};}
function overlaps(a:Box,b:Box){return axes.every(k=>a.max[k]>=b.min[k]-1e-12&&a.min[k]<=b.max[k]+1e-12);}
/** Independent center reference ray, never a sample selected from a pupil grid or a mode-coupling result. */
export function analyzeRouting(p:Project):RoutingResult {
 const out:RoutingResult={id:ROUTING_ID,solver:SURFACE_SOLVER_ID,fingerprint:projectFingerprint(p),status:'unavailable',reason:'',path:null,positionError:null,offset:null,angleError:null,direction:null,withinTolerance:null,issues:[],constraintChecks:[]};
 if(p.model.kind!=='surface')return {...out,reason:'Design Setup requires a Physical Project.'};
 const d=prescription(p),ss=compile(d),target=ss.at(-1)!,r=p.routing??defaultRouting(),g=bodyGeometry(d,ss,p.bodies);
 if(target.shape!=='plane'||target.array)return {...out,reason:'Output routing reference must be one planar Port.'};
 if(g.issues.length)return {...out,reason:g.issues.join(' · ')};
 if(d.source.channels.rows!==1||d.source.channels.cols!==1)return {...out,reason:'Single-channel routing only. Diagnostic channel arrays require per-channel Port conditions.'};
 if(d.source.n===null)return {...out,reason:'Input diagnostic medium is undefined.'};
 const expected=p.authoring?.ports.source.mediumIndex;
 if(expected!=null&&Math.abs(expected-d.source.n)>1e-10)return {...out,reason:'Input Port / diagnostic medium mismatch.'};
 const outputMedium=p.authoring?.ports.target.mediumIndex;
 if(outputMedium!=null&&target.nBefore!==null&&Math.abs(outputMedium-target.nBefore)>1e-10)out.issues.push('Output Port / Surface medium mismatch');
 const components=d.assemblies.filter(a=>ss.some(s=>s.assemblyId===a.id&&s.id!==target.id));
 for(const kind of ['lens','mirror','prism'] as const){const count=components.filter(a=>a.kind===kind).length;out.constraintChecks.push(`${kind}: ${count} / ${r.parts[kind]}`);if(count>r.parts[kind])out.issues.push(`${kind}: part limit exceeded`);}
 if(r.bounds||r.keepOut.length){
  const actual=g.faces.filter(f=>f.bodyId!=='@source'&&f.bodyId!=='@target');
  for(const a of components){const faces=actual.filter(f=>f.bodyId===a.id).flatMap(f=>f.points),surfaces=ss.filter(s=>s.assemblyId===a.id&&s.id!==target.id);
   // Lens bodies include full-radius annuli; optical rings also cover unbodied finite apertures.
   const points=[...faces,...surfaces.flatMap(s=>[s.world.origin,...surfaceRing(s)])];
   if(!points.length)continue;
   if(r.bounds&&points.some(v=>!contained(r.bounds!,v)))out.issues.push(`${a.name}: outside Design Space (sampled envelope)`);
   const box=bounds(points);
   r.keepOut.forEach((b,i)=>{if(overlaps(box,b))out.issues.push(`${a.name}: potential Keep-out ${i+1} intersection (AABB)`);});
  }
  out.constraintChecks.push('Space: sampled body / aperture envelope; Keep-out: conservative AABB. Full solid collision / segment clearance not calculated.');
 }
 const source=frame(d.source.frame),path=traceRay({origin:source.origin,direction:source.axes[0],n:d.source.n,channel:'reference'},ss,(v,s)=>insideBody(v,s,g));
 out.path=path;
 if(path.status!=='reached')return {...out,status:'blocked',reason:path.reason};
 const last=path.hits.at(-1)!,offset=last.local,direction=vectorToLocal(target.world,last.direction),positionError=Math.hypot(offset.y,offset.z),angleError=Math.atan2(Math.hypot(direction.y,direction.z),direction.x);
 const withinTolerance=positionError<=r.positionTolerance+1e-12&&angleError<=r.angleTolerance+1e-12&&out.issues.length===0;
 return {...out,status:'evaluated',reason:'Geometric reference ray only; no Beam / Coupling optimization.',positionError,offset,angleError,direction,withinTolerance};
}
