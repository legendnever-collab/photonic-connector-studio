import { modes, withMode, prescription, withPrescription, ProjectSchema } from '../project/model';
import type { Project } from '../project/model';
import { unknownAuthoring, unknownPort } from './contract';
// Nominal Gaussian design reference; not an eigenmode or a measured fiber data set.
// MFD basis: Corning SMF-28 Ultra PI-1424-AEN, 9.2 ± 0.4 µm at 1310 nm.
export const SMF_REFERENCE={wavelength:1310e-9,mfd:9.2e-6} as const;
export function applySmfReference(project:Project,which:'source'|'target'='source'):Project {
 const doc=prescription(project),next=withMode(withPrescription(project,{...doc,wavelength:SMF_REFERENCE.wavelength}),which,{...modes(project)[which],representation:'gaussian',mfdX:SMF_REFERENCE.mfd,mfdY:SMF_REFERENCE.mfd});
 const authoring=next.authoring??unknownAuthoring();
 return ProjectSchema.parse({...next,authoring:{...authoring,ports:{...authoring.ports,[which]:{...unknownPort(),preset:'smf-1310-gaussian',phase:'waist-plane',normalization:'unit-power',mediumIndex:1,adapter:'homogeneous-paraxial'}}}});
}
export function isNominalSmf(p:Project,which:'source'|'target'='source'){const mode=modes(p)[which],port=p.authoring?.ports[which];return port?.preset==='smf-1310-gaussian'&&port.fieldModel==='gaussian'&&mode.mfdX===SMF_REFERENCE.mfd&&mode.mfdY===SMF_REFERENCE.mfd&&prescription(p).wavelength===SMF_REFERENCE.wavelength&&port.phase==='waist-plane';}
