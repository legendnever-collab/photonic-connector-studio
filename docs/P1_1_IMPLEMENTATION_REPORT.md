# P1.1 Implementation & Play Review

Date: 2026-10-23 (Asia/Seoul) · App v0.1.1-p1.1
Branch: `feature/p1-gaussian-optics` · [Draft PR #2](https://github.com/legendnever-collab/photonic-connector-studio/pull/2)
Base: `main`, P0 merge `6e9016b5c3edd6601344ea10fdf25fec70be0757`.
Validated Source Commit: `f0cf2da816fdf9c3dd8ecf41eb2a49b74772b8ce`.
Stop: P1.1 Play Review. No main merge; P1.2 / P2 not started.

## Recovery

P0 PR #1 was already merged. Remote P0 HEAD `f93d59170f20863664b6e09609cca37d3276527a`, latest P0 CI PASS. Existing local P0 worktree was clean; an isolated P1 worktree began from merged main. No P1 Branch/PR existed. Required eight documents were read in order; Architecture/Roadmap originals and P0 artifact/hash/manifest were preserved. Physics Contract received only a P1.1 addendum before implementation.

The shell had no Push credentials. GitHub Connector created checkpoint commits using identical file trees; local checkpoint history is preserved. Remote Source tree matches local implementation exactly; manifest uses the actual remote Source Commit above, not an unreachable local SHA.

## Changes

- `Fields.tsx`: valid Number input auto-applies; invalid drafts do not enter Design State. Invalid field status suppresses live coupling. Enter/Blur restores last valid value; nullable blank is explicit TBD. Negative and fractional values respect schema rules. Close does not pretend to cancel applied values.
- Mobile Properties uses Visual Viewport height/offset, a persistent top editing toolbar, internal scroll and safe-area padding. **편집 종료 · Layout** blurs the input and returns to Layout. Global file controls and Workspace tabs remain reachable. Auto-application and Save JSON are explained separately.
- Pure `physics.ts`: per-axis complex q/ABCD, samples, flat-waist target Gaussian Overlap including phase curvature and WG lateral offset, strict geometry/orientation/domain checks, provenance. No backend, AI API or heavy optics dependency.
- `Layout.tsx`: XY/Y and XZ/Z calculated Gaussian Envelope and Target bracket. Geometry axes remain equal-scale; Beam/Target transverse display has explicit ×1/10/100 magnification. It is not Ray Tracing. Repeated edits retain SVG/Overlay DOM, Focus, Zoom and Pan; explicit Load/Example fits the newly loaded Design.
- `Analysis.tsx`: η, scoped Gaussian Coupling Loss, W Beam/Target radii, wY(X)/wZ(X), expandable Curvature, Waist location and incident/target intensity profiles. Scalar/waist/omitted-clipping assumptions and conditional Polarization warnings are explicit.
- Three Synthetic Examples: Free-space, Mode Matching and WG Offset Mismatch. Reset Matching restores the independently verified benchmark; it does not run Optimization. P0 Example still has MFD TBD.
- JSON v1 remains compatible, with no hidden defaults or stored Solver results. Undo/Redo and Save/Load recalculate current results.
- Font Subset now covers all 199 Korean source syllables, with a source-coverage regression check. Original P0 font/artifact remain preserved.

## Verification

| Gate | Result / evidence |
|---|---|
| Typecheck / Build | PASS |
| Domain/State + Physics + Font | 90 PASS: 47 + 42 + 1 |
| Browser | 32 PASS, 2 intentional SKIP (34 cases, Desktop/Mobile projects) |
| Numerical accuracy | Matching η=1; Offset η=e⁻¹; independent complex quadrature max observed error 1.55e−15; [detailed report](P1_1_PHYSICS_VALIDATION.md) |
| Focus / Canvas / Camera | Continuous Lens edits retain input focus, SVG and Overlay nodes; envelope/KPI respond together; Zoom stays 125% |
| Mobile editing | Focus → change → Enter/Blur/Close → Layout → JSON Save/Load; blank, 0 f, negative f, decimal, Tab, schema rejection and recovery |
| Visual Viewport proxy | Mobile test overrides Visual Viewport to 360px height / 25px offset and checks exit button bounds; does not open an actual OS keyboard |
| Responsive | 360 / 412 / 768 / 1366 / 1920px P1 screenshots and existing 320–1920 matrix; no document horizontal overflow |
| Offline | Networking-disabled `file://` Production HTML: Example calculation, edit, JSON download/import, benchmark recovery, no runtime error |
| P0 regression | Tree / Table / Layout selection, add/remove/reorder/disable/lock, geometry/MFD/orientation, History, malformed/future JSON preserving current Design |
| Source/Artifact | Source input SHA256 list + aggregate fingerprint; delivered HTML byte-identical to tested Production HTML |

The 2 SKIPs avoid repeating Desktop-only Data Table interaction and the once-per-suite viewport matrix in the Mobile project. Local Browser: Chromium 153.0.8010.0 Headless via temporary `@sparticuz/chromium`; default Playwright Browser CDN returned truncated archives. No fallback Browser dependency was added to package.json/lockfile. GitHub CI uses normal Playwright Chromium.

**Not verified:** real Android/Chrome Soft Keyboard, iOS, Safari, Firefox. Visual Viewport resizing is a geometry proxy, not Soft Keyboard real-device verification. No measured-device validation is claimed.

## Standalone Artifact

- [photonic-connector-studio-p1.1.html](../artifacts/photonic-connector-studio-p1.1.html)
- [build-info-p1.1.json](../artifacts/build-info-p1.1.json)
- [SHA256SUMS-p1.1.txt](../artifacts/SHA256SUMS-p1.1.txt)
- HTML SHA256: `2d06cd6bcddc9ea9cc105b533ad77ac4a9ea747ab8d8e55d02e35bd15432c7f9`
- HTML bytes: 351246.
- Source fingerprint: `54ed1a2cf99d33ab96b0115f601df974593dee1a226817ed53063eff5452f88b`.

`npm run artifact` rebuilds Source before packaging. Per-file hashes cover src, build configuration, dependencies and packaging script. Later documentation/artifact-only commits do not change the fingerprint. GitHub CI screenshots are uploaded under the P1.1 Actions artifact (`test-results/P1.1-*.png`). The latest full checkpoint SHA and latest CI conclusion are recorded in PR #2 / delivery message to avoid a self-referential report commit hash.

Source Commit CI: **PASS** — [P1.1 validation #9](https://github.com/legendnever-collab/photonic-connector-studio/actions/runs/39936650566). Latest delivery checkpoint CI is also checked in the PR.

An additional direct smoke test opened the delivered artifacts/photonic-connector-studio-p1.1.html itself with networking disabled: Matching η=100%; Focal Length=1.4 mm changed η to95.6098%; zero runtime errors. Source hashes, Artifact SHA256 and Production byte parity all passed.

No hosted Preview. Download HTML and open with a JavaScript-capable Browser, or run `npm ci && npm run dev` (Node 22.12+/24+) and open `http://127.0.0.1:5173`. For Mobile on the same network: `npm run dev -- --host 0.0.0.0`, then open the server's network address. File-preview apps may not execute HTML JavaScript.

## User Play Review — five checks

1. Mobile Train → Lens F → Edit, change Focal Length, tap **편집 종료 · Layout**. Valid changes remain. Save JSON separately to preserve the file.
2. Choose **Free-space Gaussian**. Beam spreads toward W; XY/XZ refer to local Y/Z radii.
3. Choose **Mode Matching**. η=100%, Loss≈0 dB. Change Lens X or Focal Length and observe Waist/Envelope and coupling together; Reset Matching restores benchmark.
4. Change WG MFD or Y/Z Position. Coupling decreases; **Mismatch / WG Offset** gives 36.7879%. Unsupported Tilt/Decenter gives a reason rather than a stale Valid result.
5. Save JSON → Reset Matching → Open JSON, then Undo/Redo. Geometry and computed results must restore consistently.

P1.1 is a completed checkpoint within P1. It does not complete all P1 Gaussian features; Small-angle Tilt/Beam Axis remains proposed P1.2, requiring separate approval.
