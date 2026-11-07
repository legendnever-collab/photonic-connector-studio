# S3.1 — Source / Numerical Control Handoff

2026-11-07 KST · `benchmark/s31-source-control-stabilization` · S3 #47 위 Stacked Draft.

- [S3.1 보고서](S31_SOURCE_CONTROL_STABILIZATION.md): S3 재현, 누적 Numerical Dispersion, Slab Settling, DFT Point Readout의 Half-cell 이상을 분리했다. 원본 S3/Lock/Fixture와 Production Physics는 보존했다.
- 짧은 Interface/3 µm Slab은 160-point와 독립 PML/시간 검사에서 목표를 통과했다. **Frozen 300 µm Slab은 Unresolved**다. 작은 Control로 대체하지 않는다.
- 실제 m=±1 Gaussian Huygens 주입, Cartesian/Hankel 독립 비교, 짧은 No-Lens Plane Calibration/Raw Field Artifact를 추가했다. Input Scale은 Launch에서 한 번만 정의한다. Full Frozen Exit Plane와 Source Calibration 전체는 미완료다.
- A 원인 진단 완료(잔여 Boundary/Readout 한계 명시), B/C 일부 수행·Unresolved, D 차단. Lens Field/Flux/Mode와 Total Coupling/Yield는 **Uncomputed**다. CI Process PASS와 Physics PASS를 구분한다.
- 다음: Source/DFT Numerical Gate를 닫고 Frozen Long-path Field 목표를 감당할 외부 Solver·실제 자원을 검토한다. 미확보 상태에서 Full Lens를 시작하거나 Threshold/Fixed Port를 변경하지 않는다. PR의 정확한 HEAD·CI와 `s31-*-summary.json`을 확인한다. Main 병합은 사용자 승인 후 진행한다.
- 승인된 후속 순서: **S4 2-Lens 검증 → S5 연결 후보 확보 → S5.5 Engineering Workflow & UI Simplification(Sol, Play Review) → S6 자동 설계 강화**.

---

# S3 — Single-Lens Wave Reference Pilot

2026-11-07 · Astra · `benchmark/s3-single-lens-wave-reference`

- Serial Meep 1.35.1 설치와 Time-stepping을 실행했다. Frozen Contract, Explicit Environment, Plane/Interface/Slab Control과 전체 Lens 크기의 짧은 Resource Pilot을 추가했다.
- [S3 Handoff](S3_SINGLE_LENS_WAVE_REFERENCE.md)와 CI `s3-meep-pilot` JSON에서 실제 관측값을 확인한다. Source Calibration, Refinement 예산과 Checkpoint C는 후속 Gate다. 실제 Lens Field/Flux/Mode는 Uncomputed다.
- 다음은 두 Vector 편광의 No-Lens Source Calibration, Planar Phase/Flux 수렴, 실제 Job 자원 할당이다. B 완료 후 실제 Lens Convergence와 기존 모델 비교로 진행한다.

---

# S2 — Fixed-Port Free-Lens Tolerance

2026-11-07 · Sol · `feature/s2-free-lens-tolerance`

- [S2 Handoff](S2_FREE_LENS_TOLERANCE.md)에 고정된 ±50 µm Prescription, Lens별 오차, Common-mode, Differential, Joint Coverage와 재현 절차를 기록했다.
- Nominal Conditional Overlap은 99.99966%이고 Ray-Pupil은 Unresolved다. Joint는 각 Offset에서 16개 중 1개만 Geometry와 Gaussian Gate를 함께 통과했다. Total Coupling, 제조 분포 기반 Assembly Yield와 전역 Worst-case는 Uncomputed다.
- Draft PR의 HEAD 및 CI Artifact를 사용자 검토 기준으로 삼는다. 다음 Physics Checkpoint는 Astra로 D2.8-E의 실제 Spherical Lens Field를 외부 Wave Reference에서 검증하는 작업이다.

---

# S1 — Integration Handoff

2026-11-06 · Sol · `integration/s1-physics-stabilization` → `main` Draft.

- [S1 Integration Readiness](S1_INTEGRATION_READINESS.md)에 원격 Dependency, #37 충돌 해소, Physics 상태, Validation 및 병합 조건을 기록했다.
- 승인 후 두 부모를 보존하는 S1 통합 PR을 우선 검토한다. 기존 스택과 문서 PR은 원본 이력을 유지한다. 최종 통합 SHA의 CI 및 Benchmark Artifact를 확인한다.
- 다음 Physics Checkpoint는 기존 D2.8-E 입력의 외부 Single-Lens Wave Reference Pilot이다. 실제 Lens Field / Flux / Mode, ±50 µm Fold 및 Explicit Free-Lens의 Total Coupling과 Assembly Yield는 Uncomputed다.
- [PR #37의 원본 Handoff](https://github.com/legendnever-collab/photonic-connector-studio/blob/5530329ed0b9c4d553c1e9385e0a429cffd012f0/docs/NEXT_TASK.md)는 해당 Commit에 보존된다.

---

# D2.8-E — 이전 Handoff

2026-11-06 · `benchmark/d28e-spherical-handoff`, base Draft #43 (`7c45d7c07dc7b43dc87598277d2002bf50b7d696`).

- **Path B — Reference / Resource Insufficient.** Reference Feasibility Gate에서 중단했다. 실제 Spherical Lens Wave Field / Flux / Mode 및 Grid/Window/Domain Convergence는 **Uncomputed / Not run**이다.
- 기존 첫 Lens의 ±655.148478 µm 곡률, 300 µm 두께, Clear/Outer Radius 200/240 µm, n=1.5035829054, Gaussian / Reference Planes / Fixed Ports를 machine-readable fixture로 잠갔다.
- 외부 **Diffractio 1.0.0** 설치·실행과 3-grid Plane-wave Controls를 검증했다. Reflection-free Scalar WPM은 실제 E/H Interface Solution을 제공하지 않는다. 동일 n/t의 이상 Uncoated Plane Slab에서 물리 Normal Flux와의 차이 약 0.11749는 Grid Refinement로 없어지지 않는다. **Slab Control이며 실제 Spherical Lens 오차가 아니다.**
- 단일 Spherical Index Slice의 Kernel Timing만 측정했다. 전파를 이어 붙이지 않았으며 전체 Lens Field / Runtime / Convergence를 계산한 것이 아니다.
- 축대칭 Meep m=±1의 10/20/40 points per glass wavelength 계획 Component Storage Estimate는 약 2.17/8.67/34.69 GiB (Fields만 complex, 유전율은 real). Domain/PML/Settling은 미검증이고 Runtime 미측정이다. 이 비용만으로 모든 Reduced Solver가 불가능하다고 판단하지 않는다.
- COMSOL Beam Envelopes / axisymmetric FEM 등은 가능성 있는 외부 경로지만 이 환경의 실행 파일·라이선스·검증된 Setup이 없다. 자체 Solver 구현으로 대체하지 않는다.
- 다음은 추가 내부 Numerical Development가 아니라 **외부 Single-Lens Reference 확보**다. Ideal bare vs 실제 Coating/Rim, Vector Launch와 Normalization을 정의하고 외부 Solver의 작은 Control / Resource Pilot을 통과한 뒤만 재개한다. Free-Lens 편심 확장은 별도 Domain 검증이 필요하다.
- `npm run benchmark:lens-gate` (별도 Python 환경), [보고서](D28E_SPHERICAL_LENS_REFERENCE_GATE.md), CI Artifact `d28e-spherical-lens-gate` 참조. Harness PASS는 Lens Validation PASS가 아니다. 기존 Physics / Gaussian Gate / Mount / 치수 / Regression을 보존했고 Main merge는 금지한다.

---

# D2.8-D — 현재 Handoff

2026-11-06 · `benchmark/d28d-development-path`, base Draft #42 (`f39c24ca1fb3ea07e55332ecbb6113ac80d4a89a`).

- **Engineering Decision: Option 3 — 공통 Spherical Lens Field Handoff 검증 우선.** D2.8-C Path B를 유지한다. 실제 Fold / Free-Lens Total Coupling과 Joint Yield는 Uncomputed다.
- Full-size Single Mirror의 Air λ/10 FDTD 계획만으로 약 995 GiB의 최소 Memory가 필요하다. Material/PML/Monitor와 Coating Resolution은 제외한 값이다. Material/Polarization 정의 및 외부 자원 부족으로 대형 Maxwell Run은 실행하지 않았다.
- 작은 Infinite-plane Vector E/H Boundary Control을 Fresnel / PEC / TIR와 독립 비교했다. 실제 Coating 값이나 Finite-body Simulation이 아니다.
- Explicit Free-Lens의 ±50 µm Nominal 후보는 기존 엔진에서 Fixed Ports/Mode와 치수를 유지해 회수했다. Geometrical Shadow는 없으나 Ray-Pupil은 Target Coverage / Caustic Gate로 Unresolved이고 기존 OAT에 Lens transverse/tilt 오차가 빠져 있다. 기본 Coaxial Mount를 바꾸지 않는다.
- 기존 9개 Bounded Fold는 Geometry PASS지만 모두 Gaussian Out-of-domain이다. Coarse Ray Flux가 크게 달라 단일 Seed로 Fold를 폐기할 근거도 없다. +500 µm Coaxial Positive Control은 유지한다.
- 기존 Prism Family는 정해진 Geometry/Cap/Conservative Clearance 안에서 평가했다. 신규 Plate/Rhomboid/Relay는 제안만 하며 구현 및 Assembly Policy 변경 전 승인 필요.
- 다음 최소 작업 **D2.8-E**: 현재 첫 Spherical Lens 하나의 Geometry/Material/Input을 고정 → 기존 외부 Wave Reference의 비용·적용 범위 확인 → Independent Field / Flux / Mode, Grid / Window / Plane 검증. Reference가 없거나 비싸면 중단하고 Model Insufficient를 유지한다. 새 범용 POP/Maxwell Solver와 UI/3D 확장 금지.
- [Decision Report](D28D_DEVELOPMENT_PATH.md), `npm run benchmark:decision`, CI Artifact `d28d-development-path`를 참조한다. 실제 Tests/CI 및 SHA는 해당 Draft PR에 기록한다. `src/`와 기존 검증 구현·제조 Bounds 보존, Main merge 금지.

---

# D2.8-C — 현재 Handoff

2026-11-06 · `benchmark/d28c-physical-boundary`, base Draft #41 (`d95ca6c219530a1ca7e6c95e283b9fd4c7f00c5b`).

- **Engineering Decision: Path B — Model Insufficient.** 무한 Scalar Mirror / Tilted Prescribed Aperture의 전파는 검증했지만 Finite Reflector + Opaque Backing의 실제 Boundary Solution은 검증되지 않았다.
- 현재 Geometry의 `reflect` / opaque ray solid는 Rim/Side/Back의 EM 응답을 지정하지 않는다. Scalar RS-I/RS-II Aperture Data는 서로 다른 Boundary Problem이며 실제 finite-body 산란해가 아니다.
- 기존 Spherical Eikonal Lens Boundary를 독립적인 Diffractive Quadratic Lens Control과 비교했다. Control의 FFT/Analytical 일치는 확인했지만 8.09% Field Difference에는 수차/모델 차이가 섞여 있어 실제 Lens Error Bound로 사용할 수 없다.
- 실제 Fold Transmission / Output Mode Coupling / Maxwell Ledger와 Lens Handoff는 `Uncomputed`; Candidate Qualification 및 Optimization은 차단한다. Fold 불가능 또는 Topology 폐기는 판정하지 않았다.
- `npm run benchmark:boundary`, `boundary-reference` CI 및 `d28c-physical-boundary` Artifact, [Physical Boundary Report](D28C_PHYSICAL_BOUNDARY_VALIDATION.md)를 참조한다. 기존 `src/`, Ports/Modes, Manufacturing/Gaussian Gates와 D2.8-B 구현은 보존한다.
- 다음 최소 작업: **Single Finite Mirror + Backing의 명시된 Material/Polarization Boundary를 기존 외부 Maxwell Solver로 검증**. 실제 Material 미지정 시 이상 Control을 별도로 표시한다. 이후 Two-Mirror Multiple Scattering, 실제 Spherical Lens Handoff 순으로 적용 범위를 확보한다. 새 범용 POP / UI / 3D / Prism 확장 및 Main merge 금지.
- 실제 완료 Tests/CI, exact SHA와 Artifact 비교 결과는 Draft PR을 기준으로 한다.

---

# D2.8-B — 이전 Handoff

2026-11-05 · Astra · `benchmark/d28b-coherent-field`, base Draft #40 (`aedf81046819efcd19ff54ae3444282a3d159bd4`).

- 기존 D2.6 Lens OPL / ray-tube boundary, D2.8-A geometry/mask fixture를 재사용한 test-only Scalar AS/Fresnel Reference를 추가했다. `src/` Physics, gates, Search, UI 및 Fixed Port/Mode/part constraints는 변경하지 않았다.
- Analytical complex Gaussian / aperture Field, independent RS surface integral, energy / reciprocity / Mode overlap, Grid / Window / Sampling / boundary interpolation 검사를 분리한다. Numerical band removal과 evanescent 제거를 physical absorption으로 계산하지 않는다.
- 평면 Screen 대체 모델의 numerical convergence와 실제 Fold validity를 구분한다. 21/23/25° tilted-aperture control은 projected normal-plane 모델과 약 9–10%의 six-point complex Field discrepancy를 보인다. 이는 전체 Fold의 error bound가 아니다.
- 실제 Fold Transmission / Output Mode Coupling / Total Coupling은 Uncomputed다. Coarse 또는 수렴한 surrogate metric 모두 optical candidate qualification에 사용하지 않는다.
- [D2.8-B Report](D28B_COHERENT_FIELD_REFERENCE.md), `npm run benchmark:coherent`, 별도 CI `coherent-reference` job과 `d28b-coherent-reference` artifact를 참조한다. Exact SHA / 실제 완료 CI 결과는 Draft PR에 기록한다.
- 다음 단계: 실제 tilted surfaces + finite opaque backing boundary의 coherent reference, Lens eikonal-to-field handoff 독립 검증. 그 뒤 bounded optimization. Main merge / UI / Prism / 범용 POP / Yield 확장 금지.

---

# D2.8-A — 현재 Handoff

2026-11-05 · Astra · `benchmark/d28a-finite-beam`, base Draft #39 (`aaccdf9504d1a0362467bb6253099f282a6cbe96`).

- 23° / ±50 µm 기준 Seed의 geometrical ray-flux는 약 19.80% clear, 74.39% neighbouring Mirror shadow, 5.80% other aperture/body clipping이다. Diffraction을 제외한 모델 값이며 actual throughput / Total Coupling이 아니다.
- 기존 Gaussian gate(footprint 0.200302 > 0.2) 유지. 첫 Lens independent ray-pupil residual RMS OPD≈6.50 nm는 계산했지만 end-to-end Mode/Field는 Uncomputed다.
- Independent projected-mask integral, 128/256/512 ray refinement, prefix Pupil refinement, bounded 3 angles × 3 Lens placements를 추가했다. `src/` Physics/Search/UI는 변경하지 않았다.
- 재현과 한계: [D2.8-A Report](D28A_FINITE_BEAM_FEASIBILITY.md). 완료 CI와 exact SHA는 Draft PR, 전체 입력/수렴성/분류는 `d28a-finite-beam.json`을 확인한다.
- D2.8-B: 이 4-part Fold에 한정하여 coherent field + finite aperture/backing shadow diffraction reference를 검증한 뒤 bounded optimization. Coarse ray pass나 Gaussian extrapolation으로 후보를 qualification하지 않는다. Prism/범용 POP/Yield 확장 및 Main merge 금지.

---

# D2.7 — 현재 Handoff

2026-11-04 · Astra · `feature/d27-small-offset-geometry`, base Draft #38 (`66feb0c684ec3114a8ff09aa74400e5b761154b0`).

- ±50 µm의 23° two-Mirror / two-Lens chief geometry가 기존 치수에서 가능함을 independent finite-cylinder reference로 확인했다. 기존 AABB false rejection과 coarse seed omission을 분리했다.
- Disc Mirror separation certificate 및 coaxial small-angle seeds만 추가했다. Port/Mode, 20° minimum bend, 1 µm gap, dimensions, Gaussian validity gates는 유지한다.
- ±50 µm optical evaluations는 2361, 100 µm는 3920으로 증가하지만 qualified optical 후보는 없다. 이를 physical impossibility로 취급하지 않는다. 0/500 µm nominal regression은 유지한다.
- 상세 근거/조건/명령/한계: [D2.7 Report](D27_SMALL_OFFSET_GEOMETRY.md). 실행 SHA와 실제 PASS/FAIL는 해당 Draft CI artifact의 JSON을 우선한다.
- 다음 개발: small-angle projected pupil, Lens aberration-domain, finite-beam / neighbouring backing shadowing의 독립 reference 및 bounded feasibility 분석. 완전 diffraction, Total Coupling, Yield는 Uncomputed.
- Advanced free-Lens policy는 별도이며 기존 regression을 보존한다. 기본 해법으로 자동 전환하지 않는다. Main merge 금지.

---

# Golden Benchmark 001 — Handoff

2026-11-04 · Sol · #36 위의 `benchmark/golden-001` Draft. Main 및 기존 Draft Branch 변경·병합 없음.

## 완료 범위
- PR #36 D2.6.1 Physics를 보존하고 PR #37 지침을 적용했다.
- `npm run benchmark:golden`: 0, ±50, 100, 500 µm와 invalid / unsupported controls. 입력·후보·SHA/hash·gate별 결과는 JSON으로 재현한다.
- 기존 CI에 자동 포함되며 `golden-benchmark-001` artifact를 보존한다. 실제 실행 결과와 조건은 [Runner](GOLDEN_BENCHMARK_001_RUNNER.md)를 참조한다.
- Model 및 실제 Browser lifecycle 검증을 분리했다. UI 기능 추가·Physics 제약 완화 없음.

## 다음 작업
1. Draft PR의 exact-head CI와 machine-readable artifact를 검토한다. Benchmark PASS는 검증 환경의 PASS이며 +50 µm connector 확보를 뜻하지 않는다.
2. Astra: expanded-beam 조건 및 diffraction reference, TIR 이후 powered Lens field의 모델/수렴 검증을 설계한다. 기존 Gaussian 목표와 total coupling을 분리한다.
3. ±50/100 µm에서 geometry gate / conservative clearance / finite seed coverage를 독립적인 정밀 reference로 분석한다. 후보 확보를 위해 제조 범위를 조용히 변경하지 않는다.
4. 합동 공차·Yield·throughput 및 제조 사양 합격 기준은 현재 Uncomputed다. 물리 가정·architecture 변경이 필요한 후속 구현은 별도 승인 후 진행한다.

Main 병합은 사용자 명시 승인 전 금지한다. PR #37의 원본 지침 문서는 해당 Draft에 보존되어 있다.
