# D2.8-A — Finite-Beam Feasibility & Aperture Reference

2026-11-05 · Astra · Base Draft PR #39, `aaccdf9504d1a0362467bb6253099f282a6cbe96`.

## 결론

**D2.7의 ±50 µm / 23° Seed는 Chief-Ray Geometry를 통과하지만 Finite Optical Field PASS로 판정할 수 없다.** 기존 Source Gaussian에서 출발한 유한 Ray Bundle은 약 19.80%만 지정 경로를 통과한다. 약 74.39%는 인접 Mirror body에 먼저 차단되고, 약 5.80%는 그 외 순차 Aperture/Body clipping으로 제거된다. 이는 **Diffraction과 coating을 제외한 geometrical ray-flux ledger**이며 실제 Transmittance나 Total Coupling이 아니다.

동시에 Gaussian evaluator는 첫 Lens rear의 footprint ratio 0.200302가 기존 0.2 gate를 넘어서 계산을 거부한다. 첫 Lens만의 독립 Ray-Pupil residual OPD는 약 6.50 nm다. 따라서 **domain rejection을 심각한 실제 aberration이나 물리적 불가능의 증거로 바꾸지 않는다.** 검사한 일부 Lens 위치에서는 geometrical pass가 높아지지만 Field model은 여전히 out-of-domain이다. 전역 불가능 판정이나 후보 강제 생성은 하지 않는다.

이번 변경은 Benchmark/helper/documentation/CI artifact에 한정한다. `src/`의 Physics, Geometry Clearance, Search/Apply, GUI는 수정하지 않는다.

## 고정 입력과 기존 코드 재사용

| 항목 | 입력 / 재사용 |
|---|---|
| Ports | Source (0,0,0), Target (0.01,0,±50e−6) m; 양쪽 +X; 기존 Target roll π |
| Mode | 양쪽 MFD 9.2 µm circular Gaussian, waist-plane, unit-power, air n=1; λ=1310 nm |
| Mount / parts | Port-axis coaxial; Lens 2 + Mirror 2; 기존 총/신규 상한 4 |
| D2.7 Fold | 23°; clear radius 200 µm; disc body radius 220 µm; backing 20 µm; mechanical gap 1 µm |
| Lens Seed | 기존 `addLenses`; N-BK7; thickness 300 µm; clear radius 200 µm; outer radius 240 µm; front/rear R≈±655.15 µm |
| Initial Lens vertex | Source에서 약 617.767 µm; 뒤쪽 Lens는 같은 endpoint 거리로 배치 |
| Ray | `traceRay`, finite Sphere/Plane intersection, Reflection/Snell, `bodyGeometry`/`insideBody` |
| Gaussian | `solveFoldedGaussian`, `propagateQ`, `powerQ`, `section`, `tensorOverlap`; 기존 validity gates 유지 |
| Independent Pupil | D2.6 `trainPupilInput`, `tracePupilRay`, `integrateTrainPupil`, 기존 OPL/Jacobian/quadratic phase fit |
| Geometry | D2.7 `angleFixture`를 숫자 변경 없이 공용 helper로 이동; independent cylinder distance Oracle 재사용 |

새 generated Lens에는 실제 Synthesis constructor처럼 원본 Assembly/Surface ID를 reserve한다. 이는 제거된 초기 Lens의 변수 bounds를 새 Lens에 잘못 연결하지 않기 위한 동일한 ID 정책이며, D2.7 기준 형상/Port/Mode는 바꾸지 않는다. Bounded study의 position/curvature/thickness vector와 bounds는 JSON에 모두 저장한다.

## 계산 가능 범위

| 모델 | 계산하는 것 | 계산하지 않는 것 |
|---|---|---|
| 기존 Folded Gaussian | domain-qualified untruncated Gaussian Q, radius/curvature, tail bound | clipping 이후 Field, 비의도 body shadow 전파 |
| 기존 Train Pupil 전체 train 호출 | Fold가 unsupported임을 확인 | 2-Lens + 2-Mirror coherent field / Mode overlap |
| 첫 Lens prefix Pupil | exact spherical Snell/OPL, ray-tube Jacobian, quadratic 제거 후 OPD | 뒤쪽 Lens/Fold field; Lens 내부 diffraction; physical accuracy bound |
| D2.8-A Ray Flux | paraxial incident Gaussian phase-gradient launch, finite sequential rays, 지정 경로의 opaque backing 차단, 광량 분류 | 이후 diffraction/interference, coating/Fresnel throughput, scatter/다중 반사 경로, total coupling |
| 독립 Projected Mask | 평행·constant-radius Gaussian에 대한 두 disc folds의 aperture/body mask 적분 | 고정 Port에서 해당 Beam을 실제로 만드는 설계 또는 clipping 이후 전파 |

Formal paraxial sections는 기존 low-level Q 함수를 재사용한 **out-of-model extrapolation**이다. 엔진 gate를 우회하거나 후보를 qualification하는 경로에 연결하지 않는다. Gate 실패 이후 숫자를 검증된 실제 Beam Radius로 표시하지 않는다.

## Projected Aperture / Body Shadow Reference

Fold angle θ, clear radius a, body radius R, offset h에서 s=sin(θ/2)라 두면 입사 +X 방향에 투영된 Mirror clear aperture는

`y² + (z/s)² ≤ a²`.

23°에서는 projected half-aperture가 **39.874 µm**, 인접 body 사이 중앙의 optical half-gap은 **h−R s = 6.139 µm**다. Mechanical 1 µm gap은 별도의 기존 Geometry gate로 검사한다. Optical obstruction은 실제 solid(gap=0)로 계산하며 기계적 clearance shell을 흡수체로 만들지 않는다.

동일한 centered parallel disc 두 개, backing이 gap 바깥쪽으로 향하고 전체 train을 충분히 앞뒤에서 관측하는 local reference에서:

`z_max(y) = min[s sqrt(a²−y²), h−s sqrt(R²−y²)]`, `|y|≤a`.

이에 대한 Gaussian power fraction은

`T = ∫ sqrt(2/π)/w · exp(−2y²/w²) · erf(sqrt(2) z_max(y)/w) dy`.

Aperture-only reference는 첫 번째 항만 사용한다. 두 Mirror에 대해 같은 입사 좌표의 **공통 mask**를 적분하며 개별 transmission을 곱하지 않는다. `y=a sin(t)` 치환 + Simpson quadrature를 사용하고, production ray/cylinder routines를 호출하지 않는다. Gaussian erf는 양의 항 급수로 계산한다.

| Local plane-front reference, w=50 µm | 값 |
|---|---:|
| Aperture-only power fraction | 0.88636605 |
| Aperture + neighbouring-body clear fraction | 0.20279581 |
| 3D ray bundle clear fraction, n=512 | 0.20276161 |
| 위 두 독립 방법의 차이 | 약 3.42×10⁻⁵ |

위 값은 가상의 local Beam에 대한 비교다. 실제 Port Mode를 w=50 µm로 바꾼 것이 아니다. Shadow와 Aperture의 loss attribution은 순서에 의존하므로, 이 정적 common-mask subtraction을 physical ray ledger의 first-hit 분류와 동일한 값으로 해석하지 않는다.

## 기준 Seed의 결과와 Numerical Convergence

Source Gaussian을 첫 Lens 앞의 launch plane까지 자유 전파한 기존 D2.6 input radius/curvature를 사용한다. 입사 방향은 동일한 phase-gradient convention을 사용하며 0.3 rad launch cap 밖의 가중치는 `other / Uncomputed domain`으로 분리한다. r≤3.5w, polar n×4n sampling, 정확한 annular Gaussian weights를 사용한다. 제외한 source tail은 exp(−24.5)≈2.29×10⁻¹¹이다.

각 Ray는 먼저 만나는 비의도 Mirror solid 또는 intended backing의 뒷면을 검사한다. Shadow는 finite cylinder의 axial/radial interval intersection으로 계산하고, D2.7의 독립 distance minimization과 대조한다. Sequential trace가 clipped intersection까지 제공하므로 aperture에 도달하기 전에 발생한 body 차단을 누락하지 않는다. 계산한 loss categories는 상호 배타적이며 합계+tail=1을 검사한다.

| Grid n | Rays | 기준 Seed clear fraction | neighbouring-body fraction |
|---:|---:|---:|---:|
| 128 | 65,536 | 0.19779128 | 0.74453751 |
| 256 | 262,144 | 0.19828657 | 0.74366837 |
| 512 | 1,048,576 | 0.19803673 | 0.74392197 |

±50 µm 결과는 대칭이다. Ray ledger의 5개 metric에 대해 연속 두 refinement의 최대 absolute 변화가 0.002보다 작아야 `converged`로 기록한다. 이는 **관측된 0.2 percentage-point 수준의 수치 안정성**이며 rigorous error bound나 0.1% clipping 기준의 합격 인증이 아니다. Coarse local reference(32/64/128)는 unresolved임을 별도 검사한다. 독립 mask integral은 512/1024/2048/4096 steps에서 1e−6 이내 수렴을 요구한다.

기준 Seed의 formal Gaussian Mirror radius는 약 **58.887 µm**, Mirror surface의 major footprint radius는 약 **295.367 µm**, curvature는 첫 Mirror 직전 약 **−0.9253 m⁻¹**다. 이는 Lens rear gate 실패 이후의 extrapolation이다. 해당 tail bound 약 0.400을 실제 clipping 비율로 쓰지 않는다.

첫 Lens exit에서 기존 independent Ray-Pupil을 16/32/64로 실행하면 quadratic 제거 후 residual RMS OPD≈**6.4996 nm**, phase fidelity≈**0.9990521**이고 minimum Jacobian은 양수다. RMS 변화는 2e−11 m보다 작다. 이 결과는 첫 Lens prefix에 한정하며 receiving Mode overlap이나 전체 connector의 aberration PASS가 아니다. Target-dependent pupil overlap 값은 prefix report에 내보내지 않는다.

## Bounded Feasibility와 실패 분류

Mirror angle 21/23/25° × symmetric Lens endpoint position factor 0.8/1.0/1.2의 **9개** 배치를 검사했다. 각 angle의 기존 Seed curvature/thickness는 유지하고 position만 기존 `synthesisLensOptions` bounds 안에서 움직인다. 모든 경우 Port/Mode, mount 및 Geometry Clearance를 다시 검사한다. 추가 최적화나 exhaustive scan은 수행하지 않는다.

| Angle | 위치 ×0.8 | 위치 ×1.0 | 위치 ×1.2 |
|---:|---:|---:|---:|
| 21° | 0.1633 | 0.3116 | 0.9705 |
| 23° | 0.1071 | 0.1967 | 0.9255 |
| 25° | 0.0560 | 0.0846 | 0.7602 |

표는 n=64의 **미수렴 coarse geometrical clear fraction**이다. 실제 coupling / 비교 순위 / 유효 optical candidate로 사용하지 않는다. 9개 모두 기존 Gaussian domain gate에서 거부된다. 위치 ×0.8은 주로 receiving Lens, ×1.0은 첫 Lens rear, ×1.2는 첫 Lens front에서 실패한다. 높은 ray pass가 검증된 field를 뜻하지 않으며, 이 표는 모든 feasible design이 없다는 증거도 아니다.

추가 3 angles × 5 local radii(5/10/20/50/100 µm)는 독립 mask의 민감도 계산이다. Beam Radius는 고정 Port/Mode에서 자유롭게 지정할 수 있는 설계변수가 아니다. 예를 들어 w=5 µm의 Rayleigh range≈60 µm는 23° Fold 길이≈128 µm보다 짧아 constant-radius Beam 가정으로 전체 연결을 인증할 수 없다.

| 원인 | 이번 판정 |
|---|---|
| Physical clipping / shadowing | 실제 유한 solid와 ray의 교차 및 incident-flux 손실을 geometrical approximation에서 계산. 기준 Seed에서 body shadow가 지배적 |
| Lens aberration / model domain | 기존 0.2 footprint gate 실패 확인. 첫 Lens OPL residual은 별도 계산. 큰 실제 aberration의 증명으로 일반화하지 않음 |
| Search / optimization | 기존 Golden의 bounded search failure 유지. 9개 diagnostic placements는 추가 최적화 성공/완전 탐색이 아님 |
| Uncomputed Physics | Fold의 coherent diffracted field, near-edge diffraction/scattering, transmitted Mode overlap, Total Coupling, Yield |

√(λL)≈13 µm의 diffraction 특성 길이는 중앙 half-gap 6.14 µm와 비교해 작지 않다. 따라서 geometrical 19.8%를 실제 wave transmission의 정확한 값이나 엄밀한 상한으로 제시하지 않는다. **End-to-end Optical Field Feasibility는 아직 Uncomputed**다.

## 재현 / 검증 산출물

```bash
npm ci
npm run benchmark:finite-beam
npm run benchmark:geometry
npm run benchmark:golden
npm run typecheck
npm run build
```

CI에서 기존 전체 Model/Browser/packaging도 실행한다. `golden-benchmark-001` artifact에 기존 3개 JSON과 `d28a-finite-beam.json`을 함께 보존한다. 신규 JSON에는 Git SHA, PR head SHA, baseline SHA, source hashes, 전체 input projects, variable bounds, ray ledger, refinement history, 38 checks의 PASS/FAIL 및 Uncomputed를 저장한다. 실제 완료된 CI의 SHA/log/artifact는 Draft PR 설명에 기록한다.

Analytical circular pupil / free Gaussian controls, independent angular ellipse integral, D2.6 independent Lens Snell/OPL 비교, common rigid transform, power conservation, signed-offset symmetry, under-resolution/unsupported-domain negative controls를 포함한다. 기존 Golden 0, ±50, 100, 500 µm의 input 및 Search 결과를 보존한다.

## D2.8-B 권고

1. **고정된 이 4-part fold에 한정한 coherent finite-field reference**: 두 Mirror의 finite aperture와 neighbouring opaque backing을 순차적으로 포함하고, near-edge diffraction/에너지 수지를 검증한다. 범용 POP 또는 Prism 확장보다 먼저 이 한 구조의 오차와 수렴 기준을 정한다.
2. Lens 내부/출구 Field 및 Folded free-space 전파의 연결을 독립 검증한다. 기존 Gaussian gate를 완화하려면 first-Lens prefix가 아닌 **전체 train**의 비교 오차 근거가 필요하다.
3. 검증된 field evaluator가 생긴 뒤 Mirror angle/Lens curvature/position의 bounded optimization을 수행한다. 이번 coarse high-ray-pass 배치는 검증 시작점일 뿐 유효 후보가 아니다.
4. Coating/Fresnel, polarization, assembly tolerance/Yield와 Total Coupling은 분리된 후속 범위로 유지한다. Main merge는 사용자 승인 전 금지한다.
