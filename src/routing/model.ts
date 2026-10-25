import {prescription,ProjectSchema,withPrescription} from '../project/model';
import type {Project} from '../project/model';
import {framePose} from '../authoring/commands';
import {unknownAuthoring,unknownPort} from '../authoring/contract';
import {compile,compose,frame,pointToLocal,vectorToLocal,V} from '../surface/model';
import type {Frame,Pose} from '../surface/model';
export type PortDevice='fiber'|'pic-edge'|'pic-grating'|'custom';
export function portDevice(p:Project,which:'source'|'target'):PortDevice {const v=p.authoring?.ports[which];return v?.device??(v?.preset?'fiber':'custom');}
export function withPortDevice(p:Project,which:'source'|'target',device:PortDevice):Project {
 const authoring=p.authoring??unknownAuthoring(),port={...(authoring.ports[which]??unknownPort()),device};
 // Device classification does not supply a measured mode or grating response.
 if(device!=='fiber')delete port.preset;
 return ProjectSchema.parse({...p,authoring:{...authoring,ports:{...authoring.ports,[which]:port}},...(device==='fiber'?{}:{[which==='source'?'sourceBody':'targetBody']:null})});
}
export function portWorld(p:Project,which:'source'|'target'):Frame {const d=prescription(p);return which==='source'?frame(d.source.frame):compile(d).at(-1)!.world;}
/** Edit the canonical Output Surface in its parent's coordinates, preserving the Assembly hierarchy. */
export function withPortWorld(p:Project,which:'source'|'target',world:Pose):Project {
 const d=prescription(p);
 if(p.model.kind!=='surface')throw Error('Design Setup requires a Physical Project.');
 if(which==='source')return withPrescription(p,{...d,source:{...d.source,frame:world}});
 const target=d.surfaces.at(-1)!;
 function parent(id:string):Frame {const a=d.assemblies.find(a=>a.id===id)!;return a.parentId?compose(parent(a.parentId),frame(a.frame)):frame(a.frame);}
 const a=parent(target.assemblyId),w=frame(world),local={origin:pointToLocal(a,w.origin),axes:w.axes.map(v=>vectorToLocal(a,v)) as Frame['axes']};
 return withPrescription(p,{...d,surfaces:d.surfaces.map(s=>s.id===target.id?{...s,frame:framePose(local)}:s)});
}
/** Set direction without erasing Roll, the rotation of the transverse mode axes. */
export function directionPose(p:Pose,axis:'+X'|'-X'|'+Y'|'-Y'|'+Z'|'-Z'):Pose {
 const directions={'+X':V(1),'-X':V(-1),'+Y':V(0,1),'-Y':V(0,-1),'+Z':V(0,0,1),'-Z':V(0,0,-1)},d=directions[axis];
 return {...p,rotation:{...p.rotation,yaw:Math.atan2(d.y,d.x),pitch:Math.atan2(-d.z,Math.hypot(d.x,d.y))}};
}
