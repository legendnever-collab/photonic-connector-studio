# S2 — Fixed-Port Free-Lens Tolerance

## 기준 Prescription

[PR #45의 D2.8-D CI Artifact](https://github.com/legendnever-collab/photonic-connector-studio/actions/runs/42222921126/artifacts/13505161023)에서 ±50 µm, `synthesis-178-3`을 복구했다. S1 병합 Commit `20cfd15d735d3ebdb1f34d361151e961ce54fc76`에서 D2.8-D를 재실행한 결과와 두 Prescription 및 Search 옵션이 정확히 일치했다. [Fixture](../tests/benchmark/s2-free-lens-fixture.json)에 양쪽 Prescription, Search 설정, Nominal 결과와 원본 Artifact SHA-256을 보존했다. S2 실행은 Search 및 재정렬 없이 이 Fixture에서 출발한다.

두 Fiber Port는 1310 nm, X 간격 10 mm, 평행 +X 광축, 양쪽 9.2 µm MFD다. +50 µm 후보의 Lens 1과 2는 각 Port 축에서 Z 방향으로 각각 +7.023 µm와 −7.023 µm 편심돼 있다. −50 µm 후보는 Z 반사에 대응한다. 기존 Chief-ray 위치/각도 Gate는 각각 1 µm와 0.1°다.

## 오차 정의와 검증

- **A** — 각 Lens의 Local Y/Z Decenter ±1 µm, Local Y/Z Tilt ±1 mrad, Local X Axial Shift ±10 µm를 각각 부호별로 가한다. Local Pivot은 Lens Front Vertex이고, 회전 순서는 `Rz Ry Rx`다. Lens Assembly의 두 Surface와 Body는 같은 Rigid Transform을 적용받는다.
- **B** — Common-mode는 X = 5 mm, Y = Z = 0인 Rail Datum에 대해 두 Lens만 이동한다. Differential은 같은 World Axes에서 각각의 Front Vertex를 Pivot으로 사용하고 두 Lens에 반대 부호의 입력을 가한다. 두 Probe는 Y/Z Translation 각 ±0.5 µm, Y/Z Tilt 각 ±0.2 mrad다. Tilt 20 mrad를 가한 독립 Control에서는 Local X로 10 µm 이동할 때 World Z 성분 약 0.200 µm가 생기며, World X 이동의 Z 성분은 0이다.
- **Joint** — 기존 deterministic sampler에 Seed 231, 16 Samples를 준다. Common-mode 위에 Lens별 Local Position Bounds X/Y/Z = 0.5/0.35/0.35 µm, Y/Z Tilt Bounds = 0.15/0.15 mrad를 조합한다. Local Transform을 먼저 적용한 후 Common Transform을 적용한다. 두 Offset에서 동일한 World 부호 규칙으로 샘플링하므로 Joint Sample 번호별로는 반사 대응이 보장되지 않는다. 독립적으로 반사시킨 31쌍의 명시적 Case에서는 Chief-ray 잔차와 Conditional Overlap을 대조했다.
- 모든 실행 Case에서 양쪽 Port의 Pose, Mode, Medium이 보존된다. 독립 Rotation Matrix로 Surface Pose와 Body Vertex를 대조했다. Capped Control은 16개 중 2개를 실행해 `partial` 상태를 확인했다. 모든 진폭은 진단 입력이다.

## 관측 결과

| Case | Geometry와 Gaussian 모두 유효 | 해당 Case 중 최소 Conditional Overlap |
|---|---:|---:|
| A, +50 µm 및 −50 µm 각각 | 12 / 21 | 99.0030% |
| B Common-mode, 각 Offset | 0 / 2 | Uncomputed |
| B Differential, 각 Offset | 0 / 2 | Uncomputed |
| B Joint, +50 µm | 1 / 16 | 96.1526% |
| B Joint, −50 µm | 1 / 16 | 96.1524% |

Nominal Conditional Overlap은 양쪽 모두 99.99966%다. Lens 1 Local Y Decenter +0.5 µm Control은 출력 각도 잔차 약 2.845 mrad로 Geometry Gate에 걸렸으며 Gaussian은 유효했다. Lens 1 Axial Shift −5 µm Control은 Geometry를 통과했으나 Gaussian Footprint Gate 0.2를 넘었다. 별도의 Aperture 차단 Control에서는 Gaussian이 Uncomputed로 분류됐다. +50 µm와 −50 µm Joint에서 Gaussian Domain 이탈은 각각 4개, 5개다.

Nominal Ray-Pupil은 양쪽 모두 **Unresolved**다. 최종 Target Coverage 약 0.973514는 0.999 Gate에 미달했고, Intermediate Caustic / Singular Tube Reject Weight 약 1.49e−4가 남았다. Perturbed Case의 Ray-Pupil, Total Coupling, 제조 분포 기반 Assembly Yield와 전역 Worst-case는 Uncomputed다. 실제 Spherical Lens Field는 D2.8-E의 외부 Wave Reference에서 별도 검증한다.

## 재현과 결과 검토

```sh
npm ci
npm run benchmark:free-lens-tolerance
npm run benchmark:golden
npm run typecheck
npm test
npm run build
npm run test:e2e
```

`benchmark-results/s2-free-lens-tolerance.json` 또는 PR CI Artifact `s2-free-lens-tolerance`에서 `gitSHA`, `headSHA`, `fixtureSHA256`, `cases[].checkpointA`, `cases[].checkpointB`를 확인한다. 각 Coverage의 `minima`에는 Gaussian만 유효한 집합과 Geometry·Gaussian 모두 유효한 집합의 Case ID가 따로 들어 있다. Browser Golden은 0/500 µm Apply·Undo/Redo와 ±50/100 µm Search를 기존 진입 경로에서 검사한다.
