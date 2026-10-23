# P1.2 Implementation & Play Review

Date: 2026-10-23 (Asia/Seoul) · App v0.1.2-p1.2.
Branch: `feature/p1-2-alignment` · [Draft PR #3](https://github.com/legendnever-collab/photonic-connector-studio/pull/3).
Actual base: `feature/p1-gaussian-optics`, HEAD `286c1386e9bc5091b475833e978676755d12d885` (unmerged Draft PR #2).
Validated Source Commit: `d3e259db9943d678ac3f0ffd374859bf39933dd9`.
Stop: P1.2 Play Review; no main merge or P2 start.

## Recovery and checkpoints

P1.1 Source/Artifact/History were preserved. Local worktree was clean, Remote PR #2 was Open/Draft, main remained the P0 merge. The user's new instruction explicitly authorized P1.2 implementation. A separate branch was created from the P1.1 checkpoint, with a stacked PR rather than changing main. Architecture/Roadmap were not rewritten; [Work Order](P1_2_WORK_ORDER.md) and a Physics Contract addendum were recorded before implementation.

Checkpoint commits separate Contract, validated Beam Axis/Overlap/Sensitivity Core, and UI/integration. Known CLI Push credential limitations were handled through GitHub Connector, with identical Git file-tree checks and expected-head fast-forward ref updates. Original local checkpoint commits remain recoverable; no reset/force push.

## Implemented

- Source and WG small-angle Pitch/Yaw as phase ramps on common X planes, with explicit ±50 mrad norm eligibility gate. Roll/Lens rotation/decenter remain unsupported. Canonical SI and JSON schema v1 are unchanged.
- Gaussian q and calculated centroid/slope travel together through free space and centered Ideal Lens. W Incident Center, Incident/Target Slope and relative Offset/Angle are displayed.
- XY/XZ shows calculated orange Beam Axis with Envelope and Target bracket. The declared transverse magnification applies consistently to Axis displacement, Beam Radius and Target Offset. Numeric angles remain in Analysis; the magnified drawing angle is not a physical angle measurement.
- Expanded Alignment Analysis: WG Y/Z Offset and corresponding Yaw/Pitch curves, joint map, absolute η threshold, nominal-connected pass interval, selectable cell details, finite scan/domain labels, Reset Scan and CSV download. Editable controls retain Focus. Expand/Close/Escape and responsive Desktop→Mobile resizing preserve the Analysis view.
- Sensitivity holds Source/Lens train fixed and reuses its validated Incident Field, avoiding repeated full-Train propagation/fingerprints while editing. Full Solver grid parity is tested. Scan settings/results do not mutate Design or History.
- New Synthetic Examples: WG Tilt (η=e⁻¹) and Source Tilt/Beam Axis (W center=4 µm, slope=−3 mrad, η=92.4465%). Original Free-space/Matching/Mismatch remain.
- P0/P1.1 HTML, hash manifests and fonts preserved; P1.2 font covers all214 Korean source syllables with coverage regression.

## Validation

| Gate | Result |
|---|---|
| Typecheck / Build | PASS |
| Unit/Numerical/Font | 119 PASS: 47 Domain/State +42 aligned Physics +29 Alignment/Sensitivity +1 Font |
| Independent field quadrature | max observed absolute error 6.33e−15; [reference values and convergence](P1_2_PHYSICS_VALIDATION.md) |
| New Alignment Browser cases | 12 PASS across Desktop/Mobile |
| Full Browser suite | 44 PASS /2 intentional SKIP (46 cases; duplicate Desktop-only tests omitted in Mobile) |
| Stability | Continuous Source Yaw edits retain Focus, Beam Axis/SVG nodes and 125% camera Zoom |
| Sensitivity | Analytic 80%/50% intervals; map inspection; invalid draft suppression; out-of-domain Gray cells; absolute Threshold; CSV; no Design mutation |
| History/JSON | Source Tilt and Coupling reproduce after Save/Load and Undo/Redo; P0 controls regressions retained |
| Responsive | Expanded Analysis at360/412/768/1366px; original viewport matrix320–1920px; no horizontal document overflow |
| Offline | Networking-disabled file:// calculation, expanded Scan, cell inspection and CSV; original HTML edit/JSON roundtrip regression |
| Provenance | Live result and scan fingerprints follow current inputs; CSV contains nominal fingerprint/settings/version/diagnostics |

Initial Browser failures exposed a responsive expanded-panel visibility issue, which was fixed and retested; a rounded benchmark literal in the Browser test was corrected from an inaccurate hand approximation to the independent analytical value. No failures are counted as passes. Local Browser is Headless Chromium153.0.8010.0 from a temporary scratch tool installation, not a project dependency. CI uses standard Playwright Chromium. Real Android/Chrome Soft Keyboard, iOS, Safari and Firefox remain unverified; this is not measured-device optical validation.

## Artifact and reproduction

[photonic-connector-studio-p1.2.html](../artifacts/photonic-connector-studio-p1.2.html) · [Source/Artifact Manifest](../artifacts/build-info-p1.2.json) · [SHA256](../artifacts/SHA256SUMS-p1.2.txt).

HTML SHA256: `72315eb8106c9ff5d461cc9548680827338e7ef447e250b1257a300bce1294a5`.
HTML bytes: 369971.
Source fingerprint: `a68ce680c630d2ff676140e59767818e0fa5bc10010ae7d6ecbbe083f7a8d091`.

The packaged HTML is byte-identical to tested dist/index.html. `npm run artifact` rebuilds current Source before packaging. Existing P0/P1.1 artifacts and manifests are unchanged. Source-file hashes include code, fonts, dependency lock/config and the packaging script. Documentation/artifact-only checkpoint commits do not change that Source fingerprint. PR #3 records the final full checkpoint SHA and latest CI conclusion.

Source Commit CI: **PASS**, [P1.2 validation #13](https://github.com/legendnever-collab/photonic-connector-studio/actions/runs/39953662870). Final checkpoint CI is also verified and recorded in PR #3.

Direct offline smoke of the delivered HTML itself: Source Tilt η=92.4465%, W CenterY=4µm, SlopeY=−3mrad; expanded map cell inspection works and zero runtime errors.

No hosted Preview. Download the HTML and open with a JavaScript-capable Browser. Local source: Node22.12+/24+, `npm ci && npm run dev` → http://127.0.0.1:5173. Mobile same-network access: `npm run dev -- --host 0.0.0.0` and the server's network address. File-manager HTML Preview apps may not execute JavaScript.

## Play Review

1. Choose **Source Tilt / Beam Axis**. Orange axis should pass through the Lens and arrive at W with centerY=4 µm and slopeY=−3 mrad. Edit Source Yaw/Pitch in Train → Edit and observe live changes without flicker.
2. Choose **WG Tilt / Angular Mismatch**. η should be36.7879%. Reset Matching should restore100%. Unsupported Roll or excessive Tilt should show a reason and suppress stale results.
3. Open Analysis → **Expand**. Choose Y/Yaw or Z/Pitch. Change Offset/Tilt range and η Threshold; compare curves, joint map and nominal-connected interval.
4. At Matching η≥80%, expect about±8.4279 µm and±8.4279 mrad. A narrow scan says Scan-end; invalid map samples are Gray; a nominal below Threshold has no nominal acceptance interval.
5. Export Sweep CSV; Save JSON → change Example → Open JSON, then Undo/Redo. Geometry, Tilt and coupling must remain consistent. On Mobile finish numeric edits via **편집 종료 · Layout**.

P1.2 completes this planned Beam Axis/Alignment checkpoint. It does not establish DeepO-wide feature/performance equivalence or industrial connector tolerances. Continue only after user Play Review.
