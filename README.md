# Photonic Connector Studio

**Fiber-to-Waveguide Optical Design Workspace · v0.0.1-p0**

P0의 첫 실행 버전입니다. Fiber Port → Editable Optical Train → Photonic Substrate WG Port를 편집합니다. **Geometry 전용**이며 Mode Overlap, Coupling IL, Beam Propagation은 `Not calculated`입니다.

## 바로 실행

[photonic-connector-studio-p0.html](artifacts/photonic-connector-studio-p0.html)을 다운로드하고 Desktop Browser에서 엽니다. JS/CSS와 작은 Korean Font가 포함된 단일 HTML이며 서버와 인터넷 없이 실행됩니다. Mobile에서는 HTML 실행을 지원하는 Browser로 열거나 아래 Vite 서버를 사용하세요. 메신저/파일 앱의 HTML Preview는 JavaScript 실행을 지원하지 않을 수 있습니다.

## Source 실행

Node.js **22.12 이상** 또는 **24.0 이상**을 사용합니다.

```bash
npm ci
npm run dev
```

`http://127.0.0.1:5173`을 엽니다. 다른 기기로 접속할 때는 `npm run dev -- --host 0.0.0.0`을 실행하고 해당 서버의 주소를 사용합니다.

```bash
npm run typecheck
npm test
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
npm run artifact
```

Production Preview: `npm run preview` → `http://127.0.0.1:4173`.
기존 Chromium을 사용해야 하는 환경에서는 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`를 지정할 수 있습니다.

## 사용 순서

1. 기본 1310 nm Example에서 Fiber Port와 WG Port를 확인합니다. Lens/Position은 학습용 가정이며 MFD는 TBD입니다.
2. Tree / Layout / Data에서 Component를 선택하고 Properties를 편집합니다. Mobile은 Layout / Train / Edit / Analysis 탭을 사용합니다.
3. Position은 mm, MFD는 µm, Orientation은 degree로 입력합니다. JSON 내부는 m / rad입니다. MFDx는 local Y, MFDy는 local Z 방향 Intensity 1/e² diameter입니다.
4. Insert로 Thin Lens / Air Gap / Reference Plane을 추가합니다. Up / Down은 Train Order만 바꾸며 절대 Position은 유지합니다. Fiber/WG Terminal Port와 Mating Plane은 삭제할 수 없습니다.
5. XY / XZ Projection, Zoom, 배경 Drag Pan, Fit을 사용합니다. 좌표 축은 같은 Scale을 사용하며 Lens/Port/Mode Symbol은 도식입니다. 편집 중 Camera는 고정되므로 큰 이동 후 Fit을 누르세요.
6. Save JSON → Open JSON으로 Design을 저장/복원합니다. 잘못된 입력은 기존 Design을 보존합니다. Undo / Redo, Lock, Enabled, X Variable Flag를 사용할 수 있습니다. Variable은 저장만 하며 Optimizer는 없습니다.
7. Help에서 공통 Vacuum Wavelength를 변경할 수 있습니다.

짧은 Desktop 화면에서는 Tree, Properties와 Data 내부를 스크롤합니다. 작업 내용은 Memory에 있으므로 종료 전에 JSON을 저장하세요. Browser Storage나 Cloud Account는 사용하지 않습니다.

## Checkpoint

- Branch: `feature/p0-foundation` / [Draft PR #1](https://github.com/legendnever-collab/photonic-connector-studio/pull/1)
- [구현 및 검증 보고서](docs/P0_IMPLEMENTATION_REPORT.md)
- [Artifact / SHA256 / Source Manifest](artifacts/)
- 사용자 Play Review 전 main 병합 금지. P1 자동 시작 금지.
- P0는 Geometry / Schema / UI만 구현합니다. Refraction, Focusing, Diffraction, Gaussian q, Mode Overlap, Loss Solver는 아직 없습니다.

## 기존 설계 문서

아래 문서는 구현 이전의 기준 문서이며 원문을 보존했습니다. 현재 구현 상태는 위 Checkpoint와 별도 보고서를 기준으로 확인하세요.

1. [DEVELOPMENT_ROADMAP_V1.md](docs/DEVELOPMENT_ROADMAP_V1.md)
2. [WORKFLOW_AND_MODEL_POLICY.md](docs/WORKFLOW_AND_MODEL_POLICY.md)
3. [MASTER_PLAN.md](docs/MASTER_PLAN.md)
4. [PHYSICS_CONTRACT.md](docs/PHYSICS_CONTRACT.md)
5. [UI_DESIGN.md](docs/UI_DESIGN.md)
6. [CHECKPOINTS.md](docs/CHECKPOINTS.md)
7. [P0_FIRST_IMPLEMENTATION_WORK_ORDER.md](docs/P0_FIRST_IMPLEMENTATION_WORK_ORDER.md)

## Source / Licensing

[DeepO Interface Tour](https://www.ai4optics.com/deepo/manual/interface/tour/)는 Shell / Layout / Data Editor / Mobile Navigation의 UX 참고 자료입니다. 구현은 독립적이며 DeepO Code / Branding / Solver를 복제하지 않았습니다. DeepLens는 설치하거나 사용하지 않았습니다.

Korean Font는 Noto Sans KR의 작은 Subset이며 [SIL OFL](src/assets/NotoSansKR-OFL.txt)을 포함합니다. Public Repository에는 학습용 가정만 사용합니다.
