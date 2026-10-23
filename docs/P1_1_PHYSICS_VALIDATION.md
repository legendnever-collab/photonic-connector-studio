# P1.1 Gaussian Physics Validation

Date: 2026-10-23 (Asia/Seoul) · Solver `aligned-gaussian-air` v1.1.0
Scope: P1.1 only. [Contract addendum](PHYSICS_CONTRACT.md#p11-implementation-addendum--frozen-before-solver-implementation-2026-10-23).

## Convention and implementation

Canonical SI, propagation +X, MFDx → local Y and MFDy → local Z. MFD is Intensity 1/e² diameter, w=MFD/2. Source has a waist at Fiber Plane F; accepted Target has a waist at WG Plane W (1/R=0). These are declared Synthetic assumptions, not measured Port data.

n=1 air, physical q, ray vector [height, angle], q(F)=iπw₀²/λ₀. Free space q+=d; Ideal Thin Lens uses [1,0;−1/f,1]. Radius w=w₀√(1+(Re(q)/Im(q))²); curvature 1/R=Re(q)/|q|²; waist X=x−Re(q). Output uses 1/R so a flat wavefront has 0 curvature rather than NaN.

For one transverse axis, incident E=exp(−u²/wi²−iπcu²/λ), target E=exp(−(u−δ)²/wt²). Integrating conjugate(Target)×Incident, normalizing both powers, and multiplying Y/Z overlaps gives η. The closed logarithmic expression in the Contract includes phase curvature; only roundoff up to 1e−12 may be corrected, while larger normalization violations fail. Loss=−10 log10 η is **Gaussian Coupling Loss**, not total Connector Insertion Loss. Float64 η underflow is displayed as 0 (underflow) and ∞ dB; finite Log η remains in diagnostics.

Source: [MIT OCW Gaussian Beams and Resonators, §2.6, eqs. 2.259–2.270](https://ocw.mit.edu/courses/6-974-fundamentals-of-photonics-quantum-electronics-spring-2006/e9852c138493233bc2813f683da5b199_gaussian_bem_res.pdf). Only its air limit is used; medium conventions are not mixed into this implementation. The normalized overlap is derived from the stated scalar fields and independently integrated below.

## Numerical gates and independent references

`npm test`: **90 PASS** = existing Domain/State 47 + Physics 42 + Offline Font coverage 1.

| Benchmark | Independent reference | Verified bound |
|---|---|---|
| λ=1 µm, waist radius=20 µm | zR=1.2566370614359172 mm | absolute error <5e−17 m |
| Free space 2 mm | w(W)=37.59270988401046 µm | absolute error <5e−16 m |
| Matching: zR=1 mm, Lens X=2 mm, f=1.25 mm, W=4 mm | q after Lens=−2+i1 mm; q(W)=i1 mm; w=17.84124116152771 µm | η error <5e−14; waist X error <5e−16 m |
| Matched circular waist; δr/w=0, .1, .7, 1, 2, 10 | η=exp[−(δr/w)²] | absolute η error <5e−14 |
| Flat circular size ratio wt/wi=.2, .5, 1, 2, 5 | η=[2wiwt/(wi²+wt²)]² | absolute η error <5e−14 |
| Equal w=20 µm, curvature=2λ/(πw²) | 2D η=0.5 instead of 1 | absolute η error <5e−14 |
| Mismatch Example: WG Y Offset=w₀ | η=exp(−1)=0.36787944117144233 | absolute η error <5e−14 |

ABCD identity, segment addition, independently known Lens transform, disabled/removed Lens equivalence, equal-X planes, Gap non-addition, elliptical-axis exchange symmetry, SI unit conversion and JSON reload parity also pass. A deterministic 108-case axis parameter grid remains inside [0,1]. Invalid λ/MFD/f/Position/Order, Source/Lens/WG Rotation, Lens Decenter, Gap overlap/Lens contradiction, explicit TE/TM mismatch and paraxial-domain violations return no Valid coupling.

## Independent Complex-field quadrature and convergence

The test integrator directly samples E and complex phase, trapezoidally accumulates real/imaginary overlap and both powers, then normalizes. It does not call q/ABCD/the closed overlap expression. Because the model is separable, 2D normalized power is the product of independently normalized Y/Z powers. Windows include both centered profiles over ±N radii.

Window/resolution: N=4 / 512 intervals → N=6 / 2048 → N=8 / 8192. All cases: first error <1e−10; final two errors <2e−13. Observed final maximum absolute error: **1.55e−15**.

| wi / wt [µm] | c=1/R [m⁻¹] | δ [µm] | Closed 1D η | Final quadrature absolute error |
|---|---:|---:|---:|---:|
| 20 / 20 | 0 | 0 | 1 | 0 |
| 20 / 30 | 1000 | 12 | 0.5348525918780537 | 2.22e−16 |
| 12 / 25 | −2200 | −7 | 0.5278718227271839 | 1.55e−15 |
| 50 / 10 | 700 | 20 | 0.19903059206480062 | 8.05e−16 |
| 20 / 20 | 1591.5494309189535 | 0 | 0.7071067811865477 | 1.55e−15 |

These are deterministic tested cases; they are not a proof of arbitrary extreme-input quadrature convergence or real-device accuracy.

## Geometry, validity and exclusions

Enabled Tree order must follow nondecreasing X; equal-X lenses use Tree order. No sorting or Model mutation occurs. Distances use absolute planes, not Gap Length addition. Gap annotations remain inside F–W, cannot overlap or enclose an enabled Lens internally. Reference/Mating planes have zero optical power; disabled lenses are ignored while full physical propagation distance remains.

Only WG Y/Z Offset relative to an aligned Source/Lens axis is supported. Nonzero Roll/Pitch/Yaw is rejected; Lens Decenter is rejected. Aligned separable elliptical MFDs are supported; rotated elliptical fields are not. Source and lens-generated waist divergence, plus Target divergence, must be ≤0.1 rad (declared conservative eligibility gate).

Unspecified Polarization gives explicitly conditional Scalar co-polarized coupling, with a warning before the KPI. Explicit TE/TM mismatch is Out-of-domain, not an invented Polarization efficiency. Fresnel loss, vector overlap, clipping, aberration, multiple media, diffraction by apertures, Ray Tracing, physical lenses and nonsequential paths are unimplemented. Aperture changes do not change η; radius ≥aperture/4 triggers an omitted-clipping warning.

Input errors and unsupported geometry suppress valid KPIs/Overlay; no previous result cache is displayed. Results are synchronously recomputed, never serialized into JSON. Schema v1 and P0 TBD are unchanged. Provenance carries Solver ID/version, exact input JSON, FNV64 fingerprint, λ, assumptions, warnings and validity. Fingerprints identify inputs; they are not cryptographic integrity proofs. Artifact integrity separately uses SHA256.
