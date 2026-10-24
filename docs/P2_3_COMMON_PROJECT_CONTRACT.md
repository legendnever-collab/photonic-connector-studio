# P2.3 Common Optical Project — scope and authority

Engineering editor first: ordered Surface Data, explicit local/assembly frames, optical parameters,
typed components and analytical/numerical validation are primary. Layout and report are derived
views. Preserve the existing Gaussian and sequential surface solvers; no wave/ray equivalence claim.

One versioned optical-project document, one history and one selection across workspaces. A model
discriminator preserves existing ideal-thin-lens designs as ideal, and physical prescriptions as
surface. Exactly one model is authoritative per project; derived adapters are not saved as duplicate
editable models. Physical Gaussian propagation remains a subsequent checkpoint. Unknown/unsupported
physics suppresses current results and explains why. Legacy imports preserve their model class and
do not invent lens curvature or thickness from focal length.

Building blocks reference Surface/Assembly IDs. Surfaces own curvature, aperture, medium, pose and
order. Body definitions own outer dimensions: lens outer radius, mirror outline/thickness, prism
extrusion depth, array substrate width/height, and optional source cylinder dimensions. Lens center
thickness derives from its paired vertices. Prism section derives from its three planes; extrusion
depth must be supplied. Body parameters never overwrite optical apertures. Missing mechanical
dimensions remain undefined; reporting must not infer them from MFD or aperture. Examples carry
explicit synthetic assumptions. Incompatible surfaces retain edits and expose invalid body status.

Finite supplied body boundaries constrain physical ray hits in addition to clear apertures; unknown
mount/absorption/stray paths are not traced. Body incompatibility suppresses physical results until
resolved, rather than drawing an inconsistent solid. Appearance/camera changes never retrace.

Acceptance: same project identity/selection and global Undo across views, dimension/pose fidelity,
legacy and common JSON round trips, strict schema/reference validation, no silent ideal-to-physical
conversion, mode-size/mechanical-size separation, explicit Gaussian support gates, geometric body
clipping, no stale result after invalid drafts, no camera/input remount on repeated edits, offline
report export and mobile editor usability. Deliver tested HTML and Draft PR, stop for Play Review.
