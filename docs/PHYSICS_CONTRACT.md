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
