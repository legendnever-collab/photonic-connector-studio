import {useProject} from '../project/Store';
import {projectFingerprint} from '../project/model';
import {tensorOverlap} from '../project/tensorOverlap';
import {basicRelayReference} from './basicRelay';
import {useMemo} from 'react';
export default function GuidedResults({onConditions}:{onConditions:()=>void}){const s=useProject(),fp=projectFingerprint(s.project),r=s.guidedResult,current=!s.invalid.length&&r?.fingerprint===fp,baseline=useMemo(()=>tensorOverlap(basicRelayReference()),[]);
 function run(){s.setGuidedResult({fingerprint:fp,overlap:s.project.model.kind==='surface'?tensorOverlap(s.project):null});}
 return <section className="guided-results" aria-label="기준 결과 비교"><h3>계산 결과</h3>{s.project.designScenario==='basic-relay'&&baseline.status==='valid'&&<p>1번 기준 예시 · 1310 nm / MFD 9.2 µm · 조건부 Mode Overlap <strong>{(100*baseline.eta).toFixed(5)}%</strong></p>}<button disabled={!!s.invalid.length||s.project.model.kind!=='surface'} onClick={run}>현재 설계 다시 계산</button>{s.project.model.kind==='ideal'?<p>이 Ideal 모델의 결과는 아래 Gaussian 분석에서 자동 계산됩니다.</p>:s.invalid.length>0?<p>입력값을 먼저 확인하세요: {s.invalid.join(', ')}</p>:!current?<p>현재 설계의 비교 결과를 계산하세요. 변경 전 결과는 표시하지 않습니다.</p>:r.overlap?.status==='valid'?<p data-testid="guided-overlap">현재 조건부 Mode Overlap <strong>{(100*r.overlap.eta).toFixed(5)}%</strong> · Loss {r.overlap.lossDB.toFixed(5)} dB</p>:<><p role="status">{r.overlap?.reason??'Surface 설계에서 계산할 수 있습니다.'}</p><button onClick={onConditions}>연결 조건 확인</button></>}<p>현재 계산은 선언된 Gaussian Mode의 정합입니다. 총 광효율과 PIC 소자 효율은 별도 검증이 필요합니다.</p></section>;
}
