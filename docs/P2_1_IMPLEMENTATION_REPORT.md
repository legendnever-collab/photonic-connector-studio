# P2.1 — Surface-first Sequential Workbench

## Result

사용자 승인 방식인 Surface-first 설계 → 계산 Ray → 필요 시 3D Inspection / Report View를 첫 Playable Checkpoint에 적용했다. 기존 P1 Gaussian Workspace는 그대로 보존하고 **Surface Workbench** 버튼으로 전환한다. 두 Workspace는 상태를 유지하며 서로 다른 모델/JSON을 혼합하지 않는다. `#surfaces`로 직접 열 수도 있다.

- **Canonical Surface / Assembly model**: SI units, local +X Normal / u=+Y / v=+Z, Rz·Ry·Rx, nested Assembly transforms and user-defined origin/Pivot. World X may reverse or fold; no monotonic-X restriction.
- **Physical sequence**: plane/sphere vertex-cap intersections, vector Snell, ideal reflection, explicit TIR with outsideIndex, finite circular aperture, incident-medium validation, actual segment-length OPL, repeated lenslets. Same compiled Surface geometry and Ray points feed all Views.
- **Surface Editor**: ordered Surface table, inline signed Radius/Clear Radius, Shape/Interaction/n, Local position/orientation, common Assembly pose, Source direction/sampling/channel pattern. Add/remove/reorder Surface, add Assembly, transactional JSON import/export, bounded Undo/Redo.
- **Views**: equal-scale XY/XZ/YZ, optional orbitable 3D projection, selected Surface Normal, fitted geometry, zoom, light Shaded optical-surface preview. Edits do not remount the Canvas or reset the camera. Export SVG resolves style tokens and embeds solver/input/view/camera metadata.
- **Analysis**: reached/blocked sampled rays, explicit termination causes, target local-u/v Centroid and RMS, selected Surface accepted-hit Footprint and OPL. Source samples have equal weights; counts are not transmission power, efficiency or mode coupling. Input fingerprint is FNV32 for identity assistance, not a cryptographic signature.
- **Mobile**: Layout / Surfaces / Inspect / Analysis; keyboard-visible editing exit; responsive table scroll, offline font, no required service or browser storage.

## Scope boundaries

This is a verified geometrical-optics checkpoint, not full P2 completion or Zemax/CODE V feature/file parity. The Presentation option currently shades optical patches and lens rims; it is an engineering **Surface Preview**, not a complete watertight mechanical CAD/photorealistic B+C render. Prism is a prescribed entrance/TIR/exit Surface sequence with circular clear apertures, not a general solid-body non-sequential tracer. Unspecified edges/walls cannot block rays. No physical Gaussian/complex-field propagation through this new train is claimed.

Current: supplied constant refractive index at recorded vacuum wavelength. No automatic glass dispersion, full aspheres, Fresnel/coating/polarization power, ray splitting, arbitrary CAD, stray-light search, diffraction, thermal/6DoF statistics or measured Mode import. Lenslet selection uses the nearest cell at the local vertex plane; the actual cap/aperture is then intersected. Neighboring-cell searches and multi-bounce/reordered paths require later Non-sequential work. Array examples validate geometry; P6 crosstalk/yield remains unimplemented.

Refraction hitting TIR unexpectedly terminates rather than silently changing the prescribed route. Explicit TIR failing its critical-angle test terminates. Missed/behind/parallel/clip/medium mismatches are visible causes. Uncommitted invalid numeric drafts suppress current rays/KPIs until correction or Enter/Blur restore.

## Verification

- TypeScript and production single-file build PASS.
- **143 Unit / Numerical / Font tests PASS** = preserved 119 + 24 Surface tests.
- **64 Browser tests PASS / 2 existing intentional Mobile SKIP** = preserved 48 + 16 Surface cases; final remote CI is linked in PR #5.
- Independent tests: Snell angles 0/10/30/60/80°, reversibility, critical-angle sides, outside-index TIR, mirror double-angle response, slab displacement and ΣnL, sphere cap selection/clipping, thick-lens paraxial BFL and convergence, all five example paths, rigid-transform covariance, nested Assembly Pivot, 9 stable lenslet channels, schema rejection and JSON parity, local target centroid/RMS and aperture area sampling.
- Synthetic bi-convex reference: n=1.5, R1=+5mm/R2=−5mm, t=1mm; thick-lens BFL≈4.827586mm from rear vertex. Decreasing ray height converges to independently calculated paraxial BFL.
- Examples: Physical Lens / Fold Mirror / TIR Prism: 13/13 reached. 3×3 Microlens Array and MLA+Prism+Mirror: 45/45 reached. These are chosen synthetic geometries, not commercial component performance.
- Browser cases: all examples, continuous Surface edits with focus/SVG/node/camera persistence, invalid drafts, clipping/TIR causes, group Pivot vs local prescription invariance, save/load/undo/redo, rejected import preserving Design, 3D orbit/shading/SVG export, independent Gaussian session, offline 320/360/412/768/1366/1600 widths, mobile reduced visual viewport exit, table edits/add/remove/Assembly creation.
- Physical kernel, schema and UI are independently versioned from existing Gaussian physics. `src/physics.ts` / `src/sensitivity.ts` and P0/P1 artifacts unchanged. Current Korean-font test now scans nested source files.

## References / independent implementation

- Surface sequences, Interfaces/Gaps and hierarchy: https://ray-optics.readthedocs.io/en/stable/api/rayoptics.seq.sequential.html and https://ray-optics.readthedocs.io/en/stable/models/ . No ray-optics source is imported.
- Reflection/refraction/TIR: MIT OCW 2.71, Lecture 2, https://ocw.mit.edu/courses/2-71-optics-spring-2009/cf9bdaeff470532f4eee57629c4ca781_MIT2_71S09_lec02.pdf . Vector implementation independently checked with angle formulas.
- Mixed-mode design context: https://optics.ansys.com/hc/en-us/articles/42661747249043-How-to-model-a-mixed-sequential-non-sequential-system . Mixed/non-sequential is a future capability, not implemented here.

## Review and recovery

Branch: `feature/p2-1-surface-workbench`. [Draft PR #5](https://github.com/legendnever-collab/photonic-connector-studio/pull/5), **stacked on PR #4** (`feature/p1-3-visual-workstation`, base 4c1883adcdb171b77a644ffc5a6a2d5cd0706e30). No main merge authorized/performed. Initial kernel was separately checkpointed after 23 initial tests; an execution-environment disconnect occurred before UI creation, then environment and files recovered without reset/redevelopment. Final reports supersede the temporary in-progress PR text.

Open `artifacts/photonic-connector-studio-p2.1.html`, choose Surface Workbench, or append #surfaces. Select Fold Mirror → M1 → Local Yaw, TIR Prism → P-TIR → Outside Index, and compound → Module → Assembly Roll. Check Source Tilt, Target Centroid, 3D and Export SVG. Save Surface JSON separately. Prior Gaussian η remains available in its own Workspace.

Source identity and artifact SHA-256: `artifacts/build-info-p2.1.json` and `SHA256SUMS-p2.1.txt`. Reproduce with npm ci → typecheck/test/build → Playwright browsers → test:e2e → artifact. This environment used a temporary existing Chromium path without new dependencies.

Stop after this Play Review. Proposed next P2 checkpoint: physical asphere/catalog prescription and fuller assembly geometry/report rendering, followed by scoped ray-wave interfaces; do not auto-start P2.2/P3 or claim arbitrary complex-path support.
