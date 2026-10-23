# Checkpoint Definitions — P0–P6

**Authoritative detail:** [Development Roadmap v1.0](DEVELOPMENT_ROADMAP_V1.md)
**Development policy:** [Work & Model Policy](WORKFLOW_AND_MODEL_POLICY.md)

| Milestone | Name | First deliverable | Pass/Stop gate |
|---|---|---|---|
| P0 | Optical Workspace Foundation | 2D editor, Fiber/WG Ports, Component Tree, properties, JSON save/load | UI, schema, build, interaction and no-flicker verified |
| P1 | Gaussian Optics | ABCD, Beam waist/curvature, Gaussian Overlap | Independent analytical benchmark, energy/normalization bounds |
| P2 | Geometrical Optics | Physical lenses, surfaces, ray tracing, aperture | Snell/paraxial and ray sampling benchmarks; never equate Ray Spot with coupling |
| P3 | Physical Optics | Diffraction/complex field propagation and imported WG mode | Power/grid convergence, complex overlap and reference plane verification |
| P4 | Optimization | Bounds, sweep, objective and optimizer | Recover known optimum, constraint checks and reproducibility |
| P5 | Detachable Tolerance | Mating plane 6DoF, rigid-body error and Monte Carlo | Zero-error and transform checks, seeded yield reports |
| P6 | Multi-channel & Measurement | Arrays, channel metrics, measurement compare | Common/per-channel error tests and simulation/measurement separation |

## P0 concrete execution
- Existing branch: `feature/p0-foundation` / existing Draft PR #1.
- First implementation instructions: [P0 Work Order](P0_FIRST_IMPLEMENTATION_WORK_ORDER.md).
- Build React + TypeScript + Vite, typed state, 2D XY/XZ layout, Component Tree, properties, examples, JSON persistence, Undo/Redo.
- Validate no flicker/remount on repeated edits and explicitly show "Not calculated" for unimplemented optical results.
- Deliver browser preview / tested offline artifact with exact run instructions and limitations.
- Do not merge or begin P1 without user Play Review/approval.

## Release protocol
Recovery → Scope lock → Implement → Test → Build → Playable artifact → PR checkpoint → User review → explicit merge/advance decision.
No force push, lost work or automated advancement.


## 2026-10-23 · P1.3 Visual Workstation

User-authorized P1.1/P1.2 merges complete; main e505652b219ee97d33c0f4916fa8c8f50feb4235. New visual branch feature/p1-3-visual-workstation: three actual theme options, persistent KPI ribbon, full-height Inspect/Analyze, contrast and offline/regression evidence. See P1_3_IMPLEMENTATION_REPORT.md. P2 remains next; not started.


## 2026-10-23 · P2.1 Surface-first Workbench

User authorized Surface-first design with optional derived 3D. Canonical Surface/nested Assembly frames, physical sequential rays, Mirror/Prism/lenslet examples, Surface Editor and shared 2D/3D with SVG export implemented. 143 Unit/Numerical/Font + 64 Browser PASS, 2 existing intentional Mobile skips. See P2_1_SURFACE_CONTRACT.md and P2_1_IMPLEMENTATION_REPORT.md. Branch feature/p2-1-surface-workbench / Draft PR #5, stacked on unmerged PR #4. No main merge or next checkpoint auto-start.


## 2026-10-24 · P2.2 Report Figure

User requested a report button with a style closer to the earlier B/C concepts. A separate derived technical illustration now adds glass caps/rims, metal shading, illustrative envelopes and shadows, sampled ray-bundle silhouettes, labels, linked geometric footprint and offline SVG/PNG export. Design model and Gaussian/surface physics are unchanged. See P2_2_REPORT_FIGURE.md. Stacked feature/p2-2-report-figure; no main merge.
