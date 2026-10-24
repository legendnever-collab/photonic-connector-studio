# Latest U1 Starter checkpoint

Read `docs/FIBER_LENS_FIBER_STARTER.md` first. Preserve startup Fiber–BK7 Lens–Fiber,
Input/Output Fiber templates, two real Fiber bodies, 10 mm facet spacing and the
shared named Lens medium. Latest verified source is in `artifacts/build-info-u1.json`.

# U1 다음 Checkpoint

U1 Draft PR #10: https://github.com/legendnever-collab/photonic-connector-studio/pull/10
검증 Source: `3881889fd68a2ea2e737c04b5d1f885b287c2e35`.
SMF 기본 Input Reference (1310 nm / MFD 9.2 µm / Gaussian Waist)를 유지한다.
PC 우선. 사용자 Play Review 전 main 병합 금지. 다음 기능 자동 시작 금지.

재개 시 `docs/U1_IMPLEMENTATION_REPORT.md`, `docs/U1_MODE_PORT_CONTRACT.md`,
기존 Surface evaluator / geometry / trace를 먼저 읽고 현재 원격 Branch를 확인한다.
U1을 다시 만들거나 Port와 Component를 새 저장 모델로 분리하지 않는다.

승인된 후속 Checkpoint는 F1.1 Conic / Aspheric이다. 공통 sag / gradient / normal /
intersection / Report geometry를 연결하고 Radius / Conic / 계수와 Decenter / Tilt를
같은 Surface ID로 편집한다. Sphere limit, 독립 Normal, root residual, Trace / Report
형상 일치 기준 사례를 검증한다. U1의 입력·Tree·Dock·History·SaveLoad를 유지한다.

B1 Physical Mode Bridge는 별도 승인 Checkpoint다. 강하게 구속된 Port Mode를
일반 Ray나 두 Transverse E 성분으로 조용히 치환하지 않는다. Sampling / Frame /
정규화 / Phase 전달을 검증하기 전에는 Coupling 결과를 활성화하지 않는다.
