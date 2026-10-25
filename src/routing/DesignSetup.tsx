import LensDialog from '../lens/LensDialog';
import {useState} from 'react';
import SearchDialog from './SearchDialog';
import {NumberField} from '../Fields';
import {useProject} from '../project/Store';
import {modes,withMode} from '../project/model';
import type {Project} from '../project/model';
import {framePose} from '../authoring/commands';
import {applySmfReference} from '../authoring/smf';
import {portDevice,portWorld,withPortDevice,withPortWorld,directionPose} from './model';
import type {PortDevice} from './model';
import {defaultRouting} from './contract';
import type {Routing,Box} from './contract';
import './routing.css';
const xyz=['x','y','z'] as const;
const f=(v:number)=>Math.abs(v)<1e-9?'0':Number(v.toPrecision(6)).toString();
const names={fiber:'SMF Fiber', 'pic-edge':'PIC Edge Coupler','pic-grating':'PIC Grating Coupler',custom:'Custom Port'};
export default function DesignSetup({onExample,onError,onSynthesis}:{onSynthesis:()=>void;onExample:(id:string)=>void;onError:(v:string)=>void}){
 const [searchOpen,setSearchOpen]=useState(false),[lensOpen,setLensOpen]=useState(false);
 const shared=useProject(),p=shared.project,r=p.routing??defaultRouting();
 function commit(next:Project){try{shared.commit(next);onError('');return true;}catch(e){onError(e instanceof Error?e.message:String(e));return false;}}
 function put(next:Routing){return commit({...p,routing:next});}
 return <section className="routing-setup" data-testid="design-setup"><h3>Port-to-Port Design Setup</h3><p>두 Port의 위치와 입사 방향을 지정합니다. S2: Fixed Lens 뒤의 광로 후보를 찾습니다.</p>
 <label className="field">Routing Example<select aria-label="Routing Example" value="" onChange={e=>{if(e.target.value)onExample(e.target.value);}}><option value="">Choose…</option><option value="routing:lens">S3.2 · Folded Lens design task</option><option value="routing:search">S2 · Displaced PIC routing task</option><option value="routing:mirrors">Lens + 2 Mirrors · 60 µm height shift</option><option value="routing:prism">Lens + TIR Prism · +Z incidence</option></select></label><p className="surface-note">예제는 직접 정의한 배치입니다. Find Routing Solutions는 기존 Lens를 고정한 geometric 경로입니다. Lens 생성과 Output Mode 정합은 Automatic Synthesis에서 실행하세요.</p>
 {p.model.kind!=='surface'?<p>Physical Project에서 사용할 수 있습니다.</p>:<>
 <button className="routing-find" aria-label="Find Routing Solutions" disabled={!!shared.invalid.length} onClick={()=>setSearchOpen(true)}>Find Routing Solutions · geometry only…</button>
 <button className="routing-find" aria-label="Setup Automatic Synthesis" disabled={!!shared.invalid.length} onClick={onSynthesis}>Automatic Synthesis · Lens + Mode…</button>
 <button className="routing-find" aria-label="Design Lenses" disabled={!!shared.invalid.length} onClick={()=>setLensOpen(true)}>Design Lenses…</button>
 <NumberField label="Design Wavelength" value={shared.doc.wavelength*1e9} unit="nm" min={200} max={20000} onChange={v=>{try{shared.updateSurface({...shared.doc,wavelength:v!*1e-9});onError('');return true;}catch(e){onError(String(e));return false;}}}/>
 {(['source','target'] as const).map(which=>{
  const label=which==='source'?'Input':'Output',world=framePose(portWorld(p,which)),device=portDevice(p,which),m=modes(p)[which],direction=portWorld(p,which).axes[0];
  const pose=(next:typeof world)=>{try{return commit(withPortWorld(p,which,next));}catch(e){onError(String(e));return false;}};
  return <fieldset key={which} className="routing-port"><legend>{label} · Global Frame</legend>
   <label className="field">{label} Device<select aria-label={`${label} Device`} value={device} onChange={e=>{const device=e.target.value as PortDevice;let next=withPortDevice(p,which,device);if(device==='fiber'){next=applySmfReference(next,which);next={...next,[which==='source'?'sourceBody':'targetBody']:{radius:62.5e-6,length:.001}};}commit(next);}}>{Object.entries(names).map(([value,name])=><option key={value} value={value}>{name}</option>)}</select></label>
   <div className="fields-three">{xyz.map(k=><NumberField key={k} label={`${label} Global ${k.toUpperCase()}`} value={world.origin[k]*1e6} unit="µm" min={-1e6} max={1e6} onChange={v=>pose({...world,origin:{...world.origin,[k]:v!*1e-6}})}/>)}</div>
   <label className="field">{label} Direction preset<select aria-label={`${label} Direction preset`} value="" onChange={e=>{if(e.target.value)pose(directionPose(world,e.target.value as '+X'));}}><option value="">Choose axis…</option>{['+X','-X','+Y','-Y','+Z','-Z'].map(v=><option key={v}>{v}</option>)}</select></label>
   <div className="fields-three">{(['yaw','pitch','roll'] as const).map(k=><NumberField key={k} label={`${label} Global ${k}`} value={world.rotation[k]*180/Math.PI} unit="°" min={k==='pitch'?-90:-180} max={k==='pitch'?90:180} onChange={v=>pose({...world,rotation:{...world.rotation,[k]:v!*Math.PI/180}})}/>)}</div>
   <p className="surface-note" data-testid={`${which}-direction`}>Global direction: {xyz.map(k=>f(direction[k])).join(' / ')} · Local +X = {which==='source'?'outgoing':'desired incoming'} direction. Roll은 Mode의 Local Y/Z 방향입니다.</p>
   <div className="fields-two">{(['mfdX','mfdY'] as const).map((k,i)=><NumberField key={k} label={`${label} Reference MFD ${i?'Z':'Y'}`} value={m[k]===null?null:m[k]!*1e6} unit="µm" nullable min={.001} max={1e6} onChange={v=>commit(withMode(p,which,{...m,[k]:v===null?null:v*1e-6}))}/>)}</div>
   <label className="field">{label} Polarization<select aria-label={`${label} Design Polarization`} value={m.polarization} onChange={e=>commit(withMode(p,which,{...m,polarization:e.target.value as typeof m.polarization}))}>{['unspecified','TE','TM'].map(v=><option key={v}>{v}</option>)}</select></label>
   {device.startsWith('pic-')&&<p className="surface-reason">User Gaussian Reference · PIC Receiving Field / Device response 미정의. Coupler Efficiency는 계산하지 않습니다.</p>}
  </fieldset>;
 })}
 <h4>Geometric Tolerances</h4><div className="fields-two"><NumberField label="Position Tolerance" value={r.positionTolerance*1e6} unit="µm" min={.000001} max={1e6} onChange={v=>put({...r,positionTolerance:v!*1e-6})}/><NumberField label="Angle Tolerance" value={r.angleTolerance*180/Math.PI} unit="°" min={.000001} max={180} onChange={v=>put({...r,angleTolerance:v!*Math.PI/180})}/></div>
 <details><summary>Design Space / Part Limits</summary><p className="surface-note">Optical Components에 적용합니다. Port 위치는 고정 조건입니다. 공간 검사는 Sampled Envelope / AABB 진단이며 전체 Solid Collision / Ray Obstruction 검증은 다음 단계입니다.</p>
 <div className="fields-three">{(['lens','mirror','prism'] as const).map(k=><NumberField key={k} label={`Max ${k}`} unit="" value={r.parts[k]} step={1} min={0} max={50} onChange={v=>put({...r,parts:{...r.parts,[k]:v!}})}/>)}</div>
 <label className="surface-check"><input aria-label="Enable Design Space" type="checkbox" checked={!!r.bounds} onChange={e=>put({...r,bounds:e.target.checked?{min:{x:-.001,y:-.001,z:-.001},max:{x:.011,y:.001,z:.001}}:null})}/>Enable Design Space</label>
 {r.bounds&&<BoxFields box={r.bounds} prefix="Space" onChange={box=>put({...r,bounds:box})}/>}
 {r.keepOut.map((box,i)=><div className="routing-keepout" key={i}><h4>Keep-out {i+1}</h4><BoxFields box={box} prefix={`Keep-out ${i+1}`} onChange={b=>put({...r,keepOut:r.keepOut.map((x,j)=>i===j?b:x)})}/><button onClick={()=>put({...r,keepOut:r.keepOut.filter((_,j)=>i!==j)})}>Remove Keep-out {i+1}</button></div>)}
 <button disabled={r.keepOut.length>=8} onClick={()=>put({...r,keepOut:[...r.keepOut,{min:{x:.006,y:-.0001,z:-.0001},max:{x:.007,y:.0001,z:.0001}}]})}>Add Keep-out Box</button>
 </details><RoutingDiagnostics/></>}
 {lensOpen&&<LensDialog onClose={()=>setLensOpen(false)}/>}
 {searchOpen&&<SearchDialog onClose={()=>setSearchOpen(false)}/>}
 </section>;
}
function BoxFields({box,prefix,onChange}:{box:Box;prefix:string;onChange:(b:Box)=>boolean}){return <>{(['min','max'] as const).map(side=><div className="fields-three" key={side}>{xyz.map(k=><NumberField key={k} label={`${prefix} ${side} ${k.toUpperCase()}`} value={box[side][k]*1e3} unit="mm" min={-1000} max={1000} onChange={v=>onChange({...box,[side]:{...box[side],[k]:v!*1e-3}})}/>)}</div>)}</>;}
export function RoutingDiagnostics({compact=false,context='setup'}:{compact?:boolean;context?:'setup'|'analysis'}){
 const shared=useProject(),r=shared.routing,prefix=compact?'routing-summary':context==='analysis'?'routing-analysis':'routing';
 if(shared.invalid.length)return <section className="routing-results"><strong>Unapplied numeric input</strong><p>유효한 값을 복구하면 다시 계산합니다.</p></section>;
 return <section className={`routing-results ${compact?'routing-compact':''}`} data-testid={compact?'routing-summary':context==='analysis'?'routing-analysis':'routing-diagnostics'}>
 <strong data-testid={`${prefix}-status`}>{r.status==='evaluated'?(r.withinTolerance?'Within geometric tolerances':'Outside geometric tolerances'):r.status==='blocked'?'Reference ray blocked':'Routing unavailable'}</strong>
 <dl><div><dt>Position error [µm]</dt><dd data-testid={`${prefix}-position-error`}>{r.positionError===null?'—':f(r.positionError*1e6)}</dd></div><div><dt>Incidence error [°]</dt><dd data-testid={`${prefix}-angle-error`}>{r.angleError===null?'—':f(r.angleError*180/Math.PI)}</dd></div>{!compact&&<div><dt>Reference OPL [mm]</dt><dd>{r.path?f(r.path.opl*1e3):'—'}</dd></div>}</dl>
 {!compact&&<><p>Reference ray: {r.reason}</p>{r.offset&&<p>Output Local ΔY / ΔZ: {f(r.offset.y*1e6)} / {f(r.offset.z*1e6)} µm</p>}{r.issues.map(x=><p key={x} className="surface-reason">{x}</p>)}<details><summary>Sequence / Constraints / Provenance</summary><ol>{r.path?.hits.map(h=><li key={h.surfaceId}>{h.surfaceId} · {h.event}<small>XYZ [µm] {xyz.map(k=>f(h.point[k]*1e6)).join(' / ')}</small></li>)}</ol>{r.constraintChecks.map(x=><p key={x}>{x}</p>)}<p>{r.id} · {r.solver} · Project {r.fingerprint}</p></details><p className="surface-note">Input Center Reference Ray의 진단입니다. Ray 도달과 위치·각도 일치는 Mode Overlap / Total Coupling을 의미하지 않습니다.</p></>}
 </section>;
}
