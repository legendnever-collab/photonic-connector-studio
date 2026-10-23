# Photonic Connector Studio — Development Roadmap v1.0

**Date:** 2026-10-23
**Status:** Proposed engineering roadmap; documentation checkpoint, not a claim of implemented features
**Repository:** https://github.com/legendnever-collab/photonic-connector-studio
**Development branch:** feature/p0-foundation
**Existing Draft PR:** #1
**Roadmap authority:** This document defines milestone meanings P0–P6; earlier P0–P4 descriptions in conversation are superseded by this seven-stage split. Nothing advances without the user's explicit checkpoint approval.

## 1. Mission and non-goals
Build an engineering workstation for designing, simulating, comparing, optimizing and validating Fiber-to-Waveguide Optical Coupling and detachable fiber connector assemblies. The platform **enables design exploration**; it does not pre-select a connector architecture in conversation.
- Left: Fiber source Port; Right: Photonic Substrate Waveguide target Port; propagation +X in the first horizontal example.
- Editable Optical Train: surfaces/lenses, gaps, later mirror/prism, coordinate transforms, reference planes, mating boundary and mechanical datums.
- Waveguide is an **Optical Port Boundary Model**, not a complete Photonic Substrate PIC/routing solver. Input position, local orientation, wavelength, accepted mode (Gaussian MFDx/MFDy or imported complex field), polarization, facet/reference-plane metadata when needed.
- Initial example: 1310-nm SMF; all other parameters may remain TBD until chosen for an example. Example assumptions are distinct from measured values.
- Not goals for P0–P1: full Zemax replacement, generic nonsequential CAD, automatic industrial qualification, AI agents, GPU infrastructure, real connector structure choice.

## 2. Product workflow (DeepO-inspired, independent)
1. New/Open design or load an example.
2. Define Fiber Source and Waveguide Target Port.
3. Insert/select/reorder Optical components in the train.
4. Edit Position, Orientation, Surface/Gap/Material and constraints; view geometry and unit-labelled axes.
5. Run eligible solver and inspect Beam/Ray/Field plots with model validity labels.
6. Compute normalized Mode overlap and explicitly scoped Insertion Loss; inspect assumptions.
7. Perform Sweep/Optimization with selectable variables and bounds.
8. Evaluate tolerance using mating-plane rigid-body offsets, distributions/correlations and repeatability.
9. Compare versions; export model, plots, traceable results and eventual measurement comparisons.

DeepO reference UX: resizable Shell/Sidebar, optical Layout, tabbed Analysis, editable Lens Data Table, variable toggles, Optimization and Monte Carlo. DeepO imaging-specific merit (RMS Spot, MTF, geometric PSF) is **not** a substitute for guided-mode coupling.
Official: https://www.ai4optics.com/deepo/manual/interface/tour/ and https://www.ai4optics.com/deepo/manual/

## 3. Architecture
- UI: React + TypeScript + Vite, responsive canvas-first mobile layout.
- Interaction: typed immutable Design State and command history (Undo/Redo); editor and layout both modify the same model, without full canvas remount.
- Domain: `DesignDocument`, `Port`, `OpticalComponent`, `OpticalTrain`, `ReferencePlane`, `LocalFrame`, `Medium`, `SolverSettings`, `ResultProvenance`.
- Geometry: canonical SI units internally; explicit display unit conversion. Right-handed global XYZ and local frames. 2D XY/XZ are projections of one 3D geometry.
- Physics: solver-neutral I/O interfaces; pure and testable reference functions. TypeScript for basic optics; evaluate Python NumPy/SciPy and optional DeepLens adaptor only when justified.
- Analysis: decoupled compute/visualization; status Unavailable / Preview / Calculating / Valid / Out-of-domain / Failed / Stale with last-computed model metadata.
- Data: versioned JSON with schema validation and migrations, deterministic seeds for stochastic computations, import/export without required cloud account.
- Boundary: external Lens/Optical Train and incident field → target Waveguide port mode overlap. Facet reflection is a separately identified contribution.
- Model categories: Gaussian paraxial, Geometrical Ray, Scalar Wave, Vector Mode, Mechanical Tolerance; **never silently combine incompatible validity domains**.

## 4. Roadmap and exit gates
### P0 — Foundation / Optical Workspace
Deliver React/Vite app, 2D XY/XZ schematic, Fiber/WG Ports, editable tree/table, add/reorder/enable/disable elements, fixed port endpoints, reference plane/mating plane, Save/Load JSON, Undo/Redo (basic), sample; explicit no-calculation KPIs.
Verification: typecheck+build; unit/coordinate JSON tests; interaction/E2E; stable no-flicker editing; browser preview and offline artifact or documented constraint. **No numeric coupling claims.**

### P1 — Gaussian Optics / First Real Simulation
Paraxial Gaussian q propagation, free space, ideal thin lens, ABCD and normalized Gaussian target overlap; waist position, radius and curvature vs X; basic offset and tilt sensitivity under stated approximations. Real parameter editing drives plots and scoped computed coupling.
Verification: z_R, q transform, identity, physical limits 0<=eta<=1, equal-mode eta=1, lateral analytic reference, independent numeric benchmarks and units; save/reload parity.

### P2 — Geometrical Optics / Physical Lenses
Ray-surface intersections, spherical/aspherical interfaces, refractive indices with wavelength, Snell reflection/refraction, physical aperture, clipping, sampling and paraxial limiting case; add mirror/prism where valid. Import lens prescription JSON or CSV when schema defined.
Verification: analytic plano/spherical paraxial focus, Snell law, conserved rays/energy accounting at model level, aperture convergence and geometry regression. Ray Spot or RMS is NOT Waveguide coupling.

### P3 — Physical Optics / Actual Mode Coupling
Transfer physical lens exit-pupil amplitude+phase to scalar propagation (FFT angular spectrum/Fresnel where valid); phase-curvature, diffraction/aperture and sampled field; target waveguide mode as normalized Gaussian or imported complex field (later vector E/H overlap). Link Ray and Wave models through explicit pupil/OPD interfaces; never substitute geometric PSF for wave optics.
Verification: free-space Gaussian to analytic result, convergence/grid and power conservation, overlap normalization, polarization/model assumptions, imported mode coordinate/phase/reference-plane validation, comparison to independent references.

### P4 — Design Optimization
Parameter sweeps, parameter bounds, constraints, multi-objective or weighted objectives explicitly separated: nominal coupling, footprint, robust tolerance, reflection if modeled. Deterministic optimizer first, gradient methods only when stable; save seeds and full solver provenance.
Verification: recover known Gaussian matching optimum, constraint feasibility, repeatability, distinguish global vs local optima, no optimization outside verified solver validity.

### P5 — Detachable Connector Mechanics / Tolerancing
Mating plane with fixed and removable parts, datum transforms, 6DoF (dx,dy,dz,tip,tilt,roll) and lens mounting error; common rigid-body vs local optical-component errors, assembly and remating vs thermal drift; sensitivity and Monte Carlo with distributions/covariance.
Verification: 0-error baseline, rigid-transform tests, single-error analytical limits, deterministic seeds, yield confidence intervals, no claim Monte Carlo maximum is guaranteed worst case, traceable report.

### P6 — Multi-channel / Measurement & Engineering Validation
Fiber/WG arrays, pitch, channel mapping and fanout, common vs per-channel errors, clipping/crosstalk as modeled, measurement import, simulation calibration and round-trip repeatability reports.
Verification: per-channel power budget, scaling and reproducibility, test data/condition metadata, simulated-vs-measured separation, qualification checklist (not automatic qualification claim).

## 5. Development process / stops
- Milestone work uses its own small checkpoint(s), PR and independent playable artifact. **P0 remains existing Draft PR #1.**
- Prior to work: inspect remote branch/PR, source, tests, local changes; preserve data; never force push unless separately authorized.
- For each checkpoint: implement minimal slice → unit tests → integration/E2E → build → visual review → artifact/commit/PR → user Play Review → only then approval/merge.
- No auto-advance or auto-merge. A failed test blocks release, not silent replacement.
- Keep optical terminology in English and explanatory prose in Korean.
- Tool code must avoid unpublished DeepO features; inspect DeepLens current revision LICENSE, dependencies and working public APIs before proposing code reuse.
- Repository currently public. No proprietary company/customer designs, measurements or confidential geometry without an approved environment.

## 6. Key technical design reviews
- DR-01: Source and target local coordinate conventions and reference-plane placement.
- DR-02: Compatible ABCD convention (ray vector, optical q, media interfaces); update physics contract before P1.
- DR-03: Differentiating Ray tracing output from complex-field mode coupling.
- DR-04: Multi-solver parity, numerical convergence, error/out-of-domain labeling.
- DR-05: Mechanics data provenance and correlation modeling.
- DR-06: Python backend/DeepLens adoption as opt-in, not a P0 prerequisite.

## 7. Definition of successful product
A designer can assemble a Fiber-to-Waveguide Optical Train, edit it visually, compute physically justified coupling, optimize over declared variables, predict manufacturing/connector sensitivity with explicit assumptions, compare scenarios and validate against measurements.

**Next step:** Complete P0 first-implementation work order only. No P1 or merge until user approval.
