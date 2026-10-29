import {DESIGN_SCENARIOS} from './designScenarios';
import {useProject} from '../project/Store';
export default function ScenarioGuide(){const {project}=useProject(),id=project.designScenario;if(!id)return null;const s=DESIGN_SCENARIOS[id];return <details className="scenario-guide"><summary>설계 참고 · {s.title}</summary><p>{s.path}</p><p>{s.roles}</p><p><strong>시작 시 가정</strong> · {s.assumptions}</p><p>{s.check}</p><small>참고: {s.reference}. 이후 편집한 설계와 원래 참고 구조는 다를 수 있습니다.</small></details>;}
