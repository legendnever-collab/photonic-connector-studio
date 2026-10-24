# P2.3 Common Optical Project

## Engineering-first architecture

The Surface Data Editor, ordered physical prescription and explicit coordinate frames remain the
engineering authority. Reports consume shared geometry and computed results. This checkpoint does
not claim Zemax/CODE V/Ansys/COMSOL feature parity, file compatibility or a new EM solver.

A strict versioned `optical-project` schema stores exactly one authoritative model: preserved ideal
Gaussian components, or a physical Surface prescription with Source/Target modes. Adapters derive
editor views; two independently editable copies are never saved. A shared React store provides one
bounded Undo/Redo history, selection, dirty state and transactional project import/export. View
cameras remain separate. Locked ideal components and ports retain their restrictions in the Surface
adapter and Mode fields; undefined reference-plane sizes are display markers, not clear apertures. Numerical input failures suppress current results.

## Building blocks / geometry

- Surfaces own radius, circular clear aperture, n, local frame and sequence. Assemblies own parent
  transforms and pivot. Source/Target MFD are independent of body size and ray sampling radius.
- Lens body: supplied outer radius, actual paired surface separation for center thickness, exact
  spherical-sag outer rim/annulus. Invalid edge thickness or non-coaxial pairs are explicit.
- Mirror body: supplied disc diameter or rectangle width/height and thickness.
- Prism: profile follows its three optical side planes; extrusion depth is supplied. Report patches
  are clipped to this finite solid. No extrusion depth is inferred from the aperture.
- MLA: supplied substrate width/height, lenslet rows/columns/pitch/curvatures from Surface definitions.
  The finite substrate must cover all defined clear apertures. Center thickness comes from vertices.
- Source body: optional cylinder dimensions, repeated at the actual channel pitch; no inference from
  MFD. It is a mechanical representation, not a traced upstream fiber propagation model.
- Missing dimensions remain undefined on legacy import. The example bodies are explicit synthetic
  assumptions. Incompatible body definitions suppress physical results until corrected or undefined.

The ray tracer has an optional finite-boundary predicate. Mirror/prism hits must satisfy both the
existing circular aperture and supplied body boundary. Blocked paths retain cause and last segment.
Reporting uses the same boundaries to trim visible optical patches. This is prescribed sequential
intersection, not general non-sequential solid traversal / stray light / mount collision checking.

## Gaussian connection boundary

Ideal models keep the existing validated solver and benchmarks. Their Surface view is an editable
position/aperture reference; shape/material controls and physical insertion are unavailable. It does
not manufacture R/thickness from focal length. Reports can show the validated ideal Gaussian 1/e²
beam envelope, separately labeled from geometric sample bundles.

Physical models share Source/Target modes and body parameters with Gaussian Workspace, but display
`Not calculated` for Gaussian propagation/coupling. Its layout is explicitly a geometric reference.
Physical lens matrices, local-frame folded Gaussian propagation, aberrations and channel coupling
remain subsequent physics checkpoints. The legacy solver source is unchanged.

## Performance / persistence

The shared store caches the physical trace independently of mode and report settings. Camera,
shading and report-quality changes do not retrace. Modes do not change physical sampling or body
size. Save stores inputs only; current results are recomputed. Legacy Gaussian and Surface JSON
imports preserve model class, with no inferred solids on legacy Surface import. Unknown keys,
references, bad schemas and files over 2 MB are rejected without replacing the current document.

## Verification

164 Unit / Numerical / Font checks pass (147 existing + 17 common-project cases). TypeScript and build pass. Full Browser suite: 80 PASS / 2 existing intentional Mobile SKIP. The 12 new desktop/mobile cases cover common project integration; legacy numerical/interaction assertions remain. Delivery fingerprints are recorded with the artifact. Unit tests include
model-class round trips, exact aperture diameter conversion, shared frames, modes vs mechanics,
finite mirror/prism clipping, nested rigid transformations, invalid lens/array bodies, report patch
clipping and repeated source bodies. Browser tests cover both workspace directions, global history,
selection, shared mode editing, report metadata, legacy imports, invalid drafts, offline export and
320–1920 px layouts. Existing numerical and interaction regression is preserved.

## Review / stop

Branch `feature/p2-3-common-project`, stacked on unmerged P2.2 / PR #6. No main merge and no automatic
physical Gaussian propagation implementation. Review: open a Gaussian synthetic example, change its
Assembly X in Surface Workbench and return; load the physical compound example, edit Mirror outline
or Prism depth, inspect Report, then switch to Gaussian Workspace and verify same project/modes.
