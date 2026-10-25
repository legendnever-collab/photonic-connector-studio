# S2 — Bounded Port-to-Port route search

Version 0.7.0-s2. User authorized S2 after merging F1.1 / S0-S1 PRs #11/#12.
Main baseline `c246bb6e00242ba189a23edb3451db59dbc505f5`, tree
`1f97d2496aee2a182c2962e945e532dc70fde35c`.
Branch `feature/s2-route-search`. PC first; stop with a Draft PR and playable HTML.
Do not automatically merge or start S3.

## Workflow

1. Design Setup → Routing Example → **S2 · Displaced PIC routing task**.
2. **Find Solutions… → Run Search**. Existing fixed Lens shapes/poses and both
   Port conditions remain unchanged. Only the trailing Mirror / Prism section is
   replaced, and only after **Apply Candidate**. Preview does not write the Project.
3. Compare retained candidates, their Global component poses, geometric path length,
   position/incidence errors, reference OPL and sampled diagnostic rays. **Focus
   Candidate Folds** exposes micro-scale routing with equal XZ coordinate scale.
4. Apply one candidate. Common Surface / Gaussian / Report views consume the same
   prescription. One Undo restores the full baseline; Redo, SaveLoad and SVG report
   export retain actual surfaces, body dimensions and provenance.

Settings collapse during/after a search so the candidate choices stay visible on a PC.
Search can be cancelled or the dialog closed without committing any optical change.
Options changed after a run mark candidates stale; Apply is disabled until rerun.
The core also checks the exact serialized baseline and reruns geometry/clearance at
Apply. It independently verifies that fixed Source, target Surface and ancestry,
Lens surfaces/bodies/frames, Modes, Port contracts and Fiber bodies are unchanged.

## Supported domain

- One channel; air Input / Output references (n=1); no arrays.
- A leading sequence of existing physical Lens blocks, each with a defined valid
  finite Lens Body, followed by zero or more Mirror / Prism blocks and the final
  planar Output probe. A design with Lens after a fold is explicitly unsupported.
- Fixed Lens geometry is not optimized. Their exact evaluator, material dispersion,
  frames and finite-aperture trace are reused. Trace a center reference ray through
  that prefix to obtain the free-space start position P and direction a.
- Final Output world origin Q and desired incoming direction b come from the
  canonical last probe and its parent hierarchy. No second Port Pose is stored.
- Supported generated topologies: Direct, one Mirror, two Mirrors, one right-angle
  BK7 TIR Prism, Mirror followed by a BK7 TIR Prism. Existing Lens count and configured
  maximum Mirror/Prism counts are respected. This is a finite template set, not
  arbitrary optical topology discovery.
- Mode profile remains a Port definition. Geometry does not establish Mode Matching,
  receiving PIC Field, coating/Fresnel/absorption throughput or Total Coupling.

## Search and optical construction

Engine `bounded-port-routing/1.0.0`, with the existing
`surface-sequential-3d/3.0.0` validation kernel. No external AI / network calls.

**One Mirror:** solve closest forward incoming / backward outgoing axes. With
w=Q−P and c=a·b, t=(w·a−c w·b)/(1−c²), u=(w·b−c w·a)/(1−c²).
Positive distances seed the axis intersection; extra bounded incoming-axis samples
cover near-parallel and tolerance cases. Mirror at A=P+ta directs toward Q.
The actual final direction is checked against b, not assumed from a line sketch.

**Two Mirrors:** A=P+ta, B=Q−ub, middle direction m=(B−A)/|B−A|.
Projection seeds u=(Q−A)·b cover parallel displaced axes. A seven-by-seven grid of
bounded forward/backward distances covers additional skew configurations. For
promising valid seeds, at most two local refinement levels evaluate four neighbors
in t/u. Analytical reflection closure keeps endpoints exact while placements vary;
this is not a general gradient optimizer or a proof of global optimality.

Mirror front normal is normalize(outgoing−incoming), so it faces the incoming ray
and the defined backing lies behind that optical front. Bends below 20° are excluded
(incidence above 80° from the normal). Finite optical radius and mechanical disc
diameter 2.2×Clear Radius are used, not infinite planes or invisible mirror points.

**Prism:** normal Entry/Exit directions are orthogonal. A right-angle BK7 block is
placed around their TIR intersection C. Let h=Leg/2. Entry E=C−ha; TIR C;
Exit F=C+hb. In local coordinates: Entry (0,0), TIR (h,0) at Yaw −45°,
Exit (h,h) at Yaw +90°. Common extrusion axis = a×b. All named BK7 media track the
Project wavelength through the existing material model; every candidate must meet
the actual TIR condition. Clear Radius must not exceed Leg/4; Depth=2.4×Clear Radius.

**Mirror + Prism:** sample A on the incoming axis, then set
C=Q−[(Q−A)·b]b and c=(C−A)/|C−A|, so c is perpendicular to b. A Mirror directs
a to c and the Prism turns c to b. Positive distances must leave room for Entry/Exit.

Every proposed prescription is validated by the existing finite Surface/body trace,
Port position/incidence tolerances, component limits, Design Space and the additional
clearance screen. A final plane from the wrong side remains an incidence mismatch.
No raw construction equation substitutes for traced acceptance.

## Bounded parameters and ranking

Optional `routing.search` stores version=1, allowed templates, trial budget 1..256,
Clear Radius, Prism Leg, Mirror Backing, Clearance and ranking. Defaults: all five
topologies, 128 trials, 20 µm Clear Radius, 80 µm Prism Leg, 5 µm backing, 1 µm
clearance and fewest parts first. Unit entry is µm; JSON remains SI.

Use the explicit global Design Space if defined. Otherwise use an ephemeral box
around P and Q, padding each global axis by max(0.25|Q−P|, 2×Prism Leg,
4×Clear Radius), clipped to the supported ±1 m coordinates. Fixed Lens dimensions
are not constrained by that implicit box; generated bodies are. Positive ray/box
intervals bound the sampling distances. Implicit bounds do not alter the Project.

Retain at most eight validated candidates, preserving the best representative of
each feasible topology before filling remaining places with ranked alternatives.
Rank lexicographically by new part count then geometric path length, or vice versa;
defined generated-body volume breaks ties. OPL is reported separately. No Mode
Overlap or sampled-ray fraction is used as a coupling objective. Diagnostic bundle
reach is calculated for the selected preview and may differ between candidates.

Outcomes are separate: completed with candidates; completed with no candidate found
in the tested templates/bounds; budget exhausted with partial evaluated coverage;
unsupported setup; cancelled. Failure to find a candidate is never called physical
impossibility. Cancellation discards session candidates, without modifying the Project.

The generator evaluates one bounded placement per cooperative asynchronous turn,
allowing UI cancellation between evaluations in the offline HTML. No long external
solve, multithreading dependency or Worker asset is needed for this bounded stage.

## Clearance scope

`src/routing/clearance.ts` performs conservative broad-phase screening:

- Exact circular-cylinder AABBs for rotated Mirror discs and Fiber shells, including
  backing / visible length. These do not rely on sampled ring extrema.
- Fixed Lens envelopes include radial interval Sag bounds over the full Outer Radius,
  so unsampled interior extrema are enclosed. Prism bounds use its exact finite
  triangular extrusion vertices.
- Reject potential component AABB overlap within the configured gap, including
  fixed components and fixed Fiber shells. Keep-out boxes include body envelopes
  and every reference-ray segment, so a route cannot bypass an obstacle check by
  keeping its optical vertices outside it.
- Screen unintended segment/body crossings against nonparticipating body AABBs.
  Bodies at the intentional segment start/end are excluded from this broad phase;
  their optical hits still use the finite-body gate. Internal Lens/Prism propagation
  remains the explicit sequential optical model.

False-positive clearance rejections are possible. AABB screening is not certified
solid collision / mechanical manufacturability or a general non-sequential trace.
Mesh/render quality does not determine Surface normals or candidate ray results.

## State and provenance

No defaults are inserted into old schemaVersion=1 JSON. `routing.search` is committed
only with Apply. Optional `routing.solution` records engine, topology, baseline
fingerprint, applied-design fingerprint and evaluated count. Its design fingerprint
excludes the provenance object itself and uses canonical schema ordering. A later
design edit marks that provenance changed; it is never reused as a validity proof.

Candidate projects are cloned through the strict schema, so Preview and any candidate
mutation cannot alias the live baseline. Generated signed-zero angles are normalized
for exact JSON round trips. Existing Surface/Assembly IDs and target ancestry are
preserved; new route IDs are collision-checked. Alignment ancestry is retained as a
saved unapplied reference, even when its previous optical route faces are replaced.

## Verification and Play Review

25 new model tests cover constructive and traced closure, independent path/OPL,
arbitrary 3D Port orientations, rigid-transform covariance of a one-Mirror solution,
reflection/backing orientation, Prism dispersion, fixed Lens/Port/Mode/parent identity,
old/new SaveLoad, provenance, stale/tampered Apply, alignment references, free-space
Keep-out, body/part limits, unsupported cases, budget, deterministic ranking, cancellation
and synchronous/asynchronous parity. Seven offline desktop browser workflows cover
Preview without write, Apply/Undo/Redo, SaveLoad/Report/physics boundaries, stale options,
budget/no-candidate/domain states, close/cancel, and laptop comparison-window dimensions.

Review the displaced PIC task: baseline diagnostic rays are blocked. Run Search,
compare two-Mirror and Mirror+Prism candidates, inspect their Global Pose, then Apply.
The center-reference position/incidence errors should meet the unchanged tolerances.
Undo must restore the original task with exactly the same Port and Lens values.

Stop for user review. S3 will address supported Beam / Mode matching and Lens design;
S4 Field / Coupling and tolerance work remain separate checkpoints.
