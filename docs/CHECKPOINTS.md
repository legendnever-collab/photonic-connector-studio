# Development Checkpoints

## P0 — Foundation and Workspace
- Branch: feature/p0-foundation; Draft PR for user review.
- Documentation: MASTER_PLAN, PHYSICS_CONTRACT, UI_DESIGN, CHECKPOINTS.
- Build: React+TypeScript+Vite; typed domain objects and reusable state.
- UI: Fiber Port left, editable optical elements, WG Port right; schematic 2D layout, component tree, data editor.
- Persistence: versioned local JSON import/export.
- Validation: typecheck, build, component interaction tests and no flicker regression.
- Deliverable: playable browser/offline HTML or unambiguous run instructions, with limitations.
- Stop: do not merge P0 or proceed to P1 automatically.

## P1 — Gaussian Coupling Engine
- Gaussian q/ABCD and ideal Thin Lens / free-space.
- Beam waist and wavefront plots, analytic scalar Gaussian mode overlap.
- Nominal lateral/axial/angular sensitivity for clearly limited assumptions.
- Unit/reference-plane tests and independent analytic benchmarks.
- No fabricated physical lens surface effects or vector mode claims.

## P2 — Physical Optics
- Actual lens surface/ray tracing, apertures, aberration and wavefront.
- Wave propagation and field overlap with imported 2D complex target mode.
- Convergence/error budget and cross-model comparison.

## P3 — Optimization & Tolerance
- Design-variable bounds, objective function, deterministic sweeps/optimizer.
- Mating plane Δx, Δy, Δz and rotations; expected loss distribution.
- Document random variables/correlations; nominal vs robust performance.

## P4 — Detachable & Arrays
- Plug/socket rigid-body alignment + per-channel fabrication offsets.
- Multi-channel coupling statistics and remating data calibration.
- Report measurement versus simulation without overstating qualification.

## Release policy
Recovery-first; source-first; validation-first; incremental commit checkpoints. User Play Review before merges. Do not auto-advance.
