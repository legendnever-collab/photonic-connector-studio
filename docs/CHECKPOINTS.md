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
