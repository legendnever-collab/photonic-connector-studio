# UI Design — P0

## Primary workspace
DeepO-inspired information architecture, with independent original implementation.

Desktop layout:
- Top navigation: File | Design | Analysis | Optimize (future) | Tolerance (future) | View
- Left sidebar: Optical Component Tree (+ Insert Component)
- Main upper canvas: interactive 2D X-Y / X-Z Optical Layout; Fiber Port left, WG Port right.
- Main lower panel: Component Data Editor with Position, Orientation, Parameter, Unit, and variable/locked flags.
- Right analysis panel or tab: Beam/Overlap/Insertion Loss with explicit 'not calculated' state in P0.

Mobile:
- Canvas first, large readable controls; tree/editor/analysis via tabs or drawers.
- Avoid dense form occupying first screen.

## Required P0 interactions
- Select Port or Component → edit typed properties → immediate stable re-render of layout.
- Add/remove/reorder non-port elements; two terminal Ports cannot be deleted.
- Zoom/pan and fit-to-system; geometry displayed to scale when requested.
- Save/Load versioned JSON with validation; example optical train loads without server.
- Clearly identify detachable mating plane (movable) and permanent/fixed region (configurable).

## P0 example (not a finalized connector)
Fiber Port (1310 nm SMF; MFD TBD) → Lens F (optional) → Air Gap → Mating Plane → Lens S (optional) → WG Port (Mode TBD).

## Visualization policy
- Optical axis +X; transverse coordinate shown with units and scale.
- Distinguish illustrative ray guides from computed rays/beam envelopes. Initial diagram is a schematic.
- Geometry edits must not remount whole canvas or flash.
- Never show a numerical IL/KPI before the corresponding validated physics exists.
- Technical terms English, descriptive text Korean.

## Later UI growth
Mode field profile viewer (amplitude+phase+polarization), beam waist and wavefront, optimization variable selection, parameter sweep, Monte Carlo histograms, tolerance ellipses, connector geometry and channel arrays.
