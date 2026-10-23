# Photonic Connector Studio — Master Plan

Status: P0 documentation/design baseline (2026-10-23)
Repository: https://github.com/legendnever-collab/photonic-connector-studio
Working branch: `feature/p0-foundation`; Draft PR #1

> **Authoritative roadmap:** [DEVELOPMENT_ROADMAP_V1.md](DEVELOPMENT_ROADMAP_V1.md). This summary links to the full P0–P6 stage plan; development has NOT begun.

## Mission
Fiber-to-Waveguide Optical Coupling 및 Detachable Fiber Connector를 설계·비교·최적화하는 독립 Engineering Workstation을 개발한다. DeepO는 UX/Workflow 참고 대상이며 Proprietary software, branding, backend는 복제하지 않는다. 궁극적인 Connector 구조는 도구를 개발한 이후 시뮬레이션/실험으로 결정한다.

## Core Optical boundary
- Left Port: Fiber source optical field (initial example: 1310 nm SMF).
- Right Port: Photonic Substrate Waveguide accepted guided mode at Edge port.
- Between Ports: editable Optical Train of Gap/Lens/Surface/Mirror (each by validated milestone).
- User-editable optical reference planes: Fiber plane, Mating plane, Waveguide plane.
- WG substrate represented only by Optical Port Boundary data: position/orientation, MFDx/MFDy or later 2D complex mode field, polarization/reference plane.
- Material, MFD, actual mode, coupling type, lens number, mating precision, Target IL remain TBD/design variables.
- Horizontal +X is a default reference geometry, not a final connector product architecture.

## Planned UX
DeepO-style left Component Tree, central XY/XZ Optical Layout with mode/beam analysis tabs, lower Component Data Table/Property Editor, and analysis/optimization/tolerance workspaces. Full synchronization of design state, stable redraw, versioned JSON Save/Load and Undo/Redo.

## Technical stack
- P0–P1: React + TypeScript + Vite, browser-local design state, pure Physics modules.
- P2: independent Geometrical Optics solver for physical lenses/apertures.
- P3: Wave propagation and Complex Mode overlap with rigorous normalization/convergence.
- P4: parameter optimization.
- P5: detachable mechanical alignment / Monte Carlo tolerance.
- P6: multi-channel arrays, measurement calibration.
- Python/DeepLens/backend only if a checkpoint-specific technical assessment justifies them.

## Governance
Recovery-First · Physics-Contract-First · Source-First · Incremental Tests · User Play Review.
No automatic merge to main or next checkpoint. No fabricated simulation KPIs.
Public repo must not contain company confidential/customer specification data.

## Primary docs
- [Full Roadmap](DEVELOPMENT_ROADMAP_V1.md)
- [Work and Model Policy](WORKFLOW_AND_MODEL_POLICY.md)
- [First P0 Implementation Work Order](P0_FIRST_IMPLEMENTATION_WORK_ORDER.md)
- [Physics Contract](PHYSICS_CONTRACT.md)
- [UI Design](UI_DESIGN.md)
- [Checkpoints](CHECKPOINTS.md)

## Next action
Execute P0 implementation ONLY after explicitly starting the first development work order; current checkpoint is documentation only.
