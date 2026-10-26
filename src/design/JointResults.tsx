import type {JointReport} from './jointReport';
import {jointPercent,JOINT_REPORT_SCOPE} from './jointReport';

export function downloadJointReport(report:JointReport){
 const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'})),a=document.createElement('a');
 a.href=url;a.download='optical-joint-assessment.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export default function JointResults({report}:{report:JointReport}){
 const r=report.result,o=report.settings;
 return <section className="joint-summary" data-testid="joint-shared-result" data-state={report.state}>
 <h3>Joint Tolerance · {report.state==='current'?r!.status:report.state==='stale'?'Stale':'Not calculated'}</h3><p>{report.reason}</p>
 {r&&<><dl>
 <div><dt>Joint field coverage</dt><dd>{r.fieldAssessed} / {r.planned}</dd></div><div><dt>Evaluated samples</dt><dd>{r.tested} / {r.planned}</dd></div>
 <div><dt>Geometry passed · samples</dt><dd>{r.geometryPassed} / {r.tested}</dd></div><div><dt>Nominal geometry</dt><dd>{r.nominal.geometryPassed?'Passed':'Failed'}</dd></div>
 <div><dt>Nominal Mode overlap</dt><dd>{jointPercent(r.nominal.eta)}</dd></div><div><dt>Lowest observed overlap</dt><dd>{jointPercent(r.lowestEta)} · {r.lowestCase??'None'}{r.status!=='assessed'?' · partial / nominal only':''}</dd></div>
 <div><dt>Declared sample goal</dt><dd>{r.meetsSampleGoals?'Met':'Not met / incomplete'} · η ≥ {jointPercent(o!.minimumOverlap)}</dd></div><div><dt>Active error dimensions</dt><dd>{r.dimensions}</dd></div>
 </dl><p>{r.nominal.evaluator??'Evaluator unavailable'} · {r.nominal.comparisonClass??'Field domain unavailable'} · {r.nominal.modelEtaTolerance!==null&&r.nominal.modelEtaTolerance<=1e-8?'Numerical comparison floor (not physical accuracy)':'Model eta tolerance'} {r.nominal.modelEtaTolerance??'undefined'}</p>{r.nominal.fieldAssumptions&&<p>{r.nominal.fieldAssumptions}</p>}
 {r.issues.map((issue,i)=><p className="surface-reason" key={i}>{issue}</p>)}
 <details><summary>Sample results & domain</summary><div className="joint-table-scroll"><table><thead><tr><th>Sample</th><th>Mode overlap</th><th>Geometry / domain</th></tr></thead><tbody>{[r.nominal,...r.observations].map(v=><tr key={v.id}><td>{v.id}</td><td>{jointPercent(v.eta)}</td><td>{v.geometryPassed?'Passed':'Failed'} · {v.reasons.join(' · ')||v.comparisonClass}</td></tr>)}</tbody></table></div></details>
 <details><summary>Assessment provenance & assumptions</summary><p>{r.engine} · Input {report.projectFingerprint}</p><p>Seed {o!.seed} · requested {o!.samples} · cap {o!.maxCases}. Local Assembly error → common world Rz·Ry·Rx about the declared pivot.</p><p>Mating Ports: {o!.mating.ports.join(', ')||'None'} · components: {o!.mating.components.join(', ')||'None'}</p><p>Units: m / rad. Bounds are symmetric ± limits.</p><pre>{JSON.stringify(o,null,2)}</pre>{report.synthesisProvenance&&<p>Saved synthesis record: {report.synthesisProvenance.engine} · {report.synthesisProvenance.topology} · baseline {report.synthesisProvenance.baselineFingerprint}. Prior search provenance; current joint assessment is recorded separately.</p>}<p>Exact evaluated input and coverage are included in JSON / SVG metadata.</p></details></>}
 <p>{JOINT_REPORT_SCOPE}</p><p>결과는 현재 세션에서 공유합니다. Project JSON에는 설정만 저장하며, 새 세션에서는 다시 평가하세요.</p>
 <button onClick={()=>downloadJointReport(report)}>Export Joint Assessment JSON</button>
 </section>;
}
