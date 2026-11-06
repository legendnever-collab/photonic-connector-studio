# D2.8-C — Physical Boundary Validation & Fold Feasibility Decision

2026-11-06 · Base: Draft [#41](https://github.com/legendnever-collab/photonic-connector-studio/pull/41),
`d95ca6c219530a1ca7e6c95e283b9fd4c7f00c5b` · Branch: `benchmark/d28c-physical-boundary`.

## Engineering Decision: Path B — Model Insufficient

**현재 모델로 실제 ±50 µm Fold의 Optical Feasibility를 확정할 수 없다.**
경사면 좌표 및 Scalar 전파의 수치 검증과, 실제 유한 Reflector의 Boundary Solution 검증은 다른 문제다.
이번 검증은 전자를 통과했지만 후자의 적용 오차를 확보하지 못했다.
실제 Transmission, Output Mode Coupling, Maxwell Energy Ledger 및 Lens Handoff Error Bound는 `null / Uncomputed`다.
Bounded Optimization과 Candidate Qualification을 시작하지 않는다.

이는 이 Fold가 불가능하다는 판정이나 모든 Scalar 모델이 부적절하다는 주장이 아니다.
Finite Body를 경계조건까지 정의하고 독립적인 산란해와 비교하면 일부 Scalar 근사를 사용할 가능성은 남아 있다.
현재는 Path A의 물리 검증 근거도, Path C의 성능 기반 Topology 배제 근거도 없다.

## 1. Recovery 및 보존 범위

- D2.6 `tracePupilRay` / `tubeJacobian`, D2.7 Geometry, D2.8-A Finite Body / Ray Flux,
  D2.8-B Scalar AS / Fresnel / RS-I 및 `d28b-input.json`을 그대로 재사용했다.
- Source/Target (0,0,0)/(10 mm,0,±50 µm), Parallel Axes, 1310 nm, MFD 9.2 µm를 유지한다.
  Lens Thickness 300 µm, Clear Radius 200 µm, Mirror Clear/Body Radius 200/220 µm,
  Backing Thickness 20 µm, 제조·Gaussian Gates 및 Coaxial Mount Policy를 변경하지 않았다.
- `src/`, 기존 Tests 및 기존 CI Jobs는 변경하지 않는다. 별도 Python Controls, 실행 명령,
  `boundary-reference` CI Job, 보고서와 Handoff만 추가한다.
- Project와 Fixed Port/Mode의 입력 Hash 및 계산 전후 불변성을 검사한다.
  Golden 001의 Search/Apply/Undo와 Browser Regression은 기존 검증에 맡긴다.
- D2.8-B의 약 9–10% six-point 차이는 Projected Screen 근사의 진단이다.
  이 값을 실제 Fold의 Field Error Bound로 사용하지 않는다.

## 2. 왜 실제 Finite Boundary가 아직 닫힌 문제가 아닌가

Scalar Helmholtz Boundary Problem은 Geometry 외에 Dirichlet, Neumann, Robin/Impedance
등의 경계조건과 입사장이 필요하다. 실제 Maxwell Problem은 Material Response,
Polarization, 접선 E/H의 Interface Conditions 및 Radiation Condition이 필요하다.

현재 Fixture의 `reflect`와 Opaque Cylinder는 광선의 방향 전환 및 교차/차폐를 정의한다.
다음 항목은 정의하거나 검증하지 않는다.

| 경계/효과 | 현재 상태 | 추가로 필요한 근거 |
|---|---|---|
| Clear Mirror Front | Ideal Geometrical Reflection | Complex Reflection 또는 명시적 이상 Boundary Model |
| 200–220 µm Front Rim, Cylinder Side, Back | Opaque Ray Solid | Absorbing/Reflecting Response, Surface Impedance 또는 Material ε/μ |
| Polarization | `unspecified` | 명시한 Polarization별 응답 또는 무시 가능한 차이의 근거 |
| Edge Field | 계산하지 않음 | 유한 두께·곡선 Edge의 독립 산란해 |
| 두 Body 사이의 재산란 | 계산하지 않음 | Multiple Scattering이 작다는 비교 또는 이를 포함한 해 |
| Lens Exit Field | Eikonal + Ray-Tube Jacobian | 실제 Spherical Lens의 독립 Wave Field 비교 |

RS-I에 `U_inc × aperture`를 넣으면 무한 평면의 Prescribed Dirichlet Data에 대한
출사측 Field를 계산한다. RS-II에 입사장의 Normal Derivative를 잘라 넣으면
다른 Neumann Boundary Problem이다. 어느 쪽도 유한 Mirror의 유도 Field를 자동으로 구하지 않는다.
실제 Body에는 Front뿐 아니라 Rim/Side/Back이 있고, 그 응답이 Front Field에도 영향을 줄 수 있다.
적분 Grid를 늘려도 이 Boundary Data의 모델 오차는 사라지지 않는다.

### 실제 Geometry에서 계산한 관련 길이

23°는 입사각이 아니라 Chief Ray의 Bend Angle이다.

| +50 µm / 23° / Position Factor 1 | 계산값 |
|---|---:|
| Grazing Angle / Incidence from Normal | 11.5° / 78.5° |
| 두 Mirror Front Plane의 Normal Separation | 25.5122 µm = 19.4749 λ |
| 중앙 Projected Clear Half-Aperture | 39.8736 µm |
| Neighbouring Body의 Central Projected Half-Gap | 6.13905 µm = 4.68630 λ |
| Backing Thickness | 20 µm = 15.2672 λ |

Normal Separation은 `abs((c2−c1)·n1)`과 `|offset|/[2 cos(θ/2)]`로 독립 확인했다.
Backing은 각 Front의 뒤에 있으므로 **Front Gap에서 두께를 빼지 않는다**.
Projected Half-Gap과 Normal Separation도 서로 다른 길이다.
작은 Projected Gap과 Grazing Incidence는 Edge/Polarization 검증이 필요한 이유지만,
그 길이만으로 Scalar 오차 크기나 Fold 불가능성을 단정하지 않는다.
같은 Audit을 기존 10개 배치 및 ±50 µm 대칭 Control에 수행했다.

## 3. Single-Mirror / Tilted Propagation 검증

### Exact Infinite Scalar Mirror

Off-axis Propagating Plane Wave 네 개와 서로 다른 Complex Weights를 사용했다.
Householder Transform `H=I−2nnᵀ`의 결과를 별도 삼각함수식 Reflection과 비교한다.
실제 Tilted Plane에서 Dirichlet 해 `U_inc−U_ref=0`와 Neumann 해
`∂n(U_inc+U_ref)=0`를 **각각 다른 이상 Boundary Problem**으로 검사했다.
이것은 3D Vector Polarization의 대체 모델이 아니다.

21/23/25° 모두 Boundary Residual <1e−11, 성분별 Incoming/Outgoing Normal Scalar Flux 차이
<1e−14를 통과했다. Spectral Mode Projection의 Cauchy Bound와 Global Phase Invariance도 검사했다.
유한 면적에 대한 Poynting Flux나 실제 Output Fiber Coupling을 계산한 것은 아니다.

### 실제 Tilted Disk Coordinate의 독립 Surface Cubature

Unfolded Outgoing Frame에서
`x=cos(θ/2) ρ sinφ`, `y=ρ cosφ`, `z=sin(θ/2) ρ sinφ`,
`n=(sin(θ/2),0,−cos(θ/2))`, `dA=ρ dρ dφ`를 사용한다.
RS-I는 `n·(r−r')` Obliquity와 `1/(kR)` 항을 유지한다.
RS-II는 같은 Paraxial Gaussian의 실제 Surface Normal Derivative를 사용한다.
Carrier는 해석적으로 제거하여 큰 Phase의 차감 오차를 줄인다.

새 Polar Disk Cubature는 D2.8-B Cartesian Ellipse Cubature와 독립적인 적분 변수/면적 가중치를 쓴다.
384→768→1536 Order의 연속 두 Refinement를 비교했다.
초기 96/192/384 Order에서는 Refinement Gate를 통과하지 못해 Order를 늘렸고 Tolerance는 유지했다.

| Bend Angle | Polar vs 기존 RS-I Relative Complex Field Error | D/N Prescribed Aperture 간 Field Difference |
|---|---:|---:|
| 21° | 9.18e−13 | 3.1713% |
| 23° | 1.03e−12 | 2.7867% |
| 25° | 1.15e−12 | 2.1413% |

두 비교는 w=50 µm Local Diagnostic Gaussian, Radius=200 µm,
1 mm 뒤의 고정 6개 관측점에서 계산했다. 실제 Port를 이 Gaussian으로 바꾸지 않는다.
연속 Quadrature Field 변화는 최대 1.61e−12 미만이다.
**D/N 차이는 다른 Boundary Data의 해 차이이며 실제 Mirror의 오차 상한이나 TE/TM 차이가 아니다.**

별도의 Unobstructed Control은 적분 Support Radius 0.6/0.8/1.0 mm,
Order 512/1024, 2 mm Observation Plane을 사용했다.
마지막 Low-NA Gaussian Relative Field Difference는 8.62e−6,
마지막 Window 변화는 3.96e−6이다. 입력 Gaussian 자체가 Paraxial이라는 한계를 포함한다.
이 Support 확대는 무한면 극한의 **수치 Control**이며 실제 Mirror 크기 변경이 아니다.
지원 Half-Space 밖의 관측점은 거부한다.

### Two-Mirror 확장을 멈춘 지점

무한 Mirror의 좌표/위상 및 Prescribed Aperture 전파는 검증했다.
그러나 **Single Finite Reflector + Opaque Backing 자체의 Boundary Gate는 통과하지 못했다**.
따라서 두 유한 Mirror를 잇는 실제 Field Solver를 구현하지 않았다.
Shadow를 다시 임의 Screen으로 대체하거나 RS-I 연쇄 결과를 실제 Fold로 보고하지 않는다.

## 4. Lens-to-Field Handoff

기존 First Lens의 실제 Vertex Position, Curvature, 300 µm Thickness와
N-BK7 Index 1.5035829054, 기존 Launch Field를 읽었다.
독립 Reference는 두 Spherical Surface를 각 Vertex의 **Quadratic Phase Power**로 근사하고,
그 사이 Glass에서 λ/n의 Fresnel Diffraction을 전파한다.
입구/출구 Margin도 보존한다. Infinite Aperture, Lossless, Paraxial Control이며
실제 Spherical Interface나 Fresnel Reflection을 해석한 결과는 아니다.
Field는 L2가 보존되는 Power-Normalized Scalar Amplitude이며 Glass 안의 실제 E 진폭은 아니다.

FFT Reference와 별도 Gaussian Integral Recurrence를 비교했다:
`U=A exp(−a r²)`에서 Reduced Propagation Length `B=L/n`에 대해
`a'=a/(1+2iBa/k)`, `A'=A/(1+2iBa/k)`;
Surface Power `P=(n₂−n₁)/R`에서 `a'=a+ikP/2`다.
Production Q 또는 Ray Solver를 이 해석 Reference에 호출하지 않는다.

| +50 µm / 23° Seed의 First Lens Control | 실제 계산 결과 |
|---|---:|
| FFT vs Closed Gaussian Integral, 가장 거친 채택 Grid | 2.53e−11 |
| 같은 비교, 최종 Grid | 1.10e−15 |
| Quadratic Ray vs Diffractive Quadratic Field | 1.51010% |
| 기존 Spherical Eikonal vs Diffractive Quadratic Field | 8.08879% |
| 기존 Spherical Eikonal vs Quadratic Ray Field | 6.74486% |

마지막 세 비교는 Global Piston만 제거한 Relative Complex Field L2 Difference다.
Amplitude Renormalization이나 Tilt/Defocus Fit은 하지 않았다.
1.51%는 같은 Quadratic Train에서 Launch→Exit 사이 Diffraction 생략의 진단이며,
Glass 내부만의 독립 효과는 아니다. 8.09%에는 Spherical Aberration과 두 모델의 차이가 함께 들어 있다.
**8.09%를 Eikonal의 물리 오차나 Coupling Loss로 해석할 수 없다.**

Grid N=512/1024/2048, Window=768 µm;
추가 Window=1536 µm, N=2048로 같은 dx=0.75 µm를 비교했다.
모든 채택 Grid의 Complex Analytic Error <1e−7,
L2 Ledger Residual <1e−12, Band/Evanescent 제거 합 <1e−8을 요구한다.
초기 512 µm Window의 오차 Plateau를 확인하고 Window를 넓혔으며 Gate를 완화하지 않았다.

별도 Flat Slab Negative Control은 300 µm Glass, C=0 Waist를 사용한다.
w=53.2734 µm에서는 Wave/Geometric Width Ratio=1.00043이지만
Field Difference=1.46565%이고, w=4.6 µm에서는 Width Ratio=4.05705,
Field Difference=1.04558이다. 폭 변화가 작거나 Ray Energy가 보존된다는 사실만으로
Complex Field Handoff가 정확하다고 판단할 수 없음을 보여준다.
이 Slab과 작은 Waist는 진단용이며 실제 Lens/Port를 변경하지 않는다.

실제 Spherical Lens 내부 Diffraction의 독립 오차는 아직 없으므로
`lensHandoff.status=Uncomputed`, `physicalSphericalLensFieldErrorBound=null`을 유지한다.

## 5. Energy / Mode / Regression 상태

| 항목 | 검증된 범위 | 실제 Fold 상태 |
|---|---|---|
| Energy / Flux | 무한 Scalar Mirror의 Normal Flux, Quadratic Lens의 L2 Ledger, 기존 D2.8-B Ledger | Maxwell Energy Balance Uncomputed |
| Mode Projection | Ideal Spectral Mode의 Cauchy/Global Phase, 기존 Gaussian/Reciprocity Controls | Actual Output Mode Coupling Uncomputed |
| Grid/Window | Tilted Cubature와 Infinite-Support Control, Quadratic Lens Grid/Window | Finite Body Model Error는 미검증 |
| Port/Mode | 입력 Hash/불변성, ±50 µm Audit, 기존 Golden/UI Tests | Fixed Constraints 유지 |

로컬 D2.8-C **57 Checks PASS**, 전체 D2.8-B **114 Checks PASS** (`partialRun=false`),
기존 Model **500 Tests / 41 Files PASS**, Typecheck / Build PASS를 확인했다.
Base PR #41 CI의 Golden Artifact를 내려받아 ZIP SHA256 및 CRC를 확인했고,
Golden 전체 Cases/Negative Controls/Checks, D2.7 전체 Cases,
D2.8-A 전체 Cases/Checks가 현재 로컬 결과와 동일함을 확인했다.
최종 Commit의 CI 및 Browser 결과와 Artifact 검증은 Draft PR에 기록한다.
PASS는 각 Control의 성공이며 실제 Fold Qualification을 뜻하지 않는다.

```bash
npm ci
python3 -m pip install -r tests/coherent/requirements.txt
OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 npm run benchmark:boundary
OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 npm run benchmark:coherent
npm test
npm run build
```

`benchmark-results/d28c-physical-boundary.json`은 Base/Git/Head SHA, Input/Source Hash,
Runtime Versions, 각 Assertion, Numerical Histories, 10개 Geometry/Boundary Audits,
Null Physical Metrics와 Path B Decision을 포함한다. Stale Input/Source는 거부한다.
CI `d28c-physical-boundary` Artifact는 재현에 필요한 `d28b-input.json`도 함께 보존한다.
큰 중간 Field Array는 저장하지 않고 동일 입력으로 재계산한다.

## 6. 다음 최소 작업 — D2.8-D Single Finite Boundary Reference

1. **한 개의 Finite Mirror + Backing**에 대해 Clear Front, Rim, Side, Back의 Material 또는
   Ideal Boundary Model과 입사 Polarization을 명시한다. 실제 Material이 없으면 이상 Control임을 표시한다.
   PEC Cylinder 전체를 Reflector로 쓰는 Control은 Clear Radius 200 µm / Body Radius 220 µm의
   기존 후보와 광학적으로 같지 않으므로 Candidate Reference로 승격하지 않는다.
2. 기존 외부 Maxwell Solver의 FEM/BEM/FDTD 중 해당 Geometry에 맞는 것을 사용한다.
   새 범용 Solver를 만들지 않는다. Local Mirror 영역만 해석하여 10 mm 전체 FDTD를 피한다.
   2D TE/TM Strip이나 Sommerfeld Half-Plane은 초기 Control로 쓸 수 있지만 3D Disc 검증을 대체하지 않는다.
3. Infinite-Plane Analytic Control → Finite Mirror Mesh/Domain/PML Refinement → Complex Field,
   Incident/Reflected/Transmitted/Absorbed Flux 및 Off-Surface Sampling을 검사한다.
   Sharp Edge/Dispersive Material의 수렴을 별도로 확인한다.
4. 명시한 수치 오차와 Polarization별 결과로 Scalar Surface Approximation을 비교한다.
   허용 오차를 먼저 정하고 단일 Mirror가 통과한 경우에만 동일 Body 두 개의 Multiple Scattering으로 확장한다.
5. Fold Boundary 검증과 별도로 실제 Spherical Lens의 독립 Wave/Beamlet/상용 POP Reference를 확보한다.
   Quadratic Control과 Full Spherical 결과를 구분하여 Handoff Error를 결정한다.

그 후에야 Path A(Bounded Optimization) 또는 Path C(검증된 성능에 근거한 대체 Topology)를 선택한다.
현재 단일 Seed의 Surrogate 성능만으로 Prism/다른 Topology 개발을 시작하거나 Fold를 폐기하지 않는다.
Main 및 기존 Draft PR은 병합하지 않는다.

## 참고한 이론 / 구현 자료

- [TU Delft, Scalar Diffraction Optics](https://interactivetextbooks.tudelft.nl/interactive-optics/content/Chap6_Diffraction/DiffractiveOptics_2022_01Clean.html):
  Angular Spectrum / RS는 주어진 Plane Field의 Homogeneous Propagation을 다루며 Vector Boundary Solution과 다르다.
- [Matsushima, Schimmel & Wyrowski, JOSA A 20, 1755–1762 (2003)](https://doi.org/10.1364/JOSAA.20.001755):
  Tilted Plane의 Coordinate/Spectral Treatment. 본 작업은 논문의 범용 FFT Rotation Solver를 구현하지 않는다.
- [Mansuripur, Nanophotonics (2020), Classical Scattering and Diffraction Tutorial](https://arxiv.org/abs/2009.06706):
  Scalar/Vector Diffraction과 Perfectly Conducting Half-Plane의 구분.
- [Meep, Subpixel Smoothing](https://meep.readthedocs.io/en/latest/Subpixel_Smoothing/):
  Sharp Edge, Interface Field, Dispersive Material에서의 수렴 한계. 이번 작업에서 Meep를 실행한 것은 아니다.

문헌은 적용 범위 판단의 근거이며 위 Numerical Results는 저장소의 실행 결과다.
