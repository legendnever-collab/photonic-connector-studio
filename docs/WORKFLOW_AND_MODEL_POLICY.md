# Work Strategy, Model Allocation & Engineering Quality Gates

**Revision:** 1.0 (2026-10-23)
**Scope:** Workflow and model choice guidance; model labels/access vary by user plan and tool availability.

## Model allocation
- Architecture / interfaces / risk review: **GPT-6 High in Work** (use highest reasoning level practical, if enabled). Focus on Physics Contract and long-lived component/solver API.
- UI components / React state / tests / refactor / documentation: **GPT-6 Medium in Work** for iterative, token-efficient checkpoints.
- Difficult scientific design audits (scalar-wave diffraction, vector electromagnetic overlap, ray–wave bridging, numerical stability): **GPT-6 High/Extra High** or **Astra Pro when available** for an independent review, not as a dependency for all tasks.
- "Sol" / "Astra" are legacy or alternate product labels: prefer effort/quality goals over relying on exact availability. An alternative model must follow the same repo contracts and checkpoint rules.
- Do not ask an AI to claim results that were not reproduced by tests; passing numerical regression gates matters more than model identity.

## Work execution cadence
1. **Recovery audit:** read repository, relevant docs, previous PR, current branch, HEAD and tests. Identify baseline. Never restart completed code.
2. **Scope lock:** one small checkpoint, concrete acceptance tests, allowed files/dependencies, explicit stop condition.
3. **Physics and units review:** reference planes, normalizations, field validity, input constraints and expected analytical baselines.
4. **Implement atomically:** small commits, source-first; no oversized inline base64 images or repeated blob upload. Keep repository assets lightweight; do not transfer binaries as giant text blobs.
5. **Verification:** compile/typecheck, deterministic unit and numerical regression, browser interaction/E2E, screenshot inspection at common desktop/mobile widths; report failures honestly.
6. **Playable artifact:** working preview URL when available, release asset, or documented offline HTML artifact with tested limitations. Source/artifact parity and SHA256 when a distributed artifact is provided.
7. **Checkpoint review:** report branch, full commit SHA, PR URL, changed files, test counts, residual risks and exact user checks.
8. **Stop:** no main merge or next milestone until explicit Play Review approval.

## P0 mandatory UX behavior
- Port tree and data editor are bidirectionally synchronized.
- Left Fiber and Right Waveguide are nondeletable terminal reference ports in the baseline optical train.
- Editing location or MFD updates design state and geometric schematic; not an invented coupling number.
- MFD TBD / import missing yields "Not calculated", not a default value silently masquerading as user-provided.
- Save→Reload yields schema-valid identical optical train. Undo→Redo restores previous state.
- Repeated edits do not flicker/remount the 2D canvas.
- No decorative dead buttons: hide or disable unimplemented actions clearly.

## Validation matrix
| Gate | P0 | P1 | P2 | P3 | P4 | P5 | P6 |
|---|---|---|---|---|---|---|---|
| Type / schema / build | required | required | required | required | required | required | required |
| Browser interaction / visual review | required | required | required | required | required | required | required |
| Analytical Gaussian / mode references | n/a | required | regression | regression | regression | regression | regression |
| Ray tracing analytical parity | n/a | n/a | required | regression | regression | regression | regression |
| Wave power / grid convergence | n/a | n/a | n/a | required | regression | regression | regression |
| Optimization constraint recovery | n/a | n/a | n/a | n/a | required | regression | regression |
| Tolerance rigid-body / Monte Carlo | n/a | n/a | n/a | n/a | n/a | required | regression |
| Measured comparison / provenance | n/a | n/a | n/a | n/a | n/a | future | required |

## Versioning conventions
- Branch P0: `feature/p0-foundation`; PR #1 remains Draft.
- Later branch names set at checkpoint kickoff, not precreated.
- P0 documentation checkpoint and UI implementation checkpoint are distinct.
- No production-sounding `1.0` release while core physics unvalidated.
- Public repo: only synthetic/published data and properly licensed sources.

## DeepO / DeepLens reuse boundary
- DeepO is UX/workflow inspiration only; not permission to copy service code or branding.
- DeepLens public repository is currently described as Apache-2.0 and provides optical simulations, but confirm pinned revision and all transitive dependency licenses. Some advertised extensions are expressly unavailable publicly.
- Use a thin adapter after evaluation rather than coupling the app schema directly to a research library.
- Ray tracing merit (e.g., spot) is not a valid stand-in for complex mode overlap; require physical optics where needed.
