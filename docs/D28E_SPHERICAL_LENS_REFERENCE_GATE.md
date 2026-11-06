# D2.8-E — Independent Spherical Lens Reference Feasibility Gate

2026-11-06 · Base Draft [#43](https://github.com/legendnever-collab/photonic-connector-studio/pull/43)
`7c45d7c07dc7b43dc87598277d2002bf50b7d696` · `benchmark/d28e-spherical-handoff`.

## Engineering Decision: Path B — Reference / Resource Insufficient

**Reference Feasibility Gate에서 중단한다. 실제 Spherical Lens의 독립 Field Handoff를 검증했다고 하지 않는다.**
외부 Diffractio 1.0.0은 설치·실행되지만, 검사한 Scalar WPM은 Reflection-free Forward Model이다.
현재 Geometry의 실제 E/H Boundary Solution과 Normal Optical Flux를 제공하는 Reference로
채택하지 않았다. 적합한 Vector / Boundary-aware Reference의 실행 환경과 수렴 예산도 확보하지 못했다.

따라서 Task C의 실제 Lens Field / Exit Wavefront / Mode Projection / Grid·Window·Domain·Plane
Convergence와 Task D의 실제 Lens Error Assessment는 **Uncomputed / Not run**이다.
새 범용 Maxwell/POP Solver, Production Physics 수정, Gaussian Gate 완화는 하지 않는다.
Fold / Explicit Free-Lens의 최종 Coupling과 Yield도 계속 Uncomputed다.

이 판정은 현재 조사·실행 환경에서 Reference가 확보되지 않았다는 뜻이다. Spherical Lens 해석이나
Optical Connection 자체가 불가능하다는 증명도, 모든 Scalar Approximation의 배제도 아니다.
Field 1%, Flux 0.5%는 제안된 **Numerical Validation 목표**일 뿐 실물 성능 인증 기준이 아니다.

## 1. Recovery와 입력 고정

원격 Draft #43과 `main`을 확인하고 #43의 정확한 HEAD에서 새 Branch를 만들었다.
당시 main은 `a3918044057a815313eb8a10d5912c522adaf29b`다. D2.6 / D2.6.1과
Stacked #38 → #39 → #40 → #41 → #42 → #43의 Source / Tests / Reports를 보존한다.
기존 `tests/coherentFieldInput.test.ts`의 `plus-23-1` Case에서 첫 Lens만 잠갔다.
새로운 Lens Generator나 Source Field Solver를 만들지 않았다.

| 항목 | 고정값 / 의미 |
|---|---|
| Source / Target | (0,0,0) / (10 mm,0,+50 µm), 기존 Frame·Mode의 직렬화 값 보존 |
| Vacuum wavelength | 1.310 µm |
| Source / Target MFD | 9.2 µm, circular Gaussian, polarization unspecified |
| Input normalization | 기존 unit-power scalar convention; 절대 W 지정 아님 |
| Lens Front / Rear vertex, global X | 617.766616 / 917.766616 µm |
| Spherical radii R1 / R2 | +655.148478 / −655.148478 µm |
| Center thickness | 300 µm |
| Clear / Outer radius | 200 / 240 µm, 서로 구분 |
| Glass / Surrounding index | N-BK7 모델 n=1.5035829054102239 / Air n=1 |
| Launch / Exit plane, global X | 585.492748 / 950.040485 µm |
| Incident amplitude radius w at launch | 53.273372 µm, 1/e field radius |
| Incident curvature C at launch | 1695.228824 m⁻¹ |

이는 저장소의 **Synthetic Fixture / Material Model 값**이다. 실측 Lens·Coating Specification이 아니다.
Clear Radius, Outer Radius, Part Bounds, Mount Policy를 축소/변경하지 않았다.
Full frozen contract는 `tests/benchmark/d28e-single-lens.json`이며 현재 exporter 출력과 정확히 비교한다.
Input JSON / Source / 외부 Package Source Hash, Git checkout / PR HEAD를 Artifact에 기록한다.

Scalar 입력은 기존 convention 그대로

\[
U(r)=\sqrt{2/(\pi w^2)}\exp[-r^2/w^2+i k_0 C r^2/2],\quad
\int |U|^2\,dA=1
\]

이다. `exp(-iωt)` / forward `exp(+ikx)` convention을 쓴다.
기존 Ray-Pupil은 이 위상의 gradient를 launch direction으로 사용하고 실제 Sphere Snell / Glass OPL /
Ray-Tube Jacobian을 계산한다. Lens 내부 Diffraction / Fresnel Reflection / Vector Field는 생략한다.
Scalar unit-power 정규화와 Maxwell의 `0.5 Re∫(E×H*)·n dA`는 자동으로 동일하지 않다.

## 2. 외부 Reference 조사와 Gate

| 기존 외부 구현 | 실제 Spherical / Glass 지원 | 이번 확인 / 채택 판단 |
|---|---|---|
| **Diffractio 1.0.0 Scalar WPM (XY → XYZ)** | 위치별 n(x,y,z)로 Spherical Volume과 내부 회절 표현 가능. Thin Lens만 지원하는 도구는 아님 | **설치·실행 확인.** 아래 독립 Controls와 단일 Slice Timing 실행. Reflection / E-H Continuity 부재로 실제 Field·Normal Flux Reference 미채택 |
| Diffractio Scalar XZ / 일반 2D TE/TM | 단면을 무한히 압출한 문제 | 원형 Lens의 sagittal diffraction을 재현하지 않으므로 대체 불가 |
| Diffractio Vector WPM | 별도 Vector 구현 존재 | 기능명만으로 모든 backward/interface/body physics를 포함한다고 가정하지 않음. 이번에 Vector implementation 실행·수렴 검증하지 않았으므로 채택하지 않음 |
| **Meep cylindrical m=±1** | 축대칭 dielectric volume, Vector Maxwell / 내부 반사 가능 | 구면대칭 Geometry를 이용하는 유망한 Reduced Reference. 실행 Package / 검증된 Source Setup 없음. 아래 Refinement 자원 Gate 미확보 |
| COMSOL Wave Optics / Beam Envelopes | Curved dielectric와 full Vector Field; 2D axisymmetric 기능 및 Lens Verification Example 존재 [S5–S7] | 실행 파일 없음, License 미확인. Phase/envelope 선택과 mesh 검증 필요. 외부 실행 자원 확보 시 우선 견적할 후보 |
| Bempp Maxwell Transmission / FMM | Homogeneous dielectric interfaces의 Surface Formulation [S8] | 설치·폐곡면 Mesh·Transmission Setup·Conditioning / FMM Resource Pilot 미확보. 새 Boundary Solver를 작성하지 않음 |

Scalar Reference라도 적용 범위가 독립적으로 검증되면 제한된 Field Shape 비교에 쓸 수 있다.
그러나 **Grid Convergence만으로 Forward Approximation / Interface Boundary의 적용 오차가 정해지지 않는다.**
이번에는 Reflection-free 조건을 실제 Lens의 새로운 물리 가정으로 채택하지 않았다.
Fresnel 계수만 사후 곱하거나 임의로 재정규화하여 정상 Flux 문제를 해결했다고 처리하지 않는다.

### 실제 Boundary 정의의 남은 부분

- 기존 real n은 Single-frequency, Lossless Ideal Glass Control을 정의하기에 충분하다.
  다만 Coating이 없다는 제조 사양, Rim/Side의 광학 응답, Clear Aperture 바깥 Annulus의
  Material/Boundary는 지정되어 있지 않다. Ray의 `clipped`는 전자기학적 흡수 Boundary가 아니다.
- 후속 실험에서는 **Ideal Bare Glass Control**을 실제 Coated Lens와 분리하고, Outer Radius까지의
  Glass/Annulus/Edge completion을 명시해야 한다. 작은 Gaussian Tail만으로 산란 영향의 상한을 인증하지 않는다.
- Polarization unspecified인 Port를 임의의 Vector Mode로 바꾸지 않는다. 두 독립 편광 Control과
  Source E/H construction을 별도로 정의하고, 동일 Tangential Gaussian / Normal Power를 확인해야 한다.
- Source-free Reference Plane의 Angular Spectrum으로 longitudinal E / H를 구성할 수 있지만,
  Vector Completion 선택, transverse projection, evanescent 처리, source injection 검증이 추가로 필요하다.

## 3. 실행한 외부 Package Controls — Lens 계산과 구분

외부 패키지의 **수정하지 않은** `WPM_schmidt_kernel`, `PWD_kernel`, `get_k`를 사용했다.
전파 Kernel을 복사하거나 새 Solver를 작성하지 않았다. 별도 Python 환경으로 기존 D2.8-B/C의
NumPy 2 환경을 보존했다. 새 환경은 `requirements-lens-gate.txt`에 고정한다.

### 3.1 Homogeneous Plane Wave

32² / 64² / 128² Grid, Air / 실제 Fixture n, Normal / Tilted Fourier Mode에서
`exp(i dz sqrt((n k0)^2−k⊥²))`와 외부 Kernel의 Complex Field를 비교했다.
Complex Phase와 L2 Controls를 통과했다. 이 검사는 sign / carrier / FFT sampling을 검증하며,
굴절면이나 Lens의 Accuracy를 검증하지 않는다.

### 3.2 Ideal Bare Plane Slab — 생략된 반사의 구체적 영향

실제 Lens와 **같은 n과 300 µm 두께**를 사용한 평행 무한 Slab Control이다.
입사/출사 Medium은 둘 다 Air, Normal Incidence, Monochromatic Coherent Wave다.
구면 Lens의 Geometry도, 실제 Coating도 아니다.

\[
R=\left(\frac{n-1}{n+1}\right)^2,\quad \delta=k_0nt,\quad
t_{\mathrm{slab}}=\frac{(1-R)e^{i\delta}}{1-R e^{2i\delta}},\quad
T=|t_{\mathrm{slab}}|^2
\]

| Quantity | 결과 |
|---|---:|
| Single bare interface Reflectance | 0.0404592663 |
| Reflection-free WPM output L2 / input L2 | 1.0000000000 |
| Coherent bare slab Normal Flux / input Flux | 0.8825085855 |
| Flux 차이 / Input Flux | **0.1174914145** |
| Complex Field relative difference | 0.0733926549 |
| Piston만 제거한 relative difference | 0.0644874129 |

32/64/128 Grid에서 차이는 유지된다. Grid가 해결하지 못하는 **Boundary Model 차이**다.
Slab이 Air→Air이므로 Glass 안에서만 적용하는 `sqrt(n)` Amplitude 보정으로 이 차이를 없앨 수 없다.
한 Air→Glass interface에서 WPM Scalar u를 E로 그대로 읽으면 Flux가 n=1.50358인 반면,
물리 transmitted Flux는 0.95954다. 이 값은 Package Bug가 아니라 잘못된 Physical Interpretation을
검출하는 Control이다. Bare Slab의 11.75 percentage points 차이를 실제 Lens 손실·오차·보수적 Bound로
사용하지 않는다. Lens의 Curvature / Internal Return / Aperture가 다르면 결과도 달라진다.

### 3.3 Bounded Runtime Pilot

실제 첫 곡면의 Sag / Outer Radius를 사용한 **하나의 Air/Glass index slice**에서
128² / 256² / 512²별 warmup 후 독립 Kernel Call 8회를 측정했다.
각 Call은 동일 입력으로 시작한다. 출력이 다음 Call의 입력으로 연결되지 않으므로 Lens Propagation이 아니다.
512 µm Window의 한 Complex128 Plane은 각각 0.25 / 1 / 4 MiB다. Peak RSS와 실제 Timing은 JSON에 남긴다.
다른 작업과의 Resource Contention이 있으므로 최적 성능 Benchmark나 Full Lens Runtime으로 외삽하지 않는다.
전체 Field / Index Volume을 저장하지 않는 외부 streaming API도 존재한다 [S2].
즉 Scalar WPM을 메모리 때문에 불가능하다고 판단한 것은 아니다. **물리 Reference 적용 범위가 미확보**다.

## 4. 축대칭 Maxwell Resource Gate

첫 Lens는 축대칭이므로 Full 3D Box만 추정하여 해석을 포기해서는 안 된다.
Meep는 r–z Grid와 `exp(imφ)`를 지원한다. 정상 입사 Circular Polarization Basis에는
|m|=1을 사용하며, m=0의 radially/azimuthally polarized 문제로 바꾸면 동일 Input이 아니다 [S3].
Linear Polarization은 적절한 ±1 조합을 검증해야 한다. 아래는 **한 m 계산**의 비용이다.
향후 편심 Free-Lens는 이 단일 harmonic만으로 검증되지 않으며 별도 3D / harmonic expansion이 필요하다.

Planning Box: r=0…260 µm (Outer Radius 240 µm + 가정 Padding 20 µm),
axial length=404.547737 µm (기존 Launch–Exit + 양끝 20 µm).
`Δ=λ0/(n·pointsPerGlassWavelength)`, `Δt=0.5Δ/c`, 가정 Duration=10 ps.
Meep FAQ의 9개 E/D/H Field component + 3개 real 유전율 scalar 구성을 기준으로 [S3,S4],
real-field는 96 bytes/cell, complex-field는 **9×16 + 3×8 = 168 bytes/cell**로 계산했다.
유전율 배열을 두 배로 세지 않는다. 이를 r–z all-component Grid에 적용한 **Component Storage Estimate**이며,
Meep cylindrical implementation의 실제 Allocation이나 엄밀히 인증된 Memory Lower Bound는 아니다.

| Glass points / wavelength | Δ (nm) | Cells | Component Storage Estimate (GiB) | Cell Updates / assumed 10 ps |
|---|---:|---:|---:|---:|
| 10 | 87.125 | 13,862,340 | 2.169 | 9.540e11 |
| 20 | 43.563 | 55,434,103 | 8.673 | 7.630e12 |
| 40 | 21.781 | 221,717,838 | 34.690 | 6.103e13 |

Full 3D real-field λglass/10의 동일 520×520×404.548 µm Box는 약 1.5884e13 bytes다.
이 값으로 축대칭 Solver 비용을 대신하지 않는다.

PML, off-diagonal Material tensors, DFT monitors, Subpixel Geometry 처리, Source arrays, Solver overhead는 제외했다.
대각 유전율 3개 배열 비용은 포함한다.
Box / Duration / Courant / Mesh가 충분하다고 검증하지 않았다. 실제 Meep Memory나 Runtime 측정값도 아니다.
실행 환경에서 관측 Host Memory는 약 9.73 GiB이고 보장된 Job Allocation은 확인되지 않았다.
λglass/20 계획값은 관측 Host Memory보다 작지만 추가 비용과 Job Allocation이 미확인이고,
λglass/40 계획값은 이를 크게 넘는다. 따라서 **이 계획의 Refinement Series를 실행하지 않았다.**
그렇다고 더 낮은 Resolution이 반드시 부정확하다는 뜻도, Adaptivity / FEM / Envelope Method가
불가능하다는 뜻도 아니다. 적합한 Solver의 검증된 Configuration과 Resource Pilot이 필요하다.

## 5. Field / Flux / Mode 비교 상태

| Model | 확보한 값 | 미검증 / 이번 중단 항목 |
|---|---|---|
| 기존 Gaussian | Fixture의 기존 Gaussian 결과 및 validity status 보존 | Single-Lens physical Field error 아님; Whole Fold gate 완화 금지 |
| 기존 Spherical Eikonal / Ray-Pupil | 같은 Geometry의 Radial Amplitude/OPD table, Jacobian, Omitted Tail 재사용 | Lens 내부 회절 / Fresnel / Vector 오차 미인증 |
| 기존 D2.8-C Quadratic Lens | 별도의 Analytical Gaussian Integral ↔ FFT Control 보존 | Spherical Lens와의 약 8.09% 차이는 수차/모델 차이가 섞인 진단; 실제 Lens 오차 아님 |
| 이번 외부 Plane / Slab Controls | Complex Field / Normal Flux analytic comparisons, 3-grid invariance | Plane/Slab Control만 해당 |
| **독립 실제 Spherical Lens Wave Reference** | **Uncomputed** | Field amplitude/phase, Normal Flux, Exit Wavefront, Input/Output Mode Projection 모두 null |
| Spherical Grid / Window / Domain / Reference Plane convergence | **Not run** | Gate 실패 뒤 계산을 시작하지 않음 |
| Fold / Explicit Free-Lens Total Coupling | **Uncomputed** | 이번 Controls로 값 채우기 금지 |

따라서 수차 / Internal Diffraction / Vector Effects / Numerical Uncertainty를 실제 Lens에 대해
수치적으로 분리했다고 주장하지 않는다. Path C의 Production Model 수정을 정당화할 증거도 아직 없다.

## 6. 재개 조건과 최소 외부 검증 계획

1. 위 Frozen Contract를 외부 Solver에 그대로 전달한다. Bare Glass Ideal Control인지 실제 Coating인지,
   Annulus/Side Boundary와 Vector Source completion을 명시한다. 기존 Port data는 바꾸지 않는다.
2. 외부 Solver의 Homogeneous Propagation / Fresnel / Bare Slab Controls 및 동일 Launch Plane의
   No-Lens source calibration을 먼저 수행한다. Geometry / Glass propagation을 없앤 Quadratic Thin Lens로
   실제 Spherical Lens를 대체하지 않는다.
3. Solver의 Small Resource Pilot으로 실제 RSS / Runtime / residual을 측정하고 최소 3개 Mesh,
   독립 Window / Domain / PML / Settling refinement를 감당할 수 있을 때만 전체 Lens를 실행한다.
   Scalar approximation이면 반사·편광·근사 오차를 해당 적용 범위에서 별도 독립 확인한다.
4. 같은 Plane / Grid / normalization으로 Field를 비교한다. Global Piston만 허용하고 Amplitude scaling,
   Defocus fitting, Port 이동으로 mismatch를 감추지 않는다. Best-quadratic-removal OPD는 별도 수차 진단이다.
   Normal Poynting Flux와 Scalar L2, Conditional Mode Projection, Absolute Power를 분리한다.
5. Exit 이후 Air의 복수 Reference Plane으로 Field와 Adjoint Mode를 함께 전파하여 Projection consistency를
   확인한다. Flux 보존과 Field convergence를 통과해도 물리 오차 인증으로 자동 승격하지 않는다.
6. 첫 Coaxial Lens의 검증 영역이 확보된 뒤에만 ±7 µm급 Decenter / Tilt, 두 번째 Lens로 확장한다.
   Fold Mirror Boundary와 Free-Lens Assembly Tolerance는 여전히 별도 문제다.

현재는 이 입력 계약과 외부 Reference 확보 조건을 Handoff하고 **추가 내부 Numerical Development를 중단**한다.

## 7. 재현 / Evidence / Regression

```sh
python3 -m venv /tmp/pcs-d28e
/tmp/pcs-d28e/bin/python -m pip install -r tests/coherent/requirements-lens-gate.txt
npx vitest run tests/coherentFieldInput.test.ts
MPLBACKEND=Agg OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 /tmp/pcs-d28e/bin/python tests/coherent/run_lens_gate.py
```

해당 Python 환경을 activate하면 `npm run benchmark:lens-gate`도 같은 순서로 실행한다.
기존 B/C requirements와 같은 환경에 설치하지 않는다. 새 CI Job은 별도 환경에서 실행되며
`d28e-spherical-lens-gate` Artifact에 원본 Input JSON과 Gate Report를 저장한다.
실제 설치나 Control 실패는 Process Failure이며 Path B의 성공적인 검증으로 숨기지 않는다.
Harness PASS / Physics Reference Unavailable을 JSON에서 분리한다.

로컬 새 Gate는 **67 checks PASS**다. 기존 Typecheck / Build / Model / Golden / A/B/C/D 검증의
관측 결과와 최종 CI Commit / Artifact는 Draft PR에 기록한다. 실제 실행되지 않은 항목은 PASS로 적지 않는다.
`src/`, 기존 Physics Reference / Regression source, 제조 Bounds와 UI는 변경하지 않는다.
Main 및 기존 Stacked Branch 병합/수정 없음.

## Sources — 공식 문서 / Package Source, 2026-11-06 확인

- [S1 Diffractio BPM/WPM limitations: no reflections, grid staircase](https://diffractio.readthedocs.io/en/latest/source/functioning/artifacts_bpm.html)
- [S2 Diffractio Scalar XY / WPM source](https://diffractio.readthedocs.io/en/latest/_modules/diffractio/scalar_fields_XY.html), [streaming WPM](https://diffractio.readthedocs.io/en/latest/source/functioning/WPM_ws.html)
- [S3 Meep Cylindrical Coordinates](https://meep.readthedocs.io/en/latest/Python_Tutorials/Cylindrical_Coordinates/), [Python Interface: nonzero-m complex fields](https://meep.readthedocs.io/en/master/Python_User_Interface/)
- [S4 Meep FAQ: memory / circular source](https://meep.readthedocs.io/en/latest/FAQ/)
- [S5 COMSOL Beam Envelopes Interface](https://doc.comsol.com/6.3/doc/com.comsol.help.woptics/woptics_ug_optics.6.63.html)
- [S6 COMSOL 6.4 Focusing Lens verification example](https://doc.comsol.com/6.4/doc/com.comsol.help.models.woptics.focusing_lens/focusing_lens.html)
- [S7 COMSOL interface dimensions](https://doc.comsol.com/6.3/doc/com.comsol.help.woptics/woptics_introduction.2.02.html)
- [S8 Bempp Maxwell operators / FMM](https://bempp.com/handbook/api/boundary_operators.html), [transmission capabilities](https://bempp.com/)

위 Cost는 이 Repository의 Planning 값이며 문헌의 측정값이 아니다.
