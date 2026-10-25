# Automatic Synthesis — 제품 경로와 exit gates

상태: D2.0 계획 checkpoint, 2026-10-25 KST. **아래 D2.1 이후는 계획이다.**
[복구·소스 근거](D2_RECOVERY_AUDIT.md) · [탐색 계약](D2_AUTOMATIC_SYNTHESIS_CONTRACT.md) · [다음 구현 지시문](D2_NEXT_TASK.md)

## 제품의 중심

Input Mode → 실제 optical train → Output Reference Mode의 정합을 설계한다.
PC에서 Port 위치·방향·Mode, 허용 부품/공간/제조 조건을 정의하면 부품이 없는
Project에서도 광학계를 생성하고, 형상/배치를 조정하며, 명목 성능을 만족하는 후보의
정렬·조립·탈착 오차를 비교할 수 있어야 한다. 사용자는 후보를 직접 편집하고 다시
설계할 수 있다. Gaussian/Surface/Report는 같은 Project를 사용한다.

4개 Surface는 초기안이다. 명시한 lock 이외의 count/type은 지원 family 안에서
변경할 수 있다. 미지원 면을 지워서 몰래 지원되는 문제로 바꾸지 않는다.
Example 확대나 보고용 그림만으로 설계 기능을 대체하지 않는다.

## 현재 지원 matrix

| 기능 축 | D1 실제 수준 | 다음에 넘어야 할 gate |
|---|---|---|
| Project/Ports/편집 | SI, local/world, Surface Data, Component, Dock/Float, Save/Load, Undo | 새 topology의 실제 geometry도 같은 계약 유지 |
| Surface/Ray | finite body, Snell/reflection/TIR, Sphere/Plane/Even Asphere 기반 | 새 family마다 geometry와 forward 성능을 함께 검증 |
| Mode 평가 | 직선 B1 scalar overlap; folded tensor Q reference | fold의 Output frame/phase/offset/tilt를 포함한 독립 overlap 검증 |
| 자동 구성 | fixed Lens prefix route 5종; 기존 1/2 Lens fitting; 두 번째 Lens 조건부 추가 | 첫 Lens 생성, 부품/배치/형상 공동 탐색 |
| 공차 | retained nominal 후보 OAT; 미지원 coverage 명시 | 공동 오차, 공통 rigid-body, optimizer feedback, 통계 가정 |
| Report | 실제 3D+linked inset, 치수/간격/beam reference | 후보 비교·평가 domain·오차·provenance 연결 |
| 실무 검증 | 모델별 reference test와 UI regression | 독립 계산/측정과 비교, 제조 조건 및 convergence 기록 |

진행률 %를 만들지 않는다. 테스트 개수는 검증 근거이며 제품 완성률이 아니다.

## 전체 개발 순서

기존 [P0–P6 roadmap](DEVELOPMENT_ROADMAP_V1.md)과
[Unified/Freeform 계획](UNIFIED_WORKSTATION_AND_FREEFORM_PLAN.md)을 보존한다.
D-series는 그 위에 자동 설계의 통합 순서를 더한다. P3/W1 전체가 끝나야만 제한된
자동 합성을 시작하는 방식도, geometric route만으로 Mode 설계 완료라 하는 방식도
택하지 않는다. 검증된 evaluator와 지원 family의 교집합을 단계적으로 넓힌다.

| Checkpoint | 실제 사용자 결과 | Exit gate / 기존 경로와 관계 |
|---|---|---|
| D2.0 — 이번 | 현재 수준·남은 차이·전체 계획·다음 한 단계가 분명함 | remote/tree/CI/실행파일 보존 확인, source audit, 계약/다음 작업 저장. 엔진 구현 없음 |
| D2.1 — 다음 한 단계 | 빈 Project에서 Lens와 planar Mirror 광학계를 한 action으로 생성·수정·Mode 평가; Prism 후보의 지원 한계 표시 | 5 mm offset 수직 slice, 0/1/2 Lens 생성, 제한된 route 조합, 새 folded conditional Gaussian overlap 독립 검증, Preview/Apply/Undo. 초기 OAT는 coverage와 함께 비교. P4의 제한된 통합 slice |
| D2.2 — 탐색/평가 확장 | Prism을 포함한 더 넓은 후보와 editable 초기 train을 일관된 Mode 기준으로 비교 | TIR phase/polarization/critical-angle domain 정리 및 검증, 추가 Lens segment allocation, aperture/body/manufacturing bounds 탐색 확대, lock가 있는 route subproblem. 지원 조합을 명시적으로 증가 |
| D2.3 — 강건 설계 | nominal Mode 목표를 통과한 여러 구조를 오차 민감도로 실제 개선 | decenter/tilt forward domain 확대, 공통 mating rigid-body와 개별 조립 오차 구분, joint samples, coverage가 같은 후보의 robustness merit를 topology/연속 최적화에 feedback. P5의 초기 통합 |
| D3.1 — Parabolic Mirror | reflector family를 직접/자동 설계에 사용 | 기존 Conic sag 재사용 가능성 확인 후 curved reflection의 tangential/sagittal power와 off-axis validity·독립 기준 검증. K=-1 형상 입력만으로 완료하지 않음 |
| D3.2 — Asphere / 필요한 Microlens | 고차 형상 및 소형 Lens 후보의 실제 Mode 이점 검토 | Asphere phase/aberration 평가, finite aperture와 제조 제약. 단일 Microlens와 MLA를 구분; array는 후속 채널 gate |
| D3.3 — 제한된 Freeform / field | 허용 basis/bounds 내 Freeform을 성능 기준으로 비교 | XY basis/control/grid import 계약, 실제 field/phase/OPD 및 diffraction, sampling/convergence·정규화·독립 benchmark. F2/A1/W1과 연결 |
| D4 — Engineering single-channel release | 재현 가능한 후보 비교/공차/보고를 실제 설계 판단에 활용 | 주요 family의 선언된 domain, benchmark golden projects, 설계·제조 조건, normalized overlap/전달광량 분리, measurement comparison, 사용자 업무 검토. I1/P3/P4/P5의 통합 |
| D5 — Multi-channel / 보정 | Fiber Array와 PS Port 배열, 공통/개별 오차 비교 | 채널별 Mode/매핑, 공통 datum, crosstalk는 모델이 있을 때만, 측정 기반 보정. P6 |

D2.2 이후 번호는 방향을 고정한 계획이며 각각 시작 시 한 checkpoint의 범위를
다시 제한한다. 독립 물리 benchmark가 막히면 중간 checkpoint를 추가할 수 있다.
Parabolic/Asphere/Freeform을 일정 편의로 삭제하거나 모두 D2.1에 넣지 않는다.
단일채널 실무 완료와 배열 확장은 별도 gate다.

## D2.1을 어디까지로 볼 것인가

빈 Project → Output SMF reference 명시 → 공간/부품 제한 → 자동 후보 → 조건부
scalar Gaussian Mode 정합 → 실제 형상 Preview/Apply/Undo가 첫 목표다.
직선/planar Mirror 경로가 수치 평가의 필수 gate다. Prism/TIR은 이번에 geometry와
Gaussian reference 후보로 연결하되 η는 미평가로 남긴다. 따라서 D2.1은 **Lens/Mirror
자동 합성의 첫 Mode 평가 checkpoint와 Prism reference 통합**이며, 모든 family의
성능 통합이나 강건 설계 완성이 아니다.

핵심 5 mm 사례의 Lens 2개+Mirror 2개는 검증 family 중 하나다. 모든 입력에 동일
구조를 넣지 않는다. 부품 최소 수를 만족시키기 위해 Mode 조건을 버리지 않으며,
부품을 늘릴 때는 사용자의 total/new/per-kind 상한을 함께 적용한다.

## 강건 설계의 우선순위

초기부터 후보 provenance, tolerance assumptions, coverage, family 다양성을 보존한다.
nominal 목표를 만족한 뒤 **동일한 평가 coverage에서** robustness를 우선 비교한다.
D2.1의 OAT 관측 최소 η는 joint worst case나 Yield가 아니다. 미지원 공차가 많은
후보가 유리하게 순위에 오르지 않게 partial 후보를 별도로 표시한다.

D2.3에서 common rigid-body / local assembly / remating 조건을 분리하고, shared
perturbation set으로 robust objective를 계산하여 topology와 연속 변수에 feedback한다.
분포·상관관계가 정해지고 검증되기 전에는 통계 Yield를 출력하지 않는다.

## 실무 완료 판정

허용 조건에서 검증 가능한 후보를 탐색하고 성능·잔여 오차·모델 가정·탐색 범위를
설명하며, 실제 설계자가 수정/비교/재현/보고하고 독립 계산 또는 측정과 대조할 수
있으면 해당 domain의 실무 gate를 검토한다. 모든 임의 입력에서 해를 보장하거나
한 개의 overlap 최고점만 보여주는 것은 완료 기준이 아니다.

각 구현 checkpoint는 source/manifest, 검증된 standalone HTML, Draft PR,
New Physical Project부터의 사용자 확인 순서로 마친다. 사용자 승인 없이 다음
checkpoint 구현이나 main 병합을 진행하지 않는다.
