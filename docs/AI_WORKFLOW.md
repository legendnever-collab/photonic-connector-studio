# Efficient AI R&D Workflow (Draft Operating Procedure)

**Status:** initial working convention, not a claim that full automation already exists.  
**Goal:** reduce repeated prompts and unnecessary high-effort model use while maintaining reproducible Physics and user control.

## Three layers of work
| Layer | Owner | Deliverable |
|---|---|---|
| Technical intent | User + AI | Objective, fixed Port constraints, pass/fail criteria, risk threshold |
| Implementation and deterministic validation | Code, scripts, CI | Candidate generation, numerical evaluation, regression outputs, provenance |
| Judgment and approval | User, with AI decision support | Select trade-offs and approve physically significant changes / PR merge |

The LLM should design tests and interpret results, not substitute for independent ray/field calculations.

## Model allocation (heuristic, not mandatory)
- **Lightweight / low effort:** status reading, focused file search, changelog, CI summary, ordinary documentation.
- **Sol or comparable coding model:** scoped implementation, UI and test integration, straightforward refactor.
- **Astra or high effort:** changes to Physics assumptions, numerical architecture, unexpected inconsistent solutions, difficult cross-module bugs.
- Run a cheaper bounded attempt first unless the problem is known to require deep analysis. Actual plan usage is not proportional only to prompt length. Compare cost per **validated deliverable**, not raw messages.

## Default development cycle
1. **Recover state:** inspect `main`, current working branch, open stacked PRs, last verified test outcome. Do not assume old chat state equals repository state.
2. **Narrow scope:** 1 task, exact files/systems, explicit acceptance gate.
3. **Implement minimally:** preserve fixed Ports, existing Physics contracts and unrelated features.
4. **Validate deterministically:** regression tests, negative cases, documented numeric tolerances; distinguish observed vs unrun.
5. **Review:** summarize branch/PR, changed files, CI/tests, limitations, next task.
6. **User decision:** no automatic `main` merge.

## Separate data from prompts
- Keep permanent constraints here and in `AGENTS.md`.
- Keep numerical fixtures and their assumptions in version control.
- Keep current incomplete work in `docs/NEXT_TASK.md`.
- Keep dated research claims linked to their source and verification time.
- Store large simulation results in machine-readable files; feed the LLM only necessary statistics, failure clusters and representative cases.

## Validation architecture (future implementation)
- **Geometry gates:** fixed Port frames, legal intersection, Snell/reflection path, no unexplained ray turn, component clearance.
- **Field gates:** model domain, finite aperture, wavefront/Mode condition; explicit `uncomputed` if unsupported.
- **Robustness gates:** OAT/joint perturbation with stated sampling, assembly conditions, valid comparison between candidates.
- **Qualification:** all required gates must pass; a numerical optimizer's best candidate is not automatically qualified.
- **Reporting:** machine-readable structured outputs with version, git SHA, fixture hash/parameters, observed result and gate reasons.

## Token and usage-efficiency measurement
For each small development task compare:
1. Number of work sessions / tool invocations / model choices, where visible.
2. Time-to-first-validated-result.
3. Number of manual user corrections.
4. Validated tests and regression outcomes.
5. Whether re-reading large unchanged documents was avoided.

Do **not** assert a specific token-saving percentage without measurements. Chat, Work, Codex and API may have different usage accounting.

## Short reusable request
> 현재 branch와 관련 Draft PR을 확인하고 `AGENTS.md` 및 `docs/NEXT_TASK.md`를 기준으로 다음 미완료 작업만 수행해줘. 기존 Optical Physics와 Port 고정 조건은 보존하고, 자동 테스트를 실행해 결과·미해결 위험·다음 액션만 보고해줘. main 병합은 하지 마.

## Scope boundaries
This document does not activate automatic scheduled tasks, set up CI triggers, install local LLMs, create a new Physics solver, or modify user account/model quotas. Those require separate tasks, verification and, where appropriate, explicit authorization.
