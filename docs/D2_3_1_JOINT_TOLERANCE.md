# D2.3.1 — 공통 체결 변위와 개별 조립 공차의 joint assessment

Version: `0.14.0-d2.3.1`. Base: main `7142817` (D2.2.2, PR #22).
이번 checkpoint는 현재 설계의 joint assessment까지다. D2.3.2 후보 비교 /
optimizer feedback와 D2.3.3 Analysis / Report 연결은 구현하지 않는다.

## 저장 계약과 좌표

기존 strict Design Problem v1에 optional `jointTolerance` v1을 추가한다.
기존 파일의 의미와 OAT 설정은 바뀌지 않는다. UI에서 처음 열면 Output Port만
common group으로 선택하고 현재 Output 위치를 pivot으로 제안한다. Save Problem
Settings를 누르기 전까지 Project는 변하지 않는다. 단위는 SI이며 입력 UI만 µm / °다.

| 항목 | 의미 |
|---|---|
| Common mating group | 명시적으로 선택한 Input / Output Port 및 leaf optical Assembly 집합. 암묵적인 target-side 추론 없음 |
| Common position | world XYZ ±한계, pivot의 world translation |
| Common angle | world axes에 대한 extrinsic X → Y → Z, 행렬 `Rz Ry Rx`; Euler 값 덧셈 아님 |
| Pivot | 저장된 world 좌표. `x' = pivot + translation + R (x − pivot)` |
| Individual Assembly | 각 leaf optical Assembly의 nominal local XYZ / 회전축, 원점 기준 변환. 부품별로 다른 sample 좌표 사용 |
| 적용 순서 | 각 Assembly local error → common group의 같은 rigid transform |
| Port | group에 포함되어야 common transform 적용. Assembly residual을 Port에 암묵적으로 적용하지 않음 |
| Locks | nominal 설계 변수 제한. 물리 공차를 자동 0으로 만들지 않음 |

Surface rows, body 치수, Mode, wavelength와 비선택 Assembly는 보존한다.
Output이 optical leaf Assembly를 공유하면 Output의 선언된 world Pose를 별도로
보존/변환하여 parent 변위가 이중 적용되지 않게 한다. 변환에는 부모 frame을 사용하되
ancestor를 수정하지 않는다. optical component 자체가 자식을 가지면 해당 부품을
움직이는 공차 설정은 거절한다. 삭제된 group member도 거절하며 UI에서 해제할 수 있다.
임의 nested moving group / assembly 간 covariance matrix는 이번 범위 밖이다.

## Sampling과 판정

`joint-rigid-scenarios/1.0.0`은 모든 활성 DOF의 −한계 / +한계 두 corner와,
나머지 N−2개의 각 축 stratified midpoint를 사용한다. 축 이름과 seed로 고정한
xorshift32 / Fisher–Yates permutation으로 각 축을 조합한다. named DOF의 순서는
component ID 정렬로 안정화하며 같은 Project / 설정 / seed는 같은 sample을 만든다.
N은 4–256, 별도의 case cap은 1–256이다. 공차가 모두 0이면 nominal만 기록하고
not-assessed로 표시한다. cap / 취소는 incomplete다.

이는 분포 없는 결정론적 scenario design이다. 두 corner가 모든 corner를 대표하지
않고, stratification도 모든 조합을 덮지 않는다. 샘플의 통계적 독립성, Gaussian /
uniform 생산 분포, 실측 상관관계, Yield나 joint worst-case 보장을 주장하지 않는다.
Common group의 강체 일관성만 명시적으로 모델링한다.

각 sample은 공통 `tensorOverlap`과 route / part / space / keep-out / clearance
검사를 통과한다. Mode 평가와 geometry 판정은 별도다. η가 있어도 geometry가
실패할 수 있다. 기존 curved Lens centered-normal 조건, Prism/TIR의 좁은 phase-only
domain, aperture / reference field 제한을 그대로 지킨다. Lens transverse decenter /
tilt forward domain은 이번에 넓히지 않았다.

- `assessed`: nominal과 요청한 모든 sample의 field가 같은 comparison class에서 평가됨.
- `partial`: cap, field 미평가 또는 comparison class 불일치.
- `meetsSampleGoals`: complete field assessment + nominal / 모든 geometry 통과 +
  nominal 포함 관측 최소 η가 선언 threshold 이상. nominal reference matching이나
  robust optimum 인증으로 사용하지 않음.
- η 미평가는 null과 이유를 남기며 0 / 성공으로 대체하지 않음.
- 관측 최소 η에는 nominal도 포함되며 partial일 때 그 한계를 표시함.

Result는 engine, 전체 input signature, settings, evaluator / 축 선언 / sampling 설정의
coverage, nominal과 sample별 η / geometry / domain을 보유한다. UI는 Project /
Problem / Routing 설정 변경 시 stale로 표시한다. 결과 자체는 transient이며 설정만
Project에 저장된다. 후보 ranking / Apply / OAT는 변경하지 않는다.

## 검증

`tests/jointTolerance.test.ts`의 독립 행렬 기준은 pivot, 비정렬 parent, local 후 common
순서, Port 공유 / 중복 변위 방지와 nominal 비변경을 검증한다. Mirror 및 bounded
two-Prism 경로의 전체 rigid motion에서 조건부 overlap 불변을 검사한다. free-space
두 Gaussian waist의 독립 적분식과 동시 XY displacement를 비교하고 OAT와 다른
관측치를 확인한다. strict SI roundtrip, seed 재현, strata, bounds, 무공차, cap,
cancel, 미지원 Lens decenter / tilt, reference 누락, geometry 실패도 검사한다.

`e2e/jointTolerance.spec.ts`는 offline desktop / mobile에서 read-only assessment,
partial / stale, 설정 SaveLoad, Undo / Redo, cap / cancel / Escape를 검증한다.
기존 model / browser 회귀와 standalone source fingerprint / HTML hash는 release
manifest 및 PR CI 결과로 대조한다. test 개수는 제품 완성률이 아니다.

## 사용자 확인

1. 새 실행 HTML을 열고 기존 설계를 선택한다. 빈 설계는 New Physical Project 후
   Output에 Apply SMF 1310 Reference를 명시적으로 적용한다.
2. Design Problem → Joint Tolerance에서 group / pivot을 확인하고 Samples를 8로 설정한다.
3. Assess Joint Tolerance로 nominal, field coverage, geometry와 sample 이유를 확인한다.
4. Lens가 있는 설계에서 Individual Assembly position Y를 1 µm로 바꾼다.
   stale → 재평가 후 미지원 curved refraction의 partial 표시를 확인한다.
5. Save Problem Settings → Close → Save Project JSON / Undo / Redo로 설정 보존을 확인한다.

## 다음 checkpoint

D2.3.2는 Astra Work 권장: 같은 물리 domain과 coverage의 후보만 비교하고
joint merit를 bounded topology / 연속 탐색에 연결해야 한다. 미평가 sample이 많은
후보가 유리해지지 않도록 비교 계약부터 검증한다. 필요한 Lens decenter / tilt domain
확장은 별도 독립 forward benchmark gate를 먼저 통과시켜야 한다. main 병합과 다음
checkpoint는 사용자 지시 후 진행한다.
