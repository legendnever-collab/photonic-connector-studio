# Linked 3D Report details · v0.9.1-report

User scope: overview with marked regions linked to enlarged 3D Lens / Prism
views; real curved faces, thickness, prism body, propagated paths, physical
dimensions / spacing and Beam size. Desktop first. No change to physics or
Project schema. Built on S3.2 cb94e372905719a0cd59ea5402eff6160cca647f.

Report defaults to D · Detail Insets. B and C are retained. Lens / Prism leaf
assemblies use the same clipped caps and defined body mesh as the overview.
Nearby world AABBs group transitively (8% of larger diagonal); this grouping
only controls presentation, never optical / clearance calculations. Up to two
regions per sheet; page controls reach every region and exports include the
current sheet with its page number. Camera orbit is shared by overview and
insets. Insets fit the region with 22% padding, no modified physical geometry.
A single region gets a larger card. The displayed zoom is relative to overview.

Dimension leaders show supplied Lens Body diameter and vertex thickness, or
Prism extrusion depth. Numeric rows include signed R1/R2, clear diameter and
adjacent prescription vertex distances in world 3D (not air path length or
minimum mechanical clearance). Undefined bodies stay explicit; Ideal Thin
Lens Projects do not acquire a physical detail solid. Nearby grouped regions
retain all geometry and dimension leaders; compact numeric summaries may
truncate long grouped component names / extra entries.

Gold = existing geometric sample bundles, with arrows on one actual reached
sample (or a blocked sample if none reached). Teal = available validated B1 or
S3.1 Gaussian 1/e² reference. Exact solver samples, local axes, ellipse principal
radii and world frame are reused; no Beam enlargement. Oblique projection uses
ellipse support perpendicular to each projected segment. Before/after refracting
snapshots are never joined across zero distance. No inferred Beam for invalid,
unsupported or unapplied numerical input. Aperture-limited folded data stays an
untruncated reference, labelled explicitly; no delivered power / PIC coupling.
Existing Ideal Gaussian envelope is retained.

Report gains vertical room without changing saved panel layout; floated design
windows and the Inspector remain available. Expand Report opens a large modal.
Instance-unique SVG IDs prevent the modal's camera / inset references from
resolving the background Report. Both SVG and 3200×2000 PNG contain overview,
region boxes, links, 3D detail, dimensions and annotations, without external
assets. Display-only state never enters Project JSON or Undo history.

Validation: typecheck / full model suite; packaged offline browser tests cover
shared data, Lens edits + Undo, Prism/TIR geometry, invalid Mode suppression,
expanded modal + focus return, complete SVG/PNG and laptop export controls.
Deliver standalone HTML and a Draft PR stacked on S3.2; stop for review. Do not
merge the dependency stack without the user's explicit merge instruction.

## v0.9.2-report · Prism visibility correction

At large crop zoom the previous shared scene also magnified ray stroke widths
and SVG marker heads. Those annotations covered tiny Prism bodies, most
noticeably on Mirror + TIR Prism routes. Keep the actual geometry and envelope
fills, but use non-scaling pen strokes. Rebuild direction glyphs separately for
each view, capped at 5 Report paper units, and suppress heads on tiny internal
segments. No marker is cloned into enlarged insets. Exact traced positions,
physical dimensions, Beam radii and Project JSON remain unchanged. Tests cover
17× / 128× glyph sizes, a >10× Prism crop, SVG and existing PNG exports.

Next-development feedback is recorded in DESIGN_WORKFLOW_FEEDBACK.md. Await
user answers about locks, allowed combinations and selection criteria; no
broader optimization implementation or Example expansion is part of this fix.
