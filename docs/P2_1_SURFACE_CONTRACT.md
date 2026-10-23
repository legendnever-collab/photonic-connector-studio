# P2.1 Surface Workbench — implementation contract

User-authorized Surface-first development. Branch `feature/p2-1-surface-workbench`, stacked on unmerged PR #4 / head 4c1883adcdb171b77a644ffc5a6a2d5cd0706e30. Preserve P1 Gaussian solver/schema and prior artifacts. No automatic merge or P2.2/P3 start.

## Scope and canonical state

Separate versioned `surface-prescription` JSON, schemaVersion 1, SI units. Physical Surface sequence, independent ordered Assembly frames, Source frame and rays. Frame convention local normal +X, transverse u=+Y/v=+Z, Rz(yaw) Ry(pitch) Rx(roll). All geometry/trace use full 3D world coordinates; no monotonic world-X requirement. Assembly transforms act on all child surfaces; a surface-local transform provides relative fabrication offsets. Arrays repeat analytic surfaces with stable cell indices, shared pitch/count and common body frame. Geometry and trace consume the same compiled surfaces; rendering never calculates a second optical path.

P2.1 shapes: plane, signed-radius sphere (vertex cap only), optional rectangular lenslet repetition. Refraction/ideal reflection/explicit TIR/probe interactions. Constant supplied refractive index at the stated wavelength; no glass catalog or dispersion claim. Source: sampled geometrical parallel pencil/bundle, uniform disk samples; not a Gaussian power distribution. Rays have explicit current n and accumulated OPL. Every physical boundary validates incident n against the sequential prescription. Refraction uses transmitted branch only; no Fresnel/absorption/coating throughput or waveguide η. Explicit TIR has its own outsideIndex and requires critical-angle condition; failed TIR terminates. Refraction encountering TIR terminates rather than silently changing the surface sequence. No non-sequential ray branching or automatic face selection beyond a repeated lenslet surface.

Sphere: local x=sag(u,v)=R-sign(R)*sqrt(R²-u²-v²); stable sag=r²/(R+sign(R)*sqrt(R²-r²)). At intersections choose smallest positive t satisfying the vertex-cap domain; reject far hemisphere. Aperture clipping and missed/behind/parallel surfaces terminate rays with their last traced segment and cause. Tangent/grazing and critical-angle numeric tolerances are explicit; no guessing a ray onto a surface. Sphere clear radius must be < |R|. Array cells cannot overlap; lenslet assignment occurs at the local vertex plane and is fixed while intersecting its sphere, with local clear aperture tested at the actual hit. Cell traversal outside that selected cell's aperture is blocked; general neighbor search/non-sequential lenslet hopping is outside this checkpoint.

Rigid-body origin is a user-defined pivot. Euler angles use radians in JSON/degrees in UI, positions m/mm. Global path distances and OPL use actual Euclidean intersection distances. Selection, input focus and camera remain stable during edits. Invalid drafts suppress current rays/stats until restored. Undo/Redo and JSON store inputs only; imports are size/schema bounded and transactional.

## Workstation

Surface table/inspector, selected Surface highlight and local normal, XY/XZ/YZ projected wireframe, optional 3D Wireframe or shaded Presentation from the same vertices and computed ray points. User orbit/zoom and SVG export; no generated bitmap used for physical geometry. Display sampled-ray reached/blocked counts, target geometric centroid/RMS radius and OPL with scope labels. A target footprint is a sampled geometric point cloud, not an EM field map. Source/target optical modes and η remain in preserved P1 workspace.

Examples: physical bi-convex lens; folded mirror; right-angle prism with entrance/TIR/exit; microlens array; combined MLA + Prism + Mirror assembly. Synthetic dimensions/n only, not measured components. Array demo is geometric architecture validation, not P6 crosstalk/yield.

## Acceptance gates / stop

Independent Snell angle, mirror double-angle response, parallel slab displacement/OPL, critical-angle sides, spherical paraxial focus from lensmaker equation, cap/edge/aperture checks, rigid-transform covariance, shared-body pivot, multi-cell indexing, folded/compound path, model rejection/JSON invariance. Browser input/selection/camera stability; invalid draft handling; save/load/undo; 3D/view switch preserves model; mobile editor exit; offline export and actual screenshots. Run P1 regression. Deliver standalone HTML + fingerprint/hash + Draft PR. Stop for Play Review.

Full aspheres, Sellmeier/catalog fitting, Fresnel/coating/polarization, arbitrary imported CAD, non-sequential/stray paths and wave propagation remain later checkpoints. Do not claim Zemax/CODE V parity or proprietary-file compatibility.
