# S3.1 — Gaussian reference along folded optical paths

User authorized S3.1 after reviewing the next-stage explanation. Start from S2
PR #13 head 6b50c731f3f0b70f3d425f5bd5ac988aff0dbf77; it remains unmerged.
Branch: feature/s3-1-folded-gaussian. Version: 0.8.0-s3.1.

## Scope and physical contract

One canonical Project; no new saved schema, no analysis data injected into design
JSON. Existing Surface / Report shape and independent diagnostic rays remain the
geometry authority. The B1 coaxial solver and its validated overlap remain intact
for prescriptions without folds. Reflection / TIR selects the new transported
scalar reference, engine `transported-scalar-gaussian/1.0.0`.

Input is the defined homogeneous Gaussian waist at its actual Port frame. Vacuum
wavelength, MFD, medium and normalization are explicit. PIC emitted fields,
imported fields, undefined contracts, arrays and >0.1 rad waist divergence are
unsupported. Diagnostic pupil size/count and mechanical Fiber size never define
the field. Diagnostic medium must agree with the Port medium.

The exact finite chief ray uses the existing sequential surface kernel, actual
Snell / reflection / TIR events and body gates. Blocked, clipped chief rays and
invalid bodies terminate with an explicit reason and no stale results. Geometric
arclength s and OPL=ΣnL are distinct; no Global-X substitution after folding.

## Mathematics and supported interfaces

Reduced complex symmetric tensor Q=q/n, in an orthonormal transverse (U,V) frame.
The intensity exponent is governed by -Im(Q^-1), and physical curvature is
Re(Q^-1)/n. Its intensity eigenvectors yield major / minor 1/e² radii; the full
complex off-diagonal is retained, including cross phase and rotated ellipses.

- Homogeneous segment: Q ← Q + (L/n)I.
- Transverse basis change: Q ← A Q Aᵀ.
- Planar reflection / geometric TIR: reflect U, negate reflected V to preserve
  right handedness, and change parity Q_UV ← -Q_UV.
- Oblique planar refraction: rotate into incident tangential/sagittal axes,
  A=diag(cosθ_out/cosθ_in,1), Q_out=A Q_in Aᵀ. These are reduced ray variables
  [height,n*slope]. This yields the usual d/n³ tangential propagation for a
  Brewster plate after entrance/exit anamorphism (versus d/n sagittal).
- Curved refraction: centered normal incidence only, vertex sphere power
  Φ=(n_out−n_in)/R; Q_out^-1=Q_in^-1−ΦI. Reject oblique/decentered curved
  encounters, higher-order Conic / Even-Asphere phase, and 2w/|R|>0.2.
- Curved reflection and grazing cosθ<0.1 are unsupported.

Lenses after a fold can be analyzed when their actual incident chief ray is
centered and normal. This does not change S2's fixed-leading-Lens search domain.
There is no Lens optimizer in S3.1.

Waist Δs and waist radii are homogeneous-medium extrapolations only. Independent
principal-axis waist estimates are withheld when intensity and curvature axes
are coupled. They never predict a waist through later optical elements.

## Finite apertures and limits

A conservative projected major radius w/cosθ and circular/body margin form a
per-surface Gaussian tail upper bound exp[-2(margin/w_projected)^2]. Prism body
margin uses actual convex halfspaces within the encountered face plane, including
extrusion depth; mirror backing width/height or disc outline is included. These
are conservative diagnostic upper bounds, not the clipped fraction or efficiency.
Sum >0.1% labels every displayed result **Aperture-limited reference**. The
untruncated envelope remains inspectable so a user can discover that geometric
routing alone leaves an oversized beam. Probe apertures are reference markers.

Flat TIR is a geometric fold only. Angular divergence within three reference
waist-divergence angles of critical incidence adds an explicit angular-spectrum
warning; the model does not solve partial TIR. No Fresnel/coating/TIR phase,
polarization, Goos–Hänchen shift, aberration, diffraction, reflected branches,
absolute delivered power, Transmission or Total Coupling. Folded Mode Overlap is
withheld even for a Fiber target in S3.1. PIC target MFD is always a user reference,
never a device coupling efficiency. Large Output tilt >50 mrad suppresses the
first-order Output-plane projection while beam-normal spatial sections remain.

## Desktop review

1. Example Projects → Lens + 2 Mirrors / Lens + TIR Prism; Gaussian View.
2. Beam Propagation: major/minor radii vs actual geometric distance, glass bands,
   selected Surface; compare the 10.06 mm folded length with the 10 mm endpoint X.
3. Spatial Envelope: Global XY/XZ/YZ, actual beam-normal 1/e² section rings,
   one common spatial scale, no magnification claim or component outlines.
4. Output Section: incident contour and user MFD ellipse in Output Local YZ,
   common scale / origin, offset and rotated transverse axes preserved.
5. Surface Beam Data: before/after n, diameter, curvature, local waist offset and
   conservative tail bound. Export Beam Analysis saves SI derived JSON with
   engine, fingerprint, scope and warnings. No design mutation.
6. Edit Input MFD, Undo / Redo, SaveLoad; invalid geometry or numeric drafts
   remove old plots. Analysis inspector repeats current folded data and scope.
7. Startup Fiber–BK7 Lens–Fiber 10 mm stays on the existing B1 solver.

## References

Primary Gaussian ABCD foundation: MIT OCW, Fundamentals of Photonics, Chapter 2,
§2.6 and Table 2.6 (reduced propagation L/n, flat mirror zero optical power).
https://ocw.mit.edu/courses/6-974-fundamentals-of-photonics-quantum-electronics-spring-2006/8e54d1625e9e71eb5b4e4998e6967e4e_chapter2.pdf

Generalized matrix coordinate / transverse propagation: Anthony A. Tovar & Lee W. Casperson,
Generalized beam matrices, JOSA A 12, 1522 (1995).
https://opg.optica.org/josaa/abstract.cfm?uri=josaa-12-7-1522

COMSOL Gaussian Beam Propagation Through an Optical Prism distinguishes geometric
refraction from a polarization-dependent electromagnetic field / coating solution.
The present implementation does not reproduce that full-field model.
https://doc.comsol.com/6.3/doc/com.comsol.help.models.woptics.gaussian_beam_propagation_optical_prism/gaussian_beam_propagation_optical_prism.html

## Validation and stop

Independent analytic tests: unfolded Mirror/Prism Q and OPL, scalar ABCD
cross-check, oblique plane anamorphism, parity, rotation covariance, cross-phase
waist suppression, finite-body clipping labels, explicit termination, source
contracts, diagnostic independence and strict SaveLoad immutability. Packaged
browser checks exercise all four views/export, MFD/Undo/SaveLoad, Prism/TIR,
invalid geometry and laptop viewport visibility. Existing regression retained.

Deliver standalone HTML and Draft PR stacked on feature/s2-route-search. Stop for
user review. Do not merge S2 or S3.1, and do not start S3.2 automatically.
