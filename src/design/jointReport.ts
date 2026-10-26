import type {Project} from '../project/model';
import {projectFingerprint,serializeProject} from '../project/model';
import {JOINT_ENGINE,jointCoverage} from './joint';
import type {JointResult} from './joint';

export const JOINT_REPORT_SCOPE='Deterministic joint scenarios: two opposite corners + stratified midpoints · conditional normalized Mode overlap · no Yield / joint worst-case guarantee';
/** Session results are valid only for the exact evaluated Project and evaluator contract.
 * Stale numeric observations are deliberately absent from current-design exports. */
export function jointReport(project:Project,result:JointResult|null,invalid=false){
 const settings=project.designProblem?.jointTolerance??null;
 let state:'not-calculated'|'stale'|'current'='not-calculated',reason='Joint tolerance has not been calculated in this session.';
 if(result){
  state='stale';reason='Stale joint result · Project / settings / input validity changed. Run again.';
  try{
   if(!invalid&&settings&&result.engine===JOINT_ENGINE&&result.inputSignature===serializeProject(project)&&result.settings===JSON.stringify(settings)&&result.coverage===jointCoverage(project,settings)){
    state='current';reason=result.status==='assessed'?'Current Project · requested field samples assessed.':'Current Project · incomplete or unassessed joint samples.';
   }
  }catch{/* Missing members and unsupported declarations require a fresh assessment. */}
 }
 return {version:1 as const,state,reason,scope:JOINT_REPORT_SCOPE,projectFingerprint:projectFingerprint(project),settings,synthesisProvenance:project.synthesis?.solution??null,result:state==='current'?result:null};
}
export type JointReport=ReturnType<typeof jointReport>;
export const jointPercent=(eta:number|null)=>eta===null?'Not calculated':`${(eta*100).toFixed(4)}%`;
export function jointReportLine(report:JointReport){
 const r=report.result;
 return r?`Joint ${r.status} · field ${r.fieldAssessed}/${r.planned} · geometry ${r.geometryPassed}/${r.tested} · min η ${jointPercent(r.lowestEta)}${r.status!=='assessed'?' (partial / nominal only)':''} · sample goals ${r.meetsSampleGoals?'met':'not met'} · seed ${report.settings!.seed} · no Yield claim`:`Joint: ${report.state==='stale'?'Stale · run again':'Not calculated'} · no current tolerance result`;
}
