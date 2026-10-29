# D2.6 · 두꺼운 Lens의 수차와 Mode 비교

`0.26.0-d26`: 실제 굴절·glass OPL과 ray-tube flux를 이용하는 1–2 Lens pupil benchmark를 추가했습니다. Analysis/Report에서 Gaussian·linear control·OPD와 수렴을 비교합니다. 내부 diffraction을 전파하는 전체 POP는 아직 아닙니다. [사용법·계산 범위·검증·다음 Astra 계획](docs/D26_THICK_LENS_PUPIL_BENCHMARK.md).

# D2.5 · 작은 offset 탐색 예산과 두 Lens Field 검증

`0.25.0-d25`: 시작 형상을 번갈아 검사하고 Local fit 예산을 확보하여, 예시 01의 ±100 µm offset을 Optical 2048 / Local fit 256에서 찾습니다. Local fit 한도도 partial 상태에 반영합니다. 독립 finite-ray differential로 두 Lens 전체의 복소 Q를 교차 검증했습니다. [사용법·수치 결과·한계와 Astra 후속 계획](docs/D25_SEARCH_AND_TRAIN_VALIDATION.md).

# D2.4 · 작은 offset과 Lens 편심·tilt 보정

`0.24.0-d24`: 고정된 Input·Output 사이에서 실제 Lens 편심·tilt를 조정합니다. 50 µm offset의 2-Lens 후보를 탐색하고 보정량과 별도 Field 유효성을 확인할 수 있습니다. [사용법·계산 계약·검증과 다음 계획](docs/D24_SMALL_OFFSET_LENS_ALIGNMENT.md).

# UX4 · 구조별 탐색 상태와 후보 비교

`0.23.0-ux4`: 구조별 선택/부품 제한, 실제 기하·평가 제외 사유와 탐색 한도를 표시합니다. 같은 구조·평가 조건의 후보를 묶고 모두 펼쳐 비교·적용할 수 있습니다. [사용 순서·진단 계약](docs/UX4_SYNTHESIS_EXPLANATIONS.md).

# UX3 · 조건 확인과 자동 설계 작업

`0.22.0-ux3`: 예시를 ② 연결 조건에서 시작하고 ③ 자동 설계 찾기를 주요 작업으로 노출합니다. Explorer는 오른쪽 탭과 PC floating을 지원합니다. [변경·사용 순서](docs/UX3_DESIGN_ACTIONS.md) · [Astra 후속 계획](docs/ASTRA_ARRAY_AND_INDUSTRY_EXAMPLES_PLAN.md).

# UX2 · 예시 중심 설계 Workspace

`0.21.0-ux2`: 왼쪽 작업 순서, 큰 광학 화면, 접을 수 있는 Surface Data, 일관된 주요 버튼과 01 Fiber–Lens–Lens–Fiber 기준 예시를 제공합니다. [변경·검증](docs/UX2_GUIDED_WORKSPACE.md) · [Astra 후속 개발 계획](docs/ASTRA_ARRAY_AND_INDUSTRY_EXAMPLES_PLAN.md).

# A1 · Channel별 평가와 참고 구조 예시

`0.20.0-a1`: Templates의 실제 참고 구조·가정·부품 역할, 계산 가능한 Mirror / 2-Lens 연습 예시, 공용 광학계의 Channel별 조건부 Gaussian 비교를 추가했습니다. Output 공통 이동·회전·Pitch 변화 전후를 비교하며 부분 coverage에서 전체 Array 성능을 추정하지 않습니다. [계약과 검증](docs/A1_ARRAY_CHANNEL_STUDY.md).

# UX1 · Array-aware Design Workspace

기본 시작은 Port만 있는 **새 설계**입니다. **Templates**에서 Edge / Vertical / Evanescent
상황의 시작 조건을 선택하거나 **설계 조건 → Ports & Array → 목표·제약 → 설계 후보 찾기**로
진행합니다. 같은 Workspace에서 후보를 비교·적용하고 기존 Analysis / Report를 사용합니다.
기존 전문가 도구는 고급 도구에, 기존 수치 fixture는 기술 검증용 예시에 보존합니다.

Input / Output 각각 Rows × Columns, Pitch Y/Z와 대표 Channel을 정의합니다. 대표 Channel
선택은 Array 배치를 보존하며, Layout / Report는 동일한 실제 Port 위치를 표시합니다.
현재 계산·자동 설계·공차는 대표 Channel 대상입니다. Array 전체 Mode / 공차 / Crosstalk는
미평가이며 Report / SVG metadata에 이를 명시합니다. Templates는 완성 답을 삽입하지 않습니다.
[계약·범위·사용자 확인](docs/UX1_ARRAY_DESIGN_WORKFLOW.md).

## D2.3.5 · Finite-beam Lens benchmark

Analysis → **Run Lens Field Benchmark**에서 단일 spherical Lens의 exact sag phase와
quadratic phase를 독립적인 pupil-plane 적분으로 비교합니다. Pupil fraction, conditional
overlap, residual phase RMS, grid convergence와 screen reference gate를 확인하고
JSON / Report SVG metadata로 내보냅니다. 이 결과는 thin phase-screen benchmark이며,
기존 3D Mode Overlap·synthesis 순위 또는 실제 coupling 정확도 보증을 대체하지 않습니다.
[모델·수치 검증·확인 방법](docs/D2_3_5_FINITE_BEAM_BENCHMARK.md).

## D2.3.4 · Bounded Lens decenter / tilt

작은 spherical Lens decenter / tilt를 exact chief ray 주변의 full complex Gaussian tensor로
전달합니다. Chief incidence ≤50 mrad와 footprint / |R| ≤0.2 안에서 tangential / sagittal
power와 anamorphism을 반영하며, Joint 평가·Gaussian·Analysis·Report가 같은 field를 사용합니다.
η는 local first-order Gaussian reference입니다. 수치 비교 floor는 실제 광학계의 오차 보증이
아닙니다. [식·독립 benchmark·범위·사용자 확인](docs/D2_3_4_OBLIQUE_LENS.md).

## D2.3.3 · Joint Analysis / Report

현재 설계의 Joint Tolerance 결과를 Analysis와 Report에서 공유합니다. Exact Project와 설정이 바뀌면 Stale로 표시하며, JSON / SVG provenance와 SVG / PNG 요약을 내보낼 수 있습니다. 설정만 Project에 저장하며 새 세션에서는 재평가합니다. [범위와 사용자 확인](docs/D2_3_3_JOINT_ANALYSIS_REPORT.md).

## D2.3.2 · Joint tolerance feedback

Design Problem → Joint Tolerance에서 common mating / individual Assembly 공차를
정의한 뒤 Automatic Synthesis → Tolerance feedback을 Joint로 선택합니다.
같은 coverage / evaluator / Mode / geometry criteria의 Group 안에서 관측 최소 η를
비교하고 route와 Lens 변수를 다시 조정합니다. Partial과 geometry 실패는 unranked입니다.
OAT가 기본값이며 Yield나 global robust optimum을 의미하지 않습니다.
[좌표·비교·예산·검증 범위](docs/D2_3_2_JOINT_FEEDBACK.md).

## D1 · Design Problem

Open **Design Problem** from the top bar or Surface Data. Set current Surface
locks / Lens bounds, component count, Design Space / Keep-out and tolerances.
Assess the current Project or search supported Lens / fold candidates directly;
compare nominal reference goals and conditional scalar overlap under OAT
boundary stresses. Save settings / Apply each make one Undo step. Partial field
coverage stays explicit. [Scope and validation](docs/D1_DESIGN_PROBLEM.md).

## Linked 3D Report details

Report → **D · Detail Insets** connects overview regions to enlarged 3D Lens /
Prism views with dimensions, vertex spacing, ray direction and available
Gaussian 1/e² Beam size. **Expand Report** opens a large view; SVG / PNG include
the current detail sheet. [Scope and validation](docs/REPORT_DETAIL_INSETS.md).

## S3.2 — Bounded Lens reference design (0.9.0-s3.2)

**Design Setup → Design Lenses** fits one/two physical Lenses to the fixed Output
Gaussian MFD and flat phase, with actual S1 / glass / S2 surfaces. The explicit
2-Lens Relay template can add a BK7 Output Lens in read-only Preview. Compare
beam and geometry, then Apply in one Undo. Fixed Ports / Mirror / Prism, Lens
material / aperture / Body radius and all Mode conditions remain unchanged.

Only model-valid, aperture-feasible, geometrically checked candidates are kept.
Reference goals / best tested partial results / no candidate / limited coverage
are distinct; there is no device-efficiency or global-optimum claim. New optional
v1 provenance is saved with the canonical physical design. Old JSON is preserved.

Review **S3.2 · Folded Lens design task → Design Lenses → Run Lens Design**,
or start with the original 10 mm Fiber–Lens–Fiber. Contract and limits:
[docs/S3_2_LENS_DESIGN.md](docs/S3_2_LENS_DESIGN.md). Draft checkpoint stacked on
unmerged S3.1 #14 / S2 #13; main is unchanged.

## S3.1 — Folded Gaussian reference (0.8.0-s3.1)

Gaussian View now follows the actual Mirror / Prism chief path with transported
transverse frames and a full 2×2 complex Gaussian tensor. Inspect beam radii vs
geometric arclength, Global section rings, Output local contour and before/after
Surface data. Export analysis as SI JSON. Oversized beams stay explicitly labeled
**Aperture-limited reference**; clipping, TIR phase and folded Coupling are not
calculated. Existing straight Fiber–Lens–Fiber B1 behavior is preserved.

Open **Example Projects → Lens + 2 Mirrors / Lens + TIR Prism → Gaussian View**.
See [S3.1 physical contract and review](docs/S3_1_FOLDED_GAUSSIAN.md).
Draft checkpoint based on unmerged S2 PR #13; no main merge or Lens optimization.

## S2 — Automatic route candidate search (0.7.0-s2)

Fix Input / Output conditions and existing Lens geometry, then find Direct / Mirror /
TIR Prism routing candidates. Compare actual 3D geometry, component poses, reference
position/incidence errors, OPL and separate diagnostic rays before applying one
undoable candidate. Search respects part limits, bounded space and conservative
clearance / Keep-out screens. It does not optimize Mode Coupling or Lens shape.

Open **Design Setup → Routing Example → S2 · Displaced PIC routing task**, then
**Find Solutions… → Run Search → Preview → Apply Candidate**.
See [S2 contract and review](docs/S2_ROUTE_SEARCH.md). Draft pending user review;
no automatic main merge or S3 start.

## S0 / S1 — Port-to-Port Design Setup (0.6.0-s0-s1)

Specify Input / Output Global position, propagation direction and reference Mode;
inspect a shared finite 3D center ray through Lens / Mirrors / TIR Prism. Two manual
Fiber-to-PIC examples show a 60 µm height shift. Design Space / Keep-out diagnostics,
part limits, world/local editing, Undo and SaveLoad share the existing Project.

Open **Design Setup**, then **Routing Example**. **Focus Folds** shows the micro-scale
fold in XZ. No automatic solution search or PIC coupling efficiency is claimed.
See [S0/S1 contract and review steps](docs/S0_S1_PORT_ROUTING.md).

F1.1 and S0/S1 were merged as PRs #11/#12 after user approval.

# Photonic Connector Studio — F1.1 Conic / Even Asphere

Desktop design workflow for **Input Mode → Optical Train → Output Reference Mode**.
Baseline P2.4 remains preserved; F1.1 is a Draft Play Review checkpoint, not a merged release.

Startup now opens **Fiber → BK7 Lens → Fiber**, with 10 mm between Fiber facets.
S1 / BK7 / S2 form one 1 mm-thick Lens, and both Fiber bodies are visible in 3D.
Choose Input or Output **Port Template → SMF Fiber** to set either reference.
**New Physical Project** remains the blank authoring route. Existing saved
projects retain their original values. Add components
from Component Catalog or insert rows in Surface Data. Layout and Surface Data
share one Project. Float / Dock and the Splitter change session layout only.

- `npm ci`; `npm run check` for type, model, build and browser checks.
- `npm run artifact` produces the offline single HTML and source/hash manifest.
- `npm run test:e2e -- --config=playwright.offline.config.ts` checks packaged B1 behavior offline.
- [F1.1 Surface scope and verification](docs/F1_1_CONIC_ASPHERIC.md)
- [B1 physical Gaussian scope and verification](docs/B1_PHYSICAL_GAUSSIAN.md)
- [U1 contract](docs/U1_MODE_PORT_CONTRACT.md)
- [U1 verification and review](docs/U1_IMPLEMENTATION_REPORT.md)
- [Existing development roadmap](docs/DEVELOPMENT_ROADMAP_V1.md)

Surface Data and Properties now edit Even Asphere Conic K and A4/A6/A8 in mm-based
units. One Sag/Normal evaluator drives geometric rays, finite bodies and Report.
Surface Ray tracing remains a Geometric Diagnostic. Gaussian View now propagates
the same coaxial sphere/plane prescription and compares the normalized Output
field with its Fiber reference. Transmission / Total Coupling, folded / confined
fields remain outside the B1.0 subset. Nonzero Aspheric departures show a
vertex-curvature Gaussian reference with Mode Overlap withheld. Existing
legacy Ideal Gaussian analysis remains available via Examples.

## P2.4 — Unified Optical Workstation

Gaussian / Surface / Report are central views of **one project**. Open/Save, Undo/Redo,
Add Component, Example, component tree, Properties and Analysis stay in the same shell.
All prior Gaussian/Surface examples are available in the common Example menu.

Download `artifacts/photonic-connector-studio-p2.4.html` and open it in a JavaScript-capable
browser. It includes scripts, styles and Korean font for offline use. For development:
`npm ci`, then `npm run dev`; validation: `npm run check`.

Try a Physical example → Report → Add → TIR Prism → enter Global XYZ / angles → Insert.
Edit its Assembly pose / Prism Depth in Properties, then switch Gaussian / Surface / Report.
All views retain the same components, inputs and global Undo history. Physical Gaussian
propagation/coupling, Freeform surfaces and CAD import are **not implemented in P2.4**.
An ideal-only project retains its original model and supports Ideal Lens / Gap / Reference
Plane insertion. Mixed ideal/physical model migration is a subsequent explicit contract.

See [P2.4 report](docs/P2_4_IMPLEMENTATION_REPORT.md) and
[full Freeform / off-axis / coupling plan](docs/UNIFIED_WORKSTATION_AND_FREEFORM_PLAN.md).
P2.4 is stacked on PR #7; main remains unmerged pending Play Review.

---

# Photonic Connector Studio

**Fiber-to-Waveguide Optical Design Workspace · v0.2.3-p2.3**

P1.2는 Air Gaussian q/Beam Axis, Source/WG Small-angle Tilt와 Offset–Tilt–Curvature Coupling을 계산합니다. Alignment Sensitivity Curve·Joint Map·Threshold 구간·CSV Export를 제공합니다. Common X-plane Phase-ramp 근사이며 Lens Tilt/Decenter, Roll과 Clipping은 지원하지 않습니다.

## 바로 실행

[photonic-connector-studio-p2.3.html](artifacts/photonic-connector-studio-p2.3.html)을 다운로드하고 Desktop Browser에서 엽니다. JS/CSS와 작은 Korean Font가 포함된 단일 HTML이며 서버와 인터넷 없이 실행됩니다. Mobile에서는 HTML 실행을 지원하는 Browser로 열거나 아래 Vite 서버를 사용하세요. 메신저/파일 앱의 HTML Preview는 JavaScript 실행을 지원하지 않을 수 있습니다.

## Source 실행

Node.js **22.12 이상** 또는 **24.0 이상**을 사용합니다.

```bash
npm ci
npm run dev
```

`http://127.0.0.1:5173`을 엽니다. 다른 기기로 접속할 때는 `npm run dev -- --host 0.0.0.0`을 실행하고 해당 서버의 주소를 사용합니다.

```bash
npm run typecheck
npm test
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
npm run artifact
```

Production Preview: `npm run preview` → `http://127.0.0.1:4173`.
기존 Chromium을 사용해야 하는 환경에서는 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`를 지정할 수 있습니다.

## 사용 순서

1. 기본 1310 nm Example에서 Fiber Port와 WG Port를 확인합니다. Lens/Position은 학습용 가정이며 MFD는 TBD입니다.
2. Tree / Layout / Data에서 Component를 선택하고 Properties를 편집합니다. Mobile은 Layout / Train / Edit / Analysis 탭을 사용합니다.
3. Position은 mm, MFD는 µm, Orientation은 degree로 입력합니다. JSON 내부는 m / rad입니다. MFDx는 local Y, MFDy는 local Z 방향 Intensity 1/e² diameter입니다.
4. Insert로 Thin Lens / Air Gap / Reference Plane을 추가합니다. Up / Down은 Train Order만 바꾸며 절대 Position은 유지합니다. Fiber/WG Terminal Port와 Mating Plane은 삭제할 수 없습니다.
5. XY / XZ Projection, Zoom, 배경 Drag Pan, Fit을 사용합니다. 좌표 축은 같은 Scale을 사용하며 Lens/Port/Mode Symbol은 도식입니다. 편집 중 Camera는 고정되므로 큰 이동 후 Fit을 누르세요.
6. Save JSON → Open JSON으로 Design을 저장/복원합니다. 잘못된 입력은 기존 Design을 보존합니다. Undo / Redo, Lock, Enabled, X Variable Flag를 사용할 수 있습니다. Variable은 저장만 하며 Optimizer는 없습니다.
7. Help에서 공통 Vacuum Wavelength를 변경할 수 있습니다.

짧은 Desktop 화면에서는 Tree, Properties와 Data 내부를 스크롤합니다. 작업 내용은 Memory에 있으므로 종료 전에 JSON을 저장하세요. Browser Storage나 Cloud Account는 사용하지 않습니다.

## P2.3 Common Optical Project

Gaussian Workspace / Surface Workbench / Report는 하나의 Project·선택·Undo/Redo·Save/Load를 공유합니다. 기존 Ideal Thin Lens 설계는 그대로 보존하고, Physical Surface 설계에서는 Surface Data를 광학 정의의 기준으로 사용합니다.

- **Source / Mode**: MFD·Polarization과 Source Body 치수를 별도로 입력합니다.
- **Assemblies & Surfaces → Assembly**: Building Block Geometry에서 Lens 외경/Center Thickness, Mirror 원형·사각형/두께, Prism Depth, Array 기판 크기를 지정합니다. 곡률·Clear Radius·n·Local Frame은 Surface Data/Properties에서 편집합니다.
- 보고용 형상은 같은 치수를 사용하며, Mirror/Prism의 유한 경계는 Ray 판정에도 적용됩니다. 정의되지 않은 Body 치수는 추정하지 않습니다.
- **Save Project JSON**은 전체 공통 문서를 저장합니다. 기존 Gaussian JSON / Surface JSON도 Import할 수 있습니다. Legacy Surface 파일의 미정의 Body 치수는 그대로 미정의로 남습니다.
- Physical Project의 Gaussian Workspace에서도 같은 Source/Target Mode와 부품을 확인·편집합니다. Physical Lens / Folded Path의 Gaussian 전파와 η는 아직 미지원이며 이전 결과를 표시하지 않습니다.
- Ideal Gaussian 설계의 Surface View는 위치·Clear Aperture 참조입니다. Parent Assembly 자세와 Aperture를 편집할 수 있으며 실제 곡률·두께로 자동 변환하지 않습니다. Report의 Gaussian Envelope는 기존 검증된 Solver를 사용합니다.

[설계 원칙과 범위](docs/P2_3_COMMON_PROJECT_CONTRACT.md) · [구현/검증](docs/P2_3_IMPLEMENTATION_REPORT.md).

## P2.2 Report Figure

Surface Workbench → **보고용 그림 · Report**에서 **B · Technical Isometric** / **C · Linked Inspector**를 선택합니다. 같은 Surface / Ray 데이터에 유리 곡면·두께·미러 질감·부품 라벨과 보고용 구도를 적용하고, SVG / PNG 2×로 저장합니다. C는 선택 Surface의 실제 Geometric Footprint를 표시합니다.

표시용 Prism 외형과 Mirror backing은 Ray Trace에 들어가지 않습니다. Field Intensity / Gaussian 연동은 아직 구현하지 않았습니다. [구현 및 범위](docs/P2_2_REPORT_FIGURE.md).

## P2.1 Surface Workbench

상단 **Surface Workbench**를 누르거나 URL에 `#surfaces`를 붙입니다. Surface 중심 설계와 계산된 Ray를 동일한 XY/XZ/YZ·3D로 확인합니다. 기존 Gaussian Workspace와 각 Design 상태는 보존됩니다.

- Surface / Assembly Local Frame·공통 Pivot, signed sphere Radius, circular Clear Radius, n, refraction/reflection/explicit TIR, repeated lenslets, computed OPL.
- Physical Lens / Fold Mirror / TIR Prism / Microlens Array / MLA+Prism+Mirror 예제. 입력은 모두 Synthetic이며 실제 부품 성능이 아닙니다.
- Table의 Radius/Clear Radius 또는 Inspect에서 편집 → Ray·Target Centroid/RMS 갱신. **Ray Analysis**에서 Footprint와 blocked 원인을 확인합니다.
- **3D**는 드래그 회전, **Shaded**는 광학면 Preview, **SVG**는 현재 계산 경로의 보고용 Vector Snapshot입니다. 완전한 Solid CAD/Photorealistic Render는 후속 범위입니다.
- **Save Surface JSON / Open Surface JSON**과 Undo/Redo. P1 Gaussian JSON과 별도 Schema이며 전용 파일 호환을 주장하지 않습니다.
- Ray count·RMS는 Optical Efficiency / Mode Coupling이 아닙니다. Constant supplied n, 지정된 Sequential 경로만 지원합니다. 상세 범위는 [Contract](docs/P2_1_SURFACE_CONTRACT.md) / [Report](docs/P2_1_IMPLEMENTATION_REPORT.md).
- [Draft PR #5](https://github.com/legendnever-collab/photonic-connector-studio/pull/5), stacked on unmerged PR #4. main 병합 및 다음 Checkpoint 자동 시작 없음.

## P1.3 Visual Workstation Review

- P1.1 / P1.2 are merged into main (PR #2 / #3). Physics limitations described above remain in force.
- **Appearance**: Lab Light (default), Precision Dark, Focus Hybrid. Switch the actual workspace without resetting the Design, camera or computed results. This session preference is not included in Design JSON.
- Persistent η / Loss / Radius ribbon; larger input and Canvas labels; stronger secondary text; full-height Desktop Inspect / Analyze tabs. Short Desktop windows scroll the center workspace rather than clipping controls. Mobile retains Layout / Train / Edit / Analysis.
- [Visual options](artifacts/P1.3-design-options.png) · [Implementation / Validation](docs/P1_3_IMPLEMENTATION_REPORT.md).
- Branch `feature/p1-3-visual-workstation`; [Draft PR #4](https://github.com/legendnever-collab/photonic-connector-studio/pull/4), based on main. Design review before merging this new visual change. No P2 implementation starts automatically.
- Next: P2 Physical Lens / Ray Tracing → P3 Physical Optics / Complex Field Overlap → P4 Optimization → P5 Connector Tolerance → P6 Multi-channel / Measurement Validation.

## P1.2 Play Review (historical)

- **Source Tilt / Beam Axis**: Source Yaw=5mrad → W Beam Center Y=4µm, Slope Y=−3mrad, η≈92.4465%.
- **WG Tilt / Angular Mismatch**: η≈36.7879%; **Reset Matching**: η=100%.
- Analysis → **Expand**: Offset/Tilt Curves, Joint Map, absolute η Threshold, finite nominal-connected pass interval, cell inspection and **Export Sweep CSV**.
- Matching η≥80%: Offset≈±8.4279µm; Tilt≈±8.4279mrad under this Synthetic model. Scan ends and invalid domains are explicitly distinguished; these are not manufacturing tolerances.
- Mobile: **편집 종료 · Layout**. Save JSON separately preserves Design. Scan settings are session state.
- PR #2 and [PR #3](https://github.com/legendnever-collab/photonic-connector-studio/pull/3) merged into main on 2026-10-23 (UTC).
- [Work Order](docs/P1_2_WORK_ORDER.md) · [Implementation Report](docs/P1_2_IMPLEMENTATION_REPORT.md) · [Physics Validation](docs/P1_2_PHYSICS_VALIDATION.md) · [Recovery](docs/P1_2_RECOVERY_NOTE.md).
- P0 / P1.1 / P1.2 artifacts preserved. The user subsequently authorized the P1.1/P1.2 merge and P1.3 visual work.

## 기존 설계 문서

아래 문서는 구현 이전의 기준 문서이며 원문을 보존했습니다. 현재 구현 상태는 위 Checkpoint와 별도 보고서를 기준으로 확인하세요.

1. [DEVELOPMENT_ROADMAP_V1.md](docs/DEVELOPMENT_ROADMAP_V1.md)
2. [WORKFLOW_AND_MODEL_POLICY.md](docs/WORKFLOW_AND_MODEL_POLICY.md)
3. [MASTER_PLAN.md](docs/MASTER_PLAN.md)
4. [PHYSICS_CONTRACT.md](docs/PHYSICS_CONTRACT.md)
5. [UI_DESIGN.md](docs/UI_DESIGN.md)
6. [CHECKPOINTS.md](docs/CHECKPOINTS.md)
7. [P0_FIRST_IMPLEMENTATION_WORK_ORDER.md](docs/P0_FIRST_IMPLEMENTATION_WORK_ORDER.md)

## Source / Licensing

[DeepO Interface Tour](https://www.ai4optics.com/deepo/manual/interface/tour/)는 Shell / Layout / Data Editor / Mobile Navigation의 UX 참고 자료입니다. 구현은 독립적이며 DeepO Code / Branding / Solver를 복제하지 않았습니다. DeepLens는 설치하거나 사용하지 않았습니다.

Korean Font는 Noto Sans KR의 작은 Subset이며 [SIL OFL](src/assets/NotoSansKR-OFL.txt)을 포함합니다. Public Repository에는 학습용 가정만 사용합니다.
