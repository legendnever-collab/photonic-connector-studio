# D2.0 — Recovery & source gap audit

확인 기준: 2026-10-25, 한국시간의 본 작업 세션. 상태: **문서 checkpoint**.
[전체 경로](AUTOMATIC_SYNTHESIS_ROADMAP.md) · [계약](D2_AUTOMATIC_SYNTHESIS_CONTRACT.md) · [다음 작업](D2_NEXT_TASK.md)

## 1. 복구 기준과 보존

최신 D1을 기준으로 별도 `docs/d2-0-synthesis-architecture` branch에서 문서만 추가한다.
기존 checkout 및 PR #13–#17의 source/branch를 변경하지 않는다. main checkout으로
되돌리거나 선행 stack을 병합하지 않는다. Repository의 해당 경로와 상위 경로에서
적용할 AGENTS.md는 발견되지 않았다.

| 대상 | 이번에 재확인한 상태 | HEAD |
|---|---|---|
| main | 기존 S0/S1까지 병합 | `c246bb6e00242ba189a23edb3451db59dbc505f5` |
| [PR #13](https://github.com/legendnever-collab/photonic-connector-studio/pull/13) | open / Draft / unmerged; base main | `6b50c731f3f0b70f3d425f5bd5ac988aff0dbf77` |
| [PR #14](https://github.com/legendnever-collab/photonic-connector-studio/pull/14) | open / Draft / unmerged; base #13 branch | `7c94cb6a075946396665df805b339d572cd26084` |
| [PR #15](https://github.com/legendnever-collab/photonic-connector-studio/pull/15) | open / Draft / unmerged; base #14 branch | `cb94e372905719a0cd59ea5402eff6160cca647f` |
| [PR #16](https://github.com/legendnever-collab/photonic-connector-studio/pull/16) | open / Draft / unmerged; base #15 branch | `c5f4b3a5fc91424bbce6bb9b10d7d209c54e0e87` |
| [PR #17](https://github.com/legendnever-collab/photonic-connector-studio/pull/17) | open / Draft / unmerged; base #16 branch | `dc8ca6f5a984ebd661edc044995fc36ac5b3caca` |

D1 remote Git commit API에서 tree `d2a1265f0ee4594135282d0c5e3c07d2d3e558b9`를
직접 확인했다. 복구한 local `814664c7c35e5cbed1ab2bdff6ff06ca12dde27a`의 tree와
정확히 일치한다. commit metadata/이력이 다르므로 두 commit SHA 자체를 같다고
기록하지 않는다. 복구 전 local working tree는 clean이었다. 문서 게시 시 remote
D1 commit을 parent로 사용한다.

## 2. 검증 및 기존 실행 파일

[CI run 77](https://github.com/legendnever-collab/photonic-connector-studio/actions/runs/40199607391)은
remote D1 HEAD에 대해 completed / success임을 이번 세션에서 다시 조회했다.
PR #17에 기록된 검증은 typecheck/build, Model 326 PASS, Browser 150 PASS 및
예정된 Mobile skip 48개다. 이는 기존 D1 검증 결과이며 D2 엔진 검증 수가 아니다.
이번 문서 작업에서 Model/Browser suite나 app build를 다시 실행하지 않는다.

보존한 manifest의 96개 build input을 실제 파일 SHA256과 대조했고 불일치가 없다.
이전 전달 HTML도 실제 bytes를 확인했다.

| 항목 | 보존 값 |
|---|---|
| App version | `0.10.0-d1` |
| Engine | `current-project-design/1.0.0` |
| HTML | `photonic-connector-studio-u1.html` |
| Bytes | 728030 |
| SHA256 | `5b33f1d59a07db1996eb6aad7ebaee6d4187405537bd6a48dfd874cb6b5a1736` |
| Source fingerprint | `4995666ef16b4cd2de951ce6a96fe927a73f3be38f96f4f868ee977763920c45` |
| Build sourceCommit | `e6dbc0058281170025dea4edb7b0a274c991b208` |

D2.0은 새 HTML을 만들지 않는다. 문서 추가가 source/build provenance를 새 엔진의
구현 증거로 바꾸지 않는다.

## 3. 소스에서 확인한 차이와 재사용 지점

| 확인 위치 / symbol | 실제 동작 | D2에서 필요한 변화 |
|---|---|---|
| `src/authoring/commands.ts:newPhysicalProject` | Input SMF, X=10 mm Output probe만 생성. Optical component 0개. Output의 medium/Mode는 미정의 | 빈 train을 합법적 시작점으로 지원. Output reference를 명시적으로 설정하는 경로 제공 |
| `src/authoring/starter.ts:fiberLensFiberProject` | 양쪽 SMF와 실제 BK7 Lens를 넣은 별도 starter | starter를 빈 Project의 대체 경로로 쓰지 않음 |
| `src/design/contract.ts:ProblemSchema` | strict v1; strategy는 lens/route 두 가지뿐 | 별도 versioned synthesis 설정. 기존 v1 의미/저장 유지 |
| `src/design/engine.ts:runProblem` | Lens 또는 route adapter 하나 실행 후 retained 후보 OAT | topology→Lens 생성→최적화→평가→feedback을 관리하는 새 orchestrator |
| `src/lens/domain.ts:lensDomain` | 먼저 finite chief route 요구, Lens 1~2개 요구. relay2는 두 번째 Lens만 추가 | 0에서 첫 physical Lens 생성, fold 전후 segment에 배치하는 constructor |
| `src/lens/search.ts:beamMerit / lensSearch` | transported Q의 크기/phase fitting. seed·bounded Nelder–Mead·실제 면 재검증 | kernel 재사용. 새 후보에 대한 Mode metric 및 topology 재탐색 feedback 추가 |
| `src/routing/search.ts:prepare / proposals / build / searchSteps` | Lens prefix 고정, Mirror/Prism suffix 생성. Lens-after-fold 입력은 거절. geometry 기준 상위 8개 보존 | 공개 API가 아닌 내부 proposal/build 분리 검토. geometry 순위로 일찍 버리기 전에 optical/tolerance 가능성 보존 |
| `src/project/physicalGaussian.ts:solvePhysicalGaussian` | B1의 직선 coaxial/paraxial overlap. reflection/TIR 거절 | 검증된 기존 경로 그대로 유지; folded overlap을 이 결과로 위장하지 않음 |
| `src/project/foldedGaussian.ts:solveFoldedGaussian` | full complex 2×2 Q, 실제 chief path, planar fold, centered-normal Sphere/Plane Lens, fold 뒤 Lens 분석 가능 | 공통 forward adapter. Output frame 변환과 조건부 scalar overlap은 새로 검증해야 함 |
| 동일 solver의 aperture/TIR gates | 누적 tail >0.1%면 untruncated reference; TIR angular-spectrum 경고 | 수용 기준에서 reference-only와 성능 평가 후보 분리. clipping을 loss로 대입하지 않음 |
| `src/design/engine.ts:assessDesign / stressCases` | leaf/Port OAT, overlap은 B1만 사용. zero/capped/미지원 coverage는 not-assessed/partial | 공통 evaluator에 연결하되 지원하지 않는 Lens decenter/tilt를 pass로 바꾸지 않음 |
| `src/project/model.ts / Store.tsx` | SI 단일 Project, strict parse, shared replace/history | 새 topology도 실제 prescription/body로 생성, Apply 한 번/Undo 한 번 |
| `src/surface/evaluator.ts / asphereIntersection.ts` | Conic/Even Asphere geometry·normals·intersection 기반 | Parabolic reflector 자동 설계나 Asphere field 성능은 별도 gate |
| `src/surface/ReportFigure.tsx / reportGeometry.ts / reportGlyph.ts` | 실제 형상/경로/beam reference, linked inset, 확대 화살표 보정 | 기존 형상 source 재사용. 새 결과 scope/provenance만 연결 |

`tests/designProblem.test.ts`와 `e2e/designProblem.spec.ts`는 locks, stale/tamper,
constraints, read-only Preview, Apply/Undo, roundtrip, cancel, PC 화면을 이미 검사한다.
이를 새 엔진 구현의 기준으로 보존한다. 기존 displaced-Port browser test는
**starter에서** 시작하며 folded η가 미평가임을 검사한다. Blank Project의 5 mm
Mode 정합 성공을 검증한 테스트가 아니다.

## 4. 5 mm 사용자 사례에 대한 판정

해당 실행의 JSON/오류 메시지가 없으므로 정확한 실패 원인은 확정하지 않는다.
Output Global UI 단위는 µm라 Z=5 mm는 `5000`이다. D1 Design Space 활성화 시
초기 Z 범위 ±2 mm도 별도로 확인해야 한다. 그러나 이 두 조건을 수정해도
첫 Lens 생성·공동 탐색·folded overlap 부재가 해결되지는 않는다.

현재 수준은 **수동 설계 가능한 공통 환경 + 제한된 탐색 + 초기 OAT screening**이다.
사용자의 자동 합성 요구는 아직 충족되지 않았다. 5 mm offset이 물리적으로 불가능하거나
사용자가 잘못 조작했다고 결론 내리지 않는다.

## 5. 이번 checkpoint의 정지점

문서 링크·근거·범위 일관성 및 변경 경로를 검사하고, D1 tree 위 문서만 별도 보존한다.
기존 source, tests, artifacts, package/version, dependency와 main 및 PR #13–#17을
그대로 둔다. 다음 구현은 [D2_NEXT_TASK.md](D2_NEXT_TASK.md)에 정리했으며, 사용자
지시 전에는 시작하지 않는다.
