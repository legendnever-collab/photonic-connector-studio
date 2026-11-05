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
