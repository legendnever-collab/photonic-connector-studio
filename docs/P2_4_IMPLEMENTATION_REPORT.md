# P2.4 — Unified Optical Workstation

Date: 2026-10-24 KST. Base: P2.3 `aac2c908ef6368978bfce820b15d7bf6478e43f9` / PR #7.
Branch: `feature/p2-4-unified-workstation`.

## Result

The previous separate Gaussian / physical-Gaussian / Surface application shells have been replaced
with one Workstation. Open/Save, Undo/Redo, Add, Example, component tree and Properties/Analysis stay
in place. Gaussian / Surface / Report buttons change the center representation only. All existing
ideal Gaussian and physical Surface examples remain available in one common Example menu. Choosing
an example is an explicit design-replacement operation with Undo; switching a View never does so.

Report is an inline, editable view, with the same Properties inspector and insertion palette. A
report face can be selected for inspection. Its B/C scene, camera, labels and exports are retained.
There is no second modal workspace. Per-view cameras and report display controls survive switching;
current numeric editing, common selection and Project document are shared. Invalid numeric drafts
suppress results. Keyboard Undo/Redo and mobile keyboard-visible exit remain available.

The Add palette accepts Global XYZ [mm] and rotation [degrees], using internal m/rad. Physical Lens,
Fold Mirror, TIR Prism, MLA and Probe use explicit synthetic template geometry, with editable bodies
and local/assembly frames. Insertion keeps existing ports/components fixed, remaps all IDs and inserts
the complete optical sequence after the selected block and before Target as one history operation.
A missed Target or medium/path mismatch is reported by the existing tracer; it is not silently fixed.
A Probe uses the outgoing medium and an aperture covering the previous lenslet array footprint.
The coordinates can subsequently be edited numerically in any View, including Report.

Ideal projects retain exact Focal Length, aperture and ideal Gaussian model. Ideal Lens / Gap /
Reference Plane insertion uses the same palette; the original ideal model remains authoritative.
The Gaussian editor layout, beam overlay, metrics, sensitivity, scientific plots and numerical
benchmarks have been reused. `src/physics.ts`, `src/sensitivity.ts`, Surface schemas, Snell/reflection
tracer and common Project schema are unchanged. Dead separate physical-Gaussian shell removed.

## Validation

- TypeScript and production build: PASS.
- Unit / Numerical / Font: **172 PASS** (164 baseline + 8 insertion cases).
- Full Browser regression: **92 PASS / 2 existing intentional Mobile SKIP**. Existing interaction
  assertions are migrated to the unified controls. New checks exercise Prism insertion from each
  representation, exact common JSON across all Views, dimensions and frames, SVG metadata,
  target invariance, common Undo/Redo/import, fixed shell element identity, camera/selection, and
  offline 320–1920px layouts. Desktop and Chromium Mobile emulation are exercised.
- Existing independent Gaussian overlap/phase quadrature, surface numerical tests and regression
  assertions retained. Appearance key text tested at >=4.5 contrast across three themes.
- Actual Android hardware keyboard behavior, Safari/Firefox and proprietary optical software
  comparisons have not been verified in this checkpoint.

## Scope / product gaps

This is a UI / insertion checkpoint; it is not completion of the user's entire engineering target.
Freeform / Conic / Aspheric / XY Polynomial / Control Point surfaces, CAD import, physical folded
Gaussian propagation, physical-mode overlap and aberration analysis remain subsequent checkpoints.
Physical projects can be edited in Gaussian View but propagation/coupling says `Not calculated`.
Mixing physical blocks into an ideal-only Project still requires an explicit mixed-model migration:
P2.4 does not invent lens curvature/thickness or change the ideal solver. Review the complete target
matrix and acceptance sequence in UNIFIED_WORKSTATION_AND_FREEFORM_PLAN.md.

## Play Review

1. Load Physical Lens, keep Gaussian View; note the shared ray geometry and explicit Gaussian gate.
2. Switch Report → Add → TIR Prism, input Global XYZ / angles, Insert at Position.
3. In Properties, edit Assembly pose and Prism Depth; inspect Surface and Gaussian. The parts retain
   identical world poses and actual body dimensions. Target stays fixed.
4. Save JSON, Undo/Redo the insertion and dimensions, reopen JSON; inspect the same report/export.
5. Load Source Tilt / Beam Axis, edit Focal Length or Source Tilt, switch Views; verify the same
   Gaussian results, selection and retained Gaussian/report zoom.
6. Repeat on a narrow browser. Use Layout / Surfaces / Inspect / Analysis in the bottom navigation;
   these navigation locations are identical for every representation.

The complete engineering target requires later numerical checkpoints; see the full plan. Main is
not merged. Deliver playable HTML and Draft PR, stop for Play Review.
