# D2 — Automatic Synthesis architecture contract

D2.0 설계 계약, 2026-10-25 KST. **아래의 새 schema·adapter·engine은 미구현이다.**
기술 용어는 English, 설명은 한국어로 작성한다.

> 상태: 계획 계약. D1 동작을 변경하지 않는다. 아래 D2.1 제안은 사용자 구현 지시 후에만 개발한다.

[소스 audit](D2_RECOVERY_AUDIT.md) · [전체 roadmap](AUTOMATIC_SYNTHESIS_ROADMAP.md) · [D2.1 범위](D2_NEXT_TASK.md)

## 1. Canonical problem과 데이터 소유권

`Project.model.prescription`의 Ports/Surfaces/Assembly frames와 Bodies, wavelength,
`model.sourceMode/targetMode`, `authoring.ports`가 유일한 광학 입력이다.
`Project.routing`은 Design Space, Keep-out, per-kind limits, position/angle tolerance의
canonical 소유자다. synthesis 설정에 그 값을 중복 저장하지 않는다.

기존 `Project.designProblem` v1은 `lens|route` 의미와 strict parser를 유지한다.
권장 확장은 optional strict `Project.synthesis.version=1`이다. 기존 Project를 읽을 때
이 필드를 자동 주입하지 않는다. 이 확장은 후보 family/제조 범위/탐색 예산/수용 목표와
새 결과 provenance를 소유한다. D1과 D2에서 공통인 total/new limits·Surface locks·OAT
설정은 기존 `designProblem`을 참조한다. 저장 시 두 설정의 reference/ID를 검증한다.
두 개의 별도 lock 목록이나 tolerance 값이 생성되지 않게 한다. D1 설정만 저장한 파일의
동작은 그대로다. Draft에서 준비한 전체 설정은 하나의 Project transaction으로 저장한다.

| Problem 항목 | 소유 / 처리 |
|---|---|
| nominal 고정 Input/Output pose·Mode·phase·medium | Project의 기존 값. 탐색이 이동/재정의하지 않음 |
| full-Surface lock / total / new-replacement / OAT | `designProblem` v1 재사용. 없는 경우 modal draft에서 명시적으로 준비 |
| per-kind limits / 공간 / Keep-out / geometric tolerances | `routing` 재사용 |
| family enable / material 후보 / aperture·body·curvature·thickness 범위 | 새 synthesis 설정. 제조 가정의 출처/단위 표시 |
| exact interval freeze | 기존 Lens variable bounds 재사용 가능한 ID에는 유지. 교체 대상의 Min=Max 변수는 해당 component를 보존해야 하는 조건으로 해석 |
| 추가 per-parameter lock / arbitrary freeform variables | 후속 version. 이번에 v1에 숨겨 넣지 않음 |

Port는 nominal 탐색에서 고정되지만 tolerance 평가에서는 가정한 오차를 받을 수 있다.
설계 lock와 조립 오차 0은 서로 다른 개념이다. Port는 optical part count에서 제외한다.
`maxGenerated`는 순증가가 아니라 baseline에 없던 new/replacement component ID 수다.

full-Surface lock는 paired Lens/Assembly와 ancestor, 관련 Body까지 보수적으로 고정한다.
D1보다 lock 범위를 축소하지 않는다. ID 재사용으로 교체 수를 숨기지 않는다. 미지정
Surface의 변경은 허용 family에 한하며, 미지원 optics·hierarchy를 임의 삭제하지 않는다.

## 2. 탐색 구조와 기존 kernel

다음은 데이터 흐름이며 구현된 새 함수명이 아니다.

1. **Preflight**: 원본 signature와 draft 설정, Port/Mode/medium, lock closure,
   허용 family/부품/공간/제조 범위를 확인한다. field 미정의와 geometry 미지원은 분리한다.
2. **Topology proposals**: 빈 train 또는 수정 가능한 기존 train에서 Direct/planar
   Mirror/정의된 TIR Prism route와 0/1/2 Lens allocation을 생성한다. source-target
   방향과 실제 segment를 사용한다. fixed-anchor subproblem은 지원할 때만 처리한다.
3. **Physical construction**: 실제 S1/glass/S2, material, finite Body, aperture, frame,
   sequential order를 canonical Project clone에 생성한다. Lens를 먼저 수동 추가하지 않는다.
4. **Continuous fitting**: 각 topology에서 위치·곡률·두께를 bounded fitting한다.
   centered-normal Lens는 실제 chief segment에 정렬하고, arclength를 world X로 바꾸지 않는다.
5. **Forward evaluation**: 아래 공통 결과 계약으로 geometry/beam/overlap/loss를 평가한다.
6. **Feedback / retention**: optical merit, residual, aperture 및 지원되는 OAT 정보를
   다음 placement refinement와 예산 배분에 돌려준다. family별 후보를 보존한다.
7. **Preview / Apply**: 공통 Project를 읽는 기존 View로 보여주고, 재구성/재검증 후 한 번 적용한다.

재사용: `routing/search.ts`의 analytical closure/build/finite checks,
`lens/domain.ts`의 pair 검증/build/frozen signature, `lens/search.ts`의 analytic seeds,
Q merit와 bounded optimizer, 두 Gaussian evaluator, clearance 및 Surface kernel.
내부 `proposals/build`는 현재 private 함수이므로 적절한 경계로 분리해야 한다.
기존 S2/S3.2 public adapter와 테스트는 유지한다.

D1 `runProblem`의 두 adapter를 차례로 호출하고 UI 버튼만 하나로 바꾸는 것은
완료가 아니다. 0-Lens constructor, fold 뒤 Lens allocation, 공통 budget, 검증된
folded Mode metric 및 **Mode 기준의 route placement 재방문**이 필수다.
기존 geometry 상위 8개만 받아 한 번 Lens fitting하고 끝내면 탐색 통합 gate를 통과하지 못한다.

D2.1 최소 feedback은 같은 closure family의 route placement 이웃을 다시 생성하고
각각 Lens를 재구성/재 fitting하여 실제 Mode metric으로 비교하는 것이다. geometry
제약·lock를 매번 확인한다. 완전한 simultaneous/global optimum이라 부르지 않는다.

## 3. D2.1 family와 forward domain

| 후보 family | 생성/조정 계획 | D2.1 수치 결과의 허용 범위 |
|---|---|---|
| Direct + 0/1/2 Lens | 빈 train 생성, 기존 알려진 Lens 유지/교체/추가 | 지원 시 B1 또는 검증한 tensor overlap; geometry와 Mode 모두 비교 |
| 1/2 planar Mirror + 0/1/2 Lens | 0-Lens route seed, 첫/마지막 free-space segment의 Lens allocation, route placement feedback | centered-normal Sphere/Plane Lens와 ideal planar scalar Mirror 조건부 Gaussian overlap. 1 Mirror가 해당 Port 조건에서 불가능하면 강제 생성하지 않음 |
| TIR Prism / Mirror+Prism + 0/1/2 Lens | 기존 normal-entry/exit BK7 family를 같은 생성 파이프라인에 연결 | 실제 finite ray/TIR 검사, Q reference/size/phase만. **η 미평가 / model-limited**. 일반 Mirror 후보와 Mode 우열을 판정하지 않음 |
| Parabolic / Asphere departure / Freeform / array | 이 checkpoint의 자동 생성 대상 아님 | 모델 미지원 사유와 후속 gate 표시 |

Lens count 0은 reference baseline이나 부품 제한을 검토하는 합법적인 후보다. overlap이
낮으면 잔여 오차로 남긴다. Lens는 S3.2의 fixed/centered-normal domain을 재사용하며,
Material/aperture/body는 명시한 유한 범위의 제조 후보로 생성한다. 소형 Mirror 기본
Clear Radius 20 µm를 mm-scale 문제의 유일한 가정으로 재사용하지 않는다. bounded
size seeds를 비교하고 실제 beam footprint/tail/body clearance로 검증한다. 연속 aperture
최적화와 arbitrary Lens segment allocation은 D2.2 확장이다.

공통 회전/translation, skew Port 조건의 geometry 생성도 검토하되 field domain 밖이면
그 이유를 보존한다. D2.1의 finite template 탐색이 모든 Port 방향을 보장하지 않는다.

## 4. 새 conditional scalar Gaussian overlap gate

이 기능은 현재 없다. folded Q reference에 효율 라벨만 붙이지 않는다.
새 adapter는 complex symmetric 2×2 Q와 beam transverse frame, Output reference
plane/frame, centroid, relative first-order slope, wavelength/medium을 받는다.
두 정규화 complex Gaussian field를 **동일한 Output transverse 좌표계**에 표현하여
복소 내적의 절댓값 제곱을 계산한다. Roll/ellipse rotation, cross-phase와 curvature,
Offset–Tilt cross term을 보존한다. scalar co-polarized 가정을 항상 표시한다.

필수 독립 검증:

- 동일 Mode η=1, 전파/회전/반사 parity 및 unfolded equivalent의 일치.
- separable/coaxial 영역에서 기존 B1의 logη와 일치; 기존 solver 수치를 바꾸지 않음.
- rotated elliptical/cross-phase/offset/tilt 케이스를 독립 수치 complex quadrature와 비교.
- 수치 적분 window/grid 확대로 normalization과 η 수렴 확인. production analytic kernel
  자체를 그대로 복제한 테스트를 독립 근거로 쓰지 않음.
- plane/frame 변환 및 phase convention을 명시. source/target가 다른 medium/정규화·phase
  미정의/TE-TM 불일치/미지원 tilt이면 η=null와 reason.
- 수치 안정성을 logη로 유지. roundoff만 제한적으로 처리하고 큰 positive logη를 clamp해 숨기지 않음.

최초 nominal Lens fitting은 기존 normal Output incidence ≤10 µrad domain을 유지한다.
평가 adapter의 small slope ≤50 mrad first-order proxy는 독립 검증된 경우에만 사용한다.
이는 exact rotated-facet diffraction이 아니다. intrinsic divergence ≤0.1 rad,
centered-normal curved encounter, 2w/|R|≤0.2, 누적 aperture tail ≤0.1% 등 기존 gates를
완화해서 성공 후보를 만들지 않는다.

Planar Mirror 결과는 ideal scalar reflection을 가정한 **conditional normalized Mode
shape overlap**이다. coatings/polarization/Fresnel/absorption/aberration/clipping diffraction은
미포함이다. Prism의 TIR phase/angular-spectrum 효과는 다음 gate로 남겨 η를 보류한다.
Aperture-limited 후보는 reference plot만 가능하며 Mode-qualified로 표시하지 않는다.
PIC MFD는 사용자 Gaussian reference다. 실제 PIC receiving complex field/eigenmode가
없으면 device coupling을 계산했다고 표시하지 않는다. D2.1 필수 성공 검증은 SMF→SMF다.

## 5. 공통 forward 결과와 실패 분류

각 sub-result는 `evaluated | invalid | unsupported | undefined`와 reason 및 domain을
별도로 가진다. 성공 boolean 하나로 geometry와 optics를 합치지 않는다.

| 결과 묶음 | 값 / 의미 |
|---|---|
| Geometry | actual chief path, position/incidence residual, finite body, part/space/Keep-out/clearance |
| Beam reference | Q, frames, radii/phase, path length/OPL, aperture tail, model warnings |
| Mode | conditional η/logη, target reference, offset/tilt/size/phase residual, eligibility |
| Loss ledger | Transmission / normalized Mode overlap / total coupling 별도. 미모델 항목은 null |
| Tolerance | error definitions, planned/tested/field-assessed/geometry-passed, observed minη, coverage/reasons |
| Provenance | input/settings signature, engine/adapter version, topology/parameters, bounds, budget/seed, warnings |

Run termination은 `completed | budget-exhausted | cancelled | unsupported | invalid-input`
으로 분리한다. 후보 상태는 `nominal-qualified | partial | model-limited` 등으로 별도 둔다.
constraint rejection은 종류별 count와 대표 사유를 기록한다. preflight에서 모순이 확인된
경우와 유한 탐색에서 feasible 후보를 못 찾은 경우를 구분한다.

`budget-exhausted`에도 best tested 후보와 잔여 오차를 보존할 수 있다. cancelled는
session 후보를 버리고 Project를 쓰지 않는다. 미정의 field를 0%로, 미지원 coverage를
pass로, search no-candidate를 global infeasibility로 대체하지 않는다.

## 6. Candidate comparison과 robustness

먼저 hard geometry/manufacturing 제약을 통과해야 한다. 다음 nominal Mode 목표 통과를
구분한다. 목표 통과 후보 사이에는 **비교 가능한 coverage의** OAT observed minη와
민감도를 우선하며, 그 다음 parts/footprint/path 등을 비교한다. 목표 미달 후보는 residual
개선용으로 보존하되 성공 후보로 부르지 않는다. η 미평가 Prism은 별도 reference-only
목록에 두고 수치 평가 후보와 같은 scalar score로 정렬하지 않는다.

새 candidate pool은 optical mode/size/phase/tail와 family·placement 다양성을 보존한다.
초기부터 nominal 최고 한 개만 남겨 robustness 탐색 가능성을 없애지 않는다. OAT는
D1의 Port/leaf semantics를 보존한다. unsupported Lens decenter/tilt 등이 남으면 partial이다.
zero tolerance와 capped cases도 robust pass가 아니다. 같은 assumed perturbations에서
계산 가능한 OAT 지표만 placement 예산 배분 feedback으로 쓸 수 있다.

D2.1에서 모든 error DOF가 평가되거나 combined errors가 최적화된다고 약속하지 않는다.
D2.3에서 common rigid-body + local errors, joint sampling, robust objective feedback을
실제 구현/검증한다. 분포/상관/seed/sample count/신뢰구간 없이 Yield를 만들지 않는다.

## 7. 예산과 PC 실행

D2.1 초기 engineering cap 제안: geometry proposal 평가 ≤128회, nominal full optical
평가 ≤8192회, 후보 보존 ≤8개, OAT는 후보당 기존 maxCases(기본128/최대256)를 따르며
전체 tolerance 평가 cap도 ≤1024회로 둔다. 이 값은 성능 보장이 아니라 runaway 방지
정책이다. field와 geometry count를 숨기거나 nested optimizer가 전역 cap을 넘지 않게 한다.

family별 최소 탐색 기회를 배정한 뒤 Mode/coverage 지표로 잔여 예산을 재배분한다.
OAT cap이 걸리면 후보별 requested/tested coverage를 공개한다. deterministic 순서와
bounds를 기록한다. local Lens 호출의 기존 max4096 cap도 준수한다. 다른 cap이 필요하면
측정한 비용·탐색 실패 근거와 함께 checkpoint 문서에 변경 이유를 남긴다.

cooperative yield/cancel을 기존 async 구조에 연결한다. UI 편집/camera/theme이 무거운
solve를 반복하지 않게 한다. 평가 수·진행 단계·경과 시간을 표시한다. Worker/backend는
반응성 측정이 필요성을 보일 때 검토하며 D2.1에 필수 외부 서비스나 AI API를 추가하지 않는다.

## 8. Preview / Apply / persistence

Preview는 baseline과 candidate clone만 읽는다. optical geometry를 report 전용으로
다시 만들지 않는다. 최종 선택 후보는 actual Surface/3D/Gaussian/Report에서 같은
prescription, Body와 beam result를 사용한다.

Apply는 exact baseline/settings signatures, engine versions, ID allocation, lock closure,
계수/부품 bounds를 다시 확인하고 proposal parameters로 Project를 재구성한다. 원본을
고친 candidate JSON/저장된 score를 그대로 신뢰하지 않는다. forward/clearance를 재실행하여
현재 domain과 residual을 확인한 뒤 shared Store.replace 한 번으로 적용한다. Undo 한 번,
Redo/SaveLoad/Report 일치를 검증한다. stale/tampered/cancelled 결과는 거절한다.

partial/reference-only 후보를 사용자가 편집할 수 있도록 적용하는 경우에도 미달/미평가
표시를 유지한다. 자동으로 성공 라벨을 부여하지 않는다. geometry-invalid 후보는 적용하지 않는다.

saved provenance는 engine/input fingerprint·seed/bounds/evaluated counts·선택 topology를
기록한다. 저장한 성능값은 인증서나 live 결과가 아니다. 후속 편집은 stale로 만든다.
raw samples/대량 후보는 Project 안에 영구 중복 저장하지 않는다. Report export에는 현재
평가 scope·가정·버전과 실제 치수/경로를 포함한다.
