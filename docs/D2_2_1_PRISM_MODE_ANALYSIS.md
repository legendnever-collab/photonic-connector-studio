# D2.2.1 — Prism Mode evaluation and common Analysis

Version `0.12.0-d2.2.1`; baseline main `0c03fd3ec57af2b4064eda196d00249c6363712b`.
Astra Work is recommended for this checkpoint's phase / polarization / validity
judgment. Existing Gaussian, Surface, routing and synthesis solvers are reused.

## Delta / supported domain

`tensorOverlap(Project)` is now the common Mode evaluator, independent of the
presence of `Project.synthesis`. Manual edits, applied routes and synthesis all
use it. Analysis, Gaussian and Report expose the same value, reason and domain;
Beam JSON / Report SVG metadata include the result and null Transmission / Total
Coupling. The displayed Q envelope remains an **unshifted Gaussian reference**;
TIR-induced displacement / profile changes enter the overlap integral, not the
geometric chief ray or envelope drawing.

New numerical support is deliberately bounded:

- One finite Prism, one Mirror + one Prism, or two **existing / independently
  authored** Prisms; coplanar folds. No new two-Prism generation family.
- BK7 / isolated air TIR, 45° chief incidence, planar normal entry/exit, air Ports,
  wavelength 1260–1625 nm. No frustrated TIR / coatings / absorption model.
- Explicit Input and Output polarization: **TE = Port local Y; TM = local Z**.
  The actual electric-field axis is transported through the chief frames.
  It must be pure local s or p at each fold and match the Output axis. Matching
  labels alone is insufficient; the evaluator never edits either Port.
- Internal 1/e angular-amplitude divergence ≤2 mrad. Critical margin must exceed
  8 times that divergence; chief-ray TIR alone cannot pass the field gate.
- No powered or oblique refracting optic after the first TIR. Existing centered
  normal Lens support before it is retained, subject to all previous gates.
- Output plane normal to the chief direction. Finite offset is permitted within
  the integration bandwidth. Mixed polarization, noncoplanar folds, Output tilt,
  higher-order field propagation and unsupported compositions return no η.
- Existing divergence, curvature, clipping and body gates remain. A conservative
  additional GH displacement reserve is included in the cumulative 0.1% aperture
  tail gate. A post-TIR paraxial-phase support bound must remain ≤1e-3 rad.
  Quadrature bandwidth and convergence gates reject unresolved integrations.

## Phase / integral convention

Use `exp(+iωt)` and plane waves `exp(-ik₀ α·x)`. With reduced `Q=q/n`, the Fourier
amplitude of a centered Gaussian is proportional to `exp(+ik₀ αᵀQα/2)`;
centroid `h` contributes `exp(+ik₀ α·h)`. The target is a normalized Gaussian
waist at the same Output plane. Parseval's complex inner product is integrated
with the full angular-dependent TIR phase. The positive real Gaussian weight is
whitened by Cholesky decomposition; its normalization is analytic.

For `m=n_out/n_in`, `c=cos θ`, and `g=√(sin²θ−m²)`, the pure-polarization TIR
phases are `φs=2 atan2(g,c)` and `φp=2 atan2(g,m²c)`. The local basis is
`s ∝ k×normal`, `p=s×k`. Overall π parity of pure reflected p does not change
normalized η. Angular phase does: backward spectral directions traverse the
actual plane normals and normal-interface Snell mapping. The integrand includes
both transverse angles, not a single chief angle or one constant phase.

Entry/exit interfaces and ideal Mirrors have **unit amplitude** in this
conditional model. Angular amplitude filtering and full vector field variation
are omitted by the production scalar adapter. A separately implemented vector
boundary-condition oracle checks that approximation on declared fixtures; the
reported absolute-η validation tolerance is `2e-4`, not a universal certified
physical error bound. Transmission and Total Coupling remain **null**.

Primary derivation references:

- Richard Fitzpatrick, *Waves*, Total Internal Reflection, equations 7.102–7.135:
  https://farside.ph.utexas.edu/teaching/315/Waveshtml/node60.html
- R. M. A. Azzam, JOSA A 21, 1559–1563 (2004), phase shifts at a dielectric
  interface: https://opg.optica.org/josaa/abstract.cfm?uri=josaa-21-8-1559

## Independent verification

`tests/prismFixtures.ts` constructs millimetre-scale finite trains independently
of routing/synthesis recipes. Input diameters are 400 / 500 µm at 1310 nm.
`tests/prismOracle.ts` independently solves complex boundary-admittance
coefficients, transports vector s/p components and integrates an unwhitened
2D angular grid. It does not call production Fresnel, reflection, refraction,
Gaussian overlap or quadrature functions. Both fields are numerically normalized.

For displaced Output references (20 / 35 µm):

| Train | Polarization | Production η | Vector reference η (160² / 9σ) | Absolute difference |
|---|---|---:|---:|---:|
| 1 Prism | TE | 0.9707383253 | 0.9707366922 | 1.63e-6 |
| 1 Prism | TM | 0.9712435161 | 0.9712418398 | 1.68e-6 |
| 2 Prism | TE | 0.9705107217 | 0.9705099894 | 7.32e-7 |
| 2 Prism | TM | 0.9714894838 | 0.9714888489 | 6.35e-7 |
| Mirror + Prism | TE | 0.9693894236 | 0.9693878076 | 1.62e-6 |
| Mirror + Prism | TM | 0.9698937480 | 0.9698920658 | 1.68e-6 |

Independent grids/windows: 48²/5σ → 96²/7σ → 160²/9σ; last two differ by less
than 1e-9. Production uses 32²/7 and 64²/8 whitened windows and rejects Δη>1e-7.
Offset fixtures measurably disagree with constant-phase overlap (>1e-4), testing
phase sign / displacement sensitivity. Additional tests cover 1260, 1550, 1625 nm
at 1.95 mrad divergence, TE/TM boundary admittance near critical incidence,
identity / B1 / ideal Mirror parity, rigid transforms, Output roll with physical
polarization-axis agreement, undefined field, excessive divergence and clipping.

Existing-train synthesis tests preserve fixed Ports, retain the same η, revalidate
Apply, and reject stale/tampered candidates. Prism and Mirror can share numeric
comparison only in the explicit copolarized phase-only class; unspecified scalar
Mirror assumptions are labelled and ordered separately. Gaussian-Q size/phase
residuals remain reference diagnostics; normalized Mode η includes TIR phase.
OAT remains partial when a stressed field leaves the domain, never joint Yield.

## User review (five steps)

1. Open the D2.2.1 HTML. In Example Projects or Design Setup, choose
   **D2.2.1 · Collimated BK7 Prism · TE**.
2. Open **Analysis**: Mode Overlap is calculated; Transmission / Total Coupling
   remain Not calculated with the missing loss-model explanation.
3. Open **Gaussian View** and **Report View**: compare the same Mode value and
   expand **Mode evaluation** for critical margin, phase, convergence and scope.
4. Set Input Mode polarization to `unspecified`: the reason becomes **Input
   undefined**. Undo restores the value; Save / Load preserves the result.
5. Review an existing Mirror design or Find Routing Solutions result. A supported
   field is evaluated without synthesis settings; an unsupported field retains
   its specific reason, not 0%. The old tiny-SMF Prism examples remain unqualified.

D2.2.1 stops here. Two-Prism automatic generation, additional Lens allocations,
manufacturing-space expansion, locked-anchor routing, Transmission, Total
Coupling, PIC receiving fields and D2.3 / Parabolic / Freeform remain outside
this checkpoint. No main merge before user review.
