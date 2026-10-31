# AI Workflow Bootstrap — Next Task

**Created:** 2026-11-01  
**Status:** documentation-only foundation; no Physics Engine or CI configuration changes in this PR.

## Current repository context at bootstrap
- `main` has D2.4 documentation and `package.json` version `0.24.0-d24`.
- Draft [PR #36](https://github.com/legendnever-collab/photonic-connector-studio/pull/36) (D2.6.1) is stacked on prior D2.6 work and documents a coaxial Port–Lens policy, verified bounded cases and unsupported field propagation. **Do not assume those changes are merged into `main`.**
- Existing npm scripts in `package.json` include `typecheck`, `test`, `build`, `test:e2e`, `check` and `artifact`.
- This bootstrap adds only operating guidelines and a benchmark *contract*. No tests have been run as part of the documentation change.

## Task 1 — Implement reproducible Golden Benchmark harness (after high-effort capacity is available)
1. Inspect which existing automated model/E2E fixtures already implement 0/±50/100/500 µm and current Port–Lens mounting behavior on the **correct target branch**.
2. Reuse and extend existing tests rather than create a parallel solver. Explicitly document an executable fixture including Port frames, Mode/MFD/NA, Lens/Prism/Mirror dimensions, assembly policy, tolerance gates, model domain and budgets.
3. Implement independent checks for no unexplained free-space ray bend, Port/Mode invariance, Snell/reflection geometry, candidate status classification, Search/Apply reproduction.
4. Add machine-readable benchmark results and compare conditional overlap vs throughput honestly. Unsupported field models remain uncomputed.
5. Run targeted model tests, full relevant regression and E2E (when environment supports it); record exact command, SHA, outcomes and limits.
6. Create a Draft PR without automatic merge. Request user review when physical assumptions or pass thresholds need approval.

## Task 2 — CI and report ergonomics (after Task 1)
- Integrate the benchmark into existing test CI without duplicating workflows.
- Add summarized PASS/FAIL, rejected family diagnostics, known limitations and fixture provenance to PR review.
- Evaluate the cost of lightweight vs high-effort models using comparable **validated** tasks, not guessed token savings.

## Task 3 — Reuse across other repositories
Apply this pattern only after the first benchmark harness demonstrates value. Adapt engineering contracts for Silicon Photonics Textbook and Spec-to-Mask rather than copying connector-specific Physics.

## Stop / approval gates
- Never merge to `main` without explicit user approval.
- Stop and ask if fixed Port, Mode, nominal assembly, fabricated geometry rules or manufacturing specifications need material change.
- If the task requires advanced numerical Physics and usage capacity is exhausted, leave a complete handoff here and avoid claiming tests were performed.
