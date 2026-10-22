# Photonic Connector Studio — Master Plan

Status: P0 / Architecture baseline (2026-10-23)
Repository: legendnever-collab/photonic-connector-studio
Working branch: feature/p0-foundation

## Mission
Fiber-to-Waveguide Optical Coupling과 Detachable Fiber Connector를 설계·비교·최적화하는 Engineering Workstation을 개발한다.
DeepO는 UX/Workflow 참고 대상이다. Proprietary software, branding, backend는 복제하지 않는다.

## Core boundary
- Left Port: Fiber optical field source (+X), 기본 예제 1310 nm SMF
- Right Port: Photonic Substrate Waveguide guided-mode receiver
- Optical components between ports are editable: Gap, Thin Lens, Physical Lens (later), Mirror (later), coordinate transforms (later)
- Waveguide 전체 routing은 solver 범위가 아니다. Waveguide edge reference plane과 accepted mode field를 boundary model로 정의한다.
- Waveguide material, optical mode, coupling architecture, lens number, connector mechanical requirements는 TBD이며 Design Variable이다.
- Horizontal edge coupling은 초기 예제일 뿐 제품 구조 선정 결과가 아니다.

## Product workflow
Create/Open Design → Edit Optical Train and Ports → View 2D Layout → Compute Beam/Field → Evaluate Mode Overlap → Sweep/Optimize → Tolerance Study → Save/Export

## Architectural layers
- UI/State: React + TypeScript + Vite
- Domain: Optical Port / Optical Component / Optical Train / Design Document
- Physics v1: Gaussian q-parameter, ABCD and scalar Gaussian overlap with analytical test cases
- Physics v2: Lens surfaces, ray tracing, aperture, wavefront, complex field propagation and imported waveguide mode
- Engineering v3+: optimized design variables, Monte Carlo error distributions, rigid-body alignment and array channels
- Persistence: versioned JSON schema; no compulsory server dependency for P0–P1

## Guardrails
- Physics models are pure functions independent of UI; display only values that have been calculated.
- Distinguish Preview geometry from physical ray/beam computation.
- Units and reference planes are explicit.
- Source-first, incremental checkpoints; do not replace proven work by recreating it.
- No merge to main until user Play Review and explicit approval.
- Do not auto-start a later checkpoint.

## P0 Exit Criteria
1. React/TypeScript/Vite app and usable left Fiber/right WG 2D editor.
2. Properties and component tree use a single typed design state; edits update geometry without flicker.
3. Versioned Save/Load JSON and one 1310-nm example.
4. No fabricated coupling numerical output; placeholders are labeled.
5. Build, tests, offline artifact/open instructions, documented known limits.
6. Draft PR to main, left unmerged.
