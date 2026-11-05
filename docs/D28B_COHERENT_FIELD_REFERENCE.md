# D2.8-B — Coherent Finite-Field Reference

2026-11-05 · Astra · Base Draft PR #40, `aedf81046819efcd19ff54ae3444282a3d159bd4`.

## 결론과 적용 범위

**검증된 Scalar free-space / aperture Reference를 추가했다. 실제 23° Two-Mirror Fold의 Field Transmission과 Output Mode Coupling은 아직 Uncomputed다.** Numerical convergence, geometry approximation의 적절성, 실제 Optical Candidate qualification을 분리한다.

D2.8-A의 광선별 Shadowing 계산에 complex amplitude와 free-space Diffraction을 추가한 **transverse-screen 대체 모델**을 만들었다. 기존 Lens OPL / ray-tube boundary와 연결하여 제한된 배치를 진단할 수 있지만, 실제 경사진 Mirror와 유한 두께 backing을 이 평면 Screen으로 대체하는 것은 별도 근사다. 독립적인 tilted-plane Rayleigh–Sommerfeld-I 계산에서 그 차이가 확인되므로 이 대체 모델의 숫자를 실제 Fold의 Transmission / Coupling으로 승격시키지 않는다. 결과 JSON은 실제 Fold metrics를 `null / Uncomputed`로 보존한다.

`src/` Physics, Gaussian validity gates, Search/Apply, Geometry Clearance, UI는 변경하지 않는다. Fixed Ports, Mode, Manufacturing Dimensions와 Port–Lens coaxial policy를 유지한다. Main 병합은 수행하지 않는다.

## 기존 코드와 입력 재사용

- D2.8-A `angleFixture`, `launchInput`, `projectedMask`, 기존 `addLenses`, `lensDomain`, manufacturing bounds를 재사용한다.
- D2.6 `tracePupilRay`의 spherical Snell / internal glass OPL과 `tubeJacobian`의 exit-plane area Jacobian·hidden caustic 검사를 사용한다. 새 Ray Solver를 만들지 않는다.
- Source / Target: (0,0,0), (10 mm,0,±50 µm); parallel axes, circular Gaussian MFD 9.2 µm; λ=1310 nm, air. 기존 Port frame 전체를 비교한다.
- Lens curvature는 **23° 기준의 기존 두 Lens** 값으로 모든 Angle에서 고정한다. Thickness 300 µm, clear radius 200 µm, outer radius 240 µm를 보존한다. Mirror clear/body radius 200/220 µm, backing 20 µm, mechanical clearance 1 µm를 보존한다.
- +50 µm에서 21/23/25° × Lens endpoint position 0.8/1.0/1.2의 9개 배치와 −50 µm/23°/1.0 대칭 Control을 기록한다. Radius / Mode / Part dimensions를 최적화하지 않는다.
- 두 Lens가 서로 뒤집은 동일 형상이고 Mode가 circular / 동일함을 확인한 경우에만 receiving Lens에 reciprocity를 적용한다. 미지원 비대칭 Lens나 arbitrary Port가 들어오면 exporter 검사를 통과하지 못한다.

## 구현한 Reference

### Lens 출구 Field와 한계

기존 Pupil의 Source Gaussian을 launch plane까지 전파한다. 4096개 radial intervals에서 Snell / OPL을 계산하고, exit radius가 단조이며 Jacobian이 양수인지 검사한다. 입력 radial coordinate r₀, 출구 r₁, 기존 Jacobian J에 대해

`U_exit(r₁) = sqrt(I_launch(r₀)/J) exp[i k (C_launch r₀²/2 + OPL(r₀) − OPL(0))]`.

Time convention은 exp(−iωt), forward carrier exp(+ikx)를 제거한 envelope다. Quadratic phase를 제거하거나 Gaussian으로 다시 맞추지 않고 기존 전체 OPL phase를 사용한다. Source tail / clipping / 기존 0.3 rad launch-domain 밖의 잔여량을 기록하며, 이를 renormalize하지 않는다. Table interpolation은 radial stride 1 대 4로 별도 비교한다.

이것은 **geometrical eikonal / ray-tube boundary**다. Lens 내부·곡면 사이 Diffraction과 vector / coating effects의 독립 오차 한계가 없다. D2.8-A의 첫 Lens RMS OPD≈6.50 nm나 interpolation 수렴은 이 물리적 한계를 해소하지 않는다. 기존 Gaussian gate를 우회한 production candidate 평가에 연결하지 않는다.

### Free-space 전파

NumPy / SciPy의 검증된 FFT를 사용한다. test-only `tests/coherent/`에 한정하며 범용 POP API나 UI를 만들지 않는다.

`H_AS(f_y,f_z) = exp[i k L (sqrt(1 − λ²(f_y²+f_z²)) − 1)]`.

Fresnel Control은 `H_F = exp[−iπ λ L (f_y²+f_z²)]`를 사용한다. Negative distance는 지원하지 않는다. Evanescent 성분은 별도 집계 후 제외하므로 sub-wavelength near-field Reference가 아니다. 주파수에 따른 transfer-phase 변화가 FFT frequency step 당 π를 넘는 영역에는 numerical band limit를 적용하고 **제거된 성분을 오차 ledger에 기록**한다. 이 제거량을 physical absorption으로 표시하거나 재정규화하지 않는다.

FFT는 periodic window다. N 증가뿐 아니라 고정 dx에서 Window 확대, half-cell Sampling shift, joint Grid/Window corner를 따로 검사한다. 단순한 FFT norm 보존만으로 wraparound가 없다고 판단하지 않는다.

### Reflection / Aperture / Shadow 모델

각 Mirror에 대해 Householder reflection `R = I − 2nnᵀ`를 사용하여 chief direction과 transverse basis를 함께 운반한다. Reflection 두 번 후 basis가 원래 frame으로 돌아오고, 중간 chief direction이 실제 Mirror 중심을 잇는 방향과 일치함을 검사한다. Scalar ideal reflection의 일정한 phase는 두 번의 반사에서 공통 phase가 되며, coating phase는 평가하지 않는다.

이 unfolding은 **무한 평면 Mirror의 좌표 변환**이다. finite tilted aperture를 normal plane으로 옮겨도 정확하다는 뜻이 아니다. 대체 모델에서는 다음 순서를 사용한다.

1. Lens exit → upstream neighbouring-body Screen.
2. Mirror 1의 projected elliptical clear aperture.
3. 실제 chief-ray Mirror 간 거리만큼 free-space propagation.
4. Mirror 2의 projected clear aperture.
5. downstream neighbouring-body Screen.

Projected aperture는 `y² + (z/sin(θ/2))² < a²`다. Opaque backing projection은 disc radius와 실제 thickness를 포함한 유한 silhouette이며, 기계적 1 µm clearance shell을 흡수체로 사용하지 않는다. 각 Screen에서 Field를 곱한 뒤 전파하므로 두 Mirror의 개별 transmission을 단순 곱하지 않는다.

Body Screen의 nominal 위치는 중앙 silhouette edge의 axial 위치를 사용한다. 비교용 `collapsed` 모델에서는 body Screen을 각 Mirror의 reference plane에 겹친다. 두 위치는 **동일 3D geometry의 서로 다른 근사법**이며 실제 부품을 이동시킨 설계 대안이 아니다. 이 차이는 numerical error가 아닌 model sensitivity로 기록한다.

### Output Mode projection과 Power 구분

동일한 reverse Lens에서 Target Mode가 역방향으로 방출한 Field를 계산하고 conjugate하여 adjoint receiver를 만든다. 마지막 Screen plane에서 overlap을 계산하면, clipping으로 생긴 넓은 회절장을 마지막 Lens까지 작은 FFT window로 전파하는 오류를 피할 수 있다. Free-space reciprocity의 bilinear complex integral을 별도 검사한다.

- `lastScreenL2`: 마지막 대체 Screen 직후의 ∫|U|² dA. Receiving Lens 뒤의 Transmission이 아니다.
- `reciprocalModePowerL2`: unit Port Gaussian / eikonal boundary convention에서 계산한 |overlap|². Target aperture loss를 숨기기 위해 target field를 재정규화하지 않는다.
- `conditionalOverlapL2`: |overlap|² / (P_field P_adjoint). 위 값과 구분한다.
- `longitudinalScalarFlux`: propagating angular spectrum에 cosθ를 가중한 scalar longitudinal flux. Hard edges에서 paraxial L2와 차이가 생길 수 있다.
- 이 세 대체 모델 지표는 실제 Fold qualification / Total Coupling 값이 아니다. JSON의 `physicalFold.transmission`, `physicalFold.outputModeCoupling`, `totalCoupling`은 별도 `null / Uncomputed`다.

D2.8-A의 19.80%는 실제 3D 순차 Ray train의 결과이고, 본 단계의 마지막 대체 Screen L2와 평가 plane / geometry model이 다르다. 두 값의 차이를 단순히 Diffraction loss라고 해석하지 않는다.

Mask 제거량, numerical band removal, evanescent removal을 분리한다. Free-space에서는 L2와 scalar longitudinal flux 보존을 검사하고, 전체 대체 모델에서는 입력 L2 = 최종 L2 + Mask 제거량 + numerical/evanescent 제거량의 닫힌 ledger를 검사한다. Maxwell Poynting flux나 실제 metal absorption을 계산한 것이 아니다.

## Independent Validation 및 수렴 기준

| 검사 | 독립 비교 / 통과 기준 |
|---|---|
| Free Gaussian | complex Analytical Fresnel solution; radius, curvature, Gouy phase 동시 검사; 상대차 <1e−10 |
| AS low-NA limit | Analytical paraxial Gaussian과 상대차 <1e−4 |
| Free propagation | L2 / longitudinal scalar flux 보존, translated phase-ramp semigroup, reciprocity |
| Mode overlap | Gaussian curvature mismatch의 Analytical overlap; global phase invariance; Cauchy bound |
| Single aperture | 독립 Gauss–Legendre Fresnel integral 및 complex-erf closed form; central ROI 전체 Field와 Window 확대 비교 |
| Aperture power | Circular Gaussian analytical power, D2.8-A projected-mask 적분과 zero-distance common-mask limit |
| Oblique aperture | FFT를 쓰지 않는 tilted / flat Rayleigh–Sommerfeld-I surface quadrature, 128/256/512 orders |
| Negative controls | Evanescent 제거·보고, backward propagation 거부, 부족한 refinement는 Unresolved |

대체 Fold의 numerical convergence는 연속 세 Grid의 두 refinement에서 scalar metric 변화 <0.002 absolute, complex Field L2 상대변화 <0.05, Window edge fraction <0.001, numerical band removal <0.001을 요구한다. Window/Sampling/joint-corner 변화는 <0.002, Lens interpolation 변화는 <2e−5를 요구한다. 이는 관측된 수치 안정성이고 rigorous physical error bound가 아니다. 실패 항목은 그대로 `Unresolved`로 남기며 후보를 승격시키지 않는다.

기준 ±50 µm/23°는 512/1024/2048/4096² Grid를 검사하고 마지막 세 Grid를 판정한다. 다른 bounded 배치는 512/1024/2048²의 제한된 budget이다. Window는 dx=1 µm에서 0.512/1.024/2.048 mm, joint corner는 dx=0.5 µm / W=1.024 mm로 검사한다. Half-cell shift는 Port 이동이 아닌 quadrature sampling 변화다.

## Oblique geometry의 독립 한계 검사

Mirror를 펼친 뒤 tilted aperture가 `x = αz`, `α=cot(θ/2)`에 있을 때, 면적벡터는 `n dA = (1,0,−α) dy dz`다. Full RS-I kernel의 1/(kr) 항과 이 obliquity를 유지하여 prescribed Dirichlet aperture Field를 적분한다. 입력은 local w=50 µm Gaussian, 관측 plane은 1 mm 뒤, 사전에 고정한 6개 좌표다. 실제 Port Mode를 이 local Gaussian으로 바꾸지 않는다.

이 계산 자체도 planar Dirichlet aperture의 Scalar boundary problem이며, metal Mirror / finite backing / edge currents / multiple scattering의 완전한 3D EM 해석이 아니다. 목적은 정상면 projected-mask 모델에 누락된 경사면 전파 효과를 독립적으로 드러내는 것이다. Six-point Field discrepancy는 전체 Fold의 error bound가 아니다.

## 실행 결과

로컬 전체 실행에서 **114 Reference checks PASS**, Golden 001 **246 checks PASS**, Typecheck / Build PASS를 확인했다. 최종 exact-head CI 결과와 artifact 검증은 Draft PR에 기록한다. Reference implementation/control PASS와 bounded numerical convergence 및 physical Fold Uncomputed는 서로 다른 상태다.

| 독립 Control | 실제 계산 결과 |
|---|---:|
| Gaussian complex Fresnel relative error | 3.91×10⁻¹⁵ |
| AS와 low-NA paraxial Gaussian 차이 | 1.73×10⁻⁵ |
| 단일 rectangular aperture complex ROI error, W=2.048 mm | 4.28×10⁻⁴ |
| Flat AS aperture와 independent RS-I six-point 차이 | 6.84×10⁻⁴ |
| Tilted versus flat aperture, 21/23/25° | 10.24% / 9.95% / 9.45% |
| RS quadrature 최대 연속 refinement 변화 | 1.2×10⁻⁹ 미만 |

아래 표는 **transverse-screen + eikonal-Lens 대체 모델의 diagnostic**이다. T는 마지막 Screen의 L2 norm, M은 reciprocal Mode power L2다. 수렴한 행도 실제 Fold의 검증된 Transmission / Coupling이 아니며 candidate ranking에 사용하지 않는다. 모든 행의 physical Fold metrics는 Uncomputed다.

| Offset / Angle / Position factor | 최종 N | T | M | Numerical status |
|---|---:|---:|---:|---|
| +50 µm / 21° / 0.8 | 2048 | 0.159221 | 0.005563 | converged |
| +50 µm / 21° / 1 | 2048 | 0.281729 | 0.082593 | converged |
| +50 µm / 21° / 1.2 | 2048 | 0.586547 | 0.312708 | Unresolved |
| +50 µm / 23° / 0.8 | 2048 | 0.093716 | 0.001791 | Unresolved |
| +50 µm / 23° / 1 | 4096 | 0.146200 | 0.028746 | converged |
| +50 µm / 23° / 1.2 | 2048 | 0.319433 | 0.121055 | Unresolved |
| +50 µm / 25° / 0.8 | 2048 | 0.045661 | 0.000429 | Unresolved |
| +50 µm / 25° / 1 | 2048 | 0.060487 | 0.006823 | Unresolved |
| +50 µm / 25° / 1.2 | 2048 | 0.136472 | 0.029933 | Unresolved |
| −50 µm / 23° / 1 | 4096 | 0.146200 | 0.028746 | converged |

기준 ±50 µm/23°의 마지막 세 Grid (1024/2048/4096)에서 T의 최대 연속 변화는 0.0008972, M은 0.0002595, conditional overlap은 0.0005698이다. complex Field 변화는 2.33% → 1.12%였다.

23°의 nominal body-Screen 배치에서는 T≈0.14620, M≈0.02875, conditional overlap≈0.19662다. 같은 coarse grid에서 body Screen을 Mirror reference plane으로 collapse하면 T가 약 0.03315만큼 달라진다. 이는 screen 위치 근사에 대한 민감도이지 허용 manufacturing displacement나 실제 Diffraction-loss bound가 아니다.

Finest-grid L2 ledger의 제거량은 upstream body projection 0.409173, Mirror 1 aperture 0.079621, Mirror 2 aperture 0.011059, downstream body projection 0.352501이다. Exact 숫자는 JSON의 `ledger`가 기준이며, free-space Diffraction 자체를 흡수 손실로 분류하지 않는다. `spectral`에는 paraxial L2와 longitudinal scalar flux의 차이, NA>0.1 / Nyquist-edge / evanescent 성분을 보존한다.

기준 Fold의 마지막 Screen에서 longitudinal scalar flux≈0.14458로 L2≈0.14620와도 차이가 난다. NA>0.1 성분의 L2는 약 0.01253이며, 좁은 hard edge 뒤의 paraxial norm을 실제 power로 그대로 해석해서는 안 된다.

6개 Unresolved 배치의 실패 원인은 scalar metric refinement, complex Field refinement 또는 subpixel sampling이다. Window나 Model Gate를 느슨하게 하여 통과시키지 않는다. 전체 global design space의 불가능성은 판단하지 않았다.


## 재현과 산출물

```bash
npm ci
python3 -m pip install -r tests/coherent/requirements.txt
OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 npm run benchmark:coherent
npm run benchmark:golden
npm run benchmark:finite-beam
npm run typecheck
npm run build
```

`benchmark-results/d28b-input.json`은 Git/base/head SHA, Source hashes, 전체 고정 Projects·bounds·Reflection bases·Lens OPL tables를 포함한다. `d28b-coherent-field.json`은 input hash, runtime versions, control assertions, loss ledger, 모든 Grid/Window/Sampling 결과와 PASS/FAIL/Unresolved/Uncomputed를 포함한다. Stale input / changed source를 검사한다. `--controls-only` 또는 `--case`는 `partialRun: true`로 명시하며 완료된 전체 Benchmark로 표시하지 않는다.

CI는 기존 Model / Browser / Golden workflow를 보존하고 별도의 `coherent-reference` job을 실행한다. `d28b-coherent-reference` artifact에는 두 JSON을 함께 보존한다. 실제 완료한 CI / Git SHA / artifact 검증은 Draft PR 설명에 기록한다.

## 다음 개발 권고

1. 실제 tilted Mirror surfaces와 opaque backing의 boundary interaction을 포함한 **이 Fold 전용** coherent reference가 먼저 필요하다. 단순한 normal-plane mask 위치 조정으로 coupling을 최적화하지 않는다.
2. Exact-plane scalar angular-spectrum rotation 또는 surface-integral reference를 먼저 single-Mirror와 two-Mirror controls로 교차 검증한다. Grazing edge / finite backing의 경계조건이 Scalar로 충분한지도 별도로 판단한다.
3. Lens eikonal boundary와 독립 finite-field Lens 전파를 비교해 Field handoff의 오차를 정한다. Gaussian gate 완화는 이 전체 train 근거가 생긴 뒤의 별도 변경이다.
4. 검증된 full-fold evaluator가 생기면 bounded optimization으로 진행한다. Prism, 범용 POP, UI, coating/polarization, Total Coupling, tolerance/Yield는 현재 범위 밖이다.

## Reference formulation sources

- K. Matsushima & T. Shimobaba, *Band-limited angular spectrum method for numerical simulation of free-space propagation in far and near fields*, Optics Express 17, 19662–19673 (2009), [DOI](https://doi.org/10.1364/OE.17.019662), [author repository](https://kansai-u.repo.nii.ac.jp/records/11127). FFT transfer-function sampling과 numerical band limitation의 근거. 본 코드의 phase-gradient cutoff와 window 검증이 논문의 모든 알고리즘을 구현한다는 뜻은 아니다.
- K. Matsushima, H. Schimmel & F. Wyrowski, *Fast calculation method for optical diffraction on tilted planes by use of the angular spectrum of plane waves*, JOSA A 20, 1755–1762 (2003), [DOI](https://doi.org/10.1364/JOSAA.20.001755). Tilted-plane propagation이 별도의 coordinate/spectral treatment를 요구하는 근거. 그 알고리즘을 본 단계의 production Solver에 구현하지 않는다.
- TU Delft, [Scalar diffraction theory](https://qiweb.tudelft.nl/aoi/scalardiffractiontheory/scalardiffractiontheory/), [Scalar diffraction optics](https://interactivetextbooks.tudelft.nl/interactive-optics/content/Chap6_Diffraction/DiffractiveOptics_2022_01Clean.html). Angular Spectrum / RS integral / boundary assumptions. Tilted surface의 area-vector 적용은 본 Reference에서 명시적으로 유도한 확장이다.
