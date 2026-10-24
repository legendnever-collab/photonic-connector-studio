# U1 — Mode-Port Authoring contract

Baseline: merged P2.4 main `1b4e8f9b483d8c7b3e625839e05247e75d61a9d9`.
User priority (2026-10-24 KST): general PC design workflow; mobile receives regression maintenance only.

## SMF default update — user instruction, 2026-10-24

Startup and New Physical Project now use an editable SMF Fiber Gaussian reference:
1310 nm, circular MFD 9.2 µm, flat phase / waist at the Fiber Facet, unit-power
normalization and an outgoing homogeneous plane in air. This is a nominal design
approximation, not a measured eigenmode or a solved facet interface. Polarization
and actual launch power remain unspecified. Output Reference Mode remains undefined.
The independent geometric diagnostic source uses air n=1 and retains its own bundle
radius / uniform parallel sampling; it is not generated from this Mode.

The MFD reference is grounded in Corning SMF-28 Ultra PI-1424-AEN (nominal 9.2 µm
at 1310 nm):
https://www.corning.com/content/dam/corning/media/worldwide/coc/documents/Fiber/product-information-sheets/PI-1424-AEN.pdf

Changing MFD or wavelength marks the SMF-derived input Custom; the code does not
invent wavelength dispersion or Fresnel loss. Apply SMF 1310 Reference explicitly
resets the input reference in one history transaction without moving Ports or
defining the Output Mode. Existing JSON and examples are not retroactively filled.
The optional Port preset tag records the reference's origin; active MFD and
wavelength retain one authoritative location. Legacy Ideal startup remains
available at #ideal for regression / legacy workflow access.

## Authoritative state and migration

The existing optical-project schemaVersion 1 remains readable. An optional, strict
`authoring.version=1` extension stores Port Field metadata, template signatures and
Alignment references. Loading old JSON does not invent Phase, Power, Material,
Mode, physical curvature or thickness. Legacy byte/value roundtrip is retained.
Mode MFD and polarization remain in the existing authoritative model; Port pose
is the source frame or the final compiled Reference Surface frame. Wavelength
is the existing Project wavelength. None of these values are duplicated in the
extension. A legacy Ideal design explicitly remains the legacy Scalar / Paraxial
Gaussian model. Unsupported imported / confined / non-air Port contracts suppress
that Gaussian result rather than evaluating the old MFD under another label.

Physical media may now be null. This is an explicit unresolved Draft, accepted by
save/load and displayed as TBD. The sequential evaluator returns no Ray paths or
power results until all required indices are defined. No constant medium is
silently substituted for a manually inserted Draft Surface. Catalog templates
have explicitly synthetic dimensions and n values shown in Preview.

Every element has an unambiguous derived Model Class: Ideal reference, Physical,
or Draft. **Mixed Ideal / Physical projects are not auto-converted.** A future
migration must use a discriminated Model Class per element, preserve IDs and
world poses, keep f-only Ideal elements without fabricated radii/thickness, and
leave unsupported bridges explicitly uncomputed. User review of that migration
precedes implementation; U1 does not enable mixed-model solvers.

## Modes and results

Input / Output Port metadata: Gaussian or imported-complex intent, Port-local YZ
Reference Plane (+X propagation normal), Phase convention, normalization,
optional absolute Power and homogeneous medium, and propagation Adapter intent.
Original complex grid schema retains coordinates, SI sampling intervals, origin,
real/imaginary arrays and normalization provenance; importer UI and Gaussian Fit
are F2 work. Missing imported arrays remain missing; an Intensity drawing is not
converted into Phase or a complex Field. Strongly confined near fields are
explicitly tagged as requiring an EM / Near-to-Far Adapter.

Incident Field and Output Reference Mode are separate UI slots. Transmission,
Mode Overlap and Total Coupling each say Not calculated for the Physical Mode
Bridge; geometric ray counts remain diagnostics. Existing legacy Gaussian
results are labeled separately. U1 does not claim a transmitted-power ledger,
vector overlap, F1.1 Aspheric evaluation, B1 propagation, or sampled-field solver.

Project fingerprints include Mode and contract edits. Synchronous supported
legacy solvers retain valid/invalid/out-of-domain states; no fake calculating
state is added for a solver which has not been implemented. View, Theme and
Dock/Float changes do not modify Project inputs or rerun Field propagation.

Alignment stores moving Port / Assembly ID, a world Reference Pose snapshot,
Reference-local six-DOF delta (SI / radians), Reference-origin pivot and explicit
`applied=false`. This is authoring state; B1 must validate application and
sensitivities. Capturing nested Assembly poses resolves their parent chain.

## Two entry paths, one model

Catalog insertion and manual Surface Data edit the same prescription, body
geometry, selection, Project save/load and history. Lens templates add Front /
Back / Medium / thickness; Prism templates add Entry / TIR / Exit / Body.
Insertion is one history transaction. Existing Port and component world poses
are preserved; no implicit downstream move or X-sort is performed.

Surface rows support Insert Before / After, Duplicate, Delete, native text
editing, editor-scoped Insert / Delete / Ctrl+D, and row context menus. The final
Output Reference Plane cannot be deleted or moved through row commands.
Consecutive non-Port rows can be grouped as a Lens or Assembly while preserving
world frames, including nested folded geometry. Curvature, Type, action, n and
Clear Aperture edit the existing Surface evaluator. Decenter/Tilt remain in
Properties. Conic is shown read-only as the Sphere / Plane limit; F1.1 is pending.
Catalog signatures detect subsequent geometry edits and show Custom status.
Leaf Components can be saved as User Building Blocks, retained in Project JSON,
and inserted again through the same numeric Pose dialog. Nested Assemblies remain
explicit Project hierarchies; this first user catalog stores leaf components.

Paired, coaxial Lens thickness moves only the Rear Surface along the Front local
normal, keeping Front as anchor. General gaps are derived 3D vertex distances;
they are not independently stored alongside Global XYZ. Off-axis spacing
constraints and downstream translations require a later explicit command.

## Workstation session

Desktop: Explorer / visual Layout + resizable Surface Data / Properties +
Analysis. Project, Catalog and Example Projects are separated Explorer trees.
Catalog double-click uses the stated suggested numeric pose; drag displays an
insertion marker and opens the numeric Global Pose preview. A canvas drop is
never interpreted as a precise 3D position. Port controls remain accessible
from every View. Uncommitted edits prompt Keep Editing, Save & Open or Discard &
Open before a replacement. Undo retains the prior project.

Surface Data and Properties / Analysis can Dock, Float, move, resize, close and
restore within the same app. They keep one mounted subtree, Project store,
selection and history. Session layout uses separate, optional localStorage;
window closure does not delete optical data. External browser pop-out is not
part of U1. Mobile keeps the existing Canvas / Surfaces / Inspect / Analysis
switcher, without desktop floating-window complexity.

## Design references (verified for direction, not our implementation)

- Ansys Lens Data Editor / row-entry workflow:
  https://optics.ansys.com/hc/en-us/articles/42661252179987-How-to-design-a-singlet-lens-Part-1-Setup
- LightTrans optical setup / linked editor / component tree and drag-and-drop:
  https://www.lighttrans.com/fileadmin/shared/UseCases/Feature_UC_Introduction%20to%20the%20Optical%20Setup.pdf

These references do not establish our solver validity. No current-version CODE V
shortcut equivalence is claimed.
