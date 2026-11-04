# Golden Benchmark 01 — Fixed Fiber–Fiber +50 µm Z Offset

**Contract status:** proposed acceptance contract. This document alone does not mean the benchmark is implemented, passing, physically feasible for every parts library, or approved for production.

## Why this benchmark exists
Test whether the workstation can *search, qualify, diagnose, and explain* a physically valid connection between fixed input and output optical ports without moving Ports or silently replacing the intended mounting arrangement.

## Provisional setup — confirm before numerical certification
| Parameter | Provisional value / requirement |
|---|---|
| Input Port | Reference global position (0, 0, 0); direction +X |
| Output Port | Position (10 mm, 0, +50 µm); parallel optical axis (+X in propagation convention) |
| Wavelength | 1310 nm (provisional) |
| Port Mode | Same explicitly defined SMF reference at both ends; do not assume an undocumented MFD/NA |
| Connection environment | Optical element geometry / clearances / physical dimensions from the actual fixture |
| Mount intent | Prefer Port–Lens coaxial assembly; free-Lens decenter/tilt must be a separately selected policy |
| Additional routes | Direct, two-Mirror folded, two-Prism folded, or other explicitly validated topologies as supported |
| Locked variables | Both Port positions, orientations, optical Mode definitions |

The 10 mm distance, 1310 nm wavelength and +50 µm sign are currently **working assumptions**, not newly user-approved manufacturing specifications. Use project's actual coordinate definition and the chosen physical source fixture when implementing.

## Independent pass/fail requirements
1. **Port invariance:** numerical identity of serialized input/output Port pose and Mode across Search -> Preview -> Apply -> Undo/Redo.
2. **Ray topology:** free-space segments remain straight in a homogeneous medium; turns require explicit reflection, refraction, or modeled optical interaction. Validate Snell and specular reflection with independent checks.
3. **Assembly:** nominal Port–Lens coaxial rule is checked only when that policy applies; do not equate a free-Lens solution with a coaxial connector.
4. **Geometry/manufacturability:** each component meets body-clearance, keep-out, aperture, part-limit and declared dimension constraints, with documented evaluator scope.
5. **Field calculation:** computed only for verified supported paths/model domains. Track pupil clipping, diffraction/aberration model limitations, Mode convention and convergence.
6. **Performance:** report conditional Mode overlap separately from throughput/loss and actual total coupling. Do not insert a default pass threshold for total efficiency without a signed specification.
7. **Robustness:** OAT/joint perturbation and sampling provenance if actually evaluated. Do not call a nominal optimum robust without sensitivity results.
8. **Search completeness:** if no qualified candidate is found, output the tested families, budget consumed, rejected gates and **not found within tested domain**; never say physically impossible solely because search returned empty.

## Mandatory diagnostic cases
| Case | Expected kind of evidence |
|---|---|
| 0 µm offset control | Coaxial reference without fake beam steering |
| +50 µm offset | Port-preserving valid routed candidate **or** honest bounded no-solution diagnosis |
| -50 µm offset | Signed-offset symmetry / directional constraints checked |
| +100 µm offset | No automatic free-Lens fallback under coaxial policy; bounded search outcome explained |
| +500 µm offset | Existing folded-route regression checked against appropriate branch/revision |
| Artificial bend in air | Rejected as physically invalid |
| Unsupported powered Lens after Prism | Explicit unsupported/uncomputed result, not estimated coupling |
| Clearance / aperture failure | Rejection with reproducible physical reason |

The cases must be evaluated on a **specified git SHA**. Results from `main` D2.4 and unmerged D2.6.1 cannot be mixed as if they were from the same implementation.

## Record for each run
`git_sha`, fixture version/hash, wavelength, Port poses and Mode parameters, assembly policy, component models, search budgets, tested topology families, result status, failing gates, reference numerical checks, computed overlap and its limitations, robustness sampling and CI/test provenance.

## What is not yet demonstrated
This document **does not** provide an independent full-wave solution, diffraction-complete Lens–Prism–Lens field propagation, exact manufacturing yield, or a proven qualified +50 µm connector. These require separate solver development and verified tests.
