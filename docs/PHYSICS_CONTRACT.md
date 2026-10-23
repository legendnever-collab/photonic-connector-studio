# Physics Contract — P0 / P1 baseline

**Version:** 1.1 (2026-10-23)
**Milestones:** See [DEVELOPMENT_ROADMAP_V1.md](DEVELOPMENT_ROADMAP_V1.md) for authoritative P0–P6 names.

## Coordinate and reference plane
- All internal geometry stored in SI units; UI displays µm/mm/nm with explicit conversions.
- Right-handed global Cartesian frame: +X forward from Fiber to WG; Y and Z transverse. XY and XZ are display projections, not independent geometries.
- F = Fiber output mode plane; M = configurable detachable mating plane; W = target Waveguide accepted-mode Edge plane. All have origin, normal/propagation vector and local frame.
- Each Port/Component records its own local coordinate frame; a transform is not inferred from screen pixel positions.
- Vacuum wavelength lambda_0 is the input; media have refractive index n(lambda_0).

## Fiber source
- Gaussian approximate mode or future imported complex mode field.
- Input: lambda_0, waist/MFDx/MFDy, waist location, polarization and normalized power.
- MFD means intensity 1/e² diameter for Gaussian convention. w=MFD/2 for each axis.

## Waveguide target (Photonic Substrate)
- Position (x,y,z), local frame, accepted-mode representation at plane W, wavelength and polarization.
- Gaussian accepted mode: MFDx/MFDy, optional waist curvature and phase reference.
- Future sampled complex field: x/y grid and spacing, vector E and H components where applicable, phasor convention, transverse coordinate orientation, normalization, effective-index and reference-plane metadata.
- Mode import requires validation of units, field orientation, polarization, phase convention and power normalization.
- Do not silently assume material, actual mode, return reflection or Polarization performance.

## Model tier boundaries
P0 — Geometry/types/schema only; no optical calculations or invented loss readouts.
P1 — Homogeneous-medium paraxial Gaussian q, ABCD, ideal thin lenses, simple scalar normalized overlap; input limits and exclusions explicit.
P2 — Physical Lens/Geometrical Ray interfaces, Snell, apertures, ray distribution. Rays do NOT directly determine guided-mode overlap.
P3 — Wave propagation, pupil amplitude+phase, diffraction/clipping, imported complex target mode, scalar then vector field overlap as validated.
P4 — Optimization. P5 — Mechanical/Monte Carlo. P6 — Arrays/measurement.

## P1 mathematical conventions (explicitly choose and test)
P1 starts **in homogeneous air**, using the standard ray vector [height, angle] (not reduced angle), physical q and:
- 1/q = 1/R - i * lambda_0/(pi * n * w²).
- q = z + i z_R for beam waist at z=0; z_R = pi*n*w_0²/lambda_0.
- Free-space propagation in a single medium: matrix [1 d; 0 1] and q_out=q_in+d.
- Ideal thin lens immersed in that same homogeneous medium: [1 0; -1/f 1]; q_out=(Aq+B)/(Cq+D).
- **Do not use reduced-angle [height, n*angle] matrices with this same q without converting both convention and q appropriately.** Multiple media/refractive surfaces belong to P2 with explicit convention and tests.
- For circular modes of equal w, matched curvature and polarization with lateral Δr: eta=exp[-(Δr/w)²].
- Perfect normalized matched field yields eta=1; eta always in [0,1] within numerical tolerance.
- Scalar overlap of a normalized field `E_i` and `E_t`: eta = | integral conj(E_t)*E_i dA |² / ( integral |E_t|² dA * integral |E_i|² dA ) when both share a plane and compatible scalar approximation.
- Loss `IL=-10log10(eta)` is only the coupling contribution actually modeled, not the complete connector insertion loss.

## P1 exclusions unless specifically implemented
Vector polarization overlap, Fresnel/return loss, multimode and non-Gaussian fields, nonparaxial optics, real surface aberrations, coatings, reflective paths, clipping beyond clearly defined ideal aperture and materials dispersion.

## Numerical integrity
- Solver results carry model ID, version, input parameters, assumptions, warnings, validity and provenance.
- Invalid or unspecified input returns Not Calculated/Out-of-domain, not fabricated data.
- Separate Mode mismatch, propagation, reflection, clipping and mechanical errors when modeled.
- Compare with analytical benchmark and independent calculation, unit tests and convergence where appropriate.
- Monte Carlo samples estimate distributions with declared assumptions; sampled max is NOT guaranteed worst case.
- Wear, contamination, thermal drift and lifetime require measured/calibrated models before any production claim.

## P1.1 implementation addendum — frozen before solver implementation (2026-10-23)

- Scope: n=1 air; monochromatic scalar, co-polarized paraxial field; two separable aligned elliptical axes. MFDx = local Y, MFDy = local Z; intensity 1/e² diameter. Source waist at F and accepted target waist (flat phase) at W are explicit assumptions, not inferred measurements.
- All enabled frames must have zero roll/pitch/yaw. Source sets the common Y/Z axis; every enabled lens must be centered on that axis. Only WG Y/Z displacement is supported; reference/mating/gap transverse positions are metadata (not optical-axis transforms). Any nonzero rotation, including WG roll, is Out-of-domain. Disabled components do not affect propagation.
- Tree order must be nondecreasing in absolute X among enabled entries. Resolve conflicts by editing X or Up/Down; no implicit sorting/model mutation. Coincident planes and lenses are allowed; apply enabled lenses in Tree order after F and before W. Reference/Mating planes have no optical power.
- Distances are differences of absolute X reference planes. Air Gap denotes [X, X+Length] inside F–W; never add Length to propagation. Enabled Gap intervals may not overlap or contain an enabled lens strictly inside; split the annotation around that lens. Planes may occur inside a Gap. Invalid annotations block results.
- Physical q and ray vector [height, angle]: q(F)=i*pi*w0²/lambda; free space q+=d; thin lens q'=q/(1-q/f). Inverse q real part is curvature c=1/R, with c=0 at waist (R=Infinity). No reduced-angle convention or material interfaces.
- E(u) proportional to exp[-u²/w²-i*pi*c*u²/lambda]. Target is exp[-(u-delta)²/wt²]. Gaussian normalized overlap factors into Y/Z powers. With a=1/wi², t=1/wt², b=pi*c/lambda, S=a+t:
  log(eta_axis)=log(2*sqrt(a*t)/hypot(S,b))-2*t*delta²*(a*S+b²)/(S²+b²).
  This includes incident phase curvature. eta=exp(sum log eta_axis), loss=-10*sum(log eta_axis)/ln(10). Positive log eta above roundoff tolerance is a numerical failure; only roundoff up to 1e-12 may be corrected. If eta underflows, show eta underflow and Infinity loss rather than a fabricated finite measured loss; retain log eta for diagnostics.
- Polarization: explicit TE/TM mismatch is Out-of-domain (no vector polarization solver). Unspecified at either port permits **conditional scalar co-polarized** coupling with an always-visible warning; no polarization efficiency is claimed. Matching explicit labels also remain a scalar assumption.
- Ideal lens aperture never clips power. Always disclose omitted clipping; warn when either radius >= aperture/4 (1/e² diameter occupies >= half the aperture). Source/any lens-generated waist divergence lambda/(pi*w0) > 0.1 rad is conservatively Out-of-domain; this declared model gate is not a universal optics limit.
- Recompute synchronously from input; never persist results in JSON. Existing schema v1 is unchanged. Provenance includes exact serialized input, deterministic FNV-1a-64 input fingerprint (identity aid, not cryptographic), solver ID/version, lambda, assumptions, warnings and validity. Invalid editor drafts suppress current Valid display until corrected/restored.
- Reference: MIT OCW 6.974, Gaussian Beams and Resonators, sec. 2.6, eqs. 2.259–2.270: https://ocw.mit.edu/courses/6-974-fundamentals-of-photonics-quantum-electronics-spring-2006/e9852c138493233bc2813f683da5b199_gaussian_bem_res.pdf . Here only n=1 is implemented; the source's other medium matrix conventions are not mixed into this solver. Closed overlap is derived by integrating the two scalar Gaussian fields; verified separately by complex quadrature.

## P1.2 addendum — Beam Axis and Offset–Tilt (before implementation)

This addendum supersedes only the P1.1 no-Port-Tilt restriction and extends its overlap. All other P1.1 validity rules remain. Model ID: paraxial-gaussian-axis-air, version 1.2.0.

- Common reference planes remain X=constant; F and W waists are defined on those planes. Port Orientation is a first-order phase-gradient proxy, not an exact rotated physical facet. Axis slopes sy=Yaw and sz=−Pitch in radians; do not mix this with exact tan/sin projections. Roll must be zero. Port slope norm and every propagated axis slope norm must be ≤0.05 rad (declared small-angle gate). q uses ΔX, omitting O(θ²) path-length/projection corrections. Existing waist-divergence ≤0.1 rad gate remains independent.
- Source axis starts at its F Y/Z origin. Free space: h_out=h_in+d*s, s_out=s. Centered Ideal Lens: h unchanged, s_out=s_in−(h−h_lens)/f; q transforms as before. Enabled lens centers must still equal Source Y/Z; Lens Tilt/Decenter remains out of scope. Beam-axis paths are calculated first-order centroids, not a physical Ray bundle.
- At W, compare incident centroid hi and slope si with target origin ht and target slope st. Use d=ht−hi and Δs=si−st per axis. Scalar fields with time convention e^(+iωt): E_i(u)=exp[−(u−hi)²/wi²−i*k*(ci*(u−hi)²/2+si*(u−hi))]; E_t(u)=exp[−(u−ht)²/wt²−i*k*st*(u−ht)], k=2π/λ. Carrier/global phase cancels in power overlap. Positive slope therefore has negative transverse phase gradient. A lens multiplies by exp[+ik*(u−h_lens)²/(2f)], consistently yielding c'=c−1/f and s'=s−(h−h_lens)/f.
- Dimensionless closed integral: a=wt/wi, t=wi/wt, S=a+t, b=π*ci*wi*wt/λ, D=S²+b², δ=d/√(wiwt), H=2π*Δs*√(wiwt)/λ.
  log η_axis = log[2/hypot(S,b)] − 2δ²/S − S/(2D)*(H+2*t*b*δ/S)².
  This completed-square form retains the Offset–Tilt–Curvature cross term and cannot conceal a large positive overlap error by clamping. It reduces to P1.1 for Δs=0. Two axes multiply (sum logs). For matched flat circular modes, η=exp[−(δr/w)²−(πwδθ/λ)²].
- Display actual W centroid offset, incident and target angles, and relative mismatch; do not conflate source input angle with W mismatch. Aperture proximity warning uses |centroid−lenscenter|+radius vs aperture/4; it still applies no clipping loss.
- Sensitivity: vary WG Y or Z position and corresponding Yaw or Pitch by signed delta around the current nominal Design. Pitch sign is opposite to Z slope, shown explicitly. Other parameters and the Source/Lens train stay fixed. Curves use 61 samples and joint map 21×21 by default, odd grids include zero. Invalid points have no numeric η and are shown distinctly.
- Threshold is absolute η, not normalized to the scanned maximum. Report only the nominal-connected passing interval when nominal η meets threshold. Crossing edges are bracketed and refined by bisection; scan-edge means no crossing found within the finite scan, domain-edge means invalid neighbor prevents continuation. A nominal point below threshold has no nominal acceptance interval, even if off-nominal samples pass. These are model-based fixed-parameter scan intervals, not manufacturing/6DoF tolerances (P5).
- Sweeps never mutate Design or serialize computed results. Sweep settings are Analysis-session state with reset; a result carries nominal input fingerprint/settings. Design change invalidates/recomputes both live result and scans. Unsupported input/drafts suppress plots instead of displaying old Valid data.
- Reference context: St-Amant et al., Applied Optics 43, 5691–5704 (2004), DOI 10.1364/AO.43.005691, publisher abstract https://opg.optica.org/ao/abstract.cfm?uri=ao-43-30-5691 describes simultaneous displacement/angular mismatch and independent numerical checking. Its full text was not accessible here; no claim to reproduce its implementation. Equations above are derived from the stated fields and independently numerically integrated in this project. The P1.1 MIT air-q convention remains unchanged.
