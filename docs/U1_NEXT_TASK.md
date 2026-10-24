# Current checkpoint — B1.0 Physical Gaussian Bridge

Read `docs/B1_PHYSICAL_GAUSSIAN.md` and `docs/FIBER_LENS_FIBER_STARTER.md`.
The user authorized the next Gaussian / Surface development checkpoint after
reviewing the previous shared-geometry behavior. B1.0 now propagates the same
coaxial sphere/plane prescription and reports normalized conditional overlap.
The 10 mm Fiber–BK7 Lens–Fiber starter and both editable Fiber templates remain.

PR #10 stays Draft: https://github.com/legendnever-collab/photonic-connector-studio/pull/10
PC first. No main merge before user Play Review. Do not automatically begin the
next feature. Exact verified source is recorded in `artifacts/build-info-u1.json`.

Resume from the current remote branch `feature/u1-mode-port-authoring`; preserve
one canonical Surface prescription, Port contract, saved JSON and Undo history.
`src/project/physicalGaussian.ts` handles B1.0, while the old Ideal solver remains
separate. Do not infer Transmission or Total Coupling from normalized overlap or
geometric Ray counts. Do not bypass explicit field eligibility gates.

F1.1 Conic / Aspheric and broader Field/Folded work are subsequent scoped tasks.
Imported/confined fields still require a real adapter. Alignment ΔPose remains a
saved Draft (`applied=false`); the actual Port/Assembly Pose controls propagation.
Review B1 before choosing the next checkpoint.
