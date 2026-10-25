# D2.1.1 — Report fold visibility and inherited synthesis limits

Version `0.11.1-d2.1.1`, based on D2.1 remote
`c5044e531248635f90baad1d7f620f8f0dae470f`. D2.2 physics/domain expansion is
outside this fix. Existing branches and PRs remain unmerged.

## Reproduction

User screenshots show a `Fiber → BK7 Lens → Fiber · S2 Mirror + TIR Prism`
Report and Automatic Synthesis with 96 geometry trials, 387 optical trials,
zero candidates. The source Project JSON was not supplied. The following
public application workflow reproduces those exact counters:

1. Open the Fiber/BK7 Lens/Fiber starter; move Output to (10,0,5) mm, +X.
2. Find Routing Solutions, select and apply Mirror + TIR Prism.
3. Use the existing D1 `defaultProblem`: maxParts=8, maxGenerated=2.
4. Run Automatic Synthesis with its default families/manufacturing bounds.

The retained Lens/Mirror/Prism train fails the Gaussian aperture/body and
local-curvature validity gates. Replacement recipes containing two Lenses
and two folds are excluded by maxGenerated=2. Previously this structural
exclusion was silent. The geometry coverage cap produces budget-exhausted
even with substantial optical budget remaining. Increasing optical budget
alone cannot admit a structure forbidden by the component limit.

With explicit total/new limits of four, preserving Ports, Mode, wavelength,
space, Keep-out, locks, and the same optical budget, the reproduced routed
starter yields a nominally Mode-qualified real two-Lens/two-Mirror train.
This is conditional normalized Gaussian Mode overlap, not delivered power,
device coupling, combined-error robustness, or a manufacturing certification.

## Physical route and display

The reproduced first fold is a 44 µm-diameter, 5 µm-backing planar Mirror
after the Lens, near X=6.27796 mm/Z=0. The second fold is the Prism TIR face
at Z=5 mm. All air segments follow the preceding outgoing direction and
both turns obey the vector reflection law at a finite optical Surface.
Two directional folds are required for this parallel displaced route;
Mirror+Prism and two Mirrors can provide them. Two Prisms are not the only
physical way to supply the turns. A two-Prism search family is not added here.

The generated tiny Mirror was almost invisible next to the 2.4 mm Lens in
the overview, and Mirror regions were excluded from Detail Insets. The
geometric route reaches only 3 of 13 sampled rays; this is not a finished
Mode-matched optical solution. The Report now makes these limitations visible.

## Changes

- Report `report-figure/2.4.2` derives fold annotations and direction arrows
  from the independent traced center reference ray. F1/F2 annotations identify
  actual Mirror/TIR hit points, with a collapsible world-coordinate/direction
  ledger. Annotation symbols do not enlarge the physical body or Beam.
- Finite Mirrors participate in true-geometry Detail Insets, including width,
  clear aperture and backing dimensions. All paged regions remain available.
- Routing Preview and applied-route Report explicitly label geometry-only
  scope, sampled-ray reach and unestablished Mode matching.
- Design Setup distinguishes Find Routing Solutions from Automatic Synthesis
  and provides a direct Lens/Mode synthesis entry point.
- Synthesis shows inherited total/new/per-kind limits, records structurally
  excluded Lens/fold recipes, and opens rejection details for zero candidates.
- An explicit `Allow 2 Lens + 2 Mirror search` draft-setting action raises only
  insufficient component caps and enables mirror2. Constraints are not silently
  relaxed. Preview remains read-only; Apply remains one Undo.

## Validation

Model regressions reproduce the exact 96/387/0 failure, verify the explicit
four-component repair, independently check straight segments/reflection laws,
and verify the tiny Mirror detail region without modifying the Project.
Offline desktop and mobile browser regressions run the reported Route→Report→
inherited-limit failure→explicit repair→qualified candidate→Apply→Undo workflow.
Full model/browser outcomes and final standalone artifact identity are recorded
in the fix PR and `artifacts/build-info-u1.json`.
