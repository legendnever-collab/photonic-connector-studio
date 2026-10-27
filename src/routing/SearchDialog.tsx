import {useEffect,useMemo,useRef,useState} from 'react';
import {NumberField} from '../Fields';
import {useProject} from '../project/Store';
import {serializeProject} from '../project/model';
import {bodyGeometry} from '../project/geometry';
import {projectTrace} from '../project/compute';
import {SurfaceScene,sceneBounds,INITIAL_CAMERA} from '../surface/Scene';
import type {SceneView} from '../surface/Scene';
import {V,add,mul,norm,sub} from '../surface/model';
import {defaultSearchOptions} from './contract';
import type {SearchOptions,Topology} from './contract';
import {searchRoutingAsync,applyCandidate,TOPOLOGY_NAMES,solutionDesignFingerprint} from './search';
import type {Candidate,SearchResult,SearchProgress} from './search';
const number=(v:number)=>Math.abs(v)<1e-9?'0':Number(v.toPrecision(5)).toString();
export default function SearchDialog({onClose}:{onClose:()=>void}){
 const shared=useProject(),p=shared.project,dialog=useRef<HTMLDialogElement>(null),cancel=useRef(false),mounted=useRef(true);
 const [settingsOpen,setSettingsOpen]=useState(true);
 const [options,setOptions]=useState<SearchOptions>(()=>p.routing?.search??defaultSearchOptions()),[running,setRunning]=useState(false),[batch,setBatch]=useState<SearchResult|null>(null),[selection,setSelection]=useState(''),[error,setError]=useState(''),[progress,setProgress]=useState<SearchProgress|null>(null);
 const signature=serializeProject(p),liveSignature=useRef(signature);liveSignature.current=signature;
 useEffect(()=>{mounted.current=true;dialog.current?.showModal();return()=>{mounted.current=false;cancel.current=true;};},[]);
 const stale=!!batch&&(batch.inputSignature!==signature||JSON.stringify(batch.options)!==JSON.stringify(options));
 const selected=batch?.candidates.find(c=>c.id===selection)??null;
 async function run(){cancel.current=false;setSettingsOpen(false);setRunning(true);setBatch(null);setSelection('');setError('');setProgress({evaluated:0,accepted:0,budget:options.budget});const snapshot=structuredClone(p),settings=structuredClone(options),inputSignature=signature;
  try{const result=await searchRoutingAsync(snapshot,settings,{cancelled:()=>cancel.current||!mounted.current||liveSignature.current!==inputSignature,progress:v=>{if(mounted.current)setProgress(v);}});if(mounted.current){setBatch(result);setSelection(result.candidates[0]?.id??'');}}
  catch(e){if(mounted.current)setError(e instanceof Error?e.message:String(e));}finally{if(mounted.current)setRunning(false);}
 }
 function apply(){if(!batch||!selected||stale||shared.invalid.length)return;try{shared.replace(applyCandidate(shared.project,batch,selected.id));onClose();}catch(e){setError(e instanceof Error?e.message:String(e));}}
 const last=p.routing?.solution;
 return <dialog ref={dialog} className="insert-dialog route-search-dialog" aria-labelledby="route-search-title" data-testid="route-search-dialog" onCancel={e=>{e.preventDefault();onClose();}}><header><div><h2 id="route-search-title">Find Routing Solutions</h2><p>Fixed Input / Output · Fixed Lens prefix · Geometric candidates</p></div><button aria-label="Close Routing Search" onClick={onClose}>×</button></header>
 <div className="route-search-body">
 <section className="route-search-settings"><p>기존 Lens는 유지하고 그 뒤의 Mirror / Prism을 새 후보로 교체합니다. Preview는 Project를 변경하지 않습니다.</p>
 {last&&<p className="surface-note">Applied: {TOPOLOGY_NAMES[last.topology]} · {last.designFingerprint===solutionDesignFingerprint(p)?'Design unchanged':'Design changed since Apply'}.</p>}
 <details className="route-search-options" open={settingsOpen} onToggle={e=>setSettingsOpen(e.currentTarget.open)}><summary>Search Settings</summary><fieldset disabled={running}><legend>Allowed Topologies</legend>{(Object.keys(TOPOLOGY_NAMES) as Topology[]).map(t=><label className="surface-check" key={t}><input aria-label={`Search ${TOPOLOGY_NAMES[t]}`} type="checkbox" checked={options.templates.includes(t)} onChange={e=>setOptions({...options,templates:e.target.checked?[...options.templates,t]:options.templates.filter(x=>x!==t)})}/>{TOPOLOGY_NAMES[t]}</label>)}
 <div className="fields-two"><NumberField label="Search Budget" value={options.budget} unit="trials" min={1} max={256} step={1} onChange={v=>{if(!Number.isInteger(v))return false;setOptions({...options,budget:v!});return true;}}/><NumberField label="Route Clear Radius" value={options.clearRadius*1e6} unit="µm" min={1} max={10000} onChange={v=>{setOptions({...options,clearRadius:v!*1e-6});return true;}}/><NumberField label="Prism Leg" value={options.prismLeg*1e6} unit="µm" min={4} max={40000} onChange={v=>{setOptions({...options,prismLeg:v!*1e-6});return true;}}/><NumberField label="Mirror Backing" value={options.mirrorThickness*1e6} unit="µm" min={.1} max={10000} onChange={v=>{setOptions({...options,mirrorThickness:v!*1e-6});return true;}}/><NumberField label="Route Clearance" value={options.clearance*1e6} unit="µm" min={0} max={10000} onChange={v=>{setOptions({...options,clearance:v!*1e-6});return true;}}/></div>
 <label className="field">Rank candidates<select aria-label="Candidate Ranking" value={options.ranking} onChange={e=>setOptions({...options,ranking:e.target.value as SearchOptions['ranking']})}><option value="fewest-parts">Fewest parts → shortest path</option><option value="shortest-path">Shortest path → fewest parts</option></select></label></fieldset></details>
 <div className="route-search-actions"><button className="primary" disabled={running||!options.templates.length||!!shared.invalid.length} onClick={()=>void run()}>Run Search</button>{running&&<button onClick={()=>{cancel.current=true;}}>Cancel Search</button>}</div>
 {running&&<p role="status" data-testid="search-progress">Searching · {progress?.evaluated??0} / {options.budget} · {progress?.accepted??0} retained</p>}
 {batch&&<div data-testid="search-result"><strong data-testid="search-status">{batch.status==='unsupported'?'Unsupported setup':batch.status==='cancelled'?'Cancelled':batch.status==='budget-exhausted'?'Budget exhausted':batch.candidates.length?'Candidates ready':'No candidate found'}</strong><p>{batch.reason}</p><small>{batch.evaluated} trials · {batch.candidates.length} retained</small></div>}
 {stale&&<p className="surface-reason" data-testid="search-stale">Stale candidates · Project / settings changed. Run Search again.</p>}{error&&<p role="alert" className="surface-reason">{error}</p>}
 <div className="route-candidates" aria-label="Routing candidates">{batch?.candidates.map((c,i)=><button key={c.id} aria-label={`Preview Candidate ${i+1}`} aria-pressed={selected?.id===c.id} data-testid="route-candidate" onClick={()=>setSelection(c.id)}><strong>{i+1}. {TOPOLOGY_NAMES[c.topology]}</strong><span>{c.partCount} new parts · {number(c.length*1e3)} mm</span><small>Δr {number(c.analysis.positionError!*1e6)} µm · Δθ {number(c.analysis.angleError!*180/Math.PI)}°</small></button>)}</div>
 {batch&&<details><summary>Search details / limits</summary>{Object.entries(batch.rejected).map(([reason,n])=><p key={reason}>{n} × {reason}</p>)}<p>Bounded placement samples + local refinement. No global optimum / impossibility proof. Mirror bends ≥20°. Prism: BK7 / 90° normal entry and exit. Clearance is conservative AABB screening, not certified solid collision.</p><p>{batch.engine} · Baseline {batch.inputFingerprint}. Geometry only; Beam / Mode Overlap / Total Coupling are not optimized.</p></details>}
 </section>
 <section className="route-preview-pane">{selected?<CandidatePreview candidate={selected}/>:<div className="route-search-empty"><h3>Port-to-Port Routing</h3><p>Run Search로 후보를 생성합니다.</p><p>후보를 선택하면 광로와 Component의 Global Pose를 확인할 수 있습니다.</p><p>Input / Output과 Lens는 고정 조건입니다. Mode Matching은 다음 단계입니다.</p></div>}</section>
 </div><footer><p>Apply는 Undo 1회로 복구할 수 있습니다.</p><button onClick={onClose}>Close</button><button className="primary" disabled={running||!selected||stale||!!shared.invalid.length} onClick={apply}>Apply Candidate</button></footer></dialog>;
}
function CandidatePreview({candidate:c}:{candidate:Candidate}){
 const doc=c.project.model.kind==='surface'?c.project.model.prescription:null;
 const trace=useMemo(()=>projectTrace(c.project),[c.project]),geometry=useMemo(()=>doc?bodyGeometry(doc,trace.surfaces,c.project.bodies,c.project.sourceBody,c.project.targetBody,c.project.portArrays):null,[doc,trace,c.project]);
 const full=useMemo(()=>doc&&geometry?sceneBounds(doc,trace,[...geometry.faces.flatMap(f=>f.points),...geometry.edges.flatMap(e=>e.points)]):null,[doc,trace,geometry]);
 const [view,setView]=useState<SceneView>('3D'),[camera,setCamera]=useState(INITIAL_CAMERA),[focus,setFocus]=useState(false),svg=useRef<SVGSVGElement>(null);
 const bounds=useMemo(()=>{if(!focus||!geometry)return full;const points=geometry.faces.filter(f=>f.bodyId&&c.generatedIds.includes(f.bodyId)).flatMap(f=>f.points);if(!points.length)return full;
  const axes=['x','y','z'] as const,lo=V(...axes.map(k=>Math.min(...points.map(p=>p[k]))) as [number,number,number]),hi=V(...axes.map(k=>Math.max(...points.map(p=>p[k]))) as [number,number,number]);return {center:mul(add(lo,hi),.5),span:norm(sub(hi,lo)),points};
 },[focus,geometry,full,c.generatedIds]);
 if(!doc||!geometry||!bounds)return null;
 return <div className="route-preview" data-testid="route-preview"><div className="route-preview-toolbar"><strong>{TOPOLOGY_NAMES[c.topology]} · Read-only Preview</strong><div>{(['3D','XZ'] as const).map(v=><button key={v} aria-label={`Candidate ${v}`} aria-pressed={view===v} onClick={()=>setView(v)}>{v}</button>)}<button onClick={()=>{setFocus(false);setCamera(INITIAL_CAMERA);}}>Fit Candidate</button><button disabled={!c.generatedIds.length} onClick={()=>{setFocus(true);setView('XZ');setCamera(INITIAL_CAMERA);}}>Focus Candidate Folds</button></div></div>
 <SurfaceScene doc={doc} opticalProject={c.project} trace={trace} geometry={geometry} view={view} camera={camera} setCamera={setCamera} bounds={bounds} selected="" onSelect={()=>{}} presentation svgRef={svg}/>
 <div className="route-preview-metrics"><span>Position error <b>{number(c.analysis.positionError!*1e6)} µm</b></span><span>Incidence error <b>{number(c.analysis.angleError!*180/Math.PI)}°</b></span><span>Reference OPL <b>{number(c.analysis.path!.opl*1e3)} mm</b></span><span>Diagnostic rays <b>{trace.reached} / {trace.paths.length}</b></span></div>
 <p className="surface-reason" data-testid="route-optical-scope">Geometric route only · Mode matching 미검증. Sampled rays {trace.reached} / {trace.paths.length}: 일부만 도달하면 clipping / 차단을 확인하세요. 이 후보는 geometric 경로이며 Mode 정합은 별도 검증이 필요합니다. Lens / Output Mode 정합은 Automatic Synthesis에서 비교하세요.</p>
 <p className="surface-note">Sampled Ray 도달 개수는 Coupling Efficiency가 아닙니다. Body 치수는 가정값입니다.</p>
 <div className="route-preview-table"><table><caption>Generated Components · Global Pose</caption><thead><tr><th>Component</th><th>X / Y / Z [µm]</th><th>Yaw / Pitch / Roll [°]</th></tr></thead><tbody>{doc.assemblies.filter(a=>c.generatedIds.includes(a.id)).map(a=><tr key={a.id}><td>{a.name}</td><td>{Object.values(a.frame.origin).map(v=>number(v*1e6)).join(' / ')}</td><td>{(['yaw','pitch','roll'] as const).map(k=>number(a.frame.rotation[k]*180/Math.PI)).join(' / ')}</td></tr>)}</tbody></table></div>
 </div>;
}
