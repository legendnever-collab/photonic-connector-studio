# Photonic Connector Studio — P0 First Implementation Work Order

**Status:** READY FOR EXECUTION; NOT STARTED
**Recommended execution:** GPT-6 Work, High for initial audit/architecture, Medium for incremental UI implementation
**Repository:** https://github.com/legendnever-collab/photonic-connector-studio
**Existing branch:** `feature/p0-foundation`
**Existing Draft PR:** #1
**Mission:** First Playable Optical Workspace. No numerical Optical Coupling solver yet.
**Stop:** After one verified P0 playable checkpoint; NO main merge and NO P1.

## 0. Recovery / source audit FIRST
1. Inspect main HEAD, `feature/p0-foundation` HEAD, Draft PR #1, existing files, GitHub CI and any local uncommitted changes.
2. Read `docs/DEVELOPMENT_ROADMAP_V1.md`, `docs/WORKFLOW_AND_MODEL_POLICY.md`, `docs/MASTER_PLAN.md`, `docs/PHYSICS_CONTRACT.md`, `docs/UI_DESIGN.md`, `docs/CHECKPOINTS.md`.
3. Preserve every existing document. Do not recreate repository or replace previous checkpoint.
4. Report the recovery baseline briefly; continue work in existing PR.

## 1. P0 implementation scope
Use React + TypeScript + Vite to implement an original engineering-style desktop-first responsive UI:
- Top File/Design/View controls (do not expose inert operational buttons).
- Component Tree with nondeletable Fiber Port (left) and WG Port (right) and optional thin-lens/free-space components as schematic geometry.
- Single optical system state: selected component, position, orientation, port mode representation and wavelength, component status, mating reference plane, enabled flags.
- Middle 2D Optical Layout with selectable XY/XZ projection, unit-labelled geometry, fit/zoom/pan. Distinguish schematic paths from actual computed optical rays or Gaussian Beam.
- Component Properties / Data Editor: positions, MFDx/MFDy (can remain TBD/null), lens parameters if included, units and validation errors. Editing either table/tree updates same geometry without flicker.
- Add/remove/reorder middle components; preserve port endpoints, distinguish absolute position from optical order.
- Save/Load versioned JSON with round-trip schema validation and a clearly labeled 1310 nm example using illustrative assumptions only.
- Basic Undo/Redo for optical editor state if feasible; implement or document as explicit P0 checkpoint gap.
- Provide short help text in Korean; technical terms in English.

## 2. Architecture boundaries
- Typed domain model and schema validation independent of UI.
- SI unit storage and unit-display converters; explicit world +X and component local frames (Right-handed).
- Waveguide represented as accepted guided-mode Optical Port with position/orientation/MFDx/MFDy or future imported E/H data reference; no full waveguide routing.
- Solver interface and `unavailable` analysis state only. NO fake IL / Mode Overlap / Spot plot and NO claim of ray tracing.
- Basic component geometry may be diagrammatic and must say so.
- Keep room for future lens surfaces, reference planes, 6DoF errors and complex mode field; do not over-engineer or install DeepLens/Python/LLM Agent/GPU.

## 3. Validation and deliverables
- Build, typecheck, test. Include deterministic tests for schema, unit conversion, Save/Load, nondeletable Ports, stable selection/updates and malformed input.
- Browser test at desktop and mobile widths; confirm no flicker under repeated Property edits.
- Provide a playable Preview or testable Offline HTML with exact launch directions and known limitations. Do not claim offline works unless verified.
- Report full commit SHA, branch, existing PR #1 link, tests run/pass/fail, screenshot/visual check evidence, source/artifact version parity.
- Small commits; no base64 image/blob loops, no unnecessary generated assets.
- Keep Draft PR #1; do not merge to main and do not proceed to P1.

## 4. Review script for user
- Load 1310 nm SMF → WG Port example; see Fiber left/WG right.
- Add an optional component, select and move; diagram changes immediately without flicker.
- Edit WG MFDx/MFDy and Port coordinates; design data updates, no fabricated coupling output.
- Save JSON, reload and confirm state restored.
- Test desktop and mobile layout and undo/redo if implemented.

## 5. Implementation rules
Recovery-First · Physics-Contract-First · Source-First · Validation-First · Atomic Commits · Play-Review-Gated.
Never alter main or release a finalized physics metric without corresponding verified solver implementation.
