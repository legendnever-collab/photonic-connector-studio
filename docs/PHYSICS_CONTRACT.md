# Physics Contract — P0

## Coordinate and reference plane
- All internal geometry is in SI units; UI may display µm/mm/nm with explicit conversion.
- Right-handed Cartesian world: +X forward (Fiber → Waveguide), Y horizontal transverse, Z vertical transverse.
- Reference plane F: Fiber mode output. Reference plane M: configurable detachable mating plane. Reference plane W: Waveguide accepted-mode edge facet.
- A local frame (origin, orientation) is required for each port/component; propagation direction must be specified, not inferred from image position.
- Wavelength given in vacuum unless specified; refractive index and optical path are medium dependent.

## Fiber Port
- Type: Gaussian approximation or imported mode field (future).
- Inputs: wavelength, waist/MFDx/MFDy, waist location, power normalization, polarization, complex field (future).
- MFD is intensity 1/e² diameter for a Gaussian approximation; w = MFD/2. Do not confuse beam radius/diameter and waist/location.

## Waveguide Port (Photonic Substrate)
- Inputs: (x,y,z), local frame/axis, wavelength, accepted-mode representation, polarization, facet and local medium details when used.
- Initial accepted mode: normalized elliptical Gaussian with MFDx/MFDy.
- Future accepted mode: sampled complex vector E/H field (grid, phases, normalization, reference plane and effective index metadata).
- No assumption of waveguide material, MFD, guided-mode symmetry, reflection, or polarization until specified.

## Model tiers
P0: typed schema, geometry and non-physical preview only.
P1: paraxial Gaussian propagation via q-parameter and ABCD, ideal thin lenses, air gap, ideal normalized Gaussian overlap.
P2: refracting surfaces, aperture and clipping, ray tracing and physical field propagation; import simulated Waveguide mode.
P3: error transform and correlated misalignment distribution; optimization objective based on optical loss and robustness.
P4: multi-port array, common rigid-body errors vs per-channel errors, measured remating calibration.

## Mathematical conventions (P1 acceptance tests)
- q: 1/q = 1/R - i lambda_0/(pi n w^2) in a uniform medium using reduced-angle ABCD conventions.
- q_out = (A q_in+B)/(C q_in+D) for matrices using the same consistent convention.
- z_R = pi*n*w_0²/lambda_0.
- Perfectly matched normalized scalar Gaussian modes at the same plane must yield overlap efficiency 1.
- At matched waist and curvature with only lateral translation Δr: eta = exp[-(Δr/w)^2] for equal circular modes.
- Insertion loss = -10 log10(eta) dB only for loss mechanisms actually modeled.
- Polarization, Fresnel reflection, nonparaxial effects and arbitrary 2D waveguide mode mismatch are excluded from P1 numerical claims unless explicitly implemented.

## Numerical integrity
- Return validity/assumption flags; never silently report NaN, impossible geometry or mode results as valid.
- Compare implementations to hand-worked analytical cases and energy limits.
- Keep nominal loss separate from loss distribution. Monte Carlo max is not guaranteed worst case.
- No model is claimed to predict wear, contamination, thermal drift or lifetime without experimental calibration.

## Test sources
Internal analytical Gaussian Beam / ABCD solutions with independently checked expected outcomes. Research paper results can serve as later comparison references, not automatic acceptance targets.
