# B1.0 — Gaussian bridge for the same physical Surface prescription

Version 0.4.0-b1. Authorized by the user's instruction to proceed after reviewing
Gaussian / Surface behavior. Desktop first; PR #10 remains Draft for Play Review.
This checkpoint implements the straight coaxial scalar/paraxial subset. It does
not begin F1.1 Aspheric, imported-field F2, general folded-field propagation, or
mixed Ideal / Physical migration.

## Behavior

The startup remains two SMF reference Fibers with facets 10 mm apart, and one
1 mm BK7 Lens composed of S1 and S2. Surface View displays the finite geometry
and independent geometric rays. Gaussian View now displays an actual 1/e² beam
envelope calculated from those same Surface IDs, radii, thickness, wavelength,
indices and compiled frames. It no longer falls back to the same Ray drawing.
The BK7 material continues to resolve at the Project wavelength.

Beam Propagation shows X–Y / X–Z envelopes and medium spans. Its transverse and
axial axes have explicit, different units. Output Field shows the incident and
reference unit-integral marginal intensity on the same Output coordinates and
same intensity scale, plus relative unwrapped phase. Reference Mode / Full
Incident Beam windows are display choices, not solver inputs. Phase has an
arbitrary common piston; the display does not claim absolute optical phase,
EM field amplitude, or a sampled full-wave solution. The analytic complex field
can be reconstructed at any Output coordinate by `normalizedIncidentField`.

Output diameter 2w, wavefront radius R, conditional normalized mode overlap,
waist radius, extrapolated waist position, offset and slope mismatch are visible.
A waist position is the homogeneous continuation of the local q after the last
interface, and may be virtual or outside that segment. It is not a claim that
an intervening physical surface can be ignored.

The default is a concrete starting prescription, not an optimized relay. At
1310 nm it yields Output diameter about 928.21 µm, R about 89.948 mm and scalar
mode overlap about 0.039288%. A nonzero Ray reached count is unrelated to this
value. No delivered-power efficiency is inferred.

## Authoritative inputs and result contract

No Project schema migration is required. No surfaces, equivalent focal lengths,
Port poses, MFDs or wavelengths are copied into another saved model. The physical
solver consumes the existing Surface Project and explicit Port contracts.
The legacy Ideal Gaussian solver stays separate and unchanged.

Required Input: analytic Gaussian, two positive MFDs (X maps to local Y, Y to
local Z), waist/flat phase at the Port plane, explicit homogeneous-paraxial
adapter, medium and normalization. Absolute-power intent also requires a saved
positive power, but this solver reports only the normalized scalar shape.
It does not turn a unit-power reference into measured launch power.

A valid propagation result is separate from an optional overlap result. Missing
Output MFD/phase/normalization, a different Output medium, or incompatible TE/TM
labels withholds overlap while retaining a valid incident beam. An unspecified
polarization explicitly gives a conditional co-polarized scalar result. Imported
or confined fields are never substituted by a fitted Gaussian.

The ledger separates Transmission, Mode Overlap and Total Coupling. Only Mode
Overlap can be calculated here. Fresnel, coatings, absorption, clipping
propagation and vector polarization coupling are not modeled, so Transmission
and Total Coupling remain Not calculated.

Field fingerprints include relevant optical geometry, modes and contracts.
The independent Ray bundle's radius, sample count, diagnostic medium and channel
grid do not define the Gaussian field. One analytic field starts at the Input
Port frame regardless of the diagnostic grid. Mechanical Fiber shells, saved
Alignment Draft, Theme, Dock/Float, view and plot scale do not change the field.
Alignment remains explicitly `applied=false`; use real Port/Assembly poses for
small offset/tilt studies. A failed propagation returns no samples or overlap;
unapplied invalid numeric drafts suppress displayed old results.

## Equations and frames

All distances and wavelengths are SI internally. Let λ be the vacuum wavelength,
n the segment index and Q=q/n the reduced complex beam parameter. At a declared
waist, Q=iπw₀²/λ. The same determinant-one matrix transports each transverse
pair [h, nθ] and Q by the Möbius law Q′=(AQ+B)/(CQ+D):

- Translation of physical length d in index n: [1, d/n; 0, 1].
- Spherical refraction: [1, 0; −(n₂−n₁)/R, 1].
- Planar refraction: identity in reduced coordinates; physical q changes with n.

Radius w²=λ|Q|²/(π Im Q); physical curvature 1/R=Re Q/(n|Q|²);
physical Rayleigh range=n Im Q. This preserves beam width at an interface.
The analytic incident amplitude has unit ∫|E|²dYdZ, a Gaussian amplitude envelope,
and phase −(2π/λ)n[(Y−hY)²/(2RY)+(Z−hZ)²/(2RZ)+relative slopes·displacement].
The target tilt is removed from both fields as a common phase gauge. Overlap
is the squared normalized complex-field inner product. The existing independently
benchmarked axis overlap kernel includes curvature / offset / tilt cross terms;
it receives n/R and n·relative-slope with vacuum λ. Finite log overlap and loss
are retained when exp(log η) underflows.

Compilation resolves the existing parent hierarchy. The first refracting frame
(or Input frame for an empty train) defines common local axes. Surfaces stay in
row order, checked against local +X, never sorted by World X. Common rigid
translation/rotation is invariant. Source and Output transverse offsets and
small phase-ramp tilts are supported; O(tilt²) plane/projection changes are not.

Primary teaching references for the matrix convention and Gaussian ABCD law:
MIT OCW 6.974, Franz X. Kärtner (2006), sections 2.5 and 2.6:

- https://ocw.mit.edu/courses/6-974-fundamentals-of-photonics-quantum-electronics-spring-2006/cf57a5a4b9a8e2919408daa82557e18f_ray_optical_sys.pdf
- https://ocw.mit.edu/courses/6-974-fundamentals-of-photonics-quantum-electronics-spring-2006/e9852c138493233bc2813f683da5b199_gaussian_bem_res.pdf

These establish the model equations, not our software correctness or numerical
validity thresholds. Those are checked independently below.

## Explicit eligibility limits

- Centered coaxial sphere/plane refraction, homogeneous segments, planar probes.
  No mirrors, TIR, lenslet arrays, tilted/decentered optical surfaces, or cross-axis
  Port rotation. All intermediate surfaces share transverse axes.
- Input/Output Port tilt and propagated axis slope norm ≤50 mrad; intrinsic
  homogeneous Gaussian waist divergence ≤0.1 rad in each segment/reference.
- Positive forward local ordering, continuous defined n and valid finite bodies.
- Conservative aperture tail bound per refracting surface:
  exp[−2((clear radius−axis offset)/max(wY,wZ))²]. Bounds are accumulated over
  the train; a sum >0.1% withholds propagation. This is an eligibility budget,
  not a transmission estimate or a hard finite-support Gaussian assumption.
- At a sphere, (axis offset+2 max(wY,wZ))/|R| ≤0.2 is a conservative engineering
  gate. It does not certify zero aberration. Output probe aperture is a reference
  marker and is not silently interpreted as an absorbing cladding stop.

Unsupported designs show the reason in Gaussian View without copied Surface
rays or stale η. Surface and Report remain available for geometric diagnostics.
Report does not gain an unvalidated physical-field overlay in this checkpoint.

## Validation and review

- TypeScript and production single-HTML build pass.
- 219 model/physics/schema/font tests pass, including 20 new bridge cases.
- Independent ordinary [height, angle] thick-lens matrix multiplication,
  plane-slab d/n and interface continuity, global rigid-transform/hierarchy
  invariance, independent offset/slope refraction and air/non-air defocus cases.
- 640×640 direct complex-field quadrature verifies unit normalization and
  curvature/offset/tilt overlap against the analytic result within 1e−10.
- Scope failures return no stale fields; target-only failures retain propagation;
  diagnostic settings and Fiber shells are independent; legacy JSON is unchanged.
- Four packaged file:// Desktop browser workflows pass with the network offline:
  distinct shared-project views, Output intensity/phase, MFD/radius/thickness
  edits, invalid drafts, clipping, missing target, Undo, Save/Load, Dock/Float,
  Theme and 1366×768 / 1440×1000 visibility.
- This run did not repeat the earlier full Desktop/Mobile browser suite. The
  managed preview daemon could not resolve the existing dependency symlink;
  standalone HTML browser verification ran directly without that service.

Run `npm run build`, `npm test`, then
`npm run test:e2e -- --config=playwright.offline.config.ts` for this packaged
checkpoint. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` can select an installed browser.
The offline filename remains `photonic-connector-studio-u1.html` to preserve the
existing review file. Version, exact source commit and SHA256 live in
`artifacts/build-info-u1.json` and `artifacts/SHA256SUMS-u1.txt`.

Review: open Gaussian → Beam Propagation / Output Field; edit S1 Radius and
Thickness; compare Surface; inspect Analysis; Undo and Save/Load. Then decide
whether to proceed to a separately scoped Aspheric / broader Field checkpoint.
