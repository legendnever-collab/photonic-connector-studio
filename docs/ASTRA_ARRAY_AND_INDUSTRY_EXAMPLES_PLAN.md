# Astra 개발 계획서 — 의미 있는 Array·비축·기업 사례 예시

작성일: 2026-10-28 (KST)  
기준: UX2 guided workspace, A1 shared-optics channel study  
목표: 예시를 열어 실제 광학계와 기준 계산을 확인하고, 조건 변경 후 동일한 방법으로 재계산·비교한다.

## 1. Sol 완료 범위와 Astra 인계 원칙

Sol은 왼쪽 작업 순서, 큰 광학 화면, Surface Data 펼침/접기, 일관된 버튼 크기,
계산 상태와 재계산 경로, 1번 단일 Channel 기준 예시를 제공한다.
1번은 기존에 검증된 두 개의 유한 두께 BK7 Lens 구성과 Gaussian evaluator를 재사용한다.
이는 제조된 제품의 총 효율 검증이 아니라, 선언된 Gaussian 기준 Mode의 정합 예시다.

Astra는 UI 메뉴를 다시 늘리지 않고 아래 모델을 같은 작업 흐름에 연결한다.
아직 계산 모델이 없는 예시는 개발 계획에만 보이고 실행 가능한 예시 버튼을 갖지 않는다.
실행 가능한 예시는 한 번의 열기로 기준 모델·입력값·계산 범위·결과가 준비돼야 한다.

기본 흐름: ① 설계 예시 → ② 연결 조건 → ③ 광학계 설계 → ④ 계산 결과 → ⑤ 결과 정리.
공통 Project가 유일한 설계 원본이다. UI 창 배치와 선택 단계는 Project의 광학 데이터를 변경하지 않는다.
기존 대표 Channel synthesis가 전체 Array를 최적화했다고 표시하지 않는다.

## 2. 최종 사용자 예시 목록

| 번호 | 예시 | 학습·검증 목적 | 완료 기준 |
| --- | --- | --- | --- |
| 01 | Fiber–Lens–Lens–Fiber | Collimation/Focusing, 위치·간격과 Mode 정합 | Sol 기준 예시 유지, 독립 기준값과 회귀 확인 |
| 02 | Fiber Array–MLA–MLA–Fiber Array | Channel별 Lenslet 소유 관계, Pitch와 공통 정렬 | 1×8 및 2차원 grid에서 모든 Channel을 독립 평가 |
| 03 | MLA + Prism 비축 연결 | 방향·높이 변화, 내부 전파, 반사 parity | Fiber 출력으로 먼저 검증한 뒤 PIC 확장 |
| 04 | SENKO 공개 구조 기반 PIC 연결 | 실제 반사 광학계와 Edge/Surface 연결 구조 | 특정 공개 제품/도면과 구현 부품의 대응 및 지원 범위 검증 |
| 05 | Teramount 공개 구조 기반 PIC 연결 | Plug/Bump의 광학 기능·조립 관계 | 특정 공개 구조를 고정하고 전파·정렬·수신 Mode를 검증 |

1×8, 2×4 등의 변형은 별도 메뉴를 늘리지 않고 해당 예시의 구성 선택으로 제공한다.
Focuslight 자료는 03의 Collimation/Refocusing 및 통합 Microprism Lens 구성 참고에 사용한다.
기업 사례를 범용 평면 Mirror나 단순 구면 Lens로 치환했다면 그 근사 범위를 명시한다.
임의로 만든 구조에 기업 이름만 붙이지 않는다.

## 3. A2.1 — Channel과 광학 부품의 대응 계약

먼저 데이터 계약과 좌표계를 구현하고 독립 검증한 후 실제 MLA 예시를 연결한다.

- 제품 Port Array와 광학 Surface Array를 구별한다. 제품 Channel 수가 광학 부품 복제를 뜻하지 않는다.
- `shared`와 `per-channel` 광학 요소를 명시하고, 반복 Assembly의 기준 frame과 Channel별 local transform을 저장한다.
- 원본 부품은 실제 Lens면·Prism 입출사면·반사면·재료·Aperture·body를 갖는다.
- 생성된 Surface/Assembly ID는 안정적이고 고유해야 하며, Source recipe와 생성 결과의 동기화 규칙을 정한다.
- Input/Output mapping은 명시적인 일대일 대응으로 시작한다. 방향 전환과 상 반전 후의 row/column parity를 검증한다.
- Rows/Columns, Pitch Y/Z, 대표 Channel을 바꿔도 어느 실제 부품과 연결되는지 추적할 수 있어야 한다.
- Channel별 emitted/received Mode와 동일 Mode 공유 가정을 구분한다. 매질·편광·정규화·기준면·phase를 저장한다.
- 기존 JSON에 정보를 자동으로 발명하지 않는다. optional extension 또는 명시적 migration을 사용한다.
- 광학 엔진과 Layout·Report가 동일하게 컴파일된 실제 좌표를 사용한다.

대상 코드: `src/project/portArrays.ts`, `arrayStudy.ts`, `model.ts`, `geometry.ts`,
`src/surface/model.ts`, `src/authoring/arrayReference.ts` 및 새 repeat/ownership compiler.
현재 `arrayStudy`는 모든 Channel이 같은 기존 광학계를 통과하는 evaluator다.
이를 그대로 사용해 개별 Lenslet을 평가했다고 표시해서는 안 된다.

필수 테스트: 독립 좌표 계산, rigid transform covariance, 임의 Roll, representative 변경 시
실제 배치 보존, 반사 parity, JSON/Undo/Redo, ID 안정성, 원본 수정 후 재생성 및 stale 결과 제거.

## 4. A2.2 — 02번 MLA Array 예시

구성: Gaussian Fiber Array → MLA 1 → 공기 gap → MLA 2 → Gaussian Fiber Array.

1. 단일 Channel의 검증된 두-Lens 구성에서 시작해 Channel별 실제 광학계를 생성한다.
2. Pitch와 Lens 외경·sag·edge thickness가 물리적으로 양립하는 치수 범위를 먼저 정한다.
   현재 01의 mm급 Lens를 127 µm pitch로 겹치게 복제하지 않는다.
3. 초기 입력값은 가정 치수로 공개한다. 특정 제조사 사양으로 표시하지 않는다.
4. 1×8에서 시작하고 같은 계약으로 2차원 grid를 검증한다.
5. Channel별 독립 전파·Mode 정합·Aperture/body 검사를 수행한다.
6. 공유 광학계와 Channel별 광학계 결과를 혼동하지 않는 regression을 추가한다.

검증: 균일하고 독립인 반복 구조가 같은 단일 Channel 해를 재현하는지 확인한다.
공통 정렬·Pitch 오차 후에는 독립 해 또는 별도 수치 field integral과 비교한다.
최소 두 단계의 sampling/window refinement로 수치 수렴을 기록한다.
허용 오차는 비교하는 모델과 관측값마다 사전에 정하고, 수치 수렴을 물리 정확도 보증으로 부르지 않는다.

## 5. A2.3 — 03번 MLA + Prism 비축 예시

초기 수신부는 Fiber Gaussian Mode로 고정해, PIC field 미정의와 광학계 검증을 동시에 풀지 않는다.
최종 광축의 방향, 입출력 높이차, 조립 방향을 별개로 저장한다.

- 필요 광학 기능: 송신 측 Collimation, 방향 전환, 수신 측 Focusing/Mode Matching.
- 기능이 별도 Lens/Prism에 배치되는지, 통합 Microprism Lens의 powered face에 있는지 명시한다.
- 실제 입사/반사/출사면, finite thickness, 매질 n(λ), body와 유효 Aperture를 정의한다.
- TIR과 코팅 반사를 구별한다. TIR에서는 TE/TM 위상, 임계각 근처 angular spectrum을 검사한다.
- 비축 powered interface와 TIR 결합은 기존 solver의 제한을 확대하기 전에 독립 benchmark를 만든다.
- 광학적으로 인접한 Channel의 부품 및 경로에 대한 clearance/clipping을 검사한다.

검증: 정확한 vector chief ray, 매질별 OPL, unfolded reference가 가능한 한계,
반사·회전 covariance, TE/TM angular-spectrum 비교, 외곽 Channel, 부분 차광,
임계각·큰 입사각·큰 divergence에서의 유효 범위 이탈을 포함한다.
finite-thickness curved-interface field benchmark(D2.3.6 roadmap)를 이 단계와 연결한다.

## 6. A2.4 / A2.5 — SENKO와 Teramount 사례

두 사례는 독립 checkpoint로 진행한다. 구현 전 공식 자료·공개 특허의 최신 버전과 도면을 다시 확인한다.

확인할 공식 출처:

- SENKO MPC: https://www.senko.com/mpc-series/
- Teramount/TeraVERSE 공식 진입점: https://teramount.com/products/teraverse/
  (현재 공식 리디렉션의 제품 페이지도 함께 보존)
- 사용자 첨부 Focuslight brochure의 FAU-side / PIC-side Coupling Lens Array 도면.

자료 대조표의 필수 열: 문서/URL/접근일/도면 번호, 공개된 구조·수치, 프로그램 부품·필드와의 대응,
가정값과 근거, 미확인 항목, 비교할 결과와 비교 가능 조건.
성능 수치만 알려진 경우 이를 solver의 입력값이나 가정 tolerance 분포로 역산하지 않는다.

SENKO는 선택한 반사면이 평면인지 곡면/비구면/자유곡면인지 확인한다.
금속 반사면의 형상 제어 기능을 단순 beam turn으로 대체할 수 있는지 검증한다.
Teramount는 Plug/Bump의 역할, 수신부 종류, deflection/spot-size conversion/beam expansion의
구현 면을 특정한다. 기업명만으로 Grating 또는 Edge 한 종류로 분류하지 않는다.

PIC Receiving Field가 필요하면 complex field import 또는 독립 device simulation 결과가 필요하다.
파일은 λ, n, 좌표축, sampling, complex amplitude, phase convention, polarization,
normalization과 reference plane을 가져야 한다. 데이터 부재 시 Gaussian surrogate는
명확히 surrogate로 표시하고 실제 PIC 효율을 주장하지 않는다.
Grating 자체의 파장·각도·편광 응답을 외부 Lens/Prism Gaussian 전파가 계산한다고 표시하지 않는다.

각 사례의 성공 기준은 “제품과 숫자가 같다”가 아니다. 같은 입력/정의/평가면에서 비교 가능한
관측값을 재현하고 차이·미확인 항목을 설명해야 한다. 공개 입력이 부족하면 구조 모델 단계로 남긴다.

## 7. A2.6 — Array 공차와 정렬 비교

위의 nominal 모델을 검증한 뒤 다음 오차를 분리한다.

1. 공통 rigid-body 이동·회전: 무엇이 함께 움직이는지, pivot과 local axes를 명시.
2. 체계적인 Pitch 오차: interval 오차와 first-to-last 누적 오차를 구분.
3. Channel별 위치·각도·Lens 제작 편차: 독립/상관 관계를 명시.
4. 광학 부품의 제작·조립 오차: 곡률, 두께, 재료, prism angle 등 지원 범위별 처리.

두 상태 비교, OAT, bounded joint scenarios, 확률분포 기반 Monte Carlo를 혼합하지 않는다.
제조사 공차 상한을 표준편차로 자동 변환하지 않는다. Yield에는 사용자 정의 분포·합격 조건·
샘플 수·seed·표본 오차가 필요하며, 누락 Channel 또는 미지원 물리가 있으면 전체 Yield를 표시하지 않는다.

## 8. 공통 표시·검증·완료 조건

- 예시 카드: 목적, 구조 그림, 주요 변수 2~3개, 출처와 가정의 펼침 영역, 하나의 실행 버튼.
- 기준값과 현재값의 비교는 같은 evaluator/version, Mode 정의와 정규화 조건을 따른다.
- 결과는 Channel별 status/reason/좌표/조건부 overlap/유효 범위를 보존한다.
- 모든 Channel이 유효할 때만 해당 상태의 전체 평균·최저값을 제공한다.
- 설계/설정/입력 변경 시 fingerprint로 이전 결과를 숨긴다. 미적용 숫자 입력도 무효화한다.
- Transmission, Conditional Mode Overlap, Device Coupling, Total Coupling을 구분한다.
- Report·Layout·JSON은 같은 실제 Array 좌표와 평가 범위를 사용한다.
- PC/모바일 offline 흐름: 예시 열기→변수 수정→재계산→비교→Report/JSON→재로드→Undo/Redo.
- model tests, 독립 물리 비교, typecheck, build, browser regression 및 정확한 PR HEAD CI 통과.
- standalone HTML의 source fingerprint와 SHA/bytes를 CI와 일치시킨다.
- 각 checkpoint는 Draft PR과 실행 HTML, 검증 증거, 다음 모델 추천을 남긴다.
  병합은 사용자 지시가 있을 때 수행한다.

## 9. 권장 실행 순서

**A2.1 계약 → A2.2 MLA 기준 예시 → A2.3 비축 Prism → A2.4 SENKO → A2.5 Teramount → A2.6 공차.**

각 단계의 물리 검증이 통과한 범위만 실행 가능한 예시에 승격한다.
첫 Astra 작업은 A2.1의 부품 소유 관계·반복 좌표 계약과 A2.2의 1×8 기준 MLA다.
곡면/TIR/PIC field가 검증되지 않은 상태에서 모든 기업 사례를 한 번에 완성 처리하지 않는다.
