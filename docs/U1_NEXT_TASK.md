# Current checkpoint — S3.2 Bounded Lens Reference Design

User authorized the next development after S3.1 completion. Read
`docs/S3_2_LENS_DESIGN.md`. Branch: feature/s3-2-lens-design.
Base: S3.1 PR #14 head 7c94cb6a075946396665df805b339d572cd26084.
S2 #13 and S3.1 #14 remain unmerged. Main baseline remains
c246bb6e00242ba189a23edb3451db59dbc505f5.

Preserve one canonical Project, fixed Mode Ports, Surface/Report geometry, B1
straight Gaussian behavior, S3.1 folded reference and S2 routing search. Startup
remains Fiber–BK7 Lens–Fiber, 10 mm.

S3.2: Design Setup → Design Lenses; Existing Lenses or explicit 2-Lens Relay.
Bounded deterministic analytic seeds + local Nelder–Mead fit actual Lens front
arclength / S1 curvature / S2 curvature / thickness to a defined Gaussian Output
reference. Materials, apertures, Body radius, transverse frames, source/target
conditions, fixed Mirrors/Prisms remain unchanged. New relay Lens has explicit
BK7 / 0.5 mm Clear R / 0.6 mm Body R. Model / aperture / geometry / conservative
clearance checks gate retention and Apply. Preview is read-only; Apply one Undo.

Reference size/phase goals are not device efficiency. No global optimum or
infeasibility proof; bounded budget and cancellation are explicit. Folded Mode
Overlap / Transmission / Total Coupling remain uncalculated. No full-field,
tolerance, catalog lens or freeform optimization in this checkpoint.

Optional v1 routing.lensSolution stores reproducibility bounds and provenance;
old JSON gets no defaults. Never treat stored metadata as fresh validation.

Added S3.2 folded task uses large fixed Mirrors and PIC Output displaced 2 mm in
Z; prior examples remain unchanged. Deliver verified standalone HTML and Draft
PR stacked on S3.1, then stop for user review. Do not merge any PR or advance
automatically. User approval is required before main merge.
