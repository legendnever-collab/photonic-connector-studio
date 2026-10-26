import {useEffect,useRef,useState} from 'react';
import {useProject} from '../project/Store';
import {serializeProject} from '../project/model';
import {assessJoint} from './joint';
import {jointReport} from './jointReport';
import JointResults from './JointResults';
import './jointReport.css';

export default function JointAnalysis(){
 const shared=useProject(),p=shared.project,signature=serializeProject(p),live=useRef(signature),cancel=useRef(false),mounted=useRef(true);
 live.current=shared.invalid.length?'invalid':signature;
 const [busy,setBusy]=useState(false),[progress,setProgress]=useState(''),[error,setError]=useState('');
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;cancel.current=true;};},[]);
 async function run(){
  const settings=p.designProblem?.jointTolerance;if(!settings)return;
  cancel.current=false;setBusy(true);setError('');shared.setJointResult(null);
  try{const result=await assessJoint(p,settings,{cancelled:()=>cancel.current||!mounted.current||live.current!==signature,progress:(n,total)=>{if(mounted.current)setProgress(`Joint samples ${n} / ${total}`);}});if(mounted.current)shared.setJointResult(result);}
  catch(e){if(mounted.current)setError(e instanceof Error?e.message:String(e));}finally{if(mounted.current){setBusy(false);setProgress('');}}
 }
 return <section aria-label="Joint Tolerance Analysis">
 <JointResults report={jointReport(p,shared.jointResult,!!shared.invalid.length)}/>
 {!p.designProblem?.jointTolerance&&<p>Design Problem → Joint Tolerance에서 설정한 뒤 Save Problem Settings를 선택하세요.</p>}
 <button disabled={busy||!!shared.invalid.length||p.model.kind!=='surface'||!p.designProblem?.jointTolerance} onClick={()=>void run()}>Assess Saved Joint Tolerance</button>
 {busy&&<><button onClick={()=>{cancel.current=true;}}>Cancel Joint Assessment</button><p role="status">{progress||'Preparing joint samples…'}</p></>}{error&&<p role="alert">{error}</p>}
 </section>;
}
