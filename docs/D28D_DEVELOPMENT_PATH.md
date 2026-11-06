# D2.8-D — Maxwell Feasibility Gate & Alternative Topology Screening

2026-11-06 · Base Draft [#42](https://github.com/legendnever-collab/photonic-connector-studio/pull/42)
`f39c24ca1fb3ea07e55332ecbb6113ac80d4a89a` · `benchmark/d28d-development-path`.

## Decision — Option 3: 기존 Physics의 검증 범위를 먼저 확대

**다음 최소 Checkpoint는 실제 Spherical Lens Exit Field의 독립 검증이다.**
Fold와 Explicit Free-Lens 비교에 공통으로 필요한 Handoff이며, 현재 Gaussian / Eikonal
Reference를 실제 Wave Field와 연결하는 근거가 부족하다. Scalar Gate를 완화하거나
범용 Solver를 추가하는 작업은 아니다. 통과하기 전 실제 Coupling과 Yield는 Uncomputed다.

Option 1의 Full-size Finite Mirror Maxwell 해석은 현재 Material 정의와 계산 자원이 부족해
착수하지 않는다. Option 2의 Free-Lens는 **이미 존재하는 별도 Mount Policy 안에서**
유망한 Geometry를 보였으나, Field와 조립 Robustness를 검증하기 전 기본 구조로 채택하지 않는다.
새 Prism / Plate / Relay와 Mount Policy 변경은 제안으로 남기며 승인 없이 구현하지 않았다.
이는 현재 Fold의 불가능 판정이 아니다.

## 1. Recovery와 보존

- D2.6 Pupil / Eikonal, D2.6.1 Coaxial / Explicit Free-Lens, Golden 001, D2.7
  Finite Body Clearance, D2.8-A Ray Flux, D2.8-B Scalar Reference, D2.8-C Path B를 회수했다.
- Stacked Draft #38 → #39 → #40 → #41 → #42 위에 새 Draft를 쌓는다.
  #42의 부모는 #41 `d95ca6c219530a1ca7e6c95e283b9fd4c7f00c5b`다. Main merge는 하지 않는다.
- `src/`와 기존 Test Source는 변경하지 않는다. Test-only Screening / Cost Controls,
  실행 명령, 기존 Validate Job의 추가 검사·Artifact, 이 Report와 Handoff만 추가한다.
- Source (0,0,0), Target (10 mm,0,±50 µm), Parallel Axes, λ=1310 nm,
  MFD=9.2 µm를 유지한다. +500 µm는 별도 Positive Control이며 50 µm 요구를 대체하지 않는다.
- Generated Lens Clear Radius 200–500 µm, Thickness 50–300 µm, Mirror Backing ≥20 µm,
  Minimum Bend 20°, Clearance 1 µm, Part Caps Lens 2 / Mirror 2 / Prism 1을 유지한다.
  Golden의 Retained Initial Lens는 Thickness 1 mm로 Generated Bounds와 다르므로 이번 Free-Lens
  비교는 `aligned-direct`로 새로 생성한 후보만 선택한다.

## 2. Maxwell 문제를 정의하기 위한 입력

| 항목 | 확정/현재 상태 | 실행 전 필요한 정의 |
|---|---|---|
| Mirror Geometry | Clear/Body Radius 200/220 µm, Thickness 20 µm | 실제 Rim/Side/Back 구조, Edge Radius와 공차 |
| Incidence | 23° Bend → Normal 기준 78.5° | Beam Angular Spectrum과 Complex Incident E/H |
| Polarization | 실제 Port는 unspecified | s/p 두 basis 및 교차 성분; 필요 시 Jones 응답. Control만 명시적으로 편광 지정 |
| Clear Front | Ray `reflect` | Coating Layer 순서·두께, ε(λ) 또는 측정 Complex r_s/r_p 및 적용 각도 |
| Rim / Side / Back | Ray Opaque Solid | Substrate/Backing ε, μ, Absorption; Front와 같은 물질인지 |
| Source / Receiver | Scalar Gaussian 정의 | Vector Mode, 정규화, Reference Plane, Lens Handoff 불확실성 |
| Open Boundary | 미정 | PML / Radiation Condition, Source subtraction, Monitor Surface와 수렴성 |

Opaque는 투과가 없다는 Ray 규칙이다. 흡수체·PEC·Coated Substrate는 동일하지 않다.
**PEC**는 접선 E=0, 내부 Field=0, Zero Absorption의 이상 Control이며 유도 Surface Current를 푼다.
Front만 Perfect Reflector로 지정하고 Rim/Side/Back을 생략하면 Closed Finite Body 문제가 아니다.
Unit-amplitude Scalar Reflector 역시 Polarization Phase나 Edge Scattering을 정의하지 않는다.
실제 Coating은 복소수·편광·각도 의존 반사, Penetration, Loss가 있으며 Grazing Geometry에서
PEC 결과가 실제 성능의 상한/하한이라는 보장은 없다. 미검증 Material 값을 대입하지 않았다.
FDTD의 Dispersive Material은 안정적인 주파수 응답 모델과 그 Fit 검증이 필요하다 [S3].

## 3. Solver 선택과 Cost Gate

| 방법 / 기존 구현 | 적합한 범위 | 정확도와 비용의 핵심 | 이번 판단 |
|---|---|---|---|
| FDTD: Meep, Ansys Lumerical | 일반 3D Body, Dispersion, Transient / Broadband | Local λ, Skin Depth, Thin Layer, CFL, PML, Edge와 긴 Settling Time | Full-size Run 보류 |
| Frequency-domain FEM: COMSOL Wave Optics | Curved Interfaces, Local Mesh, Single Frequency, Impedance Boundary | Vector Edge Elements; Sparse Linear Solve와 Preconditioning / Fill-in 비용. Higher Order도 수렴성 필요 | 외부 자원·라이선스 확보 시 Local Model 견적 |
| Maxwell BEM: Bempp | Homogeneous Exterior, Closed PEC / 적절히 정의한 Interfaces | Surface Unknowns, Singular Quadrature, Resonance-safe Formulation, Iterative Conditioning; Dense Matrix 불가 | Accelerated 전문 구현만 검토 |
| 2D TE/TM Cross-section | Infinite Extrusion / Straight Edge Control | 유한 Circular Rim, Sagittal Diffraction, Cross-polarization을 재현하지 않음 | 추후 Solver Setup Control용; 실제 3D 효율로 승격 금지 |
| Physical Optics / Impedance Hybrid | 검증된 Local Boundary와 큰 Smooth Surface | Edge / Multiple Scattering 적용 오차를 독립 확인해야 함 | D2.8-C 공백을 자동 해결하지 않음 |

COMSOL은 FEM/BEM 및 Vector Edge Element를 제공한다 [S5]. Bempp는 Maxwell Electric/Magnetic
Boundary Operator와 Dense/FMM Assembly를 제공하지만, 기능 존재가 이번 대형 문제의
수렴성·메모리·실행 가능성을 보장하지 않는다 [S4]. 자체 Maxwell Solver를 개발하지 않았다.

### 재현 가능한 3D FDTD 계획값

`run_feasibility.py`가 실제 Grid를 할당하지 않고 다음 식만 계산한다.
각 Dimension은 `ceil(L_i/Δx)`, Cell 수 N은 세 Dimension의 곱이다.
Empty Real-field Meep 기준 Memory Lower Bound는 **96 N bytes**이며 Material/PML/DFT/분산
보조변수 및 병렬 통신 비용을 제외한다 [S1]. Complex Fields 등은 추가 비용이 든다.
`Δt=0.5 Δx/c`, Steps=`ceil(T/Δt)`; Work Proxy는 N×Steps다 [S2].

| 가정한 Box / Duration | Air Points/λ | Cell 수 | 최소 Memory (GiB) | Steps | Cell Updates |
|---|---:|---:|---:|---:|---:|
| Single Mirror 500×500×100 µm / 5 ps | 10 | 1.1131e10 | 995.2 | 22,885 | 2.5473e14 |
| 동일 | 20 | 8.8990e10 | 7,956.4 | 45,770 | 4.0731e15 |
| Pair 600×500×150 µm / 5 ps | 10 | 2.0039e10 | 1,791.6 | 22,885 | 4.5858e14 |
| 동일 | 20 | 1.6022e11 | 14,324.9 | 45,770 | 7.3333e15 |
| Full Relay 10,200×600×600 µm / 100 ps | 10 | 1.6340e12 | 146,090.9 | 457,699 | 7.4788e17 |
| 동일 | 20 | 1.3069e13 | 1,168,471.9 | 915,397 | 1.1963e19 |

Box/PML 여유와 Duration은 **Cost Planning 가정**, 정확도에 충분하다고 검증한 값이 아니다.
Glass의 λ/n, Coating Layer, Skin Depth에 맞춰 Δx를 줄이면 더 비싸다.
λ/10 또는 λ/20라는 이유만으로 Accuracy PASS를 주지 않는다.
Δx를 절반으로 하면 같은 Physical Duration에서 Memory 약 8배, Cell Updates 약 16배다.
실행 시간은 `Work / measured cell-updates-per-second`로 견적해야 한다.
예를 들어 Single Mirror λ/10을 **가정** Throughput 1e8 Cell Updates/s로 계산하면 약 29.5일이지만,
이는 현재 Hardware의 예측값이 아니다. 실제 Throughput / Settling / Monitor 비용은 미측정이며
JSON의 `measuredRuntimeS`는 null이다. 상용 Solver도 Resource Test로 측정해야 한다 [S6].

FEM에 이 96 bytes 규칙을 적용하지 않는다. Element Order, Mesh Adaptivity, ε, Solver에 따라
DOF와 Factorization 비용이 달라 외부 실제 Mesh/System Check가 필요하다.
Closed Cylinder의 Surface Area `2πR²+2πRt`를 균일 Equilateral Triangle로 덮는 BEM 계획에서
h=λ/6이면 약 1,607만 Triangle, 2,411만 RWG Unknown이다.
Complex128 Dense Matrix 하나만 약 **9.30e15 bytes (9.30 PB, decimal)**다.
h=λ/10이면 약 6,697만 Unknown / 71.75 PB다. 실제 Mesh를 만든 값이 아니며 Edge Refinement와
복수 Material Interface는 추가 비용이다. FMM/Hierarchical Compression은 별도 측정이 필요하다.

현재 확인한 환경은 CPU Affinity 9, 관측 Host Memory 약 9.73 GiB다. 보장된 Job Allocation은
확인되지 않았다. `meep`, `bempp`, `ngsolve`, `gmsh` Python Package 및 조사한 Solver Executable이
없으며 Commercial License는 미확인이다. 따라서 대형 Run / 설치 / Cluster Launch는 하지 않았다.

### Local 검증이 Full Fold에 답할 수 있는 범위

1. Infinite Plane → Single Finite Closed Body 순으로 PEC 및 명시한 실물 Boundary를 분리한다.
2. 동일 Incident Angular Spectrum에 대해 Complex E/H, Near-to-Far Field, 정상 Poynting Flux를 비교한다.
   세 단계 Mesh, 독립 Domain/PML Refinement, Source normalization, Solver Residual을 각각 기록한다.
   PEC는 Closed Surface Flux Balance, Lossy Body는 Absorption까지 Ledger에 포함한다.
3. 작게 자른 illuminated Patch는 Full Rim/Side/Back 영향의 Domain Truncation 검증 없이는 대체할 수 없다.
   2D Strip이나 축소 Body의 결과를 현재 440 µm Diameter Body로 그대로 Scale하지 않는다.
4. Single Mirror는 Pair Re-scattering을 검증하지 않는다. Two-body 비교 또는 Bound가 필요하다.
   Source-to-Mirror Lens Field와 Receiver Projection도 별도다. Local Scatterer의 R은 Link Coupling이 아니다.
5. Next External Gate의 제안 Tolerance: Reference Plane의 piston-aligned Complex Field L2 변화 <1%,
   Integrated Flux 변화/Balance Residual <0.5%, 독립 Solver/Analytical Control 일치.
   이는 **향후 수치 검증 목표**이며 실제 Connector Accuracy / 효율 사양이 아니다.
   성공 후에도 Geometry, Polarization, Material, Mode 범위를 제한해 검증한다.

## 4. 실제로 실행한 작은 독립 Control

공간 Mesh Maxwell Simulation을 실행한 것은 아니다. Python Standard Library로 Infinite Plane에서
접선 E/H 연속 조건의 2×2 System을 Vector Cross Product로 조립하여 Closed-form Fresnel과 비교했다.
TE/TM, Normal/45°/Brewster/78.5°, TIR의 Complex Phase, Normal Poynting Flux `R+T=1`,
PEC 접선 E=0을 검사했다. Fresnel/Boundary Residual <2e−14와 Energy Balance <2e−14를 통과했다.
TM reflected basis는 양의 Tangential E를 유지하므로 통상적인 reflected p basis와 r 부호가 반대임을
코드에 명시했다. Arbitrary Polarization은 두 Basis를 조합하며 Port 자체는 변경하지 않았다.

n=1→1.5는 **가상의 Lossless Dielectric**이며 실제 BK7/Coating/Backing을 뜻하지 않는다.
78.5°에서 Control R_s≈0.491864, R_p≈0.188098, PEC R=1이다.
이는 Polarization/Boundary 선택을 생략할 수 없다는 Control일 뿐 실제 Mirror 반사율이 아니다.
Cost 식의 Refinement Scaling 및 Invalid Input도 검사한다.
기존 D2.8-B/C의 독립 Diffraction / Surface Integral Controls는 그대로 유지한다.

## 5. Alternative Topology Comparison

모든 계산된 후보는 원본 Port Position/Orientation/Mode와 입력 불변성을 검사한다.
Nominal Gaussian `qualified`는 기존 엔진의 목표 통과 의미로 보존하되,
이번 Report의 `physicalConnectorQualified`는 false, Total Coupling / Yield는 null이다.

| Topology / Benchmark | Geometry / Beam Clearance | Model Coverage | Assembly / Tolerance Risk | 판정 |
|---|---|---|---|---|
| Coaxial 2 Lens + 2 Mirror, ±50 µm / 23° Seed | Chief PASS. Ray Flux 128/256/512 수렴: Clear 19.8037%, Shadow 74.3922%, Aperture 5.8041% | Gaussian Out-of-domain; 실제 Diffracted Field Uncomputed | 4 parts, Grazing Front, 작은 Projected Gap; Angle/Placement 민감 | Seed의 Shadow 진단. 구조 전체 배제 불가 |
| 동일 21/23/25° × Lens Position 0.8/1/1.2 | 9/9 Chief/Mount/Bounds PASS. 기존 n=64 Clear Ray Flux 범위 5.60–97.05% | 9/9 Gaussian Out-of-domain; 단일 Grid는 Unresolved | Lens 이동으로 Beam Size 변화; Curvature/Thickness 고정 | 잠재 개선 범위 보존. 성능 Rank/Qualification 금지 |
| Explicit Free-Lens, ±50 µm | 2 Lens, Chief PASS, Independent Snell PASS, Body Clearance PASS; Ray Flux 32/64/128 수렴, Shadow=0 | Conditional Gaussian η=0.9999965993; Ray-Pupil **Unresolved**; Full Wave/Total η 없음 | 의도된 Lens Decenter와 별도 Mount/Alignment 필요; 실제 Joint Yield 없음 | 후속 비교 후보. Default Coaxial 대체 승인 아님 |
| 기존 Coaxial Fold, +500 µm | Golden에서 generated mirror2 Nominal 후보 유지 | 지원 Gaussian Domain의 Positive Control; 실물 Total η 아님 | 4 parts; 50 µm의 작은 Gap 문제를 검증하지 않음 | 기존 Positive Control 유지 |
| Free-Lens +500 µm / 제한 Budget | 새 aligned-direct 후보 없음 | not-found-within-stated-budget | ±50 µm Budget 512 / Fit 64를 동일 적용 | 불가능 판정 아님; Coaxial Positive Control과 구분 |
| 기존 1 Right-angle Prism | Parallel I/O와 90° Generator 불일치 | 기존 Prism 특수 범위만 지원 | Normal Entry/Exit 고정 | 해당 Family Geometry 미지원 |
| 기존 Mirror + Right-angle Prism | ±50 µm: 제안 0. +500 µm: 6개 모두 Conservative AABB Reject | 검증된 Field 후보 없음; Powered Lens after TIR는 기존 Unsupported | 추가 Body Clearance 및 TIR/편광 영향 | 유한 Seed 결과. Exact Collision/모든 Prism 불가능 주장 금지 |
| 기존 2 Right-angle Prism | Part Cap 1에서 비활성. Cap을 바꾸더라도 해당 Builder의 최소 Lateral=801 µm | 50/500 µm 모두 그 Normal-entry Family의 최소거리 미달 | 두 Prism 및 Lens 조립 | Cap 미변경. 일반 Prism 전체 배제 아님 |
| 새 Tilted Parallel Plate / Beam-displacing Rhomboid | Parallel Output Axis와 Lateral Shift를 만드는 구조 제안 | 기존 Full Component/Body/Field Model 없음; Geometry-only 식으로 Coupling 추정 금지 | Wedge, Tilt, Thickness, Coating/TIR와 Mount 공차 | 승인 후 별도 명시적 Geometry Control 필요 |
| 추가 Reflective Relay / GRIN Relay | 더 큰 Working Envelope 또는 새 Part/Material 가정 필요 | 현재 생성·검증 Domain 밖 | Parts/Packaging/Gradient Index/Alignment 비용 | 현재 Constraints 내 후보로 세지 않음 |

9개 Bounded Variant의 큰 Ray Flux 차이는 고정 Seed 하나로 Fold를 폐기하면 안 되는 구체적 근거다.
특히 21°/1.2의 약 97%는 **Coarse Geometrical Ray Count**이지 Optical Throughput가 아니다.
±50 µm Golden Search는 기존 그대로 not-found-within-budget이며 +500 µm에서 Nominal 후보를 회수했다.
전체 Topology 공간의 Exhaustive Search를 수행한 것은 아니다.

### Free-Lens 결과를 해석하는 데 필요한 제한

+50 µm 선택 후보의 Front Vertex는 (x,z)≈(976.775,7.023) µm와 (8723.225,42.977) µm다.
각 Lens는 자기 Port Axis에 대해 약 ±7.023 µm Decenter이며 Tilt=0이다.
Clear Radius 316.228 µm, Thickness 300 µm, Surface Radius ±1.030321 mm이다.
−50 µm는 z 부호가 반대이고 동일한 Gaussian / Ray Flux 결과를 준다.
Output Chief Residual은 약 6.96e−15 m / 6.61e−12 rad로 Independent Snell 검사와 일치한다.

Pupil Grid 16/32/64/128을 실제 실행했다. 최종 Target Coverage≈0.973514가 0.999 Gate에 미달하고,
Intermediate Caustic / Singular Tube Reject Weight≈1.49e−4도 남는다.
이 Reject는 **Ray-Tube Reference의 모델/수치 실패**이며 물리적 흡수나 Clipping으로 해석하지 않는다.
Refinement에서 값이 가까워져도 Gate를 완화하지 않는다. 내부 Diagnostic Overlap은 JSON에
남기되 Unresolved Field Metric으로 후보를 비교/합격시키지 않는다.

기존 OAT 24/24는 Nominal Geometry와 제한된 Gaussian Field에서 통과하며 Worst Conditional η≈0.953848다.
해당 Coverage는 Port Position/Angle과 Lens **axial** Position만 포함한다.
Lens 횡방향 Decenter Error와 Tilt Error를 포함하지 않으므로 Free-Lens Mount의 Robustness 증거로는 부족하다.
Nominal Fixed Port는 그대로이며 OAT의 Port Perturbation은 기존 명시적 Tolerance Diagnostic이다.

새 Parallel Plate의 기하학적 가능성은 Snell 법칙상
`δ=t sin(i−r)/cos(r), sin(r)=sin(i)/n`로 표현된다 (t는 Normal Thickness).
양면이 평행하면 출사 방향은 입사 방향과 같지만, 실제 Spherical Wave/Finite Aperture/Focus에는
별도 검증이 필요하다. 특정 t/n을 제조 사양으로 지정하지 않았고 신규 Component를 구현하지 않았다.
Rhomboid의 TIR 조건과 finite-body ray path도 현재 Right-angle Prism 결과로 대신하지 않는다.

## 6. 후속 Option 비교와 최소 Checkpoint

| Option | Engineering Value | Physics Risk | Cost / 다음 Gate |
|---|---|---|---|
| 1. 제한된 External Maxwell | Grazing Finite Mirror의 핵심 불확실성 해소 | Material/Incident Field 미정; Single Body만으로 Fold 불충분 | 외부 Solver/자원 견적 + Material Contract → Plane/PEC → Closed Body → Pair. 현재 우선 실행 아님 |
| 2. 새 Manufacturable Topology | Mirror Shadow를 피할 수 있는 가능성 | 새로운 Assembly Policy, Field/TIR/Coating와 Tolerance 미검증 | Explicit Free-Lens를 비교용으로 유지. 새 Plate/Prism과 Default Mount 변경은 승인 후 |
| **3. 기존 검증 Domain 확대** | 모든 Lens Relay에 공통인 Handoff 공백을 줄임 | Scalar/Paraxial 적용 오차를 숨기면 같은 문제 반복 | **D2.8-E: 실제 Single Spherical Lens의 제한된 독립 Field Reference** |

D2.8-E 제안 범위:

1. 현재 +50 µm Fold의 **첫 Lens 하나**와 고정된 Incident Gaussian을 잠근다. 기존 D2.8-C
   Quadratic Lens Control을 계속 통과시키되 그 결과로 Spherical Lens를 검증했다고 하지 않는다.
2. 기존 외부 Wave-optics 구현으로 정확히 같은 Spherical Geometry / n / Boundary / Reference Plane을
   계산한다. Axisymmetric 조건의 외부 Frequency-domain Solver 등으로 먼저 견적한다.
   Scalar Reference라면 Polarization/Fresnel 및 Internal Diffraction 생략 범위를 명시한다.
   Reduced Domain이 실현 불가능하거나 적합한 Reference가 없으면 **Model Insufficient로 중단**한다.
   이번에 외부 Lens Solver가 실행 가능하다고 입증한 것은 아니다.
3. Grid/Window/Reference Plane을 각각 Refinement하고 piston만 제거한 Complex Field Error,
   Normal Flux, Adjoint Mode Projection을 비교한다. 수치 목표 Field <1%, Flux <0.5%를 사전 지정하고
   불일치가 수차·회절·Vector Effects 중 어디에서 오는지 분리한다. 통과가 Physical Error Bound를
   자동 부여하지는 않으며 Reference의 적용 오차도 기록한다.
4. Common Handoff가 유효한 구간만 다음 Lens / Decenter ±7 µm Control로 확장한다.
   Free-Lens 채택 전 실제 Mount의 transverse/tilt 공차와 Joint 평가를 별도로 정의한다.
   Fold가 계속 우선이라면 그때 Option 1의 Material / Resource Gate로 돌아간다.

이 순서는 새로운 Topology를 확정하거나 사용자 대신 Assembly Policy를 결정하지 않는다.
Optical Optimization과 Candidate Qualification은 검증 Domain 및 조립 조건이 확보된 뒤 진행한다.

## 7. 재현 / Regression / Artifact

```sh
npm run typecheck
npm run benchmark:decision
npm test
npm run benchmark:coherent
npm run benchmark:boundary
```

`benchmark:decision`은 Golden 001 / D2.8-A / 새 Topology Export를 생성한 뒤 Python Control을 실행한다.
기존 Validate CI에서 모든 Model Tests 후 Standard-library Python 검사를 실행하고
`d28d-development-path` Artifact에 `d28d-topology.json`, `d28d-feasibility.json`을 저장한다.
동일 Checkout / PR Head, Golden Harness Hash, A/D Source Hash 및 입력 Artifact Hash를 기록·검사한다.
기존 Golden/D2.7/A/B/C와 Browser/Build Jobs 및 Artifacts는 보존한다.
Topology 31개 Assertion, Python Boundary/Cost/Provenance 68개 Assertion을 로컬에서 통과했다.
Exact Commit의 최종 CI / Artifact 확인은 Draft PR에 기록한다. PASS는 Harness 검증이며
실제 Robust Optical Connection 확보를 뜻하지 않는다.

## Sources (공식 문서, 2026-11-06 확인)

- [S1 Meep FAQ — Memory Estimate](https://meep.readthedocs.io/en/latest/FAQ/)
- [S2 Meep Introduction — FDTD / Courant](https://meep.readthedocs.io/en/latest/Introduction/)
- [S3 Meep Materials](https://meep.readthedocs.io/en/latest/Materials/) 및
  [Subpixel Smoothing의 제한](https://meep.readthedocs.io/en/latest/Subpixel_Smoothing/): Dispersive/Lossy/Edge에서 일반적인 2차 수렴을 가정하지 않는다.
- [S4 Bempp Maxwell Boundary Operators](https://bempp.com/handbook/api/boundary_operators.html)
- [S5 COMSOL Wave Optics Introduction](https://doc.comsol.com/6.4/doc/com.comsol.help.woptics/woptics_introduction.2.01.html)
- [S6 Ansys FDTD Resource Benchmarking](https://optics.ansys.com/hc/en-us/articles/6491711906195-Determining-the-optimum-resources-for-your-simulation)

수치 Cost와 Topology 결과는 위 문헌의 측정값이 아니라 이 저장소의 명시한 가정/실행 결과다.
