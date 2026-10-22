# Photonic Connector Studio

**Fiber-to-Waveguide Optical Design & Simulation Platform**

A planned engineering Workstation for the analysis, design and optimization of detachable fiber connectors for Photonic Substrates.

## Basic concept
- **Left Port:** Fiber (source), with 1310 nm SMF as an initial editable example
- **Middle:** Editable optical train (Gap, Lens, Mirror and other elements as implemented)
- **Right Port:** Waveguide edge optical port (target guided mode)
- Optical port boundary data include position, orientation, MFDx/MFDy or imported complex mode profile.
- Waveguide material, lens selection, detachable connector architecture and target performance remain design variables, not predetermined conclusions.

## P0 plans
- [Master Plan](docs/MASTER_PLAN.md)
- [Physics Contract](docs/PHYSICS_CONTRACT.md)
- [UI Design](docs/UI_DESIGN.md)
- [Checkpoints](docs/CHECKPOINTS.md)

This branch currently contains the **P0 documentation baseline**. The runnable UI, simulator, and build/test artifacts are not yet implemented. Do not infer validated coupling performance from concept diagrams.

## Development policy
Recovery-first · Source-first · Physics-first · Validation-first · Incremental checkpoints.

Develop on `feature/p0-foundation`; use a Draft PR for review. **Never merge to main or advance to P1 without explicit user approval.**

## Inspiration and licensing
[DeepO](https://ai4optics.com/deepo/) is a UX/workflow reference only; it is not a source for copying proprietary implementation or branding. Evaluate [DeepLens](https://github.com/vccimaging/DeepLens) separately, including exact code and dependency licenses, before any reuse.

## Language
Use English technical terminology and Korean descriptions.
