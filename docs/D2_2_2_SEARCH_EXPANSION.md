# D2.2.2 — Bounded synthesis expansion

Recommended model: Sol Work. Reuses the independently validated D2.2.1 evaluator;
this checkpoint expands deterministic construction / allocation rather than the
physics domain. Based on PR #21 HEAD `6aa5036d16d406a69a2bb1393feb244396b7c1fd`.
Main remains `0c03fd3ec57af2b4064eda196d00249c6363712b` at recovery.

## Implemented delta

- Shared `prism2` topology for routing and synthesis. Two finite BK7 normal-entry /
  normal-exit right-angle prisms, built from actual Port poses. For parallel axes,
  the transverse displacement determines the middle direction; axial distance
  is split by bounded seeds and refinements. For nonparallel axes, the three
  directions solve closure analytically. Degenerate, short and incompatible
  placements fail existing geometry/body/space/clearance checks.
- Synthesis can allocate 0/1/2 Lens blocks to exterior air segments, including
  the segment between Mirror folds. Same-segment pairs are supported. The
  existing endpoint relay seed remains available. Every Lens is a real finite
  Sphere/Plane pair, and continuous fitting stays inside its traced air cell.
  No element is inserted inside Prism glass or Mirror backing.
- Clear Radius samples are Min, Max and geometric mean. Optional Prism leg
  bounds use the same finite sampling. Eligible sizes and families are
  interleaved within the existing geometry budget. Leg <4×Clear Radius excludes
  Prism seeds without excluding an otherwise feasible Mirror family. Lens
  thickness remains continuously fitted inside declared bounds. Manufacturing
  settings are editable assumptions, not catalog-certified parts.
- A locked Surface (whole paired component) or frozen Lens interval retains the
  complete ordered prefix through the last anchor. That prefix and its ancestry
  are kept; only the trailing route is reconstructed. Unlocked prefix lenses may
  still fit their declared variables. No arbitrary multi-anchor stitching or
  optical removal ahead of an anchor is claimed.
- Replayable candidate recipes carry topology, aperture, Prism leg and Lens air
  allocation. Apply rebuilds from current input and rechecks frozen state,
  component counts, manufacturing bounds, finite geometry, Gaussian validity and
  the common Mode evaluator. Preview, stale/tamper checks and one-Undo remain.
- New controls are in Automatic Synthesis. Existing settings remain loadable;
  absent new options retain the previous endpoint / single Prism-size behavior.
  New families and interior allocation are explicit choices. Candidate metrics
  show initial recipe count, actual fit attempts and interior attempts; repeated
  refinement / refit attempts are included, not a coverage percentage.

## Physics and limits

D2.2.1 phase convention, angular integration, explicit polarization transport,
critical-angle, collimation, clipping and curvature gates are unchanged. New
geometry does not imply a supported Mode field: powered optics after the first
TIR and noncoplanar/mixed-polarization combinations remain reference-only with
an explicit reason. Qualified means both the prescribed Gaussian-Q goals and
common conditional normalized Mode overlap pass. Interfaces remain unit
amplitude; Transmission / Total Coupling remain null. No delivered efficiency,
PIC receiving-field definition, global optimum, joint worst case or Yield claim.

The original optical ≤8192, geometry ≤128, fit ≤2048, tolerance ≤1024 caps remain.
Search is finite and may omit allocations when budget is exhausted. Max Lens
count is two. Prefix routing requires a physically traceable prefix exiting to
 air. Arbitrary locked-anchor subproblems, post-TIR powered-field support and
D2.3 robustness development are outside this checkpoint.

## Validation

`tests/synthesisExpansion.test.ts` covers blank two-Prism construction, held-out
positive/negative offsets, rigid-coordinate covariance, common routing/Apply,
explicit undefined polarization, manufacturing/part/Keep-out/space/budget
rejections, middle-air Lens construction and actual automatic allocation,
locked Mirror/body/ancestor preservation and suffix replacement, mixed-family
manufacturing eligibility, and generated TE/TM against the separate vector
Fresnel/angular-spectrum oracle (96²/7 and 128²/9 convergence <1e-9; absolute
eta discrepancy <2e-4). Existing D2.2.1 independent fixtures remain regression
checks. Slow oracle/locked-train tests have explicit 30 s test timeouts; their
physics tolerances and search budgets are unchanged.

`e2e/synthesisExpansion.spec.ts` runs desktop and mobile offline: blank task →
read-only Preview → Apply → common Analysis/Gaussian/Report → one Undo / Redo;
manufacturing/air-allocation settings persist. Existing full suites preserve
Mirror, 5 mm Lens relay, locks, SaveLoad, stale/tamper/cancel and old UI behavior.

Final validation and artifact identity are recorded in the PR and existing
`artifacts/build-info-u1.json` / `artifacts/SHA256SUMS-u1.txt` manifests.

## Review (≤5 steps)

1. Open the standalone HTML and choose **D2.2.2 · Blank 2 Prism synthesis task**
   from Example Projects. It contains only Input / Output, no optical parts.
2. Open **Automatic Synthesis**, then **Run Automatic Synthesis**. Expect real
   `prism2` candidates, nominal Mode goals met and about **99.959%** normalized
   overlap; the collimated 1 mm Mode is an explicit test assumption.
3. Preview the actual Prism bodies, then Apply. Compare the same Mode value in
   Analysis, Gaussian and Report. Transmission / Total Coupling stay uncalculated.
4. Undo once to restore the blank task; Redo restores the same optical train.
5. In Automatic Synthesis, enable interior air segments / Prism leg bounds for
   other supported projects. Review domain / rejected reasons and finite budget
   coverage instead of treating a missing candidate as proof of impossibility.

Stop after D2.2.2. No main merge or D2.3 is authorized by this implementation.
