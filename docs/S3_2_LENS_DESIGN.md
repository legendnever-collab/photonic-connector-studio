# S3.2 — Bounded Lens reference design

Version 0.9.0-s3.2; branch feature/s3-2-lens-design, stacked on S3.1 PR #14
head 7c94cb6a075946396665df805b339d572cd26084. S2 #13 / S3.1 #14
remain unmerged. User authorized this next development checkpoint.

## User workflow

Design Setup → Design Lenses → Run Lens Design → inspect candidate → Apply.
The first example remains the original 10 mm Fiber–Lens–Fiber. A single-Lens
Project defaults to an explicit 2-Lens Relay preview; choose Existing Lenses to
retain one Lens. Nothing changes before Apply. Apply is one canonical Project
replacement / Undo; Surface, Gaussian, Report, SaveLoad and Building Blocks see
the same real S1 / glass / S2 geometry.

The optional new BK7 Output Lens has Clear Radius 0.5 mm, Body Radius 0.6 mm and
initial thickness 0.3 mm. Its material / apertures / outer radius are explicit
fixed assumptions, not catalog parts. Only the known starter/example titles are
updated to show two Lenses; custom Project names are preserved. Existing Lens
materials, apertures, Body radius, transverse frame and Port contracts stay fixed.

Added example: **S3.2 · Folded Lens design task**. It uses the original SMF
reference, a Lens and two fixed large-aperture Mirrors, with PIC Output displaced
by 2 mm in Z; geometric arclength is 12 mm. It is an explicit task, not a preset
optimized answer. The previous 60 µm Mirror example remains unchanged and may
have no aperture-feasible solution in this two-Lens domain.

PC-first dialog: independently scrolling settings / candidate list, fixed Preview
and Apply footer, Lens variables table, Beam Preview / Optical Layout, Output
section and before/after Surface data. Min=Max freezes a variable. Settings or
Project changes invalidate candidates. Cancel / Escape discards the search.

## Domain and fixed conditions

- Start from a finite chief route within configured geometric tolerances, space
  and part limits. Run S2 / edit the route first when it is not closed.
- One or two leaf physical Lens assemblies; each has two adjacent Sphere/Plane
  refracting surfaces, one valid finite Lens Body and air–glass–air indices.
  Glass n / linked BK7 dispersion are fixed. Higher-order/aspheric and array
  optimization are unsupported; existing non-Lens surfaces remain fixed.
- Source must have a defined homogeneous paraxial Gaussian waist / normalization.
  Both Ports are in air. Output needs an explicit MFD Y/Z Gaussian reference,
  waist-plane phase and homogeneous adapter. Imported fields are not Gaussian-fit.
  PIC MFD is a user reference, never a device field / efficiency model.
- Lens chief ray is centered and normal. Only longitudinal translation along its
  existing chief segment is varied; no decenter, tilt, roll, material, aperture or
  automatic Mirror/Prism re-routing. Normal Output incidence within 10 µrad is
  required. Position error is separately checked against the routing tolerance.
- Position bounds are geometric arclength from Input, not Global X. Each Lens
  remains between its neighboring fixed surfaces. Default cells share available
  gaps between adjacent movable Lenses; user bounds may extend within the actual
  fixed segment. Global translations are converted through each parent frame;
  original hierarchy / Surface IDs and transverse frames are retained.

Variables per Lens: front arclength s, S1 curvature, S2 curvature, center thickness.
Curvature is 1/R in SI; UI uses mm⁻¹. Zero is a Plane; |curvature|<1 m⁻¹ snaps to
Plane to respect the ±1 m radius schema. A Lens parent cannot contain a fixed
component. The final free-space segment needs ≥1 mm to add the relay Lens.

## Merit, search and acceptance

Engine `bounded-lens-reference/1.0.0`. It reuses S3.1's transported complex reduced
2×2 tensor Q, including transverse cross terms, and actual surface/ray/body gates.
Fast trials retain every before/after Surface but omit intermediate drawing
samples; the selected Preview recalculates the full envelope with identical
physics. A variable Lens outside the initial 2w/|R| or post-surface divergence gate
may be repaired by search; undefined Source fields / fixed unsupported optics
are never repaired by inventing a field.

Rotate Q into the Output reference's YZ coordinates. Let D=diag(sqrt(zR_Y),
sqrt(zR_Z)), Z=D⁻¹QD⁻¹, A=Re Z, B=Im Z>0. The dimensionless reference mismatch is

    score² = 1/2 tr[A B⁻¹ A + (B−I) B⁻¹ (B−I)].

It is zero only for the requested reduced Gaussian waist tensor. It avoids the
broad-beam minimum of an unweighted Euclidean Q distance. It is **not** reported
as efficiency, optical power, Mode Overlap or Total Coupling.

Size error uses the maximum principal radius-ratio error of the actual intensity
covariance whitened by the target MFD ellipse; it includes rotated/cross-axis
mismatch. Phase error is the spectral norm of the real inverse-Q matrix scaled
by target Rayleigh ranges: maximum quadratic phase magnitude in radians on the
target 1/e² ellipse. Global piston is irrelevant and omitted. Default goals are
5% size error and 0.05 rad reference phase error. Both must pass.

Deterministic starting points include the original Lens parameters and analytic
one/two thin-Lens guesses at bounded longitudinal samples. These guesses are
never retained without real S1/glass/S2 validation. The two best distinct starts
receive bounded, normalized Nelder–Mead reflection / expansion / contraction /
shrink passes. Intervals clamp normalized coordinates; frozen axes are omitted.
Budget is a maximum of 1–4096 distinct full evaluations; cached repeats and local
pass limits may stop below that count. Exhausted local coverage is distinct from
convergence; reaching the reference goals does not imply global optimality.

Aperture-limited Gaussian references may guide the search with a smooth tail
penalty, but are never retained or applied. Retained candidates require:

1. Strict Project schema / material indices / finite full-radius Lens body.
2. S3.1's divergence ≤0.1 rad, centered-normal curved refraction and 2w/|R|≤0.2.
3. Cumulative aperture/body tail upper bound ≤0.1% (not a transmitted-power claim).
4. Actual finite chief trace, configured position / direction / space / part limits.
5. S2's conservative component AABBs, Keep-out and unintended segment-crossing
   checks, including source/target Fiber shells. False-positive rejection is
   possible; this is not certified solid collision / nonsequential propagation.

Keep at most six distinct candidates. Clearly label Reference goals met versus
best tested reference / goals not met. No feasible candidate means none was found
in this bounded domain; it is not an impossibility proof. Closing/canceling never
writes. Apply checks the exact live baseline, rebuilds from candidate parameters,
verifies all frozen state and variable bounds, and reruns optical / clearance
checks. Displayed metrics are recalculated rather than trusted on Apply.

## Saved state and limits

Optional v1 `routing.lensSolution` records engine, baseline/design fingerprints,
trial count, reference score/goals and the explicit bounds. Old Projects receive
no defaults. The design fingerprint excludes its own provenance; any subsequent
edit marks the stored result changed. Saved metadata is never a feasibility
certificate. Full physical Lens geometry is canonical even without metadata.

This inherits S3.1's scalar/paraxial limitations: no clipping diffraction,
aberration propagation, Fresnel/coating/TIR phase, polarization or PIC receiving
field. Folded Mode Overlap / Transmission / Total Coupling stay uncalculated.
Straight applied designs use B1 and its conditional scalar overlap where valid;
otherwise the transported reference remains visible without Mode Overlap (e.g.
rolled transverse Port frames). Reference goals in this dialog never stand for
physical Coupler efficiency. Not a catalog-lens, full-field, tolerance or general
freeform optimization stage.

## Validation / references / stop

Independent tests cover the 10 mm physical two-Lens result, scalar closed-form
Gaussian mismatch, rotated elliptical references, actual fixed-Mirror PIC route,
strict SaveLoad / no baseline writes / frozen state, bounds, tamper/stale Apply,
part/space/aperture/source/model domains, hierarchical rigid transforms and fast
vs drawing sample parity. Packaged offline browser workflows cover all Preview
views, Apply/Undo/Redo/SaveLoad/Report, fixed folded geometry, stale settings,
limited/cancelled searches and 1366×768 / 1440×1000 laptop windows.

Gaussian ABCD references: docs/S3_1_FOLDED_GAUSSIAN.md.
Nelder & Mead (1965), A Simplex Method for Function Minimization,
The Computer Journal 7(4), 308–313: https://doi.org/10.1093/comjnl/7.4.308.
The merit is the explicitly derived Gaussian-Q diagnostic above, not a claim
that the cited optimizer guarantees convergence or global optimality.

Deliver standalone HTML and Draft PR stacked on S3.1, then stop for Play Review.
Do not merge existing PRs or automatically start full-field/tolerance work.
