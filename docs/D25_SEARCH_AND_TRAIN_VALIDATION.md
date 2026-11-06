# D2.5 · 작은 offset 탐색과 두 Lens differential 검증

Version: `0.25.0-d25`. Recommended model: **Astra**.

## 해결한 문제

D2.4에서는 Lens의 편심·tilt 보정이 가능해졌지만, 모든 symmetric seed 다음에 asymmetric seed를 검사했다. 작은 Local fit budget에서는 시작 형상 검사만으로 예산을 소진해 Nelder–Mead 정밀 조정을 시작하지 못했다. 예시 01의 100 µm offset은 Optical 2048 / Geometry 32 / Local fit 256에서 qualified 후보가 없었다.

이번 변경은 각 axial seed마다 symmetric, front/rear power 분배 0/1/0.25/0.75를 번갈아 배치한다. Alignment가 활성화되면 초기 검사 상한을 `min(budget, max(12, min(128, floor(budget/3))))`로 제한하고 남은 예산으로 기존 두 multistart simplex를 실행한다. 원래 형상을 항상 먼저 검사한다. 작은 budget에는 정밀 조정 여유가 부족할 수 있다. 모든 seed나 모든 배치를 검사한다는 뜻은 아니다.

Optical / Geometry / Local fit 기본값과 physics gate는 그대로다. Thin-lens seed는 시작 추정일 뿐이며, 후보는 실제 paired Sphere/Plane, glass thickness, bounded chief 보정, Gaussian validity, aperture, geometry/clearance와 Mode 목표를 모두 다시 검사한다. Input·Output Port와 frozen 조건은 움직이지 않는다.

Local fit가 소진되거나 계획한 fit를 모두 시작하지 못한 경우도 최종 `budget-exhausted`에 반영한다. Global Optical 수치가 상한보다 작아도 탐색 범위는 partial일 수 있다. 미발견을 물리적 불가능으로 표시하지 않는다.

## 사용자 확인 순서

1. **1번 예시 열기 → ② 연결 조건 → Output Global Z = 100 µm**.
2. **③ 광학계 설계 → 자동 설계 찾기**. `direct`와 작은 offset Lens 보정이 선택되어 있는지 확인한다.
3. 제한 예산 사례를 재현하려면 family는 기본 선택을 유지하고 **Budget / goals / tolerance coverage**에서 Optical `2048`, Geometry `32`, Local fit `256`을 입력한다.
4. 탐색 후 `Nominal Mode goals met`, 2-Lens 구성과 보정량을 확인한다. `budget-exhausted`와 qualified 후보는 함께 표시될 수 있다. 이는 찾은 후보가 목표를 통과했으나 다른 배치까지 모두 탐색하지 않았다는 뜻이다.
5. 후보 적용 후 Port가 유지되는지 확인한다. Undo로 적용 전 상태로 돌아갈 수 있다.

## 확인한 bounded sweep

예시 01, Input 원점, Output X=10 mm / Y=0 / 원래 방향, 기본 Mode와 부품 상한 4. Optical 2048 / Geometry 32 / Local fit 256. 아래 값은 deterministic reference 결과이며 총 전달효율 또는 제조 보증이 아니다.

| Output Z | Qualified 후보 | 대표 구조 | Conditional Mode overlap |
|---:|---:|---|---:|
| −100 µm | 1 | 2-Lens direct | 0.9996465 |
| 1 µm | 6 | Lens direct | ≈1 |
| 10 µm | 7 | 2-Lens direct | 0.99999999 |
| 50 µm | 5 | 2-Lens direct | 0.9999966 |
| 100 µm | 1 | 2-Lens direct | 0.9996465 |
| 250 µm | 0 | 이 예산에서 미발견 | — |
| 500 µm | 7 | 2-Mirror folded relay | ≈1 |

100 µm 대표 후보는 Optical 978회, Alignment ray trace 18,545회를 사용했다. 50 µm는 Optical 706회, Alignment ray trace 13,218회였다. 실행 시간은 기기에 따라 달라진다. Direct만 선택하고 Optical 512 / Geometry 8 / Local fit 256으로 줄이면 100 µm에서 qualified 후보가 없었다. 탐색 성공이 offset 크기나 budget에 단순 비례하지 않는다.

기본 설정(Optical 8192 / Geometry 128 / Local fit 1536)에서도 50 µm와 100 µm의 qualified 후보를 확인했다. 각각 Optical 1282 / 1994회, Alignment ray trace 24,188 / 38,305회를 사용했고 대표 overlap은 0.9999966 / 0.9999627이었다.

## 독립적인 전체 Lens train 검증

`tests/lensTrainOracle.ts`는 production frame/intersection/Snell/ABCD/Q 루틴을 호출하지 않는다. 독립 Euler frame 조합, sphere/plane 교차, vector Snell로 두 Lens의 네 굴절면과 receiving plane을 추적한다.

- Input chief-normal plane의 두 위치와 두 reduced slope를 섭동하고, Output chief-normal plane의 위치·reduced slope를 측정하여 전체 4×4 differential map을 계산한다.
- 독립 complex matrix 연산의 `Qout=(A Qin+B)(C Qin+D)^−1`를 production full tensor와 비교한다. reduced Q는 q/n이고, 여기서 Input/Output medium은 air이다.
- Position step 80/40/20 nm와 대응 angular step 8/4/2 µrad에서 step-halving 수렴을 검사한다. 10 mm 기준으로 무차원화한 symplectic residual과 최종 relative tensor error는 각각 2×10⁻⁶ 이내여야 한다.
- ±cross-plane decenter와 noncoplanar tilt, axial control, rolled elliptical Input (MFD 14/20 및 40/60 µm), Sphere/Plane 혼합, nested global frame을 포함한다. 실수·허수 off-diagonal 항까지 비교한다.

이 검증은 **exact finite chief 주변의 local first-order Gaussian 전달 구현**을 교차 확인한다. 유한 폭 beam의 higher-order aberration, diffraction, clipping이나 실제 coupling 오차 한계를 검증한 것은 아니다. 기존 single-Lens phase-screen benchmark도 여전히 단일 Lens의 제한된 surrogate이다. Two-Lens 물리 정확도 pass를 새로 표시하지 않는다.

회귀검증은 ±100 µm의 제한 예산 탐색, Port 불변성과 Apply, Local fit partial 표시, PC·모바일 50/100 µm 탐색·Apply·Undo를 포함한다. 전체 test/CI 결과와 HTML hash는 PR 및 build manifest에 기록한다.

## 다음 개발 계획 — Astra

다음 D2.6은 **유한 beam의 수차와 Mode overlap 오차를 분리하는 독립 benchmark**가 우선이다.

1. 두꺼운 두 Lens의 실제 굴절·glass 내부 경로를 유지하는 reference를 정의한다. Gaussian Q 비교와 finite-beam phase/amplitude 비교를 별도 항목으로 둔다. 단순 sag phase screen으로 대체하지 않는다.
2. On-axis부터 signed decenter / tilt, MFD·NA와 offset sweep으로 확대한다. Pupil sampling / propagation convergence와 energy normalization을 확인하고, 수치 오차와 모델 오차를 분리한다.
3. Reference field의 Output Mode overlap과 현재 Gaussian 결과의 차이를 수치화한다. 검증 범위 밖은 unresolved / unassessed로 유지한다. 독립 근거 없이 50 mrad incidence, footprint 0.2, divergence 0.1 rad gate를 넓히지 않는다.
4. 이후 Lens–Prism–Lens / 2-Prism, 얕은 Mirror 경로와 exact clearance, Array channel 좌표·1×8 / 2D MLA를 진행한다. SENKO / Teramount 참고 구조는 실제 공개 조건과 가정을 구분하여 의미 있는 예시로 연결한다.

UI 문구·배치의 독립적인 후속 수정은 Sol로 가능하지만, 이 physics/benchmark 단계는 Astra를 권장한다.
