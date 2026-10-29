# UX1 — Workspace 중심 설계 흐름과 Product Port Arrays

## 기준과 범위

D2.3.5 PR #27 (`ee881cd`) 위에 쌓은 Sol checkpoint다. main 병합은 포함하지 않는다.
사용자 합의: 실제 설계는 자유롭게 이동하는 Workspace, Tutorial은 후속 단계별 안내.
이번 Array는 여러 묶음이 아니라 **하나의 Rows × Columns 배열**이다.

## 사용자 흐름

`새 설계 / Templates → 설계 조건 → 설계 후보 찾기 → 후보 비교 / 이 후보 적용 → Analysis / Report`

- 기본 시작과 새 설계는 optical component가 없는 Input/Output Port다.
- Templates는 Edge / Vertical / Evanescent 상황의 Port·Array·조립 조건만 설정한다.
  “직접 설계” 선택과 장식용 “완성 예시”를 제공하지 않는다.
- Optical Interface와 Assembly는 독립이다. 수직 삽입 Receptacle의 최종 Interface는
  Edge일 수 있다. Template의 치수는 사용자 편집이 필요한 synthetic assumptions다.
- 기존 계산 fixture는 Explorer의 기술 검증용 예시에 남긴다. 개발 번호는 메뉴명에서 뺀다.
  검증 fixture가 곧 제조 가능한 완성 제품이라는 의미는 아니다.
- 기본 설계 작업은 오른쪽 패널의 Ports & Array / 목표·제약 / 후보 비교다.
  Layout과 Surface Data를 유지하며 기존 synthesis를 실제 실행한다.
- Ports는 Project에 직접 반영된다. 목표·제약의 draft는 조건 저장으로 Project에 반영하거나
  그대로 탐색할 수 있다. Preview는 read-only, Apply는 한 번의 Undo다.
- 상세 변수·공차로 이동할 때 현재 draft를 먼저 저장한다. 모달을 닫으면 최신 설정으로
  다시 읽는다. 기존 독립 도구는 고급 도구에 보존한다.

## Product Array 계약

Project v1의 optional `portArrays` extension이다. 기존 파일은 migration으로 임의 보완하지 않는다.
Ideal Project와 legacy multiple-ray channel Project에는 이 extension을 적용하지 않는다.

Input과 Output 각각:

- `rows`, `cols`: 각 1–32, 곱은 최대 256.
- `pitchY`, `pitchZ`: SI, local transverse axes별 독립 pitch.
- `referenceRow`, `referenceCol`: 0-based, 실제 존재하는 대표 Channel.
- UI는 Reference Row / Column을 1-based로 표시한다.

`mapping='row-major'`는 같은 개수 및 같은 대표 linear index를 요구한다.
나머지는 `unassigned`다. 임의 fan-in / fan-out, Channel별 복잡한 연결, 광학 power 분배를
만들어내지 않는다. 개수가 같아져도 자동으로 mapping을 확정하지 않는다.

각 Channel 위치는:

`PortFrame * [0, (col-referenceCol)*pitchY, (row-referenceRow)*pitchZ]`

Port Pose는 실제로 계산하는 대표 Channel의 Pose다. Reference 선택 변경은 기존 Array
위치를 보존하면서 대표 Port를 해당 Channel로 옮긴다. Pitch 편집은 현재 대표 Channel을
고정한다. 전체 Array의 이동·회전은 Port Frame 편집이다. 모든 Channel은 같은 reference
Mode를 공유하는 배치 계약이며 Channel별 field variation은 아직 평가하지 않는다.

## Layout / Report / 계산 범위

같은 `portArrays`에서 두 화면의 실제 Channel 위치를 만든다. Fiber body가 명시되어 있으면
그 치수의 cylinder를 반복한다. Body가 없는 PIC/Custom Port는 **표시용 marker**이며
marker radius가 실제 Coupler 크기나 Mode 크기를 뜻하지 않는다. 광학 부품은 복제하지 않는다.
Report SVG metadata와 눈에 보이는 caption에 Array 계약 / 대표 Channel / 미평가 범위를 기록한다.
Renderer는 `report-figure/2.5.0`이다. Array geometry를 포함해 bounds를 구한다.

기존 ray / Gaussian / synthesis / tolerance는 **대표 Channel**만 대상으로 한다.
전체 Array의 overlap, tolerance, crosstalk, finite-body clearance, shared/per-channel optics 설계는
평가하지 않는다. `arrayAssessment`는 `not-assessed`, Array Mode / tolerance / crosstalk는 null이다.
대표 Channel의 좋은 결과를 전체 Array 성능으로 복제하지 않는다. Evanescent Interface는
전용 field adapter가 없으므로 coupling 및 자동 탐색을 차단한다. PIC device field 미정의 gate도 유지한다.

이 UI checkpoint가 Array physics를 구현했다는 의미는 아니다. 공통 회전·Pitch 오차·외곽
Channel의 field와 clipping, shared optics는 다음 Astra checkpoint에서 별도 검증한다.

## 검증 / 사용자 확인

- Array schema / mapping / reference / JSON roundtrip / legacy 보존.
- 1×16과 4×4 구분, independent Y/Z pitch, local-frame rigid transform covariance.
- Reference 변경 전후 모든 실제 Port 위치 불변.
- 동일 좌표로 Input body 및 Output marker 생성, 가짜 optical component 미삽입.
- Offline desktop/mobile: Template 단일 action, Array 편집·Undo/Redo·재로드,
  Report geometry / SVG metadata, 실제 후보 탐색과 Preview의 비파괴성.
- 기존 model와 browser regression. Starter 검증은 explicit `#starter` fixture를 쓴다.

최종 수와 artifact provenance는 PR에 기록한다. 이 PR 병합과 다음 physics 개발은 사용자 지시 후 진행한다.

## 다음 checkpoint

**Array 물리·공차 계약과 검증 — Astra 권장.** 공통 rigid-body 오차, Pitch와 Channel별 오차,
공유 광학계와 반복 광학계의 구분, Channel별 수신 Mode와 비교 가능한 결과 범위를 먼저 정의한다.
D2.3.6 finite-thickness benchmark도 physics roadmap에 유지한다.
