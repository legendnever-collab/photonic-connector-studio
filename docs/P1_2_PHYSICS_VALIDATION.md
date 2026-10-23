# P1.2 Beam Axis & Alignment Physics Validation

Date: 2026-10-23 (Asia/Seoul). Solver `paraxial-gaussian-axis-air` v1.2.0.
Source Commit: `d3e259db9943d678ac3f0ffd374859bf39933dd9`.
See [P1.2 Contract](PHYSICS_CONTRACT.md#p12-addendum--beam-axis-and-offsettilt-before-implementation) and [Work Order](P1_2_WORK_ORDER.md). P1.1 q conventions and aligned results are preserved.

## Reference planes, field and coordinate conventions

Homogeneous Air n=1, monochromatic scalar co-polarized separable elliptical Gaussian. MFDx = local Y, MFDy = local Z, intensity 1/e² diameter. F/W are **common X=constant waist planes**. Port Tilt is a first-order transverse phase ramp; this does not rotate the full sampled field/facet geometry. Axial propagation uses ΔX and neglects O(θ²) projection/path-length corrections. Source/WG Roll, Lens Tilt/Decenter and rotated elliptical fields remain unsupported.

Port slopes are sY=Yaw, sZ=−Pitch (rad); no exact tan/sin is mixed into the first-order Solver. Source and Target slope norm ≤0.05 rad; any Lens-generated axis slope norm >0.05 rad is Out-of-domain. The P1.1 waist-divergence gate ≤0.1 rad remains separately enforced. UI degree conversion and result mrad labels are explicit.

Free space centroid: h'=h+d*s, s'=s. Centered Ideal Lens: h'=h, s'=s−(h−h_lens)/f. Gaussian q propagates independently with its existing ABCD matrices. Samples carry both q-derived radius/curvature and calculated centroid/slope; the line drawn is a first-order Beam Axis, not a Ray bundle. Aperture proximity warnings now include |h−lenscenter|+radius, but do not calculate Clipping Loss.

With time phasor e^(+iωt), per axis:

- E_i(u)=exp[−(u−hi)²/wi²−i*k*(ci*(u−hi)²/2+si*(u−hi))].
- E_t(u)=exp[−(u−ht)²/wt²−i*k*st*(u−ht)], k=2π/λ.
- Positive slope has a negative phase gradient, consistent with the Lens phase and free-space propagation conventions. Compare d=ht−hi and Δs=si−st at the **same W plane**; Source input angle is not the W mismatch.

Define a=wt/wi, t=wi/wt, S=a+t, b=πciwiwt/λ, D=S²+b², δ=d/√(wiwt), H=2πΔs√(wiwt)/λ. Direct normalized Gaussian integration gives:

`log η_axis = log(2/hypot(S,b)) − 2δ²/S − S/(2D)*(H+2*t*b*δ/S)²`.

This completed-square expression retains the Curvature–Offset–Tilt cross term. The two axis log powers add; zero Tilt reduces to P1.1. Under matched flat circular conditions, η=exp[−(δr/w)²−(πwδθ/λ)²]. No large numerical error is hidden by clamping.

Reference context: [St-Amant et al., Applied Optics 43, 5691–5704 (2004), DOI 10.1364/AO.43.005691](https://opg.optica.org/ao/abstract.cfm?uri=ao-43-30-5691). The publisher abstract discusses simultaneous axial/transverse/angular mismatch and numerical checking. Full text was inaccessible; this project derives the stated scalar-field expression and validates it independently, and does not claim reproduction of that paper's code/equations. Existing P1.1 MIT air-q reference remains unchanged.

## Analytical and numerical validation

**119 Unit/Numerical/Font PASS:** Domain/State 47, P1.1 Physics 42, P1.2 Alignment/Sensitivity 29, Font coverage 1.

| Case | Independent reference / observed result | Test bound |
|---|---|---|
| Axis h=3 µm, s=5 mrad, d=2 mm | h_out=13 µm | absolute height error <5e−17 m |
| Lens h=10 µm, s=5 mrad, f=1.25 mm | s_out=−3 mrad | error <5e−16 rad |
| Matching Train with Source Yaw=5 mrad | Complete matrix A=D=−0.6, B=0.8 mm, C=−800 m⁻¹ → W h=4 µm, s=−3 mrad | height <5e−17 m; slope <5e−16 rad |
| Same Source Tilt Example | η=exp(−0.025π)=0.9244652503762558 | field remains unchanged in q, axis changes correctly |
| Matched w=20 µm, θ=0/.001/.005/.01/.02 rad | η=exp[−(πwθ/λ)²] | absolute η error <5e−14 |
| Flat simultaneous d=12 µm, θ=7 mrad, w=20 µm | independent displacement × angular factors | absolute η error <5e−14 |
| WG Tilt Example: θ=λ/(πw₀)=17.84124116152771 mrad | η=e⁻¹=36.78794411714423% | Browser benchmark 36.7879% |
| Matched 80% absolute threshold | ΔOffset=±8.42785847184639 µm; ΔRotation=±8.427858471846386 mrad | edge error <1e−14 m / <1e−11 rad |
| Matched 50% absolute threshold | ΔOffset=±14.853807597806416 µm; same numeric value in mrad for this Synthetic example | Browser range 14.854 |

Tests also verify Yaw/Pitch sign and Y/Z interchange, zero-angle P1.1 parity, fast/no-sample Solver parity, JSON reload, explicit domain failures, finite scan limits, nominal-below-threshold status despite other passing points, and Scan immutability. The frozen-train Sensitivity implementation reuses the current Incident Field and the same pure overlap function; both axis grids are compared with independent full Solver evaluations for tilted/curved elliptical fields.

## Independent Complex-field quadrature convergence

Directly sampled incident/target amplitudes and separate phase ramps are integrated by trapezoidal sums of overlap real/imaginary parts and both powers. The integrator does not call the closed overlap or Axis/q functions. Windows cover both spatial centers; separability allows the 2D normalized power to factor into these independently tested axis integrals.

Window/resolution N=4 /512 → N=6 /2048 → N=8 /8192. First error <1e−10; last two <2e−13 for every case. Maximum observed final error **6.33e−15**.

| wi/wt [µm] | c [m⁻¹] | hi/ht [µm] | si/st [rad] | Closed axis η | Final error |
|---|---:|---|---|---:|---:|
| 20/20 | 0 | 0/12 | .005/−.003 | .5419064615144105 | 6.33e−15 |
| 20/30 | 1000 | 5/17 | .01/−.004 | .2107129980295755 | 1.33e−15 |
| 12/25 | −2200 | −5/−12 | −.012/.002 | .4493954429803129 | 2.22e−16 |
| 50/10 | 700 | 8/28 | .007/−.003 | .10176352038157874 | 4.16e−17 |
| 20/20 | 1591.5494309189535 | 3/13 | −.005/.003 | .550693374230563 | 1.11e−16 |

Changing only the relative-angle sign in a curved/offset case changes η, while changing both Offset and Tilt signs preserves η. This verifies that the cross term is retained instead of multiplying independently calculated penalties. These benchmarks do not certify arbitrary extreme inputs or real-device performance.

## Sensitivity validity and interpretation

Sweep deltas change only WG Y or Z and corresponding Yaw or Pitch around current nominal values. Other inputs remain fixed. Absolute η is plotted, with 61-point curves and a 21×21 map. A nominal-connected acceptance interval is reported only if nominal η meets the absolute threshold. Valid crossing brackets are refined with 32 bisection iterations. Scan-edge means no threshold crossing found within that finite scan; Domain-edge reports the last passing sample before an invalid neighbor, not an exact domain limit. No infinite or manufacturing tolerance is inferred.

Invalid samples have no numeric η, are Gray in the map and include their reason in CSV. Underflow samples retain Log η and an explicit underflow flag. CSV carries axis, signed position/Port-rotation deltas in SI, η, validity, nominal input fingerprint, absolute threshold, Solver version and numerical diagnostics. Scan settings are session state; Save JSON remains unchanged schema v1 and no results are cached in the Design.

## Remaining limits

No exact rotated-plane projection, Lens Decenter/Tilt, Roll, vector polarization, Fresnel effects, finite-aperture diffraction/clipping, aberrations, physical lenses, real-device calibration or 6DoF manufacturing/remating tolerancing. P1.2 is eligible only within its stated paraxial/phase-ramp approximation. P2 and P5 remain separate future scopes.
