# S0 / S1 — Port conditions and folded geometric routing

Version: 0.6.0-s0-s1. This checkpoint follows the user's approved Port-to-Port
solution-synthesis direction. F1.1 remains in Draft PR #11; this work is on
`feature/s0-s1-port-routing`, stacked on that source, with no main merge.

## User workflow

1. Open **Design Setup** in the top toolbar. It restores the inspector if closed.
2. Select **Routing Example**: Lens + 2 Mirrors or Lens + TIR Prism.
   Unsaved Project replacement retains the existing Save / Discard / Keep guard.
3. Edit Global Input / Output XYZ in µm. Euler angles are degrees; internal units
   are m/rad. +X of each Port is the outgoing / desired incoming propagation
   direction, not an outward mechanical facet normal. Local Y/Z are transverse.
   Axis presets retain the transverse Roll. World Euler display is the canonical
   Rz Ry Rx decomposition (pitch ±90°); at a pole equivalent Roll is encoded in Yaw.
4. Inspect Position error / Incidence error, or switch to Analysis for the same
   diagnostic and geometric termination. Surface / Gaussian / Report keep one Project.
5. **Focus Folds** fits only defined Mirror / Prism bodies in equal-scale XZ.
   **Fit** restores the whole scene. These camera operations do not change the Project.
6. Save Project JSON preserves conditions and components; Undo / Redo applies to
   committed position, device and constraint edits.

The initial Fiber–BK7 Lens–Fiber starter remains unchanged in geometry and reference
values, including 10 mm facet separation. S0/S1 examples are additional manual
prescriptions, not optimizer outputs or commercially available component claims.

## Canonical model and compatibility

Existing schemaVersion 1 retains optional `routing` and optional Port `device`.
Old JSON does not gain defaults when parsed/serialized. `routing` records version,
positionTolerance [m], angleTolerance [rad], optional Design Space box, zero to eight
Keep-out boxes and integer lens/mirror/prism limits. Box coordinates are global SI;
minimum must be strictly below maximum on every axis. Defaults: 1 µm / 0.1°,
2 Lens / 2 Mirror / 1 Prism, no bounded space or Keep-out.

Input Pose is the existing prescription Source frame. Output Pose remains the
existing last probe Surface composed through its Assembly hierarchy. Global edits
transform back into that Surface's parent frame; no second editable Port Pose is
stored. Assembly membership, unrelated Surfaces and IDs remain intact.

Device classifications are Fiber / PIC Edge Coupler / PIC Grating Coupler / Custom.
Selecting PIC removes the Fiber body and SMF preset, retaining an explicitly labeled
user Gaussian reference. It supplies neither a measured Mode nor a receiving
radiation field. Selecting SMF applies the established 1310 nm / 9.2 µm nominal
reference. The legacy coaxial physical Gaussian bridge withholds PIC overlap even
for straight paths. Folded propagation remains outside that bridge altogether.

## Geometric diagnostic

`src/routing/analysis.ts` traces a separate center ray from Input origin along its
local +X through the existing **explicit Surface row order**, with the same physical
intersection / reflection / Snell / TIR kernel and finite body gate. It does not
sort by global X, pick a pupil-grid sample, or derive rays from the MFD.

- Position error = hypot(Output-local hit Y, hit Z).
- Incidence error = atan2(hypot(local direction Y,Z), local direction X), range 0..π.
  A ray that reaches the plane from the wrong side has a 180° mismatch.
- OPL = sum of refractive index × actual segment length.
- Within geometric tolerances requires position and angle tolerances plus no
  reported constraint issue. It is not an optical-coupling feasibility certificate.
- Blocked rays retain the kernel's clipping / medium / missed / TIR reason;
  no hit/error is invented by extrapolating across a failed sequence.
- Invalid body / curved or repeated Output / multichannel Input are explicitly
  unavailable. Source Port and diagnostic medium must agree. An Output medium
  mismatch is a constraint issue and cannot pass the tolerance status.
- ID `port-routing-diagnostic/1.0.0`; kernel `surface-sequential-3d/3.0.0`.
  Result carries the current Project fingerprint. Unapplied numeric drafts hide metrics.

Part limits count instantiated lens/mirror/prism Assemblies with non-Output Surfaces.
Design Space checks the **sampled body/aperture envelope** for optical components,
excluding fixed Input/Output Port bodies. It is not a certified continuum bound for
arbitrary Asphere extrema. Keep-out uses conservative component AABB intersection,
reported as **potential**, not confirmed collision. Full solid collision, component
clearance and free-space segment obstruction are not calculated. Space constraints
do not alter ray physics or silently move a component.

## Reproducible manual examples

Both use λ=1310 nm, an SMF reference at (0,0,−10 µm), a BK7 Lens with front vertex
(1500,0,−10 µm), R=+5/−5 mm, 500 µm center thickness, 150 µm Clear Radius and
200 µm Outer Radius. The parallel diagnostic bundle radius is 5 µm with 13 samples.

**Two Mirrors / Edge Coupler:** M1 at (4000,0,−10 µm), M2 at (4000,0,50 µm),
each pitched +45°: +X → +Z → +X. Output at (10000,0,50 µm), desired direction +X.
Mirror Clear Radius 30 µm, body diameter 65 µm and thickness 5 µm.
Chief geometrical length = 10 mm + 60 µm; OPL adds (nBK7−1)×0.5 mm.

**TIR Prism / Grating Coupler:** Prism Assembly at (4000,0,−10 µm), Roll +90°.
Local Entry (0,0), TIR (40,0) µm at Yaw −45°, Exit (40,40) µm at Yaw +90°.
BK7 at the current wavelength, exterior n=1, depth 60 µm. Global output direction
+Z; Output at (4040,0,50 µm). Chief geometrical length = 4.04 mm + 60 µm;
OPL adds (nBK7−1)×(0.5 mm + 80 µm). Output direction is a synthetic reference,
not a generic grating's required incidence angle.

## Validation and acceptance

19 new model tests cover exact height/direction/independent OPL for both examples,
finite-body bundle reach, reference-ray sampling/MFD independence, nested parent
world-edit invariance, all six axis presets, independent 3–4–5 µm displacement,
1°/180° incidence, arbitrary rigid-frame covariance, blocked/clipped/TIR/medium
termination, constraint statuses, schema failures, old/new JSON and PIC physics gates.

Five packaged desktop browser workflows cover example loading and focus, linked
numeric edits / focus / Undo / SaveLoad, Report body and SVG metadata, unsupported
Gaussian coupling, constraints and draft recovery, closed-window restoration,
device switching, and 1366×768 / 1440×1000 horizontal layout. Existing mobile tests
remain regression coverage; new desktop workflows intentionally skip mobile.

Manual Play Review: open Mirror example, change Output Y from 0 to 3 µm and Z from
50 to 54 µm. Error must become 5 µm while optics remain fixed. Undo both edits,
then verify Prism +Z example, Report and SaveLoad.

## Next checkpoint boundary

S2 will enumerate bounded topology templates and optimize component poses. S3 adds
supported local Beam / Mode matching, followed by S4 Field / Coupling and tolerances.
No Auto Solve, global optimum claim, reflected Gaussian transport, PIC receiving
Field, Fresnel / coating / absorption, or Total Coupling is implemented here.
Stop for user Play Review. Do not merge PR #11 or this checkpoint automatically.


## Delivered build identity

Implementation source: `87a358a856a23fae9da85468b2039f1ed61c2a6e`.
Standalone HTML: `photonic-connector-studio-u1.html`, 604,769 bytes.
SHA256: `9dc11076c265fb379fc3ef94d337a690f0591bb1fdee46546c414b048d026320`.
Source fingerprint: `6e8443e5c938dce666b294f6c8de194086091aab80b5c63723a532488a92653d`.
See `artifacts/build-info-u1.json` / `artifacts/SHA256SUMS-u1.txt`.
Subsequent provenance-only commits do not change the delivered HTML; CI uses
its PR head as the build source label and must reproduce the HTML SHA and fingerprint.
