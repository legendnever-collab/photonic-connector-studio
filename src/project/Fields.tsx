import {portDevice} from '../routing/model';
import { applySmfReference, isNominalSmf } from '../authoring/smf';
import { ModePreview, PortContractFields } from '../authoring/Ports';
import { NumberField } from '../Fields';
import { useProject } from './Store';
import { modes, withMode } from './model';
import { unknownAuthoring } from '../authoring/contract';
import type { Project } from './model';
import type { Body } from './model';
import { add, mul, frame, pointToLocal } from '../surface/model';
import { bodyGeometry } from './geometry';
import { compile } from '../surface/model';
export function ModeFields({which}:{which:'source'|'target'}) {
 const shared=useProject(),p=shared.project,value=modes(p)[which],label=which==='source'?'Input':'Output';
 const locked=p.model.kind==='ideal'&&p.model.design.components[which==='source'?0:p.model.design.components.length-1].locked;
 const body=which==='source'?p.sourceBody:p.targetBody;
 const putBody=(next:Project['sourceBody'])=>shared.commit({...p,[which==='source'?'sourceBody':'targetBody']:next});
 return <section className="project-fields"><h3>{label} Mode / Fiber</h3>
 <label className="field">{label} Port Template<select aria-label={`${label} Port Template`} disabled={locked} value={p.authoring?.ports[which].preset?'smf':'custom'} onChange={e=>{
  if(e.target.value==='smf'){const next=applySmfReference(p,which);shared.commit({...next,[which==='source'?'sourceBody':'targetBody']:body??{radius:62.5e-6,length:.001}});}
  else {const a=p.authoring??unknownAuthoring(),port={...a.ports[which]};delete port.preset;shared.commit({...p,authoring:{...a,ports:{...a.ports,[which]:port}}});}
 }}><option value="custom">Custom Mode / Port</option><option value="smf">SMF Fiber · 1310 nm / MFD 9.2 µm</option></select></label>
 <ModePreview which={which}/>{portDevice(p,which).startsWith('pic-')&&<p className="surface-reason">PIC Port · User Gaussian Reference. Receiving Field / Coupler response 미정의.</p>}<strong>{p.authoring?.ports[which].preset?(isNominalSmf(p,which)?'SMF Fiber · Gaussian Reference':'SMF-derived · Custom Mode'):`${label} Reference`}</strong>
 <p className="surface-note">Fiber Facet = Mode Reference Plane. MFD는 Intensity 1/e² diameter이며 Fiber 외경과 독립적입니다.</p>
 <div className="fields-two">{(['mfdX','mfdY'] as const).map((k,i)=><NumberField key={k} disabled={locked} label={`${label} MFD ${i?'Y':'X'}`} value={value[k]===null?null:value[k]!*1e6} unit="µm" min={.001} max={1e6} nullable onChange={v=>{shared.commit(withMode(p,which,{...value,[k]:v===null?null:v*1e-6}));return true;}}/>)}</div>
 <button disabled={locked} onClick={()=>{const next=applySmfReference(p,which);shared.commit({...next,[which==='source'?'sourceBody':'targetBody']:body??{radius:62.5e-6,length:.001}});}}>Apply {label} SMF 1310 Reference</button>
 <label className="field">Polarization<select disabled={locked} aria-label={`${which} Mode Polarization`} value={value.polarization} onChange={e=>shared.commit(withMode(p,which,{...value,polarization:e.target.value as typeof value.polarization}))}>{['unspecified','TE','TM'].map(v=><option key={v}>{v}</option>)}</select></label>
 <details className="fiber-body-details"><summary>{label} Fiber Geometry</summary><label className="surface-check"><input type="checkbox" disabled={locked} aria-label={`Show ${label} Fiber Body`} checked={!!body} onChange={e=>putBody(e.target.checked?{radius:62.5e-6,length:.001}:null)}/>Show Fiber Body</label>
 {body&&<div className="fields-two"><NumberField disabled={locked} label={`${label} Fiber Diameter`} value={body.radius*2e6} unit="µm" min={.001} max={2e6} onChange={v=>{putBody({...body,radius:v!*.5e-6});return true;}}/><NumberField disabled={locked} label={`${label} Fiber Length`} value={body.length*1e3} unit="mm" min={.000001} max={1000} onChange={v=>{putBody({...body,length:v!*1e-3});return true;}}/></div>}</details>
 <details><summary>Mode Contract / Advanced</summary><PortContractFields which={which}/></details></section>;
}
export function BodyFields({ assemblyId }: {
    assemblyId: string;
}) {
    const shared = useProject(), p = shared.project, d = shared.doc, ss = compile(d).filter(s => s.assemblyId === assemblyId), a = d.assemblies.find(a => a.id === assemblyId), body = p.bodies.find(b => b.assemblyId === assemblyId);
    if (p.model.kind === 'ideal')
        return <p className="surface-note">Ideal Thin Lens: 곡률·두께·외경은 미정의입니다. Focal Length를 실제 형상으로 자동 변환하지 않습니다.</p>;
    function update(next: Body) { shared.commit({ ...p, bodies: [...p.bodies.filter(b => b.assemblyId !== assemblyId), next] }); return true; }
    function define() { const ap = Math.max(...ss.map(s => s.aperture), .0001); if (a?.kind === 'lens')
        update({ kind: 'lens', assemblyId, outerRadius: ap * 1.1 }); if (a?.kind === 'mirror')
        update({ kind: 'mirror', assemblyId, outline: 'disc', width: ap * 2.2, height: ap * 2.2, thickness: .0003 }); if (a?.kind === 'prism')
        update({ kind: 'prism', assemblyId, depth: ap * 2 }); if (a?.kind === 'array') {
        const ar = ss[0]?.array;
        update({ kind: 'array', assemblyId, width: (ar ? (ar.cols - 1) * ar.pitch : 0) + 2.2 * ap, height: (ar ? (ar.rows - 1) * ar.pitch : 0) + 2.2 * ap });
    } }
    const issues = bodyGeometry(d, compile(d), p.bodies).issues.filter(i => i.startsWith(assemblyId + ':'));
    const number = (label: string, value: number, key: string) => <NumberField key={key} label={label} value={value * 1e3} unit="mm" min={.000001} max={1000} onChange={v => update({ ...body!, [key]: v! * 1e-3 } as Body)}/>;
    return <section className="project-fields"><h3>Building Block Geometry</h3><p className="surface-note">Optical Surface는 Surface Data에서 정의합니다. 외형 치수는 이 Block에 저장합니다.</p>{!body ? <><p className="surface-note">Body dimensions: Undefined · Surface만 표시합니다.</p>{a && ['lens', 'mirror', 'prism', 'array'].includes(a.kind) && <button onClick={define}>Define {a.kind} Body · Synthetic defaults</button>}</> : <><div className="fields-two">{body.kind === 'lens' && number('Body Outer Radius', body.outerRadius, 'outerRadius')}{body.kind === 'mirror' && <><label className="field">Body Outline<select aria-label="Body Outline" value={body.outline} onChange={e => update({ ...body, outline: e.target.value as 'disc' | 'rectangle' })}><option value="disc">Disc</option><option value="rectangle">Rectangle</option></select></label>{number(body.outline === 'disc' ? 'Body Diameter' : 'Body Width', body.width, 'width')}{body.outline === 'rectangle' && number('Body Height', body.height, 'height')}{number('Body Thickness', body.thickness, 'thickness')}</>}{body.kind === 'prism' && number('Prism Depth', body.depth, 'depth')}{body.kind === 'array' && <>{number('Substrate Width', body.width, 'width')}{number('Substrate Height', body.height, 'height')}</>}{['lens', 'array'].includes(body.kind) && ss.length === 2 && <NumberField label="Center Thickness" value={pointToLocal(ss[0].world, ss[1].world.origin).x * 1e3} unit="mm" min={.000001} max={1000} onChange={v => { const front = d.surfaces.find(s => s.id === ss[0].id)!, rear = d.surfaces.find(s => s.id === ss[1].id)!; shared.updateSurface({ ...d, surfaces: d.surfaces.map(s => s.id === rear.id ? { ...s, frame: { ...s.frame, origin: add(front.frame.origin, mul(frame(front.frame).axes[0], v! * 1e-3)) } } : s) }); return true; }}/>}</div>{body.kind === 'prism' && <p className="surface-note">Prism의 단면은 세 Surface 평면에서 생성합니다. Depth는 공통 단면의 수직 방향 치수입니다.</p>}<button onClick={() => shared.commit({ ...p, bodies: p.bodies.filter(b => b.assemblyId !== assemblyId) })}>Undefine Body · keep Surfaces</button></>}{issues.map(i => <p role="alert" className="surface-reason" key={i}>{i}</p>)}</section>;
}
