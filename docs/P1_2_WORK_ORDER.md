# P1.2 — Beam Axis & Alignment Sensitivity Work Order

Date: 2026-10-23 (Asia/Seoul). User authorized immediate implementation after scope discussion.
Base: P1.1 `286c1386e9bc5091b475833e978676755d12d885`; PR #2 remains Draft.
Branch: `feature/p1-2-alignment`; use stacked Draft PR base `feature/p1-gaussian-optics` while P1.1 remains unmerged. No main merge / P2 start.

## Scope and checkpoints

1. Extend Physics Contract before implementation: common +X reference planes, small-angle Port slopes, q/centroid propagation, field phasor and coupled Offset/Tilt overlap. Preserve P1.1 aligned results and JSON v1.
2. Implement pure TypeScript centroid propagation through free space / centered Ideal Thin Lens, Source/WG Pitch/Yaw support under declared small-angle bounds, independent analytical and complex-field quadrature benchmarks.
3. Show computed Beam Axis + Envelope + Target on XY/XZ with consistent declared transverse magnification; preserve SVG/Focus/Camera during edits. Show W centroid, incident/target angle and relative mismatch.
4. Provide deterministic user-controlled WG Y/Z Offset and WG Yaw/Pitch Sensitivity curves and a joint Offset–Tilt map. Hold other inputs fixed, sweep delta from current nominal Design, do not mutate saved Design. Display absolute η threshold and nominal-connected passing interval with crossing / scan-limit / invalid-domain labels. No auto Optimization or manufacturing tolerance certification.
5. Preserve Mobile editing exit, History, Save/Load, P0/P1.1 artifacts. Verify desktop/mobile, unsupported cases, stale handling, networking-disabled offline HTML. Refresh embedded Korean font coverage.
6. Deliver P1.2 HTML, source/artifact SHA256 manifest, physics/implementation reports and Recovery Note; atomic commits, GitHub CI and Draft PR. Stop at Play Review.

## Required model boundary

Air n=1, monochromatic scalar co-polarized separable elliptical Gaussian. Source and accepted WG waist at their common +X planes; Port orientation enters as a phase ramp under first-order paraxial approximation. q uses axial X distance, no exact rotated-plane projection/path-length correction. Port Roll, Lens rotation/decenter, physical Lens/aperture losses, vector polarization and nonsequential paths remain unsupported. Preserve P1.1 clipping warnings and geometry/order checks; include centroid displacement in aperture proximity warning.

## Acceptance

- Zero Tilt reproduces aligned P1.1 benchmarks. Source angular input moves centroid through distance d and centered lens refracts its axis by −height/f.
- Equal flat modes: η=exp[−(δr/w)²−(πwδθ/λ)²]; unequal size and curved wavefront cases compare against independently sampled complex fields, including both signs and convergence.
- Sensitivity η/threshold intervals match analytic cases; scan limits and out-of-domain points are not fabricated as zero coupling or infinite acceptance. Baseline and fingerprints update after edits/Undo/Load; sweeps never alter Design.
- Play Review: Source Tilt moves Beam Axis, WG Tilt/Offset changes η, curve/map respond coherently, threshold bounds are correctly scoped, JSON/history/offline behavior remains consistent.
