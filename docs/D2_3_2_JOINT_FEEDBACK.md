# D2.3.2 — 같은 coverage의 joint merit를 탐색에 반영

Version `0.15.0-d2.3.2`. Base main `1d53226899dee5b0543b123fb7a646ac4b970bda`
(D2.3.1 PR #23 병합). 이번 범위는 opt-in joint synthesis feedback이다.
기존 OAT와 nominal synthesis는 기본값으로 유지한다. Analysis / Report 연결과
decenter / tilt forward domain 확대는 이번 변경에 포함하지 않는다.

## 사용자 경로

1. 현재 설계 또는 New Physical Project를 열고 Output Gaussian reference를 명시한다.
2. Design Problem → Joint Tolerance에서 common mating members / world pivot /
   common bounds / individual Assembly bounds / seed / samples를 설정한다.
3. 같은 dialog의 Automatic Synthesis… → Tolerance feedback을 **Joint**로 선택한다.
4. Joint budget을 확인하고 Run Automatic Synthesis를 실행한다. Nominal 목표,
   Group별 관측 순위, field coverage / geometry / domain과 feedback 내역을 확인한다.
5. Preview는 read-only다. Apply는 실제 recipe를 재구성하여 geometry / nominal Mode를
   다시 검사하고 한 Undo step으로 저장한다. joint rank는 transient이며 saved certificate가 아니다.

독립 실험 재현에는 D2.2.2 Blank 2 Prism 예제도 사용할 수 있다. 이는 기본값을 특정
정답으로 바꾸는 기능이 아니며 임의 Project의 입력/제약을 읽는 동일한 엔진을 사용한다.
이 예제에서 순위 표시를 확인하려면 Samples / cap=8, common Y / Z=0.25 µm를
사용할 수 있다. 기본 route position tolerance=1 µm에서 Y / Z 각각 1 µm를
동시에 적용하면 1.414 µm가 되어 geometry 실패가 정상이다. 이를 자동 완화하지 않는다.

## 비교 계약

`SynthesisSchema` v1에 optional `toleranceMode: oat | joint`, `jointBudget: 1..8192`를
추가한다. joint 설정이 없거나 모든 공차 한계가 0이면 joint mode를 거절한다.
설계 lock은 nominal 변수 제한이며 조립 공차를 0으로 바꾸지 않는다.

Rank를 받을 수 있는 후보는 nominal Mode goals를 통과하고, D2.3.1의 요청된 모든
joint sample 및 nominal에서 field와 geometry가 평가·통과된 후보뿐이다.
nominal η와 joint 목표 threshold는 구분한다. rank 1이어도 선언된 joint threshold를
만족하지 못할 수 있으므로 별도로 **Declared sample goal**을 표시한다.

같은 Group은 다음 값이 정확히 일치해야 한다.

- 전체 joint 설정, named DOF / bounds, seed / sample count / case cap / pivot / members.
- nominal / sample의 comparison class와 evaluator, model η tolerance.
- Input / Output Mode와 Port contract / world frame, wavelength.
- routing position / angle tolerance, part / space / keep-out criteria, total count와 clearance.

Common Port 공차만 활성화하면 optical component 개수가 달라도 같은 sample을
적용할 수 있다. Individual Assembly 공차가 활성화되면 실제 component ID와 축이
coverage에 포함된다. 서로 다른 부품을 임의의 slot으로 재명명하지 않는다. 삭제된
mating member나 미지원 nested moving component는 미평가 사유를 남긴다.

Gaussian analytic evaluator와 Prism angular-spectrum evaluator는 같은 polarization
class라도 별도 Group이다. Group 간 global winner나 공동 순위를 만들지 않는다.
정렬은 Group key에 대해 결정적이며 각 Group 안에서는 complete / feasible 후보를
먼저 보존한다. partial, geometry-failed, budget-unassessed 후보에는 rank가 없다.

순위는 **관측 최소 η** 기준이다. 수치적으로 구분되지 않는 값은 같은 rank band로
표시한다. analytic Gaussian의 numerical comparison floor는 `1e-10`, Prism은
D2.2.1 evaluator의 선언된 empirical model η tolerance `2e-4`를 그대로 사용한다.
두 평가 간 개선 인정에는 tolerance의 2배를 넘는 차이가 필요하다. 이는 empirical
model tolerance이며 실물 성능의 신뢰구간이나 오차 보증이 아니다.

## 탐색에 들어가는 위치

1. 기존 nominal generation / bounded Lens fitting으로 Mode-qualified 후보를 찾는다.
2. 후보 pool을 줄이기 **전에** joint assessment를 수행한다. 동일 Project 평가는 cache한다.
3. 같은 Group에서 관측 최소 η가 좋은 recipe를 우선하고, Group 사이에는 round robin으로
   route 재탐색 기회를 배분한다. 비교 가능한 평가가 없으면 nominal 탐색을 이어가되
   joint-guided 성과로 기록하지 않는다.
4. 생성 / 기존 recipe의 nominal-qualified Lens 후보를 시작점으로 bounded coordinate
   refinement를 수행한다. 각각의 실제 S1 / S2 / thickness / longitudinal position을
   bounds 안에서 바꾸며 새 field / geometry / joint 평가를 실행한다. 같은 Group에서
   nominal 조건을 유지하고 해상도보다 큰 joint 개선이 있을 때만 이동을 채택한다.
5. 최종 후보를 Group별로 표시한다. 결과를 뒤에서만 정렬하는 post-processing이 아니다.

Lens refinement는 서로 다른 최대 2개 recipe, recipe당 최대 32개 trial이다.
normalized step은 `1/1024`, `1/4096`, `1/16384`이며 full Surface / interval locks,
material / aperture / Mode / Port와 constructor replay 규칙을 유지한다.
전역 robust optimum / joint worst-case / Yield를 주장하지 않는다.

## 계산 예산과 취소

기존 nominal optical budget과 geometry budget은 증가시키지 않는다. joint mode에서는
기존 optical budget의 최대 64개(또는 25%)를 continuous joint refinement에 남겨 둔다.
joint forward solves는 별도 `jointBudget`(기본 2048)에서 nominal 재확인 1회와 실제
sample solve마다 세며, 초기 60% / route 20% / Lens 20% 단계 한도를 적용한다.
cache hit은 새 solve로 세지 않는다. 하나의 요청 batch를 평가할 예산이 없으면 시작하지
않고 unassessed로 표시한다. case cap에 의한 partial도 순위가 없다.

D2.3.1과 synthesis는 `jointAssessmentSteps` generator를 공유한다. 각 sample 전에
yield하여 async UI가 취소할 수 있다. 취소하면 Preview를 폐기하며 Project는 바꾸지 않는다.
설정/Project 변경 시 stale, recipe/values/Port/locks 변조 시 Apply 거절을 유지한다.

## 검증 근거

`tests/jointFeedback.test.ts`:

- 실제 Mirror / Prism 생성 후보: 같은 common Port sample에서도 evaluator가 다른 후보는
  별도 Group. 0.8 mm target displacement의 collimated Mirror 경로에서 nominal η가
  조금 낮지만 joint 관측 최소 η가 높은 route를 선택·개선하는 것을 검증한다.
  unfolding한 free-space Gaussian 적분식으로 nominal / joint η를 독립 대조한다.
- 기존 두 Lens 설계: Input / Output을 유지하면서 Y=3 µm, Z=2 µm joint samples의
  관측 최소 η를 개선한다. nominal size / phase / η 목표를 유지하며 별도 coaxial
  physical Gaussian solver로 변경된 설계의 worst sample을 대조한다.
- strict optional state / JSON roundtrip / deterministic repeat, comparator transitivity,
  coverage / field / Mode / geometry context 분리, partial·geometry failure·예산 소진,
  Prism 해상도보다 작은 변화, 미지원 tilt, cancel / stale / tamper / Apply를 검사한다.

`e2e/jointFeedback.spec.ts`: offline desktop / mobile의 grouped results, read-only Preview,
actual Prism Apply, Undo / Redo / SaveLoad, unranked budget와 stale guard를 검증한다.
기존 전체 model / browser 회귀 및 최종 HTML / manifest / CI hash 일치를 release gate로 둔다.

## 남은 단계

D2.3.3은 **Sol Work 권장**: 검증된 joint 결과와 provenance를 Analysis / Report에
연결하고 stale 상태와 비교 범위를 일관되게 표시하는 작업이다. 모델 확장 없이 UI /
state / export 연결을 중심으로 진행한다. Lens 비축 decenter / tilt의 forward domain
확장은 별도 독립 물리 benchmark가 필요하므로 그 단계는 Astra로 다룬다.
이번 D2.3.2의 새 PR 병합이나 D2.3.3은 사용자 지시 후 진행한다.
