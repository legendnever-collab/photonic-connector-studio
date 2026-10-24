# F1.1 — Conic / Even Aspheric Surface checkpoint

Version 0.5.0-f1.1. Baseline: merged B1 PR #10, main
`a154dd359fa4946583e61e97cd6f7165ba1e86cf`.
The user authorized the next development checkpoint after that merge.
PC workflow first; retain the 10 mm Fiber–BK7 Lens–Fiber startup and SMF templates.
No automatic main merge or later Field / Freeform feature starts.

## Authoring and state

Choose **Even Asphere** for an existing Surface, then edit Conic K and A4/A6/A8
in Surface Data or Properties. Both editors change the same Surface ID and
canonical prescription. Properties adds a radial Sag plot, reference K=0 / A=0
curve and edge slope. Radius, Clear Radius, medium and pose remain the existing
fields. Conic/coefficients are disabled for Sphere/Plane. An explicit type change
back to Sphere/Plane clears the higher-order parameters; Undo restores them.

The new shape value is `even-asphere`, with optional `conic` and `aspheric`
object `{a4,a6,a8}`. They have no defaults inserted into old JSON. The Project
and prescription schemaVersion remain 1; existing Sphere/Plane projects round
trip unchanged. Older app versions do not understand the new shape. Row copy,
component grouping and User Building Blocks preserve the new parameters. A new
blank Surface clears them. A2, odd powers, higher orders, XY Polynomial, sampled
Control Points and CAD import remain outside F1.1.

Inputs show R/r in mm, Sag in µm, K dimensionless and coefficients in mm⁻³ / mm⁻⁵ /
mm⁻⁷. JSON/evaluators use meters. A4_SI=A4_mm×10⁹, A6_SI=A6_mm×10¹⁵,
A8_SI=A8_mm×10²¹. There is no hidden normalization radius. For Even Asphere only,
R=0 explicitly means a flat base (c=0) with optional polynomial departure.
The ±100 K and ±1 m conservative Sag bounds are declared implementation limits.
Rejected numeric drafts restore the last valid value on Enter/Blur, clearing
that rejected-draft error. No arbitrary invalid geometry is substituted.

## One evaluator

Axial Local X is Sag, transverse coordinates are Local Y/Z; r²=Y²+Z².
The vertex branch is

    x(r) = c r² / (1 + sqrt(1 − (1+K)c²r²)) + A4 r⁴ + A6 r⁶ + A8 r⁸
    c = 1/R; c=0 for a flat base

The analytic gradient has common radial factor

    g(r) = c / sqrt(1 − (1+K)c²r²) + 4 A4 r² + 6 A6 r⁴ + 8 A8 r⁶
    dx/dY = gY; dx/dZ = gZ; Normal = normalize(1, −gY, −gZ)

`src/surface/evaluator.ts` supplies Sag, gradient/normal, radial interval bounds,
clear-domain checks and the positive-thickness check. Optical tracing, Surface
cross sections, finite body annuli/rims and Report optical caps consume it.
Domain requires a positive conic discriminant over the full clear disk; a finite
body also requires it over its full outer radius. A sphere at K=0 / A=0 agrees
with the prior signed-radius branch. A2 is deliberately absent so the saved
Radius remains the vertex curvature without another quadratic coefficient.

The equation uses the conventional Conic plus even radial polynomial form,
limited here to orders 4/6/8. It is not a general OpticStudio file importer or
its full coefficient-order list. Official reference checked for convention:
https://ansyshelp.ansys.com/public/Views/Secured/Zemax/v261/en/OpticStudio_User_Guide/OpticStudio_Help/topics/Even_Asphere.html

## Intersection and physical geometry

Legacy Plane/Sphere retain analytic intersections. Even Asphere intersects the
finite Sag disk, not an infinite polynomial extrapolation. Local cylinder and
Sag bounds restrict the forward search. Conservative radial Sag / derivative
enclosures prune empty intervals and establish monotonic root brackets. Search
visits earlier intervals first; a bounded Newton/bisection refinement accepts a
root with Sag residual ≤2×10⁻¹³ m and a distance criterion of 2×10⁻¹² m based on
the derivative enclosure. These are numerical acceptance thresholds, not a
claim of absolute manufacturing accuracy or formal directed-rounding interval
arithmetic. Tests use independent formulas and transformed rays.

An unresolved grazing/early multiple-root interval, invalid domain or exhausted
iteration budget returns an explicit numerical-unavailable termination. It does
not jump to a later intersection. An outside-disk/behind ray has no optical hit;
its reason includes finite aperture. No extrapolated clipped Aspheric hit or
extra OPL is invented. Array cell selection retains the existing vertex-plane
rule; neighboring-cell search and crosstalk are not added.

A paired Lens body requires positive front-to-rear separation at all radii,
checked by adaptive conservative intervals, including possible interior
crossings with positive vertex/rim thickness. Unresolved separation is rejected.
Whole-Lens Decenter/Tilt moves both surfaces and body using existing Assembly
frames. Individual non-coaxial faces remain incompatible with this paired body
model and explicitly invalidate it; remove the body for standalone interfaces.

Report optical caps are tagged separately from joining rims. Display meshes
remain sampled presentation geometry (not a new optical prescription). Scene fit
bounds include a conservative Aspheric Sag box, so a large interior extremum
cannot be overlooked by rim-only bounds. Surface and Report SVG exports include
the canonical prescription/coefficients and `surface-sequential-3d/3.0.0` ID.

## Gaussian boundary

Gaussian ABCD uses the same Surface's **vertex curvature**. K and orders ≥4 do
not change the first-order power. With nonzero K/A terms the Gaussian panel says
**Paraxial reference**, retains its beam/waist/wavefront reference and withholds
Mode Overlap: higher-order phase / aberration is not propagated by ABCD. The
flat Output reference can still be displayed independently on the same plane.
Returning to a supported Sphere or zero-departure Asphere restores B1 overlap.

This checkpoint therefore enables geometric Aspheric design, not a claim that
ray spot optimization predicts Fiber coupling. Transmission / Total Coupling,
full Aspheric field propagation, non-coaxial Gaussian transport and imported
confined-field adapters remain unavailable. No Ray count becomes efficiency.

## Verification

- TypeScript, production single-HTML build, 239 model/physics/schema/font tests.
- 20 new F1.1 cases: signed Sphere limit; independent quadric Conic equations;
  mm/SI coefficients and finite-difference gradient; flat base; independent
  oblique-ray bisection; nearest multiple root; unresolved earlier tangency;
  finite disk/behind/wrong cap; radial bound enclosure; interior Lens crossing;
  domain/body rejection; rigid-transform Normal/point covariance; shared Report
  caps / Ray residual / nested OPL; whole-Lens Decenter/Tilt; Gaussian boundary;
  legacy and new JSON, duplicate/blank row and Building Block reuse; interior fit.
- Four packaged Desktop browser cases cover linked editors / stable DOM,
  coefficient units, Report SVG and Gaussian boundary, Undo/SaveLoad / rejected
  drafts, Dock/Float and 1366×768 / 1440×1000 layouts. The complete regression
  suite runs in PR CI. These new workflows explicitly target Desktop.
- Managed preview is available and used for visual authoring review. This local
  environment's browser download returned a truncated archive; packaged/full
  automated browser evidence is obtained from the PR's CI runner.

CI now uploads the current checkpoint HTML/manifest and screenshots rather than
an older P2.4 artifact name. Its manifest uses the PR source head. Offline HTML
retains the existing `photonic-connector-studio-u1.html` review filename; the
version/source/hash manifest identifies the current F1.1 content.

Review: startup → S1 Type / Even Asphere → K and A4/A6/A8 → Properties Sag plot →
Surface / Report → Gaussian boundary → Undo / Save Project JSON / Open.

## Standalone provenance

Verified implementation source: `f40c9f651e7f2f6fa9fa1e8ba3320ca0a5f66725`.
HTML: 585946 bytes.
SHA256: `5c47818bed31022822d97a204f9b63aa438de4599c7a228dd4dedd648d5eb57e`.
Source fingerprint: `0eea9403ff689f3355247b79a56d54755d8a2f7f112f39dfc3eb64c3a2ec2b8b`.
