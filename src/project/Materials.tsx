import { useProject } from './Store';
import { withPrescription } from './model';
import type { Surface } from '../surface/model';
export function MaterialSelect({surface,side,label,onError,disabled=false}:{surface:Surface;side:'before'|'after';label:string;onError:(s:string)=>void;disabled?:boolean}){
 const shared=useProject(),tag=side==='before'?'materialBefore':'materialAfter';
 return <select aria-label={label} disabled={disabled} value={surface[tag]??'custom'} onChange={e=>{try{const material=e.target.value==='custom'?undefined:e.target.value as 'air'|'N-BK7';let patch:Partial<Surface>={[tag]:material};if(surface.interaction!=='refract')patch={materialBefore:material,materialAfter:material};shared.commit(withPrescription(shared.project,{...shared.doc,surfaces:shared.doc.surfaces.map(s=>s.id===surface.id?{...s,...patch}:s)}));onError('');}catch(err){onError(String(err));}}}><option value="custom">Custom n</option><option value="air">Air</option><option value="N-BK7">BK7 (N-BK7)</option></select>;
}
