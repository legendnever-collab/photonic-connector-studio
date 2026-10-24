import { NumberField } from '../Fields';
import { useProject } from './Store';
import { replaceComponent, errorMessage } from '../domain';
export default function IdealData({onSelect,onError}:{onSelect:(id:string)=>void;onError:(s:string)=>void}){
 const shared=useProject();if(shared.project.model.kind!=='ideal')return null;const doc=shared.project.model.design;
 return <section className="panel surface-table-panel"><div className="panel-toolbar"><strong>Component Data</strong><span className="tiny-label">ORDER · GLOBAL XYZ [mm]</span></div><div className="surface-table-scroll"><table><thead><tr><th>COMPONENT</th><th>X [mm]</th><th>Y [mm]</th><th>Z [mm]</th><th>STATE</th></tr></thead><tbody>{doc.components.map(c=><tr key={c.id} className={shared.selection===c.id?'selected':''}><td><button aria-label={`Select ${c.name} in Data`} onClick={()=>onSelect(c.id)}>{c.name}</button></td>{(['x','y','z'] as const).map(k=><td key={k}><NumberField label={`${c.name} ${k.toUpperCase()} table`} value={c.frame.origin[k]*1e3} unit="mm" min={-1000} max={1000} disabled={c.locked} onChange={v=>{try{shared.updateIdeal(replaceComponent(doc,{...c,frame:{...c.frame,origin:{...c.frame.origin,[k]:v!*1e-3}}}));onError('');return true;}catch(e){onError(errorMessage(e));return false;}}}/></td>)}<td>{c.enabled?'Enabled':'Disabled'}</td></tr>)}</tbody></table></div></section>;
}
