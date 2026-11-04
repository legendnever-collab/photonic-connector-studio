# Golden Benchmark 001 — 실행 및 판정

기준 Physics: PR #36 `d581717447dd4f6b0ce94c14e847b3361ab0f013`. 지침: PR #37 `5530329ed0b9c4d553c1e9385e0a429cffd012f0`. 두 PR은 미병합 Draft이며 이 작업도 #36 위에 쌓는 Draft다. `src/`는 변경하지 않는다.

## 재현

```sh
npm ci
npm run benchmark:golden
npm run typecheck
npm test
npm run build
npx playwright install --with-deps chromium
npx playwright test e2e/goldenBenchmark.spec.ts e2e/lensMount.spec.ts
```

Model 결과는 `benchmark-results/golden-001.json`, Desktop lifecycle 결과는 `benchmark-results/golden-001-browser.json`에 기록한다. 기존 CI의 `npm test` / `npm run test:e2e`에 자동 포함되며 `golden-benchmark-001` artifact로 업로드한다. Git checkout SHA와 PR head SHA를 구분한다. Fixture/검증 코드 SHA256, dirty 상태, Node 환경, 모든 입력·후보 prescription·budget·실제 소비·family diagnostics·PASS/FAIL·Uncomputed를 보존한다. Dirty run은 Git SHA만으로 재현됐다고 주장하지 않는다. PR 최종 head의 CI artifact가 최종 실행 증거다.

Browser 검증은 Model 결과를 복사하지 않고 실제 UI의 Save JSON을 비교한다. Model harness는 React Undo/Redo를 가짜 history로 흉내내지 않는다. 양쪽 결과를 함께 읽는다. Browser lifecycle의 body가 일부 실패하면 Playwright 결과가 실패이며 PASS JSON은 생성되지 않는다.

## 고정 Fixture

| 항목 | 값 / 출처 |
|---|---|
| Source / Target | `basicRelayReference()`; Source (0,0,0), Target (0.01,0,offset) m |
| Orientation | 양쪽 optical axis +X; 기존 Target roll π 보존 |
| Mode | 양쪽 circular Gaussian, MFD 9.2 µm, waist-plane, air n=1, unit-power; polarization unspecified |
| Wavelength | 1310 nm |
| NA | Catalog/측정값 미정의. Gaussian divergence 약 0.09065 rad는 Mode 근사값이며 Fiber NA 측정값이 아님 |
| Mount | `port-axis`; intentional Lens decenter/tilt opt-in 없음 |
| Part limits | total/new 4, Lens 2 / Mirror 2 / Prism 1 |
| Families | direct, mirror1, mirror2, prism1, mirror-prism. prism2는 기본 미선택·Prism 상한 1; 검사한 것처럼 표기하지 않음 |
| Budgets | optical 8192, geometry 128, local fit 1536; 모두 기존 기본값 |
| Generated Lens | N-BK7, clear radius 200–500 µm, thickness 50–300 µm; 실제 후보 치수는 JSON |
| Initial Lens | 기존 reference의 clear radius 1 mm, thickness 1 mm. Retained initial train과 생성 치수 범위는 서로 다름; 이를 일치시키기 위해 기존 형상을 수정하지 않음 |
| Fold geometry | 기존 route constructor, Mirror thickness 최소 20 µm, Prism leg ≥4×clear radius; 치수 seed와 실제 recipe는 JSON |
| Route tolerances | position 1 µm, angle 0.1°; nominal mount lateral 1 nm / axis dot ≥1−1e−10는 numerical gate이며 제작 공차 요구가 아님 |
| Clearance | 기존 1 µm gap, bounds 없음, keep-out 없음. Negative control에서만 명시한 keep-out 추가 |
| OAT | 기존 defaultProblem의 Port position [0.5,1,1] µm, Port angle [0,0.2,0.2] mrad, component position [0.5,0,0] µm, component angle 0; maxCases 128 |

이는 잠정 synthetic 검증 조건이며 제조 사양 또는 total-efficiency 합격 기준 확정이 아니다. 기본 minimumOverlap 0.9는 기존 nominal conditional goal이며 total coupling threshold가 아니다.

## 독립 검사와 재사용

- 기존 `basicRelayReference`, `searchSynthesis`, `applySynthesis`, `analyzeRouting`, `screenClearance`, `tensorOverlap`, `solveFoldedGaussian` 재사용. `tests/prismFixtures.ts`도 재사용한다. Solver를 추가하지 않는다.
- Test-only `rayOracle`은 production reflect/refract/normal/intersection/vector helper 없이 직진, sphere/plane 표면 잔차, aperture, tangential Snell 보존, specular Reflection, TIR를 검사한다. Compiled world frame은 공통 입력이므로 frame compiler의 완전 독립 검증은 아니다.
- Ray 방향/보존 잔차 2e−9, 위치·표면 잔차 2e−11 m. Optical manufacturing 한계와 별개인 검증 numerical tolerance다.
- `modeOracle`은 centered circular Gaussian + normal spherical Lens + unfolded planar Mirror의 독립 scalar ABCD와 overlap 식이다. 실제 nominal 후보와 absolute η 차이 <1e−9를 검사한다. Full-wave 독립해석이 아니다.
- Port snapshot은 pose·Mode·medium·metadata·Port body까지 비교한다. JSON roundtrip의 key 순서와 signed zero를 canonicalize하며 수치 오차 허용을 추가하지 않는다.
- 실제 Lens world axes·part counts·sphere 중심/외곽 두께·generated 치수도 독립 확인한다. Clearance는 production conservative AABB gate와 coincident finite Prism의 overlap witness, straight segment Keep-out negative control로 확인한다. Exact solid collision을 검증했다고 주장하지 않는다.
- 인위적 air bend, 잘못된 Reflection/Snell, fold 누락, aperture clipping, body overlap, keep-out crossing, out-of-domain divergence 및 powered Lens after TIR를 negative control로 사용한다.

## 관측 결과와 해석

| Offset | 관측 결과 | nominal optical / geometry evaluations |
|---:|---|---:|
| 0 µm | Direct two-Lens reference 및 기존 train 후보, conditional η≈1 | 3177 / 96 |
| +50 µm | 후보 미발견; bounded search diagnosis | 0 / 96 |
| −50 µm | 후보 미발견; +50 µm와 동일 거부 분포 | 0 / 96 |
| +100 µm | 후보 미발견; free-Lens 우회 없음 | 0 / 96 |
| +500 µm | 2-Lens + 2-Mirror nominal 후보, conditional η≈1 | 8190 / 103 |

모든 case의 Search status는 `budget-exhausted`이며 전역 최적성·완전 탐색을 뜻하지 않는다. ±50/100 µm는 optical evaluation 전에 경로/조립/기하 gate에서 걸렸다. 각 case에서 28건의 conservative AABB component conflict, 28건의 unintended crossing, 33건의 grazing bend, 7건의 position/direction rejection 및 retained train mount 불일치 1건을 관측했다. 자세한 family별 stage와 budget 제한은 JSON에 있다. 이 통계는 물리적으로 해가 없다는 증명이 아니다.

직선·무소자 경로에 한정하면 고정 +X ray와 Target 간 lateral residual은 offset 절댓값이므로 nonzero case는 선언한 position tolerance를 위반한다. 이를 `infeasible-under-stated-constraints`로 별도 표기하고, Fold 구조 전체의 미발견과 구분한다.

0/500 µm의 1위 후보 OAT는 각각 24/28 case를 계산했고 worst conditional η≈0.95384였다. 이 한정된 OAT는 합동 오차·sampled Yield 검증이 아니다. Partial 후보의 미계산 field와 incomplete mount도 원래 상태로 남긴다.

## Physics Gap / 다음 Astra 범위

1. Lens–Prism–Lens / TIR 이후 powered field의 검증된 전달이 필요하다. 이번 negative control은 유효한 Gaussian transport에서도 Mode evaluator가 `Model unsupported: powered / oblique optics after the first TIR`로 계산을 거부하는 것을 확인한다.
2. Expanded-beam 구간의 collimation 기준, Lens 내부·사이 diffraction, field/pupil clipping 및 수렴 검증이 필요하다. Gaussian nominal overlap≈1만으로 해결됐다고 볼 수 없다.
3. Small-offset에서 제조 치수와 보수적 AABB screening의 영향을 분리할 더 정밀한 collision/reference 검증과 topology coverage가 필요하다. 기본 제약을 완화해 이번 Benchmark를 통과시키지 않았다.
4. Throughput/coating loss/total coupling, full-wave reference, joint tolerance와 assembly Yield는 **Uncomputed**다. 새 fabrication 가정·합격 기준은 사용자 결정 후 별도 작업으로 진행한다.
