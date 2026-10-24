# Current checkpoint — F1.1 Conic / Even Asphere

Read `docs/F1_1_CONIC_ASPHERIC.md` and preserve the merged B1 Gaussian bridge plus
10 mm Fiber–BK7 Lens–Fiber starter. The user authorized the next development after
merging PR #10 (main `a154dd359fa4946583e61e97cd6f7165ba1e86cf`).

Branch: `feature/f1-1-conic-aspheric`. PC first. Keep the new PR Draft for user
Play Review; no automatic main merge or next feature. Exact source/HTML identity
is in `artifacts/build-info-u1.json` / `artifacts/SHA256SUMS-u1.txt`.

New type `even-asphere` uses Conic K and SI A4/A6/A8, edited in mm-based units.
Shared evaluator: `src/surface/evaluator.ts`; bounded nearest-root search:
`src/surface/asphereIntersection.ts`. Keep finite-disk and numerical-failure
semantics, full-radius body thickness check, the existing IDs/frames, one Project,
SaveLoad, Undo and templates. Old files do not gain new optional fields.

Nonzero K/A terms show a Gaussian vertex-curvature reference and no Mode Overlap.
Higher-order Field transport, XY/Control Point/CAD Freeform, coupled-axis beams,
Fresnel/Transmission and Total Coupling remain separate future checkpoints.
Do not fit imported/confined fields to a Gaussian or treat Ray reach as efficiency.
Alignment ΔPose remains a saved, unapplied draft. Do not begin another checkpoint
until the user reviews this one.
