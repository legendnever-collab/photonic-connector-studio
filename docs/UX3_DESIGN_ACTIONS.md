# UX3 · 조건 확인 → 자동 설계 → 평가

`0.22.0-ux3`는 UX2 위의 Sol 사용성 변경입니다. 광학 엔진과 유효 도메인은 바꾸지 않습니다.

## 사용 순서

1. **① 설계 예시 → 1번 예시 열기**: 완성된 Fiber–Lens–Lens–Fiber 장면을 유지하면서 **② 연결 조건**을 엽니다.
2. Input / Output 위치와 방향, Mode, Array 조건을 확인·수정합니다. 위치 입력 단위는 µm이므로 Output Y의 0.5 mm 이동은 **500 µm**입니다.
3. **③ 광학계 설계 → 자동 설계 찾기**: 변경한 Input / Output 위치·방향을 고정 목표로 표시합니다. 기존 엔진의 허용 변수와 새 구성을 탐색합니다. 고정하지 않은 부품은 교체될 수 있습니다. 후보 미리보기는 Project를 바꾸지 않으며 **Apply Synthesis Candidate**로 적용하고 Undo로 복원합니다.
4. **현재 Lens 변수 조정**은 기존 Lens 조정 도구입니다. **④ 계산 결과 → 현재 설계 다시 계산**은 현재 구성을 평가하며 자동으로 광학계를 재설계하지 않습니다.
5. **⑤ 결과 정리**에서 Report를 확인합니다.

## 화면 배치

- 왼쪽은 ①–⑤ 순서만 둡니다. 현재 단계의 주요 작업과 창 열기 버튼은 광학 화면 위에 둡니다.
- 오른쪽 **광학계 목록 / 선택 항목 설정** 탭으로 도구를 전환합니다. Explorer는 오른쪽 높이를 사용하며 PC에서 Float / Dock / Close할 수 있습니다. 떠 있는 Explorer에서 부품을 선택하면 설정 창이 열리고 Explorer는 유지됩니다.
- **Surface Data**는 필요할 때 열고 닫습니다. **광학 화면 넓게 보기**는 보조 창을 닫습니다. 배치와 도구 전환은 설계 데이터와 Undo 이력을 변경하지 않습니다.
- 모바일에서는 하단 Surfaces / Inspect / Analysis와 상단 ①–⑤ 순서를 사용합니다. 내부 floating 조작은 PC용입니다.

## 검증과 한계

0.5 mm Y 이동 목표에 대해 mirror2, optical budget 2048, geometry 32, local fit 256에서 실제 조건부 Mode 목표 통과 후보를 확인합니다. Input / Output의 전역 pose를 유지하며 Preview의 비변경, Apply와 Undo를 검증합니다. PC / 모바일 offline HTML, 창 배치와 Project 보존을 브라우저에서 점검합니다.

탐색은 설정한 구조·예산·모델 도메인 안에서 수행합니다. 전역 최적해, 제품 실측 검증, 전체 Array 결합효율 또는 Yield를 보장하지 않습니다. Astra 후속 계획은 `ASTRA_ARRAY_AND_INDUSTRY_EXAMPLES_PLAN.md`의 채널별 계약 → MLA → 비축 Prism → 실제 참고 사례 순서를 유지합니다.
