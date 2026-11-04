# D2.7 — Small-Offset Geometry / Topology 검증

## 결론과 적용 범위

±50 µm에는 **기존 치수와 고정 Port 조건을 만족하는 2-Lens + 2-Mirror chief-ray 배치**가 있다. 23° Fold의 Mirror 간 거리와 비의도 Mirror–ray 거리는 각각 25.512 µm, 6.139 µm다. 기존 AABB는 이 배치를 제거한다. 기존 Cartesian placement grid도 이 작은 반사각 구간을 누락한다. 그러나 Geometry 통과는 Mode-matched connector 확보가 아니다. 동일 Golden 입력의 개선된 탐색에서도 ±50 / 100 µm의 최종 optical 후보는 없다. 이는 **bounded search failure / Gaussian reference 한계**이며 물리적 불가능 증명이 아니다.

- Base: Draft PR #38 `benchmark/golden-001`, `66feb0c684ec3114a8ff09aa74400e5b761154b0`.
- Physics 원본: PR #36 `d581717447dd4f6b0ce94c14e847b3361ab0f013`.
- D2.7 실행 SHA, CI head SHA, 입력, source hash, dirty 상태는 `d27-geometry.json` 및 `golden-001.json`에 기록한다. PR CI의 clean checkout artifact를 최종 재현 기준으로 사용한다.
- 기존 Golden 입력/Mode, Ray/Gaussian/Snell Solver, Lens construction/fit, mounting policy, manufacturing limits를 보존한다. UI 변경 없음.

## 고정 조건

Source (0,0,0), Target (10 mm,0,h), 양쪽 +X optical axis, 기존 Target roll π. λ=1310 nm, circular Gaussian MFD=9.2 µm, waist-plane, air n=1, unit-power. Position/Orientation/Mode/Port body를 보존한다. 단위는 JSON에서 SI다.

| 항목 | 조건 |
|---|---|
| Mount | `port-axis`, endpoint Lens placement |
| Generated Lens | clear radius 200–500 µm; thickness 50–300 µm; N-BK7 |
| Mirror | 기존 disc radius = 1.1 × clear radius; thickness 20 µm |
| Prism | normal-entry right-angle BK7; leg ≥4 × clear radius, 최소 800 µm |
| Assembly | 총 4 / 신규 4; Lens 2, Mirror 2, Prism 1 |
| Clearance / bend | 1 µm / Mirror bend ≥20°; 변경 없음 |
| Search | optical 8192, geometry 128, fit 1536; 초기 geometry allocation 96 |
| Manufacturing seeds | 200, 500, √(200×500) µm clear radius |

NA 측정값, coating, total-efficiency spec은 정의되지 않았다. 기본 minimum conditional overlap 0.9를 Total Coupling 기준으로 해석하지 않는다.

## Root Cause와 Reference Calculation

평행한 Port axes 사이 offset을 h>0, 첫 Mirror 반사각을 θ라 하자. A=(a,0,0), B=(a+h cotθ,0,h)에 Mirror front 중심을 두면 중간 ray 방향은 (cosθ,0,sinθ)다. 두 Mirror normal은 서로 반대이며 backing은 front 사이 공간에서 멀어지는 방향이다. 음의 offset은 Z 반사 대칭이다.

이 centered coplanar 두-Mirror family에 한정하여:

- Mirror front-plane 거리: **h / (2 cos(θ/2))**. 횡방향 disc projection이 겹치는 검사 fixture에서는 이것이 실제 finite solid 간 거리다.
- 입·출력 ray를 연장했을 때 다른 Mirror front-plane 교점의 중심 반경: **h / sin(θ/2)**.
- h=50 µm, 최소 body radius R=220 µm에서 90° Fold는 front 간격 35.355 µm지만, ray 교점 반경이 70.711 µm여서 **실제로 다른 Mirror가 광로를 차단**한다. AABB pair conflict만 제거하면 잘못된 경로를 통과시키게 된다.
- 50 µm에서 20° ≤ θ <26.273°는 front-plane crossing이 disc 밖에 있는 구간이다. 중간 배치의 유한 입·출력 segment와 실제 backing을 검사하면 1 µm ray clearance 조건은 약 θ<25.739°로 더 좁다. 이 분석식은 특정 centered family의 범위이며 모든 배치의 필요충분조건이 아니다.

| h / θ | Mirror–Mirror 최소 거리 | 비의도 Mirror–ray 최소 거리 | 기존 AABB | D2.7 |
|---|---:|---:|---|---|
| ±50 µm / 21° | 25.426 µm | 9.908 µm | pair conflict | PASS |
| ±50 µm / 23° | 25.512 µm | 6.139 µm | pair conflict | PASS |
| ±50 µm / 25° | 25.607 µm | 2.383 µm | pair conflict | PASS |
| ±50 µm / 30° | 25.882 µm | 0 | pair conflict | FAIL: crossing 유지 |
| ±50 µm / 90° | 35.355 µm | 0 | pair conflict | FAIL: crossing 유지 |
| 100 µm / 23° | 51.024 µm | 59.596 µm | PASS | PASS |
| 100 µm / 45° | 54.120 µm | 15.810 µm | pair conflict | PASS |

정밀 Reference는 production clearance 함수를 호출하지 않는다. Parallel finite cylinders의 최소 거리는 axial interval gap과 transverse disc gap의 Euclidean norm으로 계산한다. Segment–cylinder는 point-to-solid squared distance의 convex 1D minimization을 160회 수행하며, analytic separation / overlap / tangent / endpoint controls로 검증한다. Compiled world frames는 공통 입력이다. General nonparallel solid distance는 **Uncomputed**다.

### 기존 Seed가 놓치는 이유

기존 Mirror2 projection seed는 평행 Port에 90° Fold만 제공한다. Independent t/u grid는 7개 fractions `[.5,.25,.75,.125,.375,.625,.875]`를 사용한다. 50 µm에서 필요한 axial Mirror separation은 약 0.10–0.14 mm인데 grid spacing은 약 1.56 mm다. Forward grid 배치는 grazing threshold 아래로 내려가고, projection/backtracking 배치는 clearance/crossing으로 탈락한다. 기존 local refinement는 feasible seed에서만 시작하므로 이 분리된 영역을 발견하지 못한다.

Base SHA를 별도 worktree에서 재실행한 Golden 001은 243 checks PASS다. ±50 및 100 µm 각각 geometry 96건에서 position/direction 7, grazing 33, AABB pair 28, AABB crossing 28을 기록하고 optical evaluation은 0이다. Retained initial train은 추가로 coaxial mount를 위반한다. 이 histogram의 AABB 항목 전체를 실제 충돌로 해석하면 안 된다.

## 최소 수정과 보수성

1. Disc Mirror pair의 AABB overlap에 대해서만 실제 finite-cylinder support interval의 **분리 축 증명**을 시도한다. 축 후보는 두 normal과 중심 연결축이다. 분리를 증명하지 못하면 기존 rejection을 유지한다. 완전한 collision solver가 아니다.
2. 비의도 Mirror와 ray의 AABB crossing은 axial slab을 제한한 뒤 radial distance를 해석적으로 최소화한다. Cylinder를 radius와 axial 양쪽으로 gap만큼 확대하여 Euclidean gap neighbourhood를 포함한다. Tangency/불확실성은 reject하며 1 pm 수치 여유를 추가한다.
3. Parallel small-offset Mirror2에 분석적 angle-window의 3개 내부 fractions와 기존 axial placements를 Seed로 추가한다. 실제 Reflection, finite body, gap, bounds, aperture, Lens mount, Mode gates는 그대로 통과해야 한다. Refine/fit budget도 늘리지 않는다.
4. Synthesis에서는 새 Seed를 기본 **coaxial policy에만** 사용한다. 초기 구현의 전역 Seed 추가가 작은 budget의 advanced free-Lens search allocation을 분산시켜 기존 ±100 µm regression을 깨뜨리는 것을 발견했다. 해당 별도 policy의 기존 Seed 순서를 유지하여 수정한다. Free-Lens steering은 default의 대체 해결책으로 사용하지 않는다.
5. 다른 solid pair, Lens/Prism, Design Space와 Keep-out은 기존 conservative 판정을 유지한다. `screenClearance(..., false)`는 비교용으로 더 엄격한 기존 AABB만 재생한다.

검증에는 rigid rotation/translation, segment reversal, 800개의 segment certificate/reference 비교, gap 경계, 실제 overlap, nonparallel intersecting discs, 기존 negative controls가 포함된다. 정밀 검사로 해제한 실제 proposal은 ray oracle과 independent finite-cylinder distance로 다시 검사한다.

## Topology별 판정

| Topology / policy | 이번 적용 범위의 판정 |
|---|---|
| Direct / single Mirror | 고정 +X → +X 축에서 nonzero displacement를 정상적인 single fold로 연결할 수 없음. Position/direction gate 유지 |
| 2 Lens + 2 Mirror | ±50 µm의 23° fixture에서 chief-ray closure, Snell/Reflection, 모든 Port/Mode, coaxial mount 및 component clearance PASS. 기존 `addLenses` seed는 Gaussian aberration-domain gate에서 `not-calculated`; 광학 성능 PASS가 아님 |
| Single normal-entry Prism | 기존 90° Fold는 평행 +X output과 불일치 |
| Mirror + normal-entry Prism | 중간 free-space length h−leg/2가 음수. 최소 leg 800 µm에서 50/100 µm는 backward entry. 강제로 구성해도 실제 trace가 거부함 |
| Two normal-entry Prisms | 기본 family 미선택, Prism 상한 1로 제외. 같은 canonical geometry에서 h−leg<0. 다른 Prism 구조의 불가능 증명이 아님 |
| Free-Lens steering | 별도 advanced assembly policy. 기존 signed ±100 µm regression만 보존·재검증. Golden default에서 사용 0회 |
| 다른 반사/굴절 구조 | Non-normal entry, wedge/rhomboid Prism, off-centre reflection 또는 다른 pupil relay는 이번 검증된 template 범위 밖. 치수/면/재료/assembly 명세 없이 후보로 추가하지 않음 |

## Golden Regression 관측

| Offset | Optical evaluations: Base → D2.7 | Geometry evaluated | Mirror2 geometry passed | retained / qualified |
|---:|---:|---:|---:|---:|
| 0 µm | 3177 → 3177 | 96 | 0 | 8 / 5 |
| +50 µm | 0 → 2361 | 96 | 18 | 0 / 0 |
| −50 µm | 0 → 2361 | 96 | 18 | 0 / 0 |
| 100 µm | 0 → 3920 | 96 | 51 | 0 / 0 |
| 500 µm | 8190 → 8188 | 101 | 55 | 8 / 7 |

모든 case는 `budget-exhausted`다. ±50의 rejection histogram은 대칭이며 alignment evaluations=0이다. 새 small-offset fits는 주로 `2w/|R| ... >0.2`의 Gaussian validity 및 `Aperture / body tail bound exceeds 0.1%`에서 탈락한다. 이는 개별 trial 또는 사용 모델의 제한이며 모든 연속 Lens design의 불가능 증명이 아니다. 23°에서 200 µm clear radius의 projected half-width는 약 39.9 µm이므로 큰 beam에 엄격한 aperture가 되는 경향과 일치하지만, 이 수치만으로 전역 feasibility를 판정하지 않는다.

0/500 µm의 conditional overlap nominal 후보는 유지된다. Golden의 독립 scalar ABCD/Mode overlap, Reflection/Snell controls, fixed Port/Mode, Apply/save replay를 보존하고 small-offset optical evaluation checks 3개를 추가하여 총 246 checks다. Bare Mirror geometric Search/Apply도 ±50 µm에서 deterministic replay를 검사한다. Browser의 small-offset Apply는 최종 optical 후보가 없어 수행 대상이 아니며, 해당 E2E는 unchanged Project를 확인한다.

## 재현 및 검증 상태

```bash
npm ci
npm run benchmark:geometry
npm run benchmark:golden
npm test -- --maxWorkers=1
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
```

`benchmark-results/d27-geometry.json`은 18개 angle/offset references, 입력, 23° two-Lens fixtures, PASS/FAIL와 미계산 범위 및 SHA를 담는다. `golden-001.json`은 전체 입력/후보/실패 분포를, `golden-001-browser.json`은 실제 Browser lifecycle을 담는다. CI는 세 JSON을 기존 `golden-benchmark-001` artifact에 보존한다. 모델 JSON은 Playwright의 test-results 정리 대상 밖에 있다.

로컬 첫 전체 실행은 과도한 worker 병렬화로 timeout/RPC error와 위 free-Lens allocation regression을 드러냈다. 물리 제약이나 assertions를 완화하지 않고 allocation scope를 수정한 후 worker 1개로 직렬 재검증한다. 로컬 Playwright download는 truncated ZIP 오류로 실패했으므로 로컬 Browser 완료로 표시하지 않는다. 최종 PR의 CI log/artifact가 Browser 실행의 근거다.

## 다음 Physics 개발 권고

- **우선:** 작은 Fold의 projected pupil과 Lens aberration을 함께 다루는 검증된 reference. 해당 경로의 finite beam이 인접 Mirror backing을 비의도적으로 비추는 문제는 chief-ray clearance로 인증할 수 없다. Full diffraction/stray-body shadowing은 이번 **Uncomputed**다.
- Port-axis 상태에서 topology/beam-width/aperture를 결합한 bounded feasibility 분석과 Lens seed 품질을 개선한다. 범위를 바꾸기 전에 independently converged pupil/field reference와 오차 기준을 정한다.
- 일반 Lens/Prism solid에 대한 precise clearance, non-normal/wedge Prism, TIR 이후 powered Lens field는 별도 architecture/physics 검증이 필요하다.
- Total Coupling, throughput/coating loss, combined tolerance/Yield, production manufacturability와 global impossibility는 **Uncomputed**다. High conditional overlap을 이 값들로 치환하지 않는다.

Main 및 PR #36–#38은 변경하거나 병합하지 않는다. D2.7은 #38 위의 별도 Draft PR로 검토한다.
