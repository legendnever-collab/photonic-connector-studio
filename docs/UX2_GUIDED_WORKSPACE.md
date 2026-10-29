# UX2 — 예시에서 시작하는 설계 Workspace

## 사용자 흐름

기본 시작 화면에 계산 가능한 01 Fiber–Lens–Lens–Fiber 예시를 제시한다.
실제 Lens 네 면과 두 body, Fiber 기준 Mode와 10 mm 간격을 갖는 기존 Gaussian relay다.
기존 A1 construction/evaluator를 재사용하며 새 물리 모델을 도입하지 않는다.

왼쪽 순서: 설계 예시 → 연결 조건 → 광학계 설계 → 계산 결과 → 결과 정리.
단계는 자유롭게 이동한다. 광학계 설계는 Surface 화면으로 돌아가며 data/inspector를 접는다.
연결 조건은 닫힌 Inspector를 다시 열고 Ports/Array 설정을 보인다.
계산 결과는 PC에서 넓은 결과 Workspace, 모바일에서는 고정 작업 메뉴 아래 결과 패널을 제공한다.
결과 정리는 같은 Project의 Report를 연다. 부품 선택도 Inspector를 다시 연다.

## 예시와 계산 상태

- 첫 예시를 열면 기준 모델의 조건부 overlap 결과가 준비된다.
- 기준값과 현재값은 분리되어 표시된다. 광학 데이터 변경이나 미적용 숫자 입력 후 이전 현재값을 숨긴다.
- 현재 설계 다시 계산 버튼은 기존 tensorOverlap을 실제 실행한다.
- 미계산 이유와 연결 조건으로 이동하는 버튼을 제공한다.
- 계산 가능한 01과 개발 예정 02–05를 구별한다. 예정 항목은 실행 버튼을 갖지 않는다.
- 기존 Port-only 시작 조건, 공용 Mirror/Relay 연구 예시는 모달의 고급 drawer에 보존한다.
- 기존 기술 수치 fixtures도 Explorer에서 명시적으로 펼쳐 사용한다.
- 기존 Project 교체 보호와 Undo/Redo를 유지한다. 새 예시 열기도 requestReplace를 사용한다.

## 화면과 표시

상단은 파일·새 설계·예시·Undo/Redo다. 부품 추가, 조건, 고급 도구와 창 제어는 왼쪽에 모았다.
Surface Data는 일반 시작에서 접혀 있고 버튼으로 열고 닫는다. 창 배치 저장 키를 UX2로 구분해
이전 작은 화면 설정을 새 기본 화면에 그대로 적용하지 않는다. 명시적인 #starter/#surfaces/#ideal
등의 수치 fixture 진입은 data view를 유지한다. 패널 배치·resize는 광학 Project를 변경하지 않는다.

상단/왼쪽 주요 버튼은 14 px, 높이 36 px 이상이다. 입력/설명/패널 제목의 크기를 공통 규격으로
정리하며 SVG 과학 annotation의 크기는 별도로 유지한다. 편집 종료 · Layout은 광학 화면 보기로
이름과 역할을 정리하고, 선택 항목 설정 / 계산 결과로 Inspector 탭을 표시한다.
모바일 고정 Inspector는 작업 메뉴를 가리지 않으며 메뉴의 가로 스크롤을 지원한다.

## 검증

01 모델의 실제 두 Lens/네 굴절면, 단일 Channel, JSON roundtrip, 99.9% 이상 기준 overlap과
5 µm Output 이동 시 overlap 감소를 검증한다. 이것은 Gaussian 모델의 정합이며 제품 효율이 아니다.
Offline desktop/mobile에서 예시 → 조건 수정 → 이전값 제거 → 실제 재계산 → 큰 Layout → Report,
모달의 단일 primary 예시, 패널 접기·복원 시 Project 보존, 버튼 크기 및 화면 overflow를 확인한다.
기존 회귀는 명시적으로 Surface Data나 기술 예시 drawer를 열도록 사용자 경로를 갱신한다.

다음 Astra 작업의 모델 계약·checkpoint·독립 검증·완료 조건은
[ASTRA_ARRAY_AND_INDUSTRY_EXAMPLES_PLAN.md](ASTRA_ARRAY_AND_INDUSTRY_EXAMPLES_PLAN.md)에 기록했다.
이 단계에서 반복 Lenslet/Prism, 기업 제품 성능, PIC field 또는 Array Yield를 구현했다고 표시하지 않는다.
