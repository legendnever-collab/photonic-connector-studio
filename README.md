# Photonic Connector Studio

**Fiber-to-Waveguide Optical Design & Simulation Platform**

A planned engineering workstation for designing and evaluating detachable Fiber-to-Photonic Substrate Waveguide connectors.

## Core concept
- **Left Port:** Fiber source; initial editable example 1310 nm SMF.
- **Middle:** Editable Optical Train (free-space, lens, physical optical surfaces, mirror as validated stages are added).
- **Right Port:** Photonic Substrate Waveguide Edge Port / accepted guided mode.
- Waveguide model uses position/orientation/MFDx/MFDy and later imported complex E/H profile, not full routing.
- Material, connector architecture, lens configuration, optical/mechanical targets remain design variables.

## Development documents (read in this order)
1. [DEVELOPMENT_ROADMAP_V1.md](docs/DEVELOPMENT_ROADMAP_V1.md) — long-term engineering product roadmap P0–P6
2. [WORKFLOW_AND_MODEL_POLICY.md](docs/WORKFLOW_AND_MODEL_POLICY.md) — model selection, verification, checkpoint rules
3. [MASTER_PLAN.md](docs/MASTER_PLAN.md) — concise mission and interfaces
4. [PHYSICS_CONTRACT.md](docs/PHYSICS_CONTRACT.md) — coordinates, units, optical boundary and model validity
5. [UI_DESIGN.md](docs/UI_DESIGN.md) — DeepO-inspired workspace design
6. [CHECKPOINTS.md](docs/CHECKPOINTS.md) — checklists and stage gates
7. [P0_FIRST_IMPLEMENTATION_WORK_ORDER.md](docs/P0_FIRST_IMPLEMENTATION_WORK_ORDER.md) — next development instruction, **not yet executed**

## Current status
P0 **documentation baseline only** on `feature/p0-foundation`, Draft PR #1.
No runnable UI, physical optical solver, validated loss, release artifact, or build/test success should be inferred from these documents.

## Rules
Recovery-First · Physics-First · Source-First · Validation-First · Atomic Checkpoints.
No merge to main or auto-start of next milestone before user Play Review and explicit approval.
Use English for technical terminology and Korean for explanations.

## Licensing and confidential data
[DeepO](https://ai4optics.com/deepo/) is a UX/workflow reference only. Evaluate current public [DeepLens](https://github.com/vccimaging/DeepLens) revision and its dependency licenses before reusing code.
This repository is public; do not add confidential company/customer geometries, measurement data, or restricted source code.
