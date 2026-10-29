import {mountName,portMounted} from './lensMount';
import type {SynthesisResult,SynthesisCandidate} from './engine';
import type {SynthesisOptions} from './contract';
import type {Routing,Topology} from '../routing/contract';
import type {DesignProblem} from '../design/contract';
import {prescription} from '../project/model';
import {componentIds} from '../design/engine';
import {FAMILY_IDS,configurationIssues,emptyEvidence,EXISTING_FAMILY} from './diagnostics';
import type {IssueKind,FamilyEvidence} from './diagnostics';

const NAMES:Record<string,string>={direct:'Lens 직결',mirror1:'Mirror 1개',mirror2:'Mirror 2개',prism1:'TIR Prism 1개','mirror-prism':'Mirror + TIR Prism',prism2:'TIR Prism 2개',[EXISTING_FAMILY]:'현재 광학계 조정'};
const ACTIONS:Record<IssueKind,string>={settings:'Family / Manufacturing assumptions에서 사용할 구조를 선택하세요.',parts:'Constraints의 Mirror / Prism / 전체 부품 / 새 구성 부품 상한을 확인하세요.',geometry:'Port 위치·방향, 설계 공간, 부품 크기와 Keep-out 조건을 확인하세요.',unsupported:'표시된 모델 지원 범위를 확인하세요. 탐색 예산을 늘려도 미지원 평가가 지원되지는 않습니다.',domain:'파장·입사각·빔 발산·구경 등 상세 사유의 유효 범위를 확인하세요.',budget:'Budget / goals / tolerance coverage에서 광학·기하·Local fit 한도를 확인하세요. 한도를 늘려도 후보 확보가 보장되지는 않습니다.',other:'아래 원문 사유를 확인하세요. 실패 원인을 미지원 모델로 단정하지 않습니다.'};
const KIND_NAMES:Record<IssueKind,string>={settings:'설정',parts:'부품 상한',geometry:'기하·경로',unsupported:'평가 미지원',domain:'평가 도메인 제한',budget:'탐색 한도',other:'상세 확인'};

export function familyStatus(row:FamilyEvidence,candidates:SynthesisCandidate[],result:SynthesisResult|null,blocked:boolean){
 if(blocked)return '설정에서 제외';
 if(!result)return '탐색 전';
 if(result.status==='cancelled')return '취소 · 결과 폐기';
 if(result.status==='invalid-input'||result.status==='unsupported')return '입력·지원 범위 확인';
 const qualified=candidates.filter(c=>c.qualified).length;
 if(qualified)return `조건부 목표 통과 ${qualified}개`;
 if(candidates.length)return candidates.every(c=>c.eta===null)?`Mode 미계산 참고 후보 ${candidates.length}개`:`목표 미달·참고 후보 ${candidates.length}개`;
 if(row.accepted)return '평가된 후보가 최종 목록에 남지 않음';
 const limits=[...(row.issues.some(v=>v.kind==='unsupported')?['미지원 평가 기록 있음']:[]),...(row.issues.some(v=>v.kind==='domain')?['도메인 제한 기록 있음']:[]),...(row.limited?['탐색 한도']:[])];
 if(limits.length)return limits.join(' · ')+' · 후보 미확보';
 if(!row.proposals&&!row.fitTested)return '경로 seed 생성 안 됨';
 return '검토한 범위에서 후보 미확보';
}

export function FamilyDiagnostics({result,options,routing,problem,stale,busy=false}:{result:SynthesisResult|null;options:SynthesisOptions;routing:Routing;problem:DesignProblem;stale:boolean;busy?:boolean}){
 // A completed run always describes its saved settings, not the edited form.
 const o=result?.options??options,r=result?.routing??routing,p=result?.problem??problem;
 const ids:string[]=[...FAMILY_IDS];
 if(result&&(result.diagnostics.families[EXISTING_FAMILY].fitPlanned||result.candidates.some(c=>c.topology===EXISTING_FAMILY)))ids.unshift(EXISTING_FAMILY);
 return <section className="synthesis-diagnostics" aria-label="구조별 탐색 상태" data-testid="synthesis-diagnostics">
  <p>조립 조건: {mountName(o)}. {portMounted(o)?'편심 2-Lens 직결은 기본 탐색에서 제외합니다.':'Lens 편심 조립을 명시적으로 허용한 탐색입니다.'}</p><h3>{busy?'탐색 중 · 결과 대기':result?'구조별 탐색 결과':'탐색 전 구조 설정'}</h3>
  {stale&&<p className="surface-reason" role="status">이전 결과입니다. 조건이 변경되었으므로 다시 탐색하세요.</p>}
  <p>후보가 없다는 것은 물리적으로 불가능하거나 성능이 낮다는 뜻이 아닙니다. 경로 seed와 설정한 탐색 범위 안의 결과입니다.</p>
  {result?.status==='cancelled'&&<p>탐색을 취소하여 중간 후보와 진단 결과를 폐기했습니다. 다시 탐색하세요.</p>}
  {!!result?.diagnostics.global.length&&<details open><summary>공통 입력·탐색 사유</summary>{result.diagnostics.global.map((issue,i)=><div key={i}><p>{KIND_NAMES[issue.kind]} · {issue.count}회 · {issue.reason}</p><p>다음: {ACTIONS[issue.kind]}</p></div>)}</details>}
  <div className="family-status-list">{ids.map(id=>{
   const row=result?.diagnostics.families[id]??emptyEvidence(),issues=id===EXISTING_FAMILY?[]:configurationIssues(id as Topology,o,r,p),candidates=result?.candidates.filter(c=>c.topology===id)??[];
   const status=busy&&!issues.length?'결과 대기':familyStatus(row,candidates,result,!!issues.length),kinds=[...new Set(row.issues.map(i=>i.kind))];
   return <article key={id} data-testid={`family-status-${id}`}>
    <header><strong>{NAMES[id]}</strong><span>{status}</span></header>
    {!!issues.length&&<><p>{issues.join(' ')}</p><p>다음: {issues.length===1&&!o.families.includes(id as Topology)?ACTIONS.settings:ACTIONS.settings+' '+ACTIONS.parts}</p></>}
    {result&&result.status!=='cancelled'&&<p className="family-counts">초기 경로 {row.proposals}개 · 기하 검사 {row.geometryTested}개 / 통과 {row.geometryPassed}개 · 초기 광학 배치 {row.fitPlanned}개 · 조정 실행 {row.fitTested}회 · 표시 후보 {candidates.length}개</p>}
    {row.limited&&<p className="family-limit">탐색 한도에 도달해 검토하지 못한 경로·광학 배치 또는 조정이 있습니다. {ACTIONS.budget}</p>}
    {!!row.issues.length&&<details open={!candidates.length&&!issues.length}><summary>제외·평가 사유 {row.issues.length}종 · 다음 조치</summary>{kinds.map(kind=><p key={kind}><strong>{KIND_NAMES[kind]}</strong> · {ACTIONS[kind]}</p>)}<ul>{[...row.issues].sort((a,b)=>b.count-a.count).map((v,i)=><li key={i}>{v.count}회 · {v.reason}</li>)}</ul><p>횟수는 검사·조정 중 발생한 사유 수이며, 서로 다른 설계 수나 전체 불가능 판정이 아닙니다.</p></details>}
    {id==='direct'&&!portMounted(o)&&o.lensAlignment&&<p>Lens 직결은 편심·tilt 보정을 포함합니다. 먼저 직선 경로가 닫히지 않아도 2-Lens 초기 광학 배치를 조정할 수 있습니다. 후보는 보정 후 경로·충돌·Mode를 모두 재검증합니다.</p>}
    {id.includes('prism')&&<details><summary>현재 Prism 평가 범위</summary><p>현재 생성기는 직각 TIR Prism을 사용합니다. Prism Mode 평가는 검증된 BK7 / air, 1260–1625 nm, 명시적인 TE/TM 및 거의 평행한 빔 등의 조건을 요구합니다. 첫 TIR 뒤 powered Lens는 평가 미지원입니다. 이 설명은 공통 지원 범위이며 이번 후보의 실제 제외 원인은 위 기록을 확인하세요.</p></details>}
    {!result&&!issues.length&&!busy&&<p>다음: Run Automatic Synthesis로 실제 경로·광학 평가를 시작하세요.</p>}
   </article>;
  })}</div>
  <p>기하 집계는 초기 seed 검사입니다. 조정 실행은 재시도·배치 refinement를 포함합니다. 최종 목록은 최대 8개이며, 참고 후보와 서로 다른 평가 도메인은 전체 성능 순위로 비교하지 않습니다.</p>
 </section>;
}

export function candidateGroups(candidates:SynthesisCandidate[]){
 const groups=new Map<string,SynthesisCandidate[]>();
 for(const c of candidates){const key=JSON.stringify([c.topology,c.comparisonClass,c.evaluator,c.joint?.coverage??null,c.joint?.group??null]);const list=groups.get(key)??[];list.push(c);groups.set(key,list);}
 return [...groups.values()];
}
export function CandidateList({candidates,selected,onSelect}:{candidates:SynthesisCandidate[];selected:string;onSelect:(id:string)=>void}){
 const groups=candidateGroups(candidates);
 const card=(v:SynthesisCandidate)=>{
  const ids=new Set(componentIds(v.project)),parts=prescription(v.project).assemblies.filter(a=>ids.has(a.id)),count=(kind:string)=>parts.filter(a=>a.kind===kind).length;
  return <button key={v.id} aria-label={`Preview Synthesis Candidate ${candidates.indexOf(v)+1}`} aria-pressed={selected===v.id} onClick={()=>onSelect(v.id)}>
   <strong>후보 {candidates.indexOf(v)+1} · {NAMES[v.topology]??v.topology}</strong>
   <span>{v.qualified?'Nominal Mode goals met':v.eta===null?'Mode 미계산 · 참고용':'Partial · 조건부 목표 미달'}</span>
   <small>Lens {count('lens')} · Mirror {count('mirror')} · Prism {count('prism')} · 총 {parts.length}개</small>
   <small>조건부 overlap {v.eta===null?'미계산':`${(100*v.eta).toFixed(5)}%`} · 실제 총 결합효율 아님</small>
   <small>조립: {v.project.synthesis?.lensMount==='free'?'편심·tilt 허용':'Port–Lens 동축 유지'}</small><small>평가: {v.comparisonClass}</small>
   {v.joint?<small>{v.joint.group} · {v.joint.rank===null?'Unranked':`Joint rank ${v.joint.rank}`} · {v.joint.result?.status??'not-assessed'}</small>:<small>OAT {v.oat.status} · {v.oat.fieldAssessed}/{v.oat.planned}</small>}
  </button>;
 };
 return <section className="synthesis-candidate-groups" aria-label="Automatic Synthesis candidates">
  {!!candidates.length&&<p className="selected-candidate">선택: 후보 {candidates.findIndex(c=>c.id===selected)+1} · {NAMES[candidates.find(c=>c.id===selected)?.topology??'']??''}</p>}
  {!!candidates.length&&<p>{groups.length}개 비교 그룹 · {candidates.length}개 후보. 같은 구조·평가 도메인의 대표 후보를 먼저 표시합니다. Group 간 우열은 선언하지 않습니다.</p>}
  {groups.map(group=><article key={group[0].id}>{card(group[0])}{group.length>1&&<details open={group.slice(1).some(c=>c.id===selected)||undefined}><summary>같은 그룹의 다른 후보 {group.length-1}개 보기</summary>{group.slice(1).map(card)}</details>}</article>)}
 </section>;
}
