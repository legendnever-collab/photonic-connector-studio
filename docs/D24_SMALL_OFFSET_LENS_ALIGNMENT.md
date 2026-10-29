# D2.4 · 작은 Port offset과 Lens 편심·tilt 보정

Version: `0.24.0-d24`. Recommended model: **Astra** for physics/validation extensions; Sol for subsequent UI-only polish.

## 사용자 문제와 변경

예시 01의 Output Z를 500 µm로 바꾸면 Mirror 경로가 나오지만 50 µm에서는 광학 평가 전에 모든 Fold seed가 제외됐다. Lens 자동 설계 역시 centered/normal chief와 이미 닫힌 Port 경로를 요구했다. 작은 offset을 Lens로 보정하는 탐색 기회 자체가 없었다.

이번 변경은 실제 Sphere/Plane Lens의 **local Y/Z decenter, pitch/yaw**를 계산에 연결한다. Input·Output의 위치, 방향, Mode와 metadata는 고정한다. 기존 Lens 조정과 새 2-Lens direct seed를 모두 지원하며, 기존 Mirror/Prism 경로도 계속 비교한다.

사용 순서:

1. **1번 예시 → 연결조건 → Output Global Z = 50 µm**.
2. **③ 광학계 설계 → 자동 설계 찾기**.
3. `direct`와 **작은 offset · Lens 편심·tilt 보정**을 선택한다. 새 설정의 기본값은 decenter ±1000 µm, tilt ±20 mrad. 실제 이동량은 후보마다 다르다.
4. 탐색 후 Mode 목표와 **Lens 보정량** 표를 함께 확인한다. Preview는 Project를 변경하지 않는다.
5. **선택 후보 적용**, 필요하면 **Undo**. 기존 저장 파일에서 보정 옵션이 없으면 직접 켤 수 있다.

기존 Lens만 조정하려면 Lens Design의 **Lens 편심·tilt 보정**을 사용한다. 작은 편심/미연결을 발견하면 기본 bounds에 보정을 포함한다. Freeze Lens는 형상 변수와 pose를 함께 고정한다. Reset Lens Bounds로 해제한다.

## 계산 계약

- 외부 bounded multistart search는 기존 axial position, S1/S2 curvature, center thickness를 조정한다. 비대칭 Lens power 분배 seed를 추가했다.
- 각 형상에서 실제 aperture와 body를 통과하는 chief를 추적하고, 고정된 receiving plane의 Y/Z 위치와 두 방향 slope를 잔차로 사용한다. Sphere 교차와 vector Snell은 기존 finite-surface ray solver를 사용한다.
- 정규화된 변수의 finite-difference Jacobian과 damped minimum-norm correction을 사용한다. 먼저 decenter를 조정하고, 충분하지 않으면 pitch/yaw도 허용한다. 모든 자유도를 독립적으로 전역 최적화한 결과는 아니다.
- 1회 형상 평가당 correction은 최대 160회 chief evaluation, 단계별 최대 12 iteration이다. `Alignment ray traces`는 별도 작업량으로 표시한다. Optical budget은 Gaussian forward evaluation을 센다.
- 내부 closure 목표는 position `min(1 nm, declared tolerance × 0.01)`, angle `min(0.1 µrad, declared tolerance × 0.01)`이다. 이는 **수치 종료 조건이며 제조 정밀도나 물리적 정확도 보증이 아니다**.
- pose는 각 원래 Lens front vertex의 local Y/Z, local pitch/yaw 증분이다. paired surfaces와 body를 하나의 rigid component로 움직인다. roll, parent hierarchy, Ports, material/body 치수는 보존한다.
- parameter vector는 기존 Lens별 4개 형상 값 뒤에 Lens별 `[ΔY, ΔZ, pitch, yaw]`를 추가한다. Apply는 bounds/locks 검사, prescription 재구성, exact serialization 비교, 경로·clearance·field 재검증을 수행한다.
- 신규 direct seed는 fixed prefix가 없고 Lens 2개 및 부품 상한이 허용될 때만 생성한다. axial separation ≥1 mm, 축 차이 ≤20 mrad, lateral separation ≤2×decenter bound인 유한 시작 범위이다. 임시 coaxial reference는 초기 형상 구성에만 사용하고 실제 Port를 복원한 뒤 평가한다. 평가 중 Port를 이동시키지 않는다.

## 기하 연결과 Field 유효성은 별도

chief가 Output에 도달했다고 qualified가 되지 않는다. 최종 후보는 기존 geometry/space/Keep-out, conservative body clearance, Gaussian validity, aperture tail, size/phase, conditional normalized Mode overlap 검사를 통과해야 한다.

Sphere Gaussian 모델의 기존 **50 mrad chief incidence**, **footprint ratio 0.2**, **0.1 rad waist divergence**, **0.1% aperture tail** 조건은 완화하지 않았다. 이 값은 현재 검증한 모델 범위이며 실제 광학계의 불가능 경계가 아니다. 기존 광학계를 그대로 편심시키면 Field 한계에 걸리고 다른 곡률·두께·배치로 구성한 후보가 통과할 수 있다.

초기 chief 자체가 aperture에 막혀 receiving plane까지 도달하지 못하면 현재 correction은 시작하지 못한다. 단일 channel, air–glass–air, leaf Lens 1–2개, coaxial paired Sphere/Plane surfaces가 대상이다. 큰 NA, high-order aberration, clipping diffraction, evanescent/grating coupling, vendor device 효율을 새로 지원하지 않는다. Oblique Lens+TIR의 기존 field 제한도 유지한다.

Mirror 20° seed 제한과 conservative AABB screening은 이번에 변경하지 않았다. 얕은 반사 경로와 exact solid collision 확장은 후속 검증 대상이다.

## 확인한 사례와 검증

예시 01, Input 원점, Output X=10 mm, Y=0, 원래 Output 방향. Optical 2048 / geometry 32 / fit 256, 기본 치수와 family에서 확인한 bounded sweep:

| Output Z | 결과 | 대표 qualified 구조 |
|---:|---|---|
| 0 µm | 목표 통과 | direct |
| 0.01 µm | 목표 통과 | Lens 보정 direct |
| 10 µm | 목표 통과 | 2-Lens direct |
| 50 µm | 목표 통과 | 2-Lens direct, conditional overlap ≈0.9999966 |
| 100 µm | 이 작은 fit budget에서 후보 없음 | 기하 불가능 판정 아님 |
| 500 µm | 목표 통과 | 2-Mirror folded relay |

100 µm는 direct family, optical 8192 / fit 1536으로 따로 실행하여 2-Lens qualified 후보(conditional overlap ≈0.9999627)를 확인했다. Offset 크기만으로 탐색 난이도나 성공을 보장하지 않는다. 표의 overlap은 총 전달효율이 아니다.

회귀검증은 다음을 포함한다.

- 0, ±10 nm, ±1/10/50/100 µm, 500 µm와 cross-plane offset의 chief closure; 유효 범위 밖 field는 미계산 유지.
- decenter=0인 tilt-only 1 µm 보정과 전체 Lens lock / zero bound 실패.
- application intersection/frame/Snell을 호출하지 않는 독립 vector-Snell oracle의 tilted 4-Surface 전체 경로 비교.
- parent rigid transform, 재구성, Save/Load, Port 불변성, Apply bounds/pose tamper 차단.
- 50 µm 자동 설계의 실제 2-Lens 후보, Keep-out/부품 상한/fixed surface/옵션 OFF 회귀.
- Offline desktop/mobile에서 50 µm 입력 → 탐색 → 보정량 표시 → Apply → Undo.

전체 모델 suite: 462 tests / 34 files. 최종 browser/CI 결과와 standalone artifact hash는 PR 및 build manifest에 기록한다.

## 다음 개발

**Astra 권장: 작은 offset의 탐색 안정성과 Field 검증 범위 확장.**

1. 10–500 µm 연속 sweep과 다양한 MFD/NA에서 seed·budget 부족과 실제 field-domain 제한을 분리한다. 적은 budget에서도 100 µm 후보를 일관되게 찾도록 warm-start/shape-pose 공동 탐색을 검토한다.
2. Lens 편심·tilt를 포함한 independent field benchmark로 higher-order aberration에 따른 overlap 오차를 정량화한다. 검증 없이 50 mrad/footprint cutoff를 늘리지 않는다.
3. Lens–Prism–Lens 및 2-Prism의 결합 field benchmark, 얕은 Mirror 경로와 exact clearance를 순차 확장한다.
4. 이후 channel ownership/repeat-coordinate 계약, 1×8/2D MLA와 SENKO/Teramount 참고 사례 및 Array tolerance로 연결한다. 합성 예시를 vendor 검증으로 표시하지 않는다.
