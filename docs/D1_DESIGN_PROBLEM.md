# D1 · Current-Project Design Problem · v0.10.0-d1

User decisions: four authored Surfaces are an initial prescription; type/count
may change. User specifies component count and allowed volume. Alignment and
assembly tolerance robustness is the primary preference, subject to meeting
nominal Mode requirements. This checkpoint starts the direct design workflow,
without adding any Example Projects or claiming universal optical synthesis.

## User workflow

Top bar Design Problem, or Surface Data → Design Problem… . The same canonical
Project supplies the Ports, surfaces, assemblies, bodies, materials and modes.
Problem tab sets total optical component and new/replacement ID limits, per-kind
part limits, routing position/angle tolerances, Design Space and Keep-out boxes.
Surface Variables sets full-Surface locks and Lens parameter intervals. Tolerances
sets boundary stresses and an observed scalar overlap threshold. Saving settings
is one Undo; opening/editing a draft and Preview never write the Project.

Assess Current Design screens the authored prescription without optimization.
Run Candidate Search selects one of two existing validated search adapters:
- Lens: one/two Sphere/Plane physical Lenses; optional second BK7 Lens. Front
  arclength, front/rear curvature (zero may become Plane), and thickness bounds.
- Route: fixed Lens prefix, replacement trailing Mirror/Prism section; Direct,
  1/2 Mirror, normal-entry/exit BK7 TIR Prism and Mirror+Prism proposals.

These actions run separately, not as a joint topology+shape optimizer. Lens
material, aperture, transverse pose and other components remain fixed. A full
Surface lock conservatively freezes its paired Lens and its Assembly/ancestors.
For individual values use Min=Max. Exact no-op Lens parameters preserve source
local frame numbers, avoiding roundoff changes to fixed rows. Routing candidates
that delete or alter locked rows are rejected. New component IDs count toward
new/replacement limits even if an old suffix is removed. Ports are excluded from
part counts and are immutable nominal search boundary conditions.

## Tolerance contract

Deterministic one-at-a-time (OAT) ±boundary samples, with no random distribution.
Input and Output Port translations use world XYZ and angles world-frame Euler
roll/pitch/yaw. Component translations use world XYZ converted to parent local
coordinates; component angles use Assembly local Euler. Only leaf optical
assemblies are stressed, so a parent group is not perturbed twice. Nominal fixed
rows can still receive manufacturing perturbations during assessment; those
perturbations never enter the candidate prescription.

Default assumed bounds: each Port position [0.5,1,1] µm, roll/pitch/yaw
[0,0.2,0.2] mrad; each component world position [0.5,0,0] µm, angles zero. These
are editable assumptions, not measured manufacturing statistics. Default case
cap 128, maximum 256. Requested vs tested vs field-assessed coverage is explicit.
Zero nonzero tolerances is not assessed. Capped / unsupported coverage is partial.

Geometric closure / volume / parts and conservative body / segment AABB checks
are separate from optical performance. Nominal reference goals use existing
complex-Q size/phase comparison; 5% size and 0.05 rad defaults when no Lens
settings exist. Conditional scalar normalized Gaussian Mode overlap is computed
only by the existing B1 solver in its validated straight coaxial/paraxial domain.
No Fresnel / absorption / delivered power or actual PIC receiving-field response.
Folded or unsupported decenter/tilt/asphere fields are explicitly unassessed,
never assigned a fictitious zero or passing score.

Candidates are ranked among the retained nominal search pool: nominal+fully
assessed OAT goals, nominal goal satisfaction, field coverage, then lowest
observed conditional scalar overlap and Q merit. A qualified candidate requires
nominal geometry + size/phase goals, complete declared OAT coverage, every
geometric stress check passing, and all observed overlaps above the threshold.
Lowest observed overlap includes nominal. It is not a global joint-error worst
case, statistical Yield, or globally robust optimum. No sample distribution or
combined-error performance claim is produced. No continuous robustness merit is
fed back into the current nominal optimizer in D1.

## State / Apply

Optional strict v1 Project.designProblem stores settings; old JSON gets no
new defaults. Project.routing remains authoritative for spatial / part / route
constraints; the modal draft is saved there atomically with Problem settings.
Result previews are transient. Report SVG metadata includes saved Problem data.
Apply checks original Project signature, working settings/routing signature,
engine options, frozen rows/ancestors, generated/total counts, route and
clearance; the underlying engine reconstructs and revalidates candidate physics.
One shared replace gives one Undo and all Gaussian/Surface/Report views update.
Cancellation, Escape, close and settings/Project changes discard or stale results.

## Validation and next scope

Model tests cover strict settings / old JSON / roundtrip, real matched four-
Surface overlap vs boundary stresses, zero/capped coverage, folded PIC and Lens
angle domains, exact frozen frames, Apply/stale/tampered bounds, part/space/lock
limits, cancellation and read-only assessment. Packaged browser tests cover
current Project entry, draft/save/Undo/Load, candidate Apply, shared views,
manual displaced Ports, partial fields, cancellation and PC window sizes.

Broader synthesis (arbitrary Lens removal/addition, interleaved folds, arbitrary
face type/count, Microlens arrays, Parabolic / XY Freeform) and combined-error
robust optimization require subsequent geometry/field and search work. Preserve
this distinction in UI and reports. Deliver standalone HTML and Draft PR stacked
on Report #16; stop for user review, do not merge or auto-start the next stage.
