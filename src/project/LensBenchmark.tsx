import {useEffect,useRef,useState} from 'react';
import {useProject} from './Store';
import {serializeProject} from './model';
import {assessLensBenchmark,lensBenchmarkReport} from './lensFieldBenchmark';
type Report=ReturnType<typeof lensBenchmarkReport>;
const pct=(v:number)=>`${(100*v).toPrecision(5)}%`;
export function LensBenchmarkResults({report}:{report:Report}){
 const r=report.result,m=r?.status==='converged'?r.metrics:null;
 function save(){const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='lens-phase-screen-benchmark.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 return <section data-testid="lens-benchmark-result" data-state={report.state} className="joint-summary">
 <h3>Lens Field Benchmark · {report.state==='current'?r!.status:report.state}</h3>
 <p>Exact sag phase / quadratic phase · separate thin-screen reference</p>
 {r&&<p>{r.reason}</p>}{m&&<><dl>
 <div><dt>Exact phase-screen overlap</dt><dd>{pct(m.sample.exactEta)}</dd></div>
 <div><dt>Quadratic + same pupil</dt><dd>{pct(m.sample.quadraticPupilEta)}</dd></div>
 <div><dt>Analytic thin Gaussian · no pupil</dt><dd>{pct(m.analyticEta)}</dd></div>
 <div><dt>Observed overlap difference · screen only</dt><dd>{Math.abs(m.sample.exactEta-m.analyticEta).toExponential(3)} absolute η</dd></div>
 <div><dt>Pupil fraction · screen only</dt><dd>{pct(m.sample.pupilFraction)}</dd></div>
 <div><dt>Residual phase RMS · piston removed</dt><dd>{m.sample.rmsPhase.toPrecision(5)} rad</dd></div>
 <div><dt>Phase-only field fidelity</dt><dd>{pct(m.sample.phaseFidelity)}</dd></div>
 <div><dt>Any-target modal-deviation estimate · screen only</dt><dd>{m.estimatedDeviationInterval.map(v=>v.toPrecision(4)).join(' – ')} absolute η</dd></div>
 </dl><p data-testid="lens-benchmark-gate">Screen reference gate: {m.referenceGate} · threshold {m.threshold} absolute η</p>
 <p>Grid {m.sample.radialNodes} × {m.sample.angularNodes} · refinement estimate {m.numericalErrorEstimate.toExponential(2)}. This is not a certified numerical enclosure or a physical coupling error bound.</p></>}
 {report.state==='stale'&&<p>Project / input changed. Run again; previous metrics are not current.</p>}
 <details><summary>Benchmark scope / provenance</summary><p>{report.scope}</p><p>Thickness is collapsed; this does not replace current Mode Overlap or rank synthesis candidates. Physical accuracy remains unassessed.</p>{r&&<p>{r.engine} · {r.lensId??'No supported Lens'} · thickness {r.thickness===null?'undefined':`${r.thickness*1e3} mm`}</p>}</details>
 <button onClick={save}>Export Lens Benchmark JSON</button>
 </section>;
}
export default function LensBenchmark(){
 const shared=useProject(),p=shared.project,signature=serializeProject(p),live=useRef(signature),cancel=useRef(false),mounted=useRef(true),[busy,setBusy]=useState(false),[progress,setProgress]=useState(0);
 live.current=shared.invalid.length?'invalid':signature;
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;cancel.current=true;};},[]);
 async function run(){cancel.current=false;setBusy(true);setProgress(0);shared.setLensBenchmark(null);
  try{const result=await assessLensBenchmark(p,{cancelled:()=>cancel.current||!mounted.current||live.current!==signature,progress:n=>{if(mounted.current)setProgress(n);}});if(mounted.current)shared.setLensBenchmark(result);}finally{if(mounted.current)setBusy(false);}
 }
 return <section aria-label="Lens Field Benchmark"><LensBenchmarkResults report={lensBenchmarkReport(p,shared.lensBenchmark,!!shared.invalid.length)}/><button disabled={busy||!!shared.invalid.length} onClick={()=>void run()}>Run Lens Field Benchmark</button>{busy&&<><button onClick={()=>{cancel.current=true;}}>Cancel Lens Benchmark</button><p role="status">Radial grid {progress} · refinement in progress</p></>}</section>;
}
