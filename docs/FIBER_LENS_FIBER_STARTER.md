# U1 Starter — Fiber → BK7 Lens → Fiber

> B1.0 update (0.4.0-b1): the coaxial physical Gaussian bridge is now implemented.
> See [current scope and verification](B1_PHYSICAL_GAUSSIAN.md). The U1 text below
> is historical where it describes all physical Gaussian results as pending.

Version: 0.3.2-u1. User feedback: first-start usability, receiving Fiber Template,
Source identity, visible 3D Fibers and a concrete two-surface BK7 Lens example.

## Default project

| Element | Definition |
|---|---|
| Input Fiber | Mode reference facet at x=0 mm; editable SMF Gaussian reference |
| S1 | Front surface at x=4.5 mm; R=+5 mm; Air → N-BK7 |
| Lens medium | SCHOTT N-BK7; wavelength-dependent Sellmeier index |
| S2 | Rear surface at x=5.5 mm; R=−5 mm; N-BK7 → Air |
| Output Fiber | Reference facet at x=10 mm; editable SMF target Mode |

S1 and S2 have the same Lens Assembly ID and finite body definition. Center
thickness is 1 mm, Clear Radius is 1 mm and body outer radius is 1.2 mm. Fiber
facet separation is 10 mm. Fiber body dimensions are editable assumptions:
125 µm diameter, 1 mm visible length. Input body extends behind its facet;
Output body extends into its receiver frame. Their dimensions are independent
of the 9.2 µm reference MFD. These are starter dimensions, not an optimized
Gaussian coupling solution.

Startup opens this example in shaded 3D. It can be reopened under Example
Projects as Fiber → BK7 Lens → Fiber · 10 mm. New Physical Project remains an
explicit blank authoring route, with an Input Fiber and an undefined Output Mode.

## Port templates and Source meaning

Both Input and Output Properties offer a Port Template selector. SMF Fiber
sets an explicit 1310 nm / MFD 9.2 µm Gaussian reference and defines the selected
Fiber body; its pose and the opposite Port Mode are preserved. A custom MFD
stays editable. Template selection and its geometry are one Undo transaction.
Old saved projects retain their unknown modes and optional body definitions.

The computational `source` in the saved schema is the Input Port reference
plane, not another component. Layout and Report call it Input Fiber / Input Port.
There is one Input Fiber body and one facet anchor at that same position.
Uniform parallel ray sampling is kept inside Ray Diagnostic · Advanced.
It is not labeled or drawn as a separate emitter or as the Fiber Mode field.
Physical Mode propagation / overlap remains the later B1 checkpoint.

## Shared geometry

Surface Layout now consumes the same finite body geometry as Report, including
both Fibers. Optional `targetBody` is backwards compatible and follows the
compiled Output Frame, including nested rotations and translation. Its extent
is on the receiving side of the reference plane. Surface / Report / saved JSON
all use the same dimensions. Mechanical body dimensions do not change the
parallel diagnostic ray bundle or become an optical aperture / coupling value.

## BK7 material identity

Optional `materialBefore` / `materialAfter` preserve named media while legacy
custom n values remain unchanged. Named N-BK7 owns its refractive index at the
Project wavelength (implemented range 300–2500 nm). Air uses n=1.
The paired Lens internal medium is shared: changing the Front exit medium also
changes the Rear incident medium, and vice versa. Explicit numeric n edits detach
the named material and select Custom n, avoiding stale BK7 labels. Inconsistent
imported named material / n pairs are rejected. No Fresnel, absorption or
thermo-optic calculation is claimed.

Reference: SCHOTT Optical Glass Collection, N-BK7 datasheet, constants B1–B3 /
C1–C3 and independent tabulated indices:
https://www.schott.com/en-gb/products/optical-glass/-/media/Project/OnEx/Products/O/optical-glass/Downloads/schott-optical-glass-collection-datasheets-english-may2019.pdf

## Validation

- 199 Model / Physics / Schema / Font tests passed.
- All 58 Desktop browser cases passed, including Input-selected first-row
  insertion, Output template, material edits and shared Layout / Report bodies.
  Final caption-only cleanup is covered again by the packaged Starter smoke suite.
- Independent SCHOTT index table comparisons, wavelength update, named/custom
  medium transitions, coupled S1/S2 media, 10 mm pose, rotated receiving body,
  geometry/ray independence, old-file and new-project roundtrip checks pass.
- The final Source commit and standalone HTML SHA256 are recorded in
  `artifacts/build-info-u1.json` / `artifacts/SHA256SUMS-u1.txt`.

Keep PR #10 in Draft pending user Play Review. No main merge or automatic F1.1.
