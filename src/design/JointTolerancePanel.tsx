import {useEffect,useRef,useState} from 'react';
import {NumberField} from '../Fields';
import type {Project} from '../project/model';
import type {Routing} from '../routing/contract';
import type {DesignProblem} from './contract';
import type {JointTolerance} from './jointContract';
import {JointToleranceSchema} from './jointContract';
import {assessJoint,defaultJointTolerance,jointComponents} from './joint';
import type {JointResult} from './joint';
import {problemProject} from './engine';
import {useProject} from '../project/Store';
const pct=(v:number|null)=>v===null?'Not calculated':`${(v*100).toFixed(4)}%`;
export default function JointTolerancePanel({project,problem,routing,onChange,busy,onBusy,cancelled,invalid}:{project:Project;problem:DesignProblem;routing:Routing;onChange:(o:JointTolerance)=>void;busy:boolean;onBusy:(busy:boolean)=>void;cancelled:()=>boolean;invalid:boolean}){
 const shared=useProject();
 const o=problem.jointTolerance??defaultJointTolerance(project),signature=JSON.stringify({project,problem,routing}),live=useRef(signature),mounted=useRef(true);
 live.current=signature;
 const [result,setResult]=useState<{key:string;value:JointResult}|null>(null),[error,setError]=useState(''),[progress,setProgress]=useState('');
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const nf=(label:string,value:number,unit:string,min:number,max:number,change:(v:number)=>void,step:number|'any'='any')=><NumberField label={label} value={value} unit={unit} min={min} max={max} step={step} onChange={v=>{change(v!);return true;}}/>;
 async function run(){const key=signature;onBusy(true);setError('');setResult(null);shared.setJointResult(null);setProgress('Preparing joint samples…');
  try{const value=await assessJoint(problemProject(project,problem,routing),o,{cancelled:()=>!mounted.current||cancelled()||live.current!==key,progress:(n,total)=>{if(mounted.current)setProgress(`Joint samples ${n} / ${total}`);}});if(mounted.current){setResult({key,value});shared.setJointResult(value);}}
  catch(e){if(mounted.current)setError(e instanceof Error?e.message:String(e));}finally{if(mounted.current){onBusy(false);setProgress('');}}
 }
 return <section className="joint-panel"><h3>Joint tolerance · D2.3.1</h3><p>Common mating group에 같은 rigid-body 공차를 적용하고, 각 부품의 Assembly 공차를 함께 적용합니다. 현재 설계만 평가합니다.</p>
 <fieldset disabled={busy}><legend>Common mating group</legend><p>선택한 Port / 부품만 함께 이동합니다. World XYZ 이동과 pivot 기준 Rz·Ry·Rx 회전입니다.</p>
 {(['source','target'] as const).map(which=><label className="surface-check" key={which}><input type="checkbox" aria-label={`Joint mating ${which}`} checked={o.mating.ports.includes(which)} onChange={e=>onChange({...o,mating:{...o.mating,ports:e.target.checked?[...o.mating.ports,which]:o.mating.ports.filter(x=>x!==which)}})}/>{which==='source'?'Input Port':'Output Port'}</label>)}
 {[...new Set([...jointComponents(project),...o.mating.components])].sort().map(id=><label className="surface-check" key={id}><input type="checkbox" aria-label={`Joint mating component ${id}`} checked={o.mating.components.includes(id)} onChange={e=>onChange({...o,mating:{...o.mating,components:e.target.checked?[...o.mating.components,id]:o.mating.components.filter(x=>x!==id)}})}/>{id}{!jointComponents(project).includes(id)?' · missing: clear membership':''}</label>)}
 <div className="fields-three">{['X','Y','Z'].map((axis,i)=><div key={axis}>{nf(`Joint pivot ${axis}`,o.mating.pivot[i]*1e6,'µm',-1e6,1e6,v=>{const pivot=[...o.mating.pivot] as [number,number,number];pivot[i]=v*1e-6;onChange({...o,mating:{...o.mating,pivot}});})}</div>)}</div></fieldset>
 {(['mating','assembly'] as const).map(group=><fieldset disabled={busy} key={group}><legend>{group==='mating'?'Common mating bounds':'Individual Assembly bounds · all leaf optical components'}</legend>{group==='assembly'&&<p>각 부품의 nominal local XYZ / 회전 Axis을 사용합니다. 개별 공차를 먼저 적용하고 Common mating 변환을 적용합니다. 설계 lock도 공차 평가에서는 변위가 적용됩니다.</p>}{(['position','angle'] as const).map(kind=><div className="fields-three" key={kind}>{['X','Y','Z'].map((axis,i)=>{const factor=kind==='position'?1e6:180/Math.PI;return <div key={axis}>{nf(`Joint ${group} ${kind} ${axis}`,o[group][kind][i]*factor,kind==='position'?'µm':'°',0,(kind==='position'?.001:.05)*factor,v=>{const a=[...o[group][kind]] as [number,number,number];a[i]=v/factor;onChange({...o,[group]:{...o[group],[kind]:a}});})}</div>;})}</div>)}</fieldset>)}
 <fieldset disabled={busy}><legend>Deterministic joint samples</legend><div className="fields-two">{nf('Joint Samples',o.samples,'requested',4,256,v=>onChange({...o,samples:v}),1)}{nf('Joint Case cap',o.maxCases,'evaluated',1,256,v=>onChange({...o,maxCases:v}),1)}{nf('Joint Seed',o.seed,'seed',0,4294967295,v=>onChange({...o,seed:v}),1)}{nf('Joint Minimum overlap',o.minimumOverlap*100,'%',0,100,v=>onChange({...o,minimumOverlap:v/100}))}</div></fieldset>
 <p>두 개의 반대 corner와 각 공차 Axis의 stratified midpoint samples를 사용합니다. 분포 / 상관관계를 가정하지 않으며 Yield 또는 전체 worst case가 아닙니다. Lens decenter / tilt의 미지원 sample은 미평가로 표시합니다.</p>
 <button className="primary" disabled={busy||invalid||!JointToleranceSchema.safeParse(o).success} onClick={()=>void run()}>Assess Joint Tolerance</button>
 {progress&&<p role="status">{progress}</p>}{error&&<p role="alert">{error}</p>}
 {result&&<section data-testid="joint-result" className="problem-metrics"><h3>{result.key!==signature?'Stale joint result · run again':`${result.value.status} · ${result.value.meetsSampleGoals?'Sample goals met':'Review sample coverage / goals'}`}</h3>
 <dl><div><dt>Active error dimensions</dt><dd>{result.value.dimensions}</dd></div><div><dt>Joint field coverage</dt><dd>{result.value.fieldAssessed} / {result.value.planned}</dd></div><div><dt>Evaluated samples</dt><dd>{result.value.tested} / {result.value.planned}</dd></div><div><dt>Geometry passed</dt><dd>{result.value.geometryPassed} / {result.value.tested}</dd></div><div><dt>Nominal Mode overlap</dt><dd>{pct(result.value.nominal.eta)}</dd></div><div><dt>Lowest observed overlap</dt><dd>{pct(result.value.lowestEta)} · {result.value.lowestCase??'None'}{result.value.status!=='assessed'?' · partial / nominal only':''}</dd></div></dl>
 <p>Conditional normalized Mode overlap. 미평가 sample은 0 또는 성공으로 처리하지 않습니다. Save Problem Settings 후 같은 Project의 결과를 Analysis / Report에서 확인할 수 있습니다.</p>
 {result.value.issues.map((issue,i)=><p className="surface-reason" key={i}>{issue}</p>)}
 <details><summary>Sample results & domain</summary><table className="problem-locks"><thead><tr><th>Sample</th><th>Mode overlap</th><th>Geometry / domain</th></tr></thead><tbody>{[result.value.nominal,...result.value.observations].map(v=><tr key={v.id}><td>{v.id}</td><td>{pct(v.eta)}</td><td>{v.geometryPassed?'Passed':'Failed'} · {v.reasons.join(' · ')||v.comparisonClass}</td></tr>)}</tbody></table></details></section>}
 </section>;
}
