import {useEffect,useMemo,useRef,useState} from 'react';
import {NumberField} from '../Fields';
import {useProject} from '../project/Store';
import {serializeProject} from '../project/model';
import {defaultLensOptions,lensDomain,defaultAlignment} from './domain';
import type {LensOptions} from './contract';
import {searchLensesAsync,applyLensCandidate,lensDesignFingerprint} from './search';
import type {LensResult,LensCandidate} from './search';
import {solveFoldedGaussian} from '../project/foldedGaussian';
import FoldedGaussianView from '../project/FoldedGaussianView';
import {projectTrace} from '../project/compute';
import {bodyGeometry} from '../project/geometry';
import {SurfaceScene,sceneBounds,INITIAL_CAMERA} from '../surface/Scene';
import type {SceneView} from '../surface/Scene';
import './lens.css';
const f=(v:number)=>Number(v.toPrecision(5)).toString();
const motionText=(v:number)=>Math.abs(v)<1e-6?'0':f(v);
const keys=['position','front','rear','thickness'] as const;
const labels={position:'Front distance',front:'S1 curvature',rear:'S2 curvature',thickness:'Center thickness'};
export default function LensDialog({onClose}:{onClose:()=>void}){
 const shared=useProject(),p=shared.project,dialog=useRef<HTMLDialogElement>(null),mounted=useRef(true),cancel=useRef(false);
 const [template,setTemplate]=useState<LensOptions['template']>(()=>p.model.kind==='surface'&&p.model.prescription.assemblies.filter(a=>a.kind==='lens').length===1?'relay2':'existing');
 const defaults=useMemo(()=>{try{const options=defaultLensOptions(p,template);return {options,domain:lensDomain(p,template,!!options.alignment),reason:''};}catch(e){return {options:null,domain:null,reason:e instanceof Error?e.message:String(e)};}},[p,template]);
 const [custom,setCustom]=useState<LensOptions|null>(null),o=custom??defaults.options;
 const [batch,setBatch]=useState<LensResult|null>(null),[selected,setSelected]=useState(''),[running,setRunning]=useState(false),[error,setError]=useState(''),[settingsOpen,setSettingsOpen]=useState(true),[progress,setProgress]=useState({evaluated:0,retained:0});
 const signature=serializeProject(p),live=useRef(signature);live.current=signature;
 useEffect(()=>{mounted.current=true;dialog.current?.showModal();return()=>{mounted.current=false;cancel.current=true;};},[]);
 const stale=!!batch&&(batch.inputSignature!==signature||JSON.stringify(batch.options)!==JSON.stringify(o)),candidate=batch?.candidates.find(c=>c.id===selected)??null;
 function change(next:LensOptions){setCustom(next);return true;}
 async function run(){if(!o)return;cancel.current=false;setRunning(true);setSettingsOpen(false);setBatch(null);setSelected('');setError('');setProgress({evaluated:0,retained:0});
  try{const r=await searchLensesAsync(p,o,{cancelled:()=>cancel.current||!mounted.current||live.current!==signature,progress:v=>{if(mounted.current)setProgress(v);}});if(mounted.current){setBatch(r);setSelected(r.candidates[0]?.id??'');}}catch(e){if(mounted.current)setError(String(e));}finally{if(mounted.current)setRunning(false);}
 }
 function apply(){if(!batch||!candidate||stale||shared.invalid.length)return;try{shared.replace(applyLensCandidate(p,batch,candidate.id));onClose();}catch(e){setError(e instanceof Error?e.message:String(e));}}
 const previous=p.routing?.lensSolution;
 return <dialog ref={dialog} className="insert-dialog route-search-dialog lens-design-dialog" aria-labelledby="lens-title" data-testid="lens-design-dialog" onCancel={e=>{e.preventDefault();onClose();}}><header><div><h2 id="lens-title">Design Lenses</h2><p>Fixed Ports / Mirror / Prism · Gaussian reference matching</p></div><button aria-label="Close Lens Design" onClick={onClose}>×</button></header>
 <div className="route-search-body"><section className="route-search-settings"><p>Input / Output과 Mirror / Prism은 고정합니다. Lens 위치, S1 / S2 곡률, 두께를 조정합니다. 작은 offset은 편심·tilt 보정으로 연결합니다. Preview는 설계를 변경하지 않습니다.</p>
 <p className="surface-note">Target reference · 2w Y / Z: {p.model.kind==='surface'?[p.model.targetMode.mfdX,p.model.targetMode.mfdY].map(v=>v===null?'Undefined':f(v*1e6)).join(' / '):'Undefined'} µm · flat phase. Reference mismatch · lower is better.</p>
 {previous&&<p className="surface-note">Applied Lens design · {previous.designFingerprint===lensDesignFingerprint(p)?'Design unchanged':'Design changed since Apply'}</p>}
 <details open={settingsOpen} onToggle={e=>setSettingsOpen(e.currentTarget.open)}><summary>Lens Search Settings</summary><fieldset disabled={running}>
 <label className="field">Lens template<select aria-label="Lens Design Template" value={template} onChange={e=>{setTemplate(e.target.value as typeof template);setCustom(null);}}><option value="existing">Existing Lenses · 1 or 2</option><option value="relay2">2-Lens Relay · add Output Lens if needed</option></select></label>
 {template==='relay2'&&<p className="surface-note">추가 Lens: BK7 · Clear R 0.5 mm · Body R 0.6 mm. 기존 Lens의 재료와 Body는 유지합니다.</p>}
 {!o?<p className="surface-reason" data-testid="lens-preflight">{defaults.reason}</p>:<>
 <div className="fields-two"><NumberField label="Lens Search Budget" value={o.budget} unit="trials" min={1} max={4096} step={1} onChange={v=>{if(!Number.isInteger(v))return false;return change({...o,budget:v!});}}/><NumberField label="Lens Clearance" value={o.clearance*1e6} unit="µm" min={0} max={10000} onChange={v=>change({...o,clearance:v!*1e-6})}/><NumberField label="Beam Size Tolerance" value={o.diameterTolerance*100} unit="%" min={.1} max={100} onChange={v=>change({...o,diameterTolerance:v!/100})}/><NumberField label="Reference Phase Tolerance" value={o.phaseTolerance} unit="rad" min={.001} max={1} onChange={v=>change({...o,phaseTolerance:v!})}/></div>
 <label className="surface-check"><input type="checkbox" aria-label="Lens decenter and tilt compensation" checked={!!o.alignment} onChange={e=>change({...o,alignment:e.target.checked?defaultAlignment():undefined})}/>Lens 편심·tilt 보정</label>
 {o.alignment&&<><div className="fields-two"><NumberField label="Lens Decenter bound" value={o.alignment.decenter*1e6} unit="± µm" min={0} max={2000} onChange={v=>change({...o,alignment:{...o.alignment!,decenter:v!*1e-6}})}/><NumberField label="Lens Tilt bound" value={o.alignment.tilt*1e3} unit="± mrad" min={0} max={50} onChange={v=>change({...o,alignment:{...o.alignment!,tilt:v!*1e-3}})}/></div><p className="surface-note">각 Lens의 원래 front vertex / local Y·Z 기준 이동 범위입니다. 편심으로 먼저 보정하고 필요하면 pitch·yaw를 함께 풉니다. Output 오차와 aperture, Gaussian 유효 범위를 별도로 검증합니다.</p></>}
 <p className="surface-note">Front distance는 Input부터 광로상의 거리입니다. Min = Max이면 해당 변수를 고정합니다. Curvature = 1/R; 0은 Plane입니다.</p>
 {o.variables.map((v,i)=><details className="lens-variable" key={v.id}><summary>{v.id} · Variable bounds</summary>{keys.map(key=>{const factor=key==='front'||key==='rear'?.001:1000,unit=key==='front'||key==='rear'?'mm⁻¹':'mm';return <fieldset key={key}><legend>{labels[key]}</legend><div className="fields-two">{(['Min','Max'] as const).map((side,j)=><NumberField key={side} label={`${v.id} ${labels[key]} ${side}`} value={v[key][j]*factor} unit={unit} min={key==='front'||key==='rear'?-1000:0} max={key==='front'||key==='rear'?1000:1000} onChange={n=>{const pair=[...v[key]] as [number,number];pair[j]=n!/factor;return change({...o,variables:o.variables.map((x,k)=>k===i?{...x,[key]:pair}:x)});}}/>)}</div></fieldset>;})}<button onClick={()=>{const slot=defaults.domain?.slots[i];if(!slot)return;change({...o,...(o.alignment?{alignment:{...o.alignment,fixed:[...new Set([...o.alignment.fixed,v.id])]}}:{}),variables:o.variables.map((x,k)=>k===i?{...x,...Object.fromEntries(keys.map((key,j)=>[key,[slot.values[j],slot.values[j]]]))}:x)});}}>Freeze {v.id}</button></details>)}
 <button onClick={()=>setCustom(null)}>Reset Lens Bounds</button></>}
 </fieldset></details>
 <div className="route-search-actions"><button className="primary" disabled={running||!o||!!shared.invalid.length} onClick={()=>void run()}>Run Lens Design</button>{running&&<button onClick={()=>{cancel.current=true;}}>Cancel Lens Design</button>}</div>
 {running&&<p role="status" data-testid="lens-progress">Searching · {progress.evaluated} / {o?.budget} · {progress.retained} retained</p>}
 {batch&&<div data-testid="lens-result"><strong data-testid="lens-status">{batch.status==='unsupported'?'Unsupported setup':batch.status==='cancelled'?'Cancelled':batch.candidates.some(c=>c.merit.goalsMet)?'Reference goals met':batch.candidates.length?'Best tested reference':'No feasible candidate'}</strong><p>{batch.reason}</p><small>{batch.evaluated} optical trials · {batch.alignmentEvaluated} alignment ray traces · {batch.status} · {batch.candidates.length} retained</small>{batch.baseline&&<p>Baseline reference mismatch: {f(batch.baseline.score)}</p>}</div>}
 {stale&&<p className="surface-reason" data-testid="lens-stale">Stale candidates · Project / settings changed. Run Lens Design again.</p>}{error&&<p role="alert">{error}</p>}
 <div className="route-candidates" aria-label="Lens candidates">{batch?.candidates.map((c,i)=><button key={c.id} aria-label={`Preview Lens Candidate ${i+1}`} aria-pressed={selected===c.id} data-testid="lens-candidate" onClick={()=>setSelected(c.id)}><strong>{i+1}. {c.merit.goalsMet?'Reference goals met':'Goals not met'}</strong><span>2w Y / Z · {c.merit.diameters.map(v=>f(v*1e6)).join(' / ')} µm</span><small>Size error {f(c.merit.sizeError*100)}% · Phase {f(c.merit.phaseError)} rad</small><small>Reference mismatch {f(c.merit.score)}</small></button>)}</div>
 {batch&&<details><summary>Rejected trials / limits</summary>{Object.entries(batch.rejected).map(([reason,n])=><p key={reason}>{n} × {reason}</p>)}<p>Analytic thin-Lens seeds + bounded local search. No global optimum / impossibility proof. Aperture and body checks are conservative. This is a paraxial Gaussian reference; TIR phase, diffraction and device response are omitted. Mode Overlap / Transmission / Total Coupling are not optimized or calculated.</p><p>{batch.engine} · Baseline {batch.inputFingerprint}</p></details>}
 </section><section className="route-preview-pane">{candidate?<LensPreview key={candidate.id} candidate={candidate}/>:<div className="route-search-empty"><h3>Lens Reference Design</h3><p>Output Gaussian Reference · MFD / flat phase matching.</p><p>Run Lens Design으로 실제 Surface와 Body를 가진 후보를 비교합니다.</p><p>PIC Coupler Efficiency는 계산하지 않습니다.</p></div>}</section></div>
 <footer><p>Apply는 Undo 1회로 복구합니다. Reference 기준이며 실제 결합효율이 아닙니다.</p><button onClick={onClose}>Close</button><button className="primary" disabled={running||!candidate||stale||!!shared.invalid.length} onClick={apply}>Apply Lens Candidate</button></footer></dialog>;
}
function LensPreview({candidate:c}:{candidate:LensCandidate}){
 const [tab,setTab]=useState<'beam'|'layout'>('beam'),[view,setView]=useState<SceneView>('3D'),[camera,setCamera]=useState(INITIAL_CAMERA),svg=useRef<SVGSVGElement>(null);
 const beam=useMemo(()=>solveFoldedGaussian(c.project),[c.project]),doc=c.project.model.kind==='surface'?c.project.model.prescription:null,trace=useMemo(()=>projectTrace(c.project),[c.project]);
 const geometry=useMemo(()=>doc?bodyGeometry(doc,trace.surfaces,c.project.bodies,c.project.sourceBody,c.project.targetBody,c.project.portArrays):null,[doc,trace,c.project]);
 const bounds=useMemo(()=>doc&&geometry?sceneBounds(doc,trace,[...geometry.faces.flatMap(f=>f.points),...geometry.edges.flatMap(e=>e.points)]):null,[doc,trace,geometry]);
 return <div className="lens-preview" data-testid="lens-preview"><div className="route-preview-toolbar"><strong>{c.merit.goalsMet?'Reference goals met':'Best tested reference · goals not met'} · Read-only Preview</strong><div><button aria-pressed={tab==='beam'} onClick={()=>setTab('beam')}>Beam Preview</button><button aria-pressed={tab==='layout'} onClick={()=>setTab('layout')}>Optical Layout</button>{tab==='layout'&&<>{(['3D','XZ'] as const).map(v=><button key={v} onClick={()=>setView(v)}>{v}</button>)}<button onClick={()=>setCamera(INITIAL_CAMERA)}>Fit Lens Layout</button></>}</div></div>
 <div className="lens-preview-plot">{tab==='beam'?<FoldedGaussianView result={beam} heading="Gaussian Beam · Lens Reference"/>:doc&&geometry&&bounds&&<SurfaceScene doc={doc} opticalProject={c.project} trace={trace} geometry={geometry} view={view} camera={camera} setCamera={setCamera} bounds={bounds} selected="" onSelect={()=>{}} presentation svgRef={svg}/>}</div>
 <div className="route-preview-table"><table data-testid="lens-parameter-table"><caption>Candidate Lens Parameters · physical S1 / glass / S2</caption><thead><tr><th>Lens</th><th>Front s [mm]</th><th>R1 / R2 [mm]</th><th>Thickness [mm]</th></tr></thead><tbody>{c.values.slice(0,(doc?.assemblies.filter(a=>a.kind==='lens'&&doc.surfaces.some(s=>s.assemblyId===a.id)).length??0)*4).map((_,i)=>i%4===0?<tr key={i}><td>{c.project.routing?.lensSolution?.options.variables[i/4]?.id??doc?.surfaces.filter(s=>s.interaction==='refract'&&doc.assemblies.some(a=>a.id===s.assemblyId&&a.kind==='lens'))[i/2]?.assemblyId}</td><td>{f(c.values[i]*1e3)}</td><td>{[1,2].map(j=>Math.abs(c.values[i+j])<1?'∞':f(1e3/c.values[i+j])).join(' / ')}</td><td>{f(c.values[i+3]*1e3)}</td></tr>:null)}</tbody></table></div>
 <LensMotion candidate={c}/>
 <p className="surface-note lens-scope">Target MFD / waist-plane phase 기준의 Gaussian reference입니다. 실제 Mode Coupling / delivered power는 계산하지 않습니다.</p></div>;
}

export function LensMotion({candidate:c}:{candidate:{project:import('../project/model').Project;values:number[]}}){
 if(c.project.model.kind!=='surface')return null;
 const d=c.project.model.prescription,ids=d.assemblies.filter(a=>a.kind==='lens'&&d.surfaces.some(s=>s.assemblyId===a.id)).map(a=>a.id),offset=ids.length*4;
 if(c.values.length!==offset*2)return null;
 return <div className="route-preview-table"><table data-testid="lens-motion-table"><caption>Lens 보정량 · 원래 front vertex의 local frame 기준</caption><thead><tr><th>Lens</th><th>ΔY / ΔZ [µm]</th><th>Pitch / Yaw [mrad]</th></tr></thead><tbody>{ids.map((id,i)=><tr key={id}><td>{id}</td><td>{c.values.slice(offset+4*i,offset+4*i+2).map(v=>motionText(v*1e6)).join(' / ')}</td><td>{c.values.slice(offset+4*i+2,offset+4*i+4).map(v=>motionText(v*1e3)).join(' / ')}</td></tr>)}</tbody></table></div>;
}
