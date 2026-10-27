# D2.3.4 — Bounded spherical Lens decenter / tilt

Astra checkpoint; PR #25 merged into main at `964ba69`. This checkpoint adds
local first-order Gaussian support around an exact finite chief ray. It does
not compute the full aberrated field or certify physical coupling accuracy.

## Physical contract

The transported tensor is reduced `Q = q/n` in orthonormal beam-normal axes,
with vacuum wavelength. For a forward spherical refraction, let `ci=cos(i)`,
`co=cos(o)` and `Delta=n2*co-n1*ci`. Rotate the full complex tensor into the
incident tangential/sagittal frame. Then:

- `A = diag(co/ci, 1)` and `Qtilde = A Q A^T`.
- `H = diag(Delta/(R*co^2), Delta/R)`.
- `Qout = (Qtilde^-1 - H)^-1` in the outgoing tangential/sagittal frame.
- The corresponding reduced canonical ray blocks are `B=0`,
  `C=diag(-Delta/(R*ci*co), -Delta/R)`, `D=A^-1`.

Normal incidence reduces to the existing scalar power `(n2-n1)/R`; the plane
limit retains existing anamorphism. Signed R follows the forward local surface
normal. Reverse-facing surface branches are rejected, even though the geometric
ray tracer itself can handle them. Near-normal frames use a cross product to
avoid cancellation and retain orthogonality. Cross phase and ellipse roll are
transported, rather than replacing the tensor with two intensity radii.

The equations are consistent with the Coddington equations in Liu & Thibos,
*Ophthalmic and Physiological Optics* (2017), Appendix A,
https://pmc.ncbi.nlm.nih.gov/articles/PMC5404965/ (doi:10.1111/opo.12364),
and the oblique-refraction ABCD tables in Freise & Strain,
*Living Reviews in Relativity* (2010),
https://pmc.ncbi.nlm.nih.gov/articles/PMC5253918/ (doi:10.12942/lrr-2010-1).
The code is verified by independent exact ray / optical-path calculations below;
the papers do not establish a physical error bound for this application's domain.

## Domain and interpretation

Every spherical interface must satisfy:

1. Positive forward normal and chief incidence ≤0.05 rad (50 mrad).
2. `(chief radial height + 2*w_major/ci) / abs(R) ≤0.2`.
   This retains the prior centered footprint scale while accounting for the
   off-axis footprint and distance from the vertex. It is an admission heuristic,
   not a bound on coma, spherical aberration or physical eta error.
3. Existing single-channel explicit homogeneous Gaussian Port contracts,
   divergence ≤0.1 rad, finite chief / body / aperture and medium validation.
4. Conditional overlap additionally requires aggregate aperture tail ≤1e-3 and
   Output relative slope ≤50 mrad. Clipping diffraction is never propagated.

Spherical `even-asphere` with conic=0 and zero higher coefficients uses the same
reference. General Asphere / Parabolic / Freeform, curved mirrors, arrays,
undefined PIC fields and imported fields retain their unsupported status.
Oblique powered Lens + TIR is explicitly withheld from Mode overlap pending a
combined field benchmark; the geometric Q envelope remains a reference. The
existing normal-Lens / validated Prism domain is retained.

This is an analytic **local Gaussian model**, not a finite-beam wave solver.
Higher-order aberration, Fresnel throughput, coating amplitude / phase and device
coupling are omitted. `physicalEtaErrorBound`, transmission and total coupling
are null in the spherical Mode reference metadata. The existing `1e-10` rank
comparison floor measures numerical comparisons *within this reference model*;
it is not an experimental or aberrated-field accuracy guarantee. Prism model
tolerance remains its separate declared contract. Field coverage never implies
geometry passage, manufacturing Yield or a global robust optimum.

## Integration and provenance

- Transported solver and tensor evaluator IDs advance to 1.1.0. Joint coverage
  embeds the new evaluator so an old evaluator result cannot become current.
- Every valid spherical path exports per-interface incidence, footprint ratio,
  tangential/sagittal power and explicit assumptions. Gaussian, Analysis and
  Report display the same Mode result; SVG metadata preserves the full result.
- A Physical Project with oblique spherical chief incidence selects the transported
  envelope even when the older coaxial bridge can return a first-order value,
  and without prior Lens-search provenance. Centered reference behavior stays available.
- Joint nominal and samples use the same evaluator. Complete supported Lens
  decenter/tilt coverage can now be assessed; geometry is still separate. Each
  spherical observation exports its field assumptions. No unsupported eta is
  converted to zero, and stale / cancellation / cap behavior is unchanged.
- No Project schema migration or persisted derived field is introduced.

## Independent validation

`tests/obliqueLens.test.ts` contains an independent exact sphere intersection and
vector Snell implementation; it does not call the application's intersection,
normal, Snell, ABCD or frame functions. Central differences at 20 and 10 nm in
height, with correspondingly scaled angular steps, verify all sixteen Jacobian
entries at 0, 1, 25 and 50 mrad, for R=±5 mm and indices 1→1.5 / 1.5→1. The
normalized entry discrepancy must be <2e-7. The independent Jacobian also checks
the full complex inverse-Q map, including cross phase, rather than just beam size.

An independent optical-path Hessian on the exact spherical patch verifies the
phase-power signs and tangential / sagittal denominators at two step sizes.
Normal / plane / index-matched / reciprocal limits, 3D rigid-motion covariance
with a rolled ellipse, the 50 mrad boundary and near-normal orthogonality are
covered. Existing complex-field overlap quadrature, coaxial Lens and folded
matrix-chain benchmarks remain mandatory regressions. These tests establish the
local differential model; they do not validate a finite-beam aberration error.

Integration tests cover complete small Lens joint perturbations with separate
geometry failure, beyond-domain nulls, immutability and Save/Load. Offline
Playwright desktop/mobile tests inspect Gaussian / Analysis / Report, SI JSON /
SVG consistency, null physical error bound, unsupported invalidation, Undo,
read-only Project state and browser errors / overflow. Legacy unsupported Lens
fixtures now use a 1 mm displacement, rather than misclassifying newly supported
1 µm perturbations. Final pass counts and artifact SHA are recorded in the PR.

## User review

Open the standalone HTML, then save the default Project JSON. In a copy, set the
Starter-Lens Assembly `frame.origin.y=1e-6`, `z=-2e-6`, and
`frame.rotation.yaw=0.002`, `pitch=-0.001` (SI units); reopen it.
Gaussian View now shows the transported envelope. Expand Mode evaluation for
per-surface incidence / powers and the approximation statement. Export Beam
Analysis and Report SVG to compare the same conditional Mode result.

For Joint assessment, use 8 samples with Assembly Y/Z=1/2 µm and pitch/yaw within
1/2 mrad. Complete field coverage is possible while tight geometry tolerances
may still fail. Larger errors can instead give explicit partial coverage and
null sample eta. Assessment does not move the nominal components.

## Next checkpoint

D2.3.5 — independent finite-beam wavefront / aberration benchmark and a meaningful
physical accuracy gate before extending the domain or combining oblique powered
Lenses with TIR. **Astra recommended**: phase reference, propagation and model
error need physics review; differential-ray agreement alone is insufficient.
Parabolic / Asphere / Freeform, Engineering release and multi-channel remain on
the later roadmap. This Draft PR is for review; its merge and the next checkpoint
start follow the user's next instruction.
