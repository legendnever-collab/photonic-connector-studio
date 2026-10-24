# P1.3 Visual Workstation

## Problem and behavior

작은 보조 글자와 낮은 대비, 좁게 나뉜 Properties/Analysis, Canvas에서 떨어진 KPI 때문에 Design을 읽고 편집하기 어려웠다. P1.3은 실제 작업 화면을 Lab Light / Precision Dark / Focus Hybrid로 전환하고, η·Loss·Radius를 Canvas 위에 유지한다. Desktop 오른쪽은 Inspect / Analyze로 전체 높이를 사용한다. Mobile navigation과 keyboard-visible 편집 종료 동작은 유지한다.

| Option | Reading / visibility | Tradeoff |
|---|---|---|
| Lab Light (default) | White panels, dark text, teal emphasis; 입력·문서 읽기 중심 | 밝은 환경에 적합 |
| Precision Dark | Graphite surfaces, light text, bright optical signals | 밝은 실외에서는 덜 적합할 수 있음 |
| Focus Hybrid | Light editing panels, dark optical Canvas | 두 영역의 밝기 차이가 큼 |

Appearance는 세션 설정이다. Native dialog는 Escape와 Close, Apply & Close를 지원하고 닫으면 trigger로 focus를 돌린다. 미니어처는 테마 설명용이며 실제 계산 결과는 기존 workspace KPI에 표시된다. Theme 전환 시 Design/Undo/JSON/Solver/Camera/선택은 보존한다. 키보드 focus 표시는 명시적인 outline으로 보강했다.

핵심 입력은 15px(기존 Mobile 16px 유지), 핵심 KPI는 29px, Canvas labels는 11–12px로 확대했다. 짧은 Desktop에서는 중앙 workspace를 scroll할 수 있다. 패널 크기 조절, 3D, catalog import는 아직 구현하지 않았다.

## Validation

- TypeScript / production single-file build PASS.
- Unit / numerical / offline Korean-font coverage: **119 PASS**.
- Browser regression + Appearance: **48 PASS / 2 intentional Mobile SKIP**. Skips are pre-existing Desktop-only Data/viewport cases; Desktop tests cover responsive widths.
- Theme tests: same SVG/beam-axis DOM and geometry, same η and zoom, edited parameter retained, input focus during edits, offline file:// operation, bounded Desktop/Mobile dialogs, Escape and focus return.
- Compared actual computed foreground/background colors for title, KPI label/value, tree secondary text, synthetic-data disclaimer and finish-editing button in all three themes. Ratios **4.7607–13.9034:1** (selected samples only). No full WCAG conformance claim.
- Contrast method: sRGB relative luminance, (Llighter+0.05)/(Ldarker+0.05). Reference: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html . Threshold tests use unrounded values.
- Actual screenshots captured from the production single HTML; comparison sheet is a composition of those screenshots, not an image-generation mockup.
- `src/physics.ts`, `src/sensitivity.ts`, existing physics benchmarks and prior P0/P1.1/P1.2 artifacts are unchanged. Display changes do not add physical ray tracing or manufacturing tolerances.
- Standalone source identity, source fingerprint and artifact SHA-256 are in `artifacts/build-info-p1.3.json` / `SHA256SUMS-p1.3.txt`.

## Review / recovery

Base main includes PR #2 (`f084340ad7db7e457c45297f2f74769b158b1a6b`) and PR #3 (`e505652b219ee97d33c0f4916fa8c8f50feb4235`). P1.3 branch: `feature/p1-3-visual-workstation`. Review the standalone HTML using Appearance, matching/mismatch/pointing examples, Inspect / Analyze and expanded Alignment Analysis. The new UI is kept in a separate PR for visual review; P2 has not started.

To reproduce: Node 22.12+, `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, `npx playwright install --with-deps chromium`, `npm run test:e2e`, `npm run artifact`. A local Chromium path can be supplied through PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH; this environment used a temporary Chromium executable without adding project dependencies.

## Next development steps

1. **P2 Physical Lens / Ray Tracing**: first define optical-surface/material/aperture contracts and analytic refraction benchmarks; then spherical Snell intersections, physical thickness, aspheres and clipping with explicit validity domains. Couple geometric ray evidence to the existing Gaussian assumptions without presenting one as the other.
2. **P3 Physical Optics / Mode Overlap**: sampled complex fields, propagation, imported mode profiles, overlap convergence and independent numerical validation.
3. **P4 Optimization**: bounded variables, objectives/constraints, reproducible optimization history and validation against known optima.
4. **P5 Connector Tolerance**: mating 6-DoF, manufacturing/reassembly distributions, Monte Carlo and yield reporting.
5. **P6 Multi-channel / Measurement Validation**: arrays, channel-dependent mismatch/crosstalk, measurement import and prediction-versus-measurement comparison.

DeepO remains a workstation-quality reference; this iteration addresses readability and presentation only. Do not claim feature parity.
