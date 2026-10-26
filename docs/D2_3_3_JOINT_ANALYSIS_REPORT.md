# D2.3.3 — Joint assessment를 Analysis / Report에 연결

Version `0.16.0-d2.3.3`. Base main `b5df369ff001731ce4d5db2c058becd7a3f6db90`
(D2.3.2 PR #24 병합). 이번 checkpoint는 현재 설계의 joint 결과 / provenance / stale /
export 연결이다. 물리 evaluator, joint sampling, 후보 비교 / optimizer는 D2.3.2를 재사용한다.

## 사용자 경로

1. Design Problem → Joint Tolerance에서 common members / pivot / bounds / samples /
   cap / seed / minimum overlap을 명시하고 **Save Problem Settings**를 선택한다.
2. 그 창의 **Assess Joint Tolerance**를 실행한 뒤 닫는다. 또는 **Analysis → Assess
   Saved Joint Tolerance**로 현재 저장된 설정을 평가한다. 실행은 read-only다.
3. Analysis에서 nominal / sample geometry, field coverage, null domain, 관측 최소 η,
   declared sample goal을 구분해 확인한다. 결과의 sample별 이유와 provenance를 펼칠 수 있다.
4. Report View의 **Joint Tolerance**를 펼치면 같은 결과와 설정을 확인할 수 있다.
   SVG / PNG의 아래쪽에도 현재 상태 / coverage / geometry / minimum η / seed가 표시된다.
5. **Export Joint Assessment JSON**은 현재 결과의 정확한 input signature / coverage /
   engine / evaluator / model tolerance / 설정 / 모든 nominal·sample 관측치를 내보낸다.
   SVG metadata의 `jointTolerance`도 동일한 structured snapshot을 보유한다.

Joint 설정이 없는 Project는 Analysis에서 Not calculated로 표시하고 설정 경로를 안내한다.
기본값을 몰래 저장하거나 계산하지 않는다. Automatic Synthesis Apply 후에도 실제 적용된
Project를 다시 평가한다. 후보 Preview의 Group / rank를 현재 설계의 certificate로 복사하지 않는다.

## 세션과 최신 여부 계약

- ProjectProvider에 한 개의 transient `jointResult`를 공유한다. Project schema는 변경하지 않는다.
  Project JSON은 설정을 저장하며 계산 결과를 certificate로 import하지 않는다.
- Design Problem에서 draft 설정으로 평가한 결과는 draft Project의 signature를 갖는다.
  정확히 같은 설정을 Save하면 current가 된다. 저장하지 않고 닫으면 현재 Project에 대해 stale다.
- `jointReport`는 exact serialized Project, 현재 joint settings, engine, coverage 및 input validity를
  함께 확인한다. geometry / Port / Mode / routing / manufacturing / saved settings 변경은 stale다.
- Stale UI와 export에는 과거 수치 / sample-goal 성공을 current 결과로 노출하지 않는다.
  stale snapshot의 `result`는 null이며 상태와 현재 설정만 보유한다. 자동 재계산은 하지 않는다.
- Undo가 평가 당시 exact Project로 돌아가면 세션 결과는 다시 current다. Redo는 그 상태에 따라
  stale가 된다. 같은 JSON을 같은 세션에서 열면 exact signature가 같을 때만 재사용한다.
  브라우저를 새로 열거나 reload하면 transient 결과는 없어지고 재평가가 필요하다.
- Analysis 실행 중 Project / input validity 변경 또는 Cancel은 shared assessor의 cancellation으로
  종료한다. 취소된 batch는 cancelled / incomplete다. unmount 후 결과를 publish하지 않는다.
  평가와 export는 Undo history에 쓰지 않는다.

## 판정과 보고 범위

`assessed`는 요청된 field sample의 complete coverage이며 모든 geometry 통과나
sample goal 충족과 같은 말이 아니다. nominal geometry / sample geometry와
`meetsSampleGoals`를 별도로 표시한다. partial / cancelled / not-assessed에서도 실제
coverage, null field와 이유를 보존한다. 관측 최소 η는 nominal을 포함하며 incomplete면
partial / nominal only를 표시한다. 미평가를 0 또는 성공으로 바꾸지 않는다.

두 반대 corner + stratified midpoint의 결정론적 시나리오이며 생산 분포 / Yield /
joint worst-case / global robust optimum을 주장하지 않는다. η는 conditional normalized
Mode overlap이며 transmission / total coupling은 아니다. Gaussian과 Prism evaluator의
model tolerance를 그대로 보존한다. Analysis / Report가 새 global 후보 순위를 만들지 않는다.

SVG는 structured metadata와 visible annotation을 함께 가진다. PNG는 기존 3200×2000
raster에 visible annotation을 담으며 JSON provenance를 내장하는 파일은 아니다.
전체 provenance가 필요하면 JSON 또는 SVG를 함께 보관한다. Report renderer는 `2.4.3`이다.

## 검증

- `tests/jointReport.test.ts`: exact input / bounds / sample domain export; geometry / Mode /
  seed / routing / invalid draft / engine / coverage 변경 시 stale; Undo exact restoration;
  cap / cancel / unsupported Lens field / geometry failure; unsaved→saved effective Project.
- `e2e/jointReport.spec.ts`: offline desktop / mobile의 dialog→Analysis→Report→JSON/SVG
  공유, reload / Load 후 재평가, seed 변경 / Undo / Redo, cap / cancel / unsupported null,
  read-only Project와 browser error / overflow / annotation width 검사.
- 기존 joint tolerance / feedback / Report composition / PNG 및 전체 model / browser 회귀를
  실행한다. 최종 CI와 standalone fingerprint / SHA256을 대조한다. 결과 수는 PR에 기록한다.

## 다음 checkpoint

D2.3.4 — **Lens decenter / tilt forward domain의 독립 benchmark와 제한된 확장**을
제안한다. **Astra Work 권장**: 비축 curved refraction의 tangential / sagittal power,
beam frame / phase, aperture와 approximation validity를 독립 기준에 대조해야 한다.
먼저 작은 benchmark gate를 확정하고, 그 기준이 통과하는 domain만 연다. 이 단계 후에도
Parabolic / Asphere / Freeform, Engineering release, multi-channel roadmap은 유지한다.
이번 PR 병합과 다음 checkpoint 시작은 사용자 지시 후 진행한다.
