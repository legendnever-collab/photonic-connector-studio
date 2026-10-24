# Unified Optical Workstation and Freeform Engineering Plan

Date: 2026-10-24 KST
Baseline: P2.3 `aac2c908ef6368978bfce820b15d7bf6478e43f9`, Draft PR #7.

## 2026-10-24 · Mode-Port authoring revision

P2.4 was merged to main in `1b4e8f9b483d8c7b3e625839e05247e75d61a9d9`.
The user's additional requirements establish **Input Mode → Optical Train → Output Reference Mode /
Alignment** as the primary workflow. Project, Component Catalog and Example Projects must be clearly
separated in an Explorer. Component-first insertion and Surface-first editing operate on the same
prescription, with Layout and Surface Data shown together and optional Dock/Float windows.

See [Mode-Port authoring review and work order](F1_1_MODE_PORT_AUTHORING_WORK_ORDER.md) for the
binding revision, official references, physics validity boundaries and acceptance tests. Immediate
order becomes **U1 Mode-Port Authoring → F1.1 Conic/Aspheric → B1 Physical Mode Bridge**, followed by
Freeform / imports / aberration / field-overlap checkpoints. Previously listed future targets remain
in scope. This is a design revision; it does not claim these features are already implemented.

## Confirmed user requirements

One engineering application, one Project and one fixed set of menus. Gaussian / Surface / Report
are representations of that Project. Switching representation never loads an example, moves a
component, converts an optical model, changes the active physics, loses selection, replaces history
or repositions the Properties/Analysis panels. Editing is allowed in each representation; the
lightweight layout is the usual design surface. Report is not a separate document or a read-only
modal. Numerical entry remains available while looking at the report.

All requested target capabilities are retained in scope:

| Area | Required capabilities |
|---|---|
| Surface definition | Radius / Conic / Aspheric coefficients; asymmetric XY Polynomial; editable Control Points; external CAD / Surface data |
| Geometry | Lens Decenter / Tilt; folded Mirror / Prism paths; independently oriented Fiber / Target; Lens / Prism channel arrays |
| Results | Actual body geometry / rays; Beam size and Waist along the path; Target Spot and aberrations; Target Mode Coupling Efficiency |

Selecting all of these is an end-to-end product requirement. It does not establish that existing
Gaussian ABCD propagation already solves arbitrary freeform or off-axis systems. The final integrated
milestone is accepted only when all four result categories have independent numerical evidence in
their declared validity domain. Intermediate UI checkpoints must not be called that final milestone.

## Authority and interfaces

- One canonical Project stores optical Surfaces, source/target definitions, explicit frames,
  component identity, mechanical bodies and model classes. File import/export never serializes two
  independently editable copies of the same surface. Internal distances are m; rotations rad.
- Every Surface evaluator supplies `sag(u,v)`, gradient/normal, domain and error bounds. Ray
  intersection, mechanical tessellation, report tessellation and wave transfer consume this same
  evaluator. Tessellation quality changes display sampling, never the optical surface definition.
- Control Points must define a documented interpolant with boundary behavior, not merely deform a
  report mesh. Coefficients record basis, powers, reference radius and units. Editing/importing a new
  representation must show any fit residual and require an explicit conversion when it is lossy.
- External CAD geometry is not automatically an optical prescription. Units, global/local frame,
  selected optical faces, sequence, media and aperture must be assigned. First import checkpoint:
  explicit Surface JSON and CSV Grid Sag with units, sample spacing, missing-data and bounds checks.
  STEP/IGES/NURBS CAD extraction is a later adapter with a selected kernel, license, approximation
  tolerance and round-trip tests. STL/OBJ display meshes alone cannot supply optical normals or a
  trustworthy coupling calculation. No proprietary file compatibility is implied.
- A Block references its actual Surface IDs and Assembly frame. Insertion is one undoable operation.
  Existing parts/ports retain their exact frames. Surface sequence is explicit; a fold does not
  reorder the system by world X. Arrays carry channel identity and parent transforms.
- A View owns its camera, labels and display quality. All Views use the common selection, model,
  examples, Properties, Analysis, input validation, history and file commands. A View switch does
  not choose a solver. A solver result carries input hash, reference plane/frame, assumptions,
  algorithm/version, units and validity/failure reason.

## Checkpoint sequence

| Checkpoint | Concrete work | Required evidence |
|---|---|---|
| P2.4 Unified Workstation | Fixed shell, central Gaussian/Surface/Report switch, inline editable report, common examples, one Add palette with world-coordinate entry, exact shape/position/history round trips | Add Prism from each View; edit dimensions and pose; compare common JSON/export; Undo/Redo; preserve selection/cameras; mobile/offline; existing physics regression |
| F1 Surface kernel | Conic + even asphere + XY Polynomial evaluators, derivatives, bounded intersection and the same sampled actual shape in Layout/Report | Plane/sphere limits; independently differentiated normals; analytic special cases; root residuals; no missed/false roots; aperture/domain and ray/tessellation convergence |
| F2 Control Points / import | Grid/B-spline representation, interactive local control edits, Surface JSON/CSV Grid Sag import; explicit CAD adapter contract | Interpolation basis tests, C1/normal continuity as applicable, round trips, rigid transforms, units and fit-error evidence; same rays and reports before/after equivalent import |
| B1 Folded local beam | Chief/reference ray with local transverse frames; paraxial perturbation matrices around a valid path; astigmatic Gaussian transport through refractive/reflective surfaces | Straight ABCD parity; planar fold/rigid-rotation invariance; decenter/tilt and oblique-interface independent references; non-paraxial/aberrated invalidity gates |
| A1 Spot / aberration | Channel-separated centroid/RMS, pupil/field sampling, reference wavefront and OPD conventions, aberration plots | Sampling convergence, analytic zero-aberration cases, known defocus/astigmatism cases, block/refract/TIR termination, channel identity |
| W1 Physical field / coupling | Complex field propagation to a specified Target plane, finite-aperture effects and normalized complex overlap with Gaussian or imported Target Mode | Power/window/grid convergence, known free-space/focus benchmarks, phase/curvature/misalignment overlap, reference-frame invariance, scalar/vector/polarization boundary |
| I1 Integrated engineering release | Each supported Surface input workflow and off-axis/array workflow feeds Layout, Report and the four required result categories | Full reproducible golden projects, independent result references, offline performance, project migrations, imports and exports, user engineering review |

B1 is a local paraxial approximation, not a general freeform diffraction solution. Gaussian mode
labels may remain useful as source/target definitions even when the propagated field is non-Gaussian.
W1 must distinguish overlap efficiency from transmitted power and total insertion efficiency; a
reached-ray fraction or geometric Spot size never substitutes for mode overlap.

## Computational behavior

Keep geometry/ray/beam/field and report caches separate. Camera, theme and labels do not retrace or
rerun propagation. During heavy solves, use a cancellable worker and show the result input hash;
previous results must be visibly stale until replaced. Drag previews may lower display mesh density
only. Target field solves are an explicit analysis action at first; routine position/shape editing
must remain interactive. Coarse/standard/converged quality requires stated grid and error checks.

Implementation cadence: one recovery baseline, one small validated checkpoint, one playable artifact.
No independent model/agent change is required for UI iteration. Difficult wave/beam numerical audits
warrant a focused independent review when available; reference results and reproducible tests remain
the acceptance criteria. Stop after P2.4 for Play Review. Do not merge main or automatically claim
F1/W1 complete.

## P2.4 boundaries

Existing ideal Gaussian projects retain their exact ideal solver and semantics. Physical projects
can add Physical Lens / Mirror / Prism / MLA / Probe from **any** of the three Views, using the same
world-coordinate dialog and Properties. A Gaussian View of a physical project is currently a shared
geometric layout with Gaussian propagation/coupling explicitly unavailable. Adding physical optics
into an ideal-only project still requires an explicit future mixed-model migration; no curvature or
thickness is invented from focal length. This remains a declared product gap for I1.

## Primary engineering references checked for the plan

These establish architectural boundaries, not validation of our implementation:
- Ansys, Freeform optics in OpticStudio: https://optics.ansys.com/hc/en-us/articles/42661754261651-Freeform-optics-in-OpticStudio
- Ansys, How to use the Grid Sag surface type: https://optics.ansys.com/hc/en-us/articles/43071134642323-How-to-use-the-Grid-Sag-surface-type
- Ansys, Gaussian Beam modeling, Part 3 / Physical Optics Propagation: https://optics.ansys.com/hc/en-us/articles/42661948624019-How-to-model-laser-beam-propagation-in-OpticStudio-Part-3-Using-Physical-Optics-Propagation-to-model-Gaussian-beams
- COMSOL, Gaussian Beam Theory: https://doc.comsol.com/6.3/doc/com.comsol.help.roptics/roptics_ug_optics.6.62.html
