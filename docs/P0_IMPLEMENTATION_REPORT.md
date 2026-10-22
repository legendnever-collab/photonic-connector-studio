# P0 First Playable Implementation — Verification Report

**Date:** 2026-10-23 (Asia/Seoul)
**Version:** 0.0.1-p0
**Branch:** feature/p0-foundation
**PR:** https://github.com/legendnever-collab/photonic-connector-studio/pull/1 (Draft 유지)
**Stop:** P0 Play Review 대기. main 병합 / P1 시작 없음.

## Recovery baseline

- Remote main: `713a7709c72fcceedbd2f1214de374593dc949be`.
- Remote development: `cefb76d3f3065df0c2d75bcc22f5364e42058bed`.
- PR #1: Open / Draft / 12 documentation commits. 기존 Source와 CI Workflow는 없었음.
- Local Workspace에 해당 Repository가 없어 기존 Branch를 Clone함. 초기 Worktree는 Clean.
- 사용자 지정 7개 문서를 지정 순서대로 읽고 원문을 보존함. Architecture / Physics Contract / Roadmap 재작성 없음.

## Implemented boundary

React 19 + TypeScript + Vite. Zod Schema가 UI와 분리된 DesignDocument를 검증합니다. 내부 길이는 m, Rotation은 rad이며 UI만 mm / µm / nm / degree로 변환합니다. Rz(yaw) Ry(pitch) Rx(roll) 기준 Right-handed Local Frame과 +X Normal을 사용합니다. MFDx → local Y, MFDy → local Z로 명시합니다.

- Nondeletable Fiber / WG Terminal Ports, Movable Mating Reference, Optional Thin Lens / Air Gap / Reference Plane.
- Tree / Data Table / Properties / Layout은 같은 Immutable State를 공유함.
- Add / Delete / Order / Enabled / Lock / Assembly Side / X Variable Flag, 100-Step History의 Undo / Redo.
- Position / Rotation / MFD / Lens Parameters / Gap Length / 공통 Wavelength 입력.
- XY / XZ Projection, Equal Axis Scale, Zoom / Pointer Pan / Fit. Camera는 Parameter 편집 중 재설정하지 않음.
- Strict versioned JSON Save / Load. Unknown Schema / Units / Extra Fields / Duplicate IDs / Invalid Geometry / Nonfinite Numbers / Oversized JSON을 거절하고 기존 State를 보존함.
- Unavailable Solver Interface. 세 Analysis 항목은 항상 Not calculated. Beam / Ray / Coupling / IL 계산은 없음.
- Desktop 패널별 Scroll, Mobile Canvas-first 탭. Korean 설명과 English 기술 용어.
- Vite Single-file Build, 외부 Script / CSS / Font 요청 없음. Korean Font Subset 14.4 kB와 OFL 포함.

DeepO의 공식 Interface Tour에서 Shell / Layout / Lens Data Editor / Mobile Navigation을 참고했습니다. 독립 구현이며 외부 Optical Library나 AI Service는 사용하지 않았습니다.

## Validation

| Gate | Result | Evidence |
|---|---|---|
| Typecheck | PASS | `npm run typecheck` |
| Production Build | PASS | `npm run build`; JS/CSS/Font inline |
| Unit / Schema / State | 47 PASS | `tests/domain.test.ts` |
| Browser / UI | 20 PASS, 2 intentional SKIP | `e2e/workspace.spec.ts`; Desktop + Pixel 7 viewport emulation |
| Viewport matrix | PASS | 320×740, 360×800, 768×1024, 1024×768, 1366×768, 1920×1080; no horizontal document overflow |
| Repeated property edits | PASS | 12 Position edits; same SVG and Lens DOM nodes retained on Desktop + Mobile |
| Save / Load | PASS | Geometry / MFD / Rotation parity; malformed/future imports preserve current Document |
| Offline HTML | PASS | `file://` with Browser networking disabled; Edit / Download JSON / Import JSON; no runtime exception |
| Visual review | PASS | Screenshots: Desktop 1440×1080 / 1366×768, Mobile 412×915 / 360×800 |

2 SKIP은 Desktop Data Table 테스트와 한 번만 실행하는 Viewport Matrix를 Mobile Project에서 중복 실행하지 않기 위한 것입니다. Mobile Tab 편집과 실제 Geometry / Save / History 동작은 별도 통과했습니다.

Browser는 Chromium 153.0.8010.0의 Headless Emulation입니다. 기본 Playwright Chromium 다운로드가 이 환경에서 손상되어, 검증 시 NPM 배포 Chromium 실행 파일을 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`로 지정했습니다. 해당 대체 Browser Package는 프로젝트 Dependency나 Lockfile에 포함하지 않았습니다. 일반 개발 환경과 CI는 Playwright 기본 Chromium 설치를 사용합니다.

## Source / Artifact parity

Remote Source Commit: `7ee6b9e0ec461f1cfdb83124e57f3529476262fe`.
Git CLI의 Push 인증이 없어 GitHub Connector로 동일한 File Tree를 Fast-forward 반영했습니다. Local 구현 Commit들은 보존했으며, Remote Commit의 Source와 Artifact Manifest의 Hash는 같습니다.

- `npm run build` 후 `npm run artifact`로 `artifacts/photonic-connector-studio-p0.html`을 생성합니다.
- Artifact는 검증된 `dist/index.html`과 Byte-identical Copy입니다.
- `artifacts/build-info.json`: Source Commit, Source File별 SHA256, 통합 Source Fingerprint, HTML SHA256, Byte Size.
- `artifacts/SHA256SUMS.txt`: 배포 HTML Hash.
- Source Commit은 App / Tests / CI 구현 Commit입니다. 이후 Artifact / 보고서 Commit은 같은 App Source를 포함하며 Manifest의 File Hash로 동일성을 확인할 수 있습니다.

## Review script

1. HTML을 Desktop Browser에서 열고 Fiber → Optical Train → WG 순서를 확인합니다.
2. Lens F X Position을 반복 변경하고 Layout이 깜빡이지 않는지 확인합니다.
3. WG Port에서 MFDx / MFDy를 입력하고 XY / XZ 라벨을 비교합니다. Optical 결과는 Not calculated를 유지해야 합니다.
4. Component Add / Up / Down / Delete, Lock / Enabled, Undo / Redo를 확인합니다.
5. Save JSON → Example → Open JSON으로 전체 Design 복원을 확인합니다.
6. Mobile에서는 Train에서 선택 후 Edit, Layout / Analysis 탭을 확인합니다.

## Limits

- Symbol / Mode Glyph는 도식입니다. Shape, Gaussian Envelope, Refracted Ray나 Physical Mode Field를 계산한 결과가 아닙니다.
- Train Order와 Absolute Position은 독립적이며 순서 변경만으로 Lens가 움직이지 않습니다. Solver가 없어 Optical Order Consistency 판정은 하지 않습니다.
- Assembly Side는 사용자 지정 Metadata입니다. Mating Plane 이동만으로 Component Side를 자동 재분류하거나 Mechanical Transform을 적용하지 않습니다.
- Variable Flag는 Metadata만 저장하며 Sweep / Optimize / Tolerance는 없습니다.
- Memory State만 사용합니다. 종료 전 JSON 저장이 필요합니다. Undo History / Selection / Camera는 Document Export에 포함하지 않습니다.
- 실제 Android / iOS 기기, Safari / Firefox는 검증하지 않았습니다. Mobile OS의 HTML Preview 앱은 JavaScript 실행이 제한될 수 있습니다.
