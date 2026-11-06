# S1 — Integration Readiness & Physics Stabilization

2026-11-06 · Sol · 기준 Main `a3918044057a815313eb8a10d5912c522adaf29b`, D2.8-E `dc23a00e777e4c2f08241741ec259c2c7a743678`, 문서 `5530329ed0b9c4d553c1e9385e0a429cffd012f0`.

## 원격 복구와 변경 범위

Main은 #33 D2.4 병합 Commit이며 해당 SHA의 [Main push CI #131](https://github.com/legendnever-collab/photonic-connector-studio/actions/runs/40812662479)가 성공했다. 아래 PR은 조사 시점에 모두 open Draft이며, 현재 Base에서 mergeable이었다. CI는 각 PR Head에 연결된 workflow 결과다. Files 링크는 PR별 변경 파일 목록이다.

| PR | Base | Head | Base SHA → Head SHA | 변경 파일 | CI |
|---|---|---|---|---:|---|
| [#34](https://github.com/legendnever-collab/photonic-connector-studio/pull/34/files) | `main` | `feature/d25-efficient-lens-search` | `a3918044057a` → `57561af97a7d` | 16 | [#132 PASS](https://github.com/legendnever-collab/photonic-connector-studio/actions/runs/40855177152) |
| [#35](https://github.com/legendnever-collab/photonic-connector-studio/pull/35/files) | `feature/d25-efficient-lens-search` | `feature/d26-finite-beam-benchmark` | `57561af97a7d` → `94598155504b` | 17 | [#133 PASS](https://github.com/legendnever-collab/photonic-connector-studio/actions/runs/40952098228) |
| [#36](https://github.com/legendnever-collab/photonic-connector-studio/pull/36/files) | `feature/d26-finite-beam-benchmark` | `feature/d26-1-port-lens-mount` | `94598155504b` → `d581717447dd` | 23 | [#134 PASS](https://github.com/legendnever-collab/photonic-connector-studio/actions/runs/40961029016) |
| [#37](https://github.com/legendnever-collab/photonic-connector-studio/pull/37/files) | `main` | `docs/ai-workflow-foundation-20261101` | `a3918044057a` → `5530329ed0b9` | 4 | [#135 PASS](https://github.com/legendnever-collab/photonic-connector-studio/actions/runs/41252240853) |
| [#38](https://github.com/legendnever-collab/photonic-connector-studio/pull/38/files) | `feature/d26-1-port-lens-mount` | `benchmark/golden-001` | `d581717447dd` → `66feb0c684ec` | 13 | [#137 PASS](https://github.com/legendnever-collab/photonic-connector-studio/actions/runs/41827295851) |
| [#39](https://github.com/legendnever-collab/photonic-connector-studio/pull/39/files) | `benchmark/golden-001` | `feature/d27-small-offset-geometry` | `66feb0c684ec` → `aaccdf9504d1` | 11 | [#138 PASS](https://github.com/legendnever-collab/photonic-connector-studio/actions/runs/41840873785) |
| [#40](https://github.com/legendnever-collab/photonic-connector-studio/pull/40/files) | `feature/d27-small-offset-geometry` | `benchmark/d28a-finite-beam` | `aaccdf9504d1` → `aedf81046819` | 10 | [#141 PASS](https://github.com/legendnever-collab/photonic-connector-studio/actions/runs/41962703474) |
| [#41](https://github.com/legendnever-collab/photonic-connector-studio/pull/41/files) | `benchmark/d28a-finite-beam` | `benchmark/d28b-coherent-field` | `aedf81046819` → `d95ca6c21953` | 9 | [#142 PASS](https://github.com/legendnever-collab/photonic-connector-studio/actions/runs/42016001386) |
| [#42](https://github.com/legendnever-collab/photonic-connector-studio/pull/42/files) | `benchmark/d28b-coherent-field` | `benchmark/d28c-physical-boundary` | `d95ca6c21953` → `f39c24ca1fb3` | 6 | [#143 PASS](https://github.com/legendnever-collab/photonic-connector-studio/actions/runs/42116032500) |
| [#43](https://github.com/legendnever-collab/photonic-connector-studio/pull/43/files) | `benchmark/d28c-physical-boundary` | `benchmark/d28d-development-path` | `f39c24ca1fb3` → `7c45d7c07dc7` | 6 | [#144 PASS](https://github.com/legendnever-collab/photonic-connector-studio/actions/runs/42192500205) |
| [#44](https://github.com/legendnever-collab/photonic-connector-studio/pull/44/files) | `benchmark/d28d-development-path` | `benchmark/d28e-spherical-handoff` | `7c45d7c07dc7` → `dc23a00e777e` | 7 | [#146 PASS](https://github.com/legendnever-collab/photonic-connector-studio/actions/runs/42219584432) |

실제 Commit 조상 관계는 **Main → #34 → #35 → #36 → #38 → #39 → #40 → #41 → #42 → #43 → #44**와 **Main → #37**이다. 각 PR의 Base SHA가 직전 Head와 일치한다. Main→#44의 변경 파일은 73개다. #34–#36은 Search/Assembly/Report 및 기존 standalone build manifest를, #38은 Golden CI/fixture를, #39는 Mirror clearance/seed와 Search diagnostics를 변경한다. #40–#44는 `src/` diff 없이 Reference, 회귀, workflow 및 문서를 추가한다. #40은 기존 Browser Test의 비동기 import assertion도 정리한다.

## 충돌과 통합 위험

| 항목 | 확인 결과와 조치 |
|---|---|
| #37 중복 | `AGENTS.md`, `docs/AI_WORKFLOW.md`, `docs/GOLDEN_BENCHMARK_50UM.md`는 #37과 #38/#44에서 바이트 단위로 같다. `git merge-tree`에서 #37과 #34/#36은 clean, #37과 #38/#44는 `docs/NEXT_TASK.md`만 add/add 충돌이다. |
| #37 해소 | #44와 #37을 부모로 하는 Merge Commit에서 #44의 최신 Handoff를 채택했다. 해소 직후 트리는 #44와 동일하다. S1 Handoff에서 #37 원본 Commit을 연결하며 이후 작성된 모든 D2.8 Handoff를 유지한다. |
| Stacked History | S1 Draft의 Base는 Main이다. 전체 Physics 스택과 #37의 원본 Commit을 조상으로 유지한다. 이후 Draft PR을 하나씩 병합할 경우 ancestry 확인과 Base 재지정이 추가로 필요하다. |
| Fixed Ports 및 저장 호환성 | Position, Orientation, Mode 및 Project migration 동작을 Golden과 Mount regression으로 확인한다. Default Coaxial Port–Lens와 명시적 Advanced Free-Lens, Preview/Apply/Undo/Redo, 기존 Report/UI와 Search diagnostics를 같은 소스로 유지한다. |
| 분리된 Reference | D2.6 finite-ray 비교는 기존 앱의 진단 기능이며 후보 qualification에서 독립적이다. D2.8-A–E 독립 수치 구현과 Fixture는 `tests/` 및 별도 CI Job에 둔다. D2.8-E의 NumPy 1 / Diffractio 환경과 B/C의 NumPy 2 환경을 분리한다. |
| Artifact provenance | PR Head와 CI Checkout SHA, clean tracked state, input/source SHA256을 기록한다. S1에서는 Git provenance가 바뀌므로 이전 결과와 비교할 때 SHA·runtime·wall time과 물리 결과를 구분한다. |
| 보호 규칙과 변경 가능성 | 승인 직전 Main SHA, Merge 방식, Branch Protection, Required Checks, 비교 diff를 재확인한다. Main이 이동하면 S1에서 3-way 결과를 새로 검증하고 해당 Checkout의 CI로 판단한다. |

## Physics Capability & Validation Matrix

**Implemented / Regression Tested**는 정해진 동작의 회귀 검증이다. **Independently Validated within Model Domain**은 별도 Oracle이나 해석해와의 비교를 뜻한다. **Approximate / Domain Limited**는 계산 범위와 물리 오차 한계를 표시한다. **Reference Only**는 후보 qualification을 바꾸지 않는 비교 도구에 적용한다. **Unresolved / Uncomputed**는 해당 결과의 수렴이나 물리 계산을 확보하지 못한 상태다.

| Capability | 상태 | 검증 범위 및 한계 |
|---|---|---|
| Fixed Port/Mode, Coaxial / Advanced Mount, Search/Apply | Implemented / Regression Tested | D2.6.1 및 Golden에서 양쪽 Port frame, Mode, 제조 치수, default/opt-in 및 저장된 기존 Project를 검증. Browser Golden에서 0/500 µm Apply·Undo/Redo와 ±50/100 µm Search·변경 없는 Project를 검증. |
| Chief-ray tracing / 정렬된 Golden Gaussian | Independently Validated within Model Domain | Golden의 별도 Snell/Reflection/straight-segment Oracle 및 centered circular ABCD/Overlap. Oracle의 compiled world frame 입력은 공유한다. |
| D2.5 Bounded Lens Search와 4×4 Gaussian transport | Implemented / Regression Tested · Independently Validated within Model Domain · Approximate / Domain Limited | Search 예산 배분 및 explicit free-Lens regression. 별도 vector Snell/4×4 Differential Oracle가 두 Lens의 local first-order Gaussian tensor를 확인. Finite-beam clipping, diffraction, aberration 오차는 범위 밖. |
| Conditional Gaussian / ideal planar Mirror / 제한 Prism Mode | Approximate / Domain Limited | Unit-amplitude Gaussian overlap은 조건부다. Prism은 지정된 BK7, coplanar pure s/p 및 고정된 polarization basis에서의 TIR phase 모델이다. 첫 TIR 이후 powered/oblique optics와 범위 밖 후보는 계산 제한을 유지한다. |
| D2.6 Thick-Lens Finite-Ray Pupil / OPD | Reference Only · Independently Validated within Model Domain · Approximate / Domain Limited | 앱 진단과 Export를 회귀 검증. 축대칭 Snell/Simpson Oracle이 예시의 normalized overlap과 residual OPD를 확인. Clipping, Jacobian, Caustic, target coverage 및 수렴 gate가 있으며 physical η error bound와 Total Coupling은 null이다. |
| D2.7 Mirror Clearance / 23° Fold | Implemented / Regression Tested · Independently Validated within Model Domain | 지정 Disc/Segment에 대한 보수적 certificate와 independent cylinder/clearance 검사. ±50 µm에서 Two-Lens + Two-Mirror chief closure 및 Mount PASS. 0/500 µm는 nominal conditional 후보 유지, ±50/100 µm는 optical trials 후에도 기본 Mount에서 qualified 후보 0, bounded Search로 기록. |
| D2.8-A Aperture / Shadow / Lens Prefix | Reference Only · Independently Validated within Model Domain · Approximate / Domain Limited | Projected Mask 적분과 finite-ray refinement, 첫 Lens residual OPD. 23° Seed 약 19.80% clear ray flux, 첫 Lens OPD 약 6.50 nm. Diffraction 및 end-to-end Mode는 범위 밖이다. |
| D2.8-B Scalar AS/Fresnel, Aperture, Mode Projection | Reference Only · Independently Validated within Model Domain · Approximate / Domain Limited | Gaussian/flat aperture/RS 및 normalization controls. 일부 transverse-screen cases만 수렴했고 일부는 Unresolved다. 21/23/25° tilted aperture 비교의 six-point complex-field 차이는 실제 Fold 오차 한계로 사용하지 않는다. |
| D2.8-C/D Vector Planar Boundary 및 Topology Screening | Reference Only · Independently Validated within Model Domain | Prescribed Scalar Boundary/ideal infinite-plane Vector Fresnel·PEC·TIR controls 및 제한된 topology screening. 실제 Finite Mirror+Backing, edge scattering, 복수 반사는 미검증이다. Explicit Free-Lens nominal 후보의 target coverage/caustic 및 Lens transverse/tilt tolerance는 남아 있다. |
| D2.8-E Diffractio Feasibility Gate | Reference Only · Approximate / Domain Limited | Plane-wave/Slab controls와 단일 index slice 비용을 확인. Slab flux 차이는 해당 Boundary Model 차이다. 실제 Lens의 full propagation과 Grid/Window/Domain/Plane convergence는 Uncomputed다. |
| 실제 Fold 및 Explicit Free-Lens Field/Flux/Total Coupling | Unresolved / Uncomputed | 실제 Spherical Lens Wave Handoff와 finite-body Mirror boundary의 독립해가 없다. Coating, polarization, 실제 power normalization을 정의해야 한다. |
| OAT, Joint Tolerance, Assembly Yield | Implemented / Regression Tested · Approximate / Domain Limited · Unresolved / Uncomputed | OAT와 기존 deterministic joint scenarios는 조건부 Mode 민감도 진단이다. 실제 Combined-error 성능, Worst-case 보증, 제조 분포 기반 Yield 및 Robust Optimization은 Uncomputed다. |

Golden 001은 1310 nm, 10 mm 간격, 고정 평행 축, 양쪽 MFD 9.2 µm, default `port-axis` 조건을 사용한다. `geometry-pass`, `model-out-of-domain`, `budget-exhausted`, `infeasible-under-stated-constraints`, `uncomputed`를 구분한다. 현재 ±50/100 µm의 후보 미발견은 정해진 범위와 예산 안에서의 관측이다. Conditional overlap과 실제 Transmission / Total Coupling은 별도 필드이며 후자는 계속 미계산이다.

## Regression과 CI 비용

- #44 [CI #146](https://github.com/legendnever-collab/photonic-connector-studio/actions/runs/42219584432)의 정확한 Head에서 `validate`, `coherent-reference`, `boundary-reference`, `spherical-lens-gate` 네 Job이 성공했다. #44 보고 기준 Model 501 PASS / 42 files, Browser 218 PASS / 기존 52 SKIP, Golden 246 checks, D2.8-A 38, B 114, C 57, D 68+31, E 67 checks다. B/C/E의 PASS는 각 Reference 및 Gate assertion의 결과다.
- #146 `validate` 762초 중 Browser는 570초, Model은 123초였다. 별도 Build는 14초, 내부에서 Build를 다시 실행하는 Artifact 단계는 13초였다. S1은 기존 Artifact 빌드를 Browser 앞에서 실행해 동일 standalone HTML을 검증하고 업로드한다. 초기 Typecheck, Model, Browser, D Decision 및 모든 Reference Job과 Assertion은 유지한다.
- `coherentFieldInput.test.ts`는 Model과 세 Reference Job에서 실행된다. B/C/E의 독립 실행과 각각의 Artifact 입력/실패 진단을 유지한다. 이를 단일 Job에 의존시키거나 Browser 범위를 줄이는 변경은 이번 S1에 포함하지 않았다. C와 E가 다른 Python 환경을 쓰며 #146의 병렬 Job은 B 181초, C 43초, E 61초였다.
- S1 비교에는 `git diff --name-status <D2.8-E head> <S1 head>` 및 S1 PR의 정확한 Head에 연결된 CI를 사용한다. 체크포인트 HTML과 `dist/index.html`을 byte-compare할 수 있다. 수치 Artifact는 각 JSON의 물리 상태·입력·소스 SHA 및 Check ledger를 우선 대조한다. 로컬 재현 시 `npm ci`, `npm run typecheck`, `npm test`, `python3 tests/coherent/run_feasibility.py`, `npm run artifact`, `npm run test:e2e` 순으로 실행한다. B/C/E 명령과 요구 환경은 각 Reference 보고서에 있다.

## 권장 병합 순서와 승인 항목

1. S1 → Main Draft의 정확한 Head 및 Checkout CI를 검토한다. 최종 diff에서 #44 대비 문서와 Workflow만 변경되었는지 확인한다. Golden Model/Browser, D2.7, D2.8-A–E 결과와 Artifact를 함께 검토한다.
2. 사용자 승인 후 **S1 하나를 Merge Commit으로 Main에 병합**한다. #34–#36 및 #38–#44의 조상과 #37의 조상이 모두 포함된다. Squash/Rebase는 이 조상 관계를 보존하지 못한다. 저장소 정책이 Merge Commit을 허용하지 않으면 별도 순서인 #37 → #34 → #35 → #36 → #38 → #39 → #40 → #41 → #42 → #43 → #44를 사용자와 결정한다. 이 경로에서는 #38에서 같은 Handoff 충돌을 해소하고 각 Base/Head와 CI를 갱신해 검증해야 한다.
3. 승인된 병합 후 새 Main push CI를 확인한다. 원본 Draft의 상태와 후속 닫기 및 Branch 삭제는 사용자 승인 범위와 실제 GitHub 상태를 확인한 뒤 처리한다. 물리 Gate, Mount policy, 제작 치수, 합격 기준 또는 Architecture 변경은 별도 승인 대상이다.

## 다음 Engineering Checkpoint

**Astra · 외부 Single-Lens Wave Reference Pilot.** 기존 `tests/benchmark/d28e-single-lens.json`을 그대로 시작점으로 삼고 외부 Solver에서 Vector launch, Normal Flux, Bare/Coated/Rim boundary와 reference planes를 고정한다. 작은 Plane-wave/Bare Slab control과 자원 Pilot을 먼저 실행한다. 통과 후 실제 Lens의 complex Field, Normal Flux, receiving Mode projection을 Grid/Window/Domain/Plane refinement와 함께 비교한다. 기존 Gaussian/Ray-Pupil/Eikonal에 재사용할 오차 지표와 통과 기준은 실제 Lens 계산 전에 확정한다. 자원·Boundary·수렴 Gate가 충족되지 않으면 Path B와 Uncomputed 상태를 유지한다.
