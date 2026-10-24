import { newPhysicalProject } from './commands';
import { applySmfReference } from './smf';
import { prescription, withPrescription, ProjectSchema } from '../project/model';
import { materialIndex } from '../surface/materials';
import { pose } from '../surface/model';
import type { Project } from '../project/model';
export const FIBER_BODY={radius:62.5e-6,length:.001};
/** Starter dimensions are explicit editable assumptions, not an optimized coupling solution. */
export function fiberLensFiberProject():Project {
 const p=applySmfReference(newPhysicalProject(),'target'),d=prescription(p),n=materialIndex('N-BK7',d.wavelength);
 const s={...d.surfaces[0],assemblyId:'Starter-Lens',shape:'sphere' as const,interaction:'refract' as const,radius:.005,aperture:.001};
 const next=withPrescription(p,{...d,name:'Fiber → BK7 Lens → Fiber',source:{...d.source,radius:.00004},assemblies:[{id:'Starter-Lens',name:'BK7 Lens · S1–S2',kind:'lens',parentId:null,frame:pose(.0045)},...d.assemblies.map(a=>({...a,name:'Output Fiber'}))],surfaces:[{...s,id:'S1',name:'Front',frame:pose(),materialBefore:'air',materialAfter:'N-BK7',nBefore:1,nAfter:n},{...s,id:'S2',name:'Rear',frame:pose(.001),radius:-.005,materialBefore:'N-BK7',materialAfter:'air',nBefore:n,nAfter:1},{...d.surfaces[0],name:'Output Fiber Reference Plane',aperture:62.5e-6,materialBefore:'air',materialAfter:'air',nBefore:1,nAfter:1}]});
 return ProjectSchema.parse({...next,sourceBody:{...FIBER_BODY},targetBody:{...FIBER_BODY},bodies:[{assemblyId:'Starter-Lens',kind:'lens',outerRadius:.0012}]});
}
