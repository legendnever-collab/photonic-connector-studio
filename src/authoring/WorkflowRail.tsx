export type WorkStep='examples'|'conditions'|'structure'|'results'|'report';
export const WORK_STEPS=[['examples','① 설계 예시'],['conditions','② 연결 조건'],['structure','③ 광학계 설계'],['results','④ 계산 결과'],['report','⑤ 결과 정리']] as const;
export default function WorkflowRail({step,onStep}:{step:WorkStep;onStep:(s:WorkStep)=>void}){return <nav className="workflow-rail" aria-label="설계 순서">{WORK_STEPS.map(([id,label])=><button key={id} aria-current={step===id?'step':undefined} onClick={()=>onStep(id)}>{label}</button>)}</nav>;}
