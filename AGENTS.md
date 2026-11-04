# AI Development Contract — Photonic Connector Studio

## Purpose and source of truth
This repository builds a physically defensible optical connection design workstation between two fixed Optical I/O Ports. The central value is valid, manufacturable, robust optical connections—not visual polish.

Before implementation, inspect the actual branch, applicable source files, tests, open PR dependencies and relevant docs. Prefer current code and verified tests over old discussion summaries. Docs on `main` may lag unmerged feature branches; never assume a Draft PR is already merged.

Related guidance:
- [AI workflow](docs/AI_WORKFLOW.md)
- [50 µm Golden Benchmark contract](docs/GOLDEN_BENCHMARK_50UM.md)
- [Next task and handoff](docs/NEXT_TASK.md)

## Non-negotiable optical and product constraints
1. Input and Output Ports have fixed global **position**, **orientation / optical axis**, and **Mode Profile**. Never silently rotate, translate or change a Port to make a candidate fit.
2. A chief ray changes direction only at a physically modeled interface or other explicitly modeled optical interaction. Do not render or rank unexplained free-space bends as valid.
3. Separate **geometric route closure**, **ray/field model validity**, **conditional Mode overlap**, **total link efficiency**, **assembly tolerance**, and **manufacturability**. A high conditional Gaussian overlap is not proof of physical total coupling.
4. Treat `uncomputed`, `out-of-model`, `infeasible-under-stated-constraints`, and `not-found-within-search-budget` as different statuses. Never translate search failure into proof of impossibility.
5. Do not loosen aperture, surface geometry, clearance, tolerance, Lens/Prism assumptions, or model-validity gates simply to produce a candidate. Document and request approval for material physical changes.
6. Preserve assembly intent. D2.6.1 Draft PR #36 introduces default Port–Lens coaxial mounting and explicit advanced free-Lens opt-in. Check its merge/base status before reusing that behavior; do not assume it exists on `main`.
7. Small-offset connections may require a Fold / Mirror / Prism topology. Off-axis Lens steering is an explicitly different mounting policy, never a silent substitute.
8. Use existing calculation engines, reproducible fixtures, and independent numerical checks instead of asking an LLM to simulate large numeric sweeps in text.
9. Preserve existing Project data, Undo/Redo behavior, offline artifact compatibility, and prior validated Physics unless a task explicitly permits migration or behavior changes.
10. Technical terms may stay in English; explanatory prose and user reports should be in Korean.

## Low-waste implementation protocol
1. State the smallest requested deliverable, acceptance conditions, target branch and affected files.
2. Read targeted files first; avoid full-repository re-ingestion if a scoped investigation suffices.
3. Use the simplest model and smallest code change sufficient for the task. Escalate to deep reasoning when topology, numerical correctness, architecture, or previously failed diagnosis requires it.
4. Make small coherent checkpoints. Do not reimplement solved features or reset a working branch merely because chat context changed.
5. Run appropriate validations based on scope. Existing `package.json` supports `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e`, `npm run check`, and `npm run artifact`. Report only tests actually executed, with observed outcomes.
6. Compare benchmark outcomes against their exact input assumptions; include at least one negative / invalid case when changing candidate qualification.
7. Record a concise handoff in `docs/NEXT_TASK.md` when a task substantially changes current state. Avoid rewriting the project history each turn.
8. Final report: **changed files / observed validation / unverified risks / next action**. Avoid repeating long unchanged project context.

## Branch and approval policy
- Never modify `main` directly for AI-driven implementation.
- Do not merge a PR without the user's explicit instruction.
- Do not change or overwrite existing feature branches or stacked PRs inadvertently.
- Keep Draft PRs draft until user review, particularly for Physics/assembly semantics.
- Preserve source provenance and distinguish measured outputs, model predictions, and unverified assumptions.
