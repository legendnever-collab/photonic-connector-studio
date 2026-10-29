# D2.6.1 · Connector의 Port–Lens 조립 조건

Version `0.26.1-d261` · 이번 구현 **Sol** · 다음 field propagation / Prism 평가 확장은 **Astra**.

## 바뀐 기본 동작

이전 기본 탐색은 Lens 편심·tilt를 허용했다. Output Z=100 µm이면 Lens 중심을 약 25/75 µm 편심시켜 높은 Gaussian overlap을 얻을 수 있었지만, 이는 사용자가 의도한 동축 Fiber–Lens collimator와 다른 조립이다.

새 기본값은 `synthesis.lensMount='port-axis'`이다. Input / Output Port와 Mode를 고정하고, 추가·유지하는 Lens는 해당 Port의 광축을 따라 축 방향 거리·곡률·두께만 조정한다. Folded connector 목표 통과에는 Input과 Output 앞의 Lens 두 개를 요구한다. 편심 Lens로 높이 차이를 우회하지 않는다. Lens가 없는 collimated-field 경로 등은 참고 후보로 남을 수 있지만 기본 connector 목표 통과가 아니다.

`lensMount='free'`는 고급 자유 광학계 모드다. 사용자가 명시적으로 선택하면 기존 bounded Lens 편심·tilt 보정이나 중간 Lens 배치를 사용할 수 있다. Beam steering을 위해 Fiber–Lens 편심 조립을 의도한 경우 또는 Lens 없는 collimated reference를 검증하는 경우에 사용한다. 이 모드에서도 Port·Mode·고정 면·부품 상한·기하/physical gate는 유지한다.

**이 변경은 동축 조립과 탐색 자유도의 구현이다.** 중간 경로가 충분히 collimated인지, 실제 total coupling / coating / 제조 Yield가 맞는지 인증하는 기능은 아니다. 기존 Gaussian 목표 통과와 D2.6 benchmark의 수렴·한계를 구분한다. PIC의 receiving field가 미정의이면 동축 조건을 맞춰도 coupling으로 표시하지 않는다. Port 축은 정의한 optical direction이며 모든 PIC에 칩 표면 수직을 강제하지 않는다.

## 사용 순서

1. 1번 예시 → ② 연결 조건에서 Input/Output 위치·방향·Mode를 정의한다.
2. ③ 광학계 설계 → 자동 설계 찾기 → **Port–Lens 조립 방식: 기본 · Port–Lens 동축 유지**를 확인한다.
3. Total / new 상한 4, Lens 2, Mirror 2로 2-Lens + 2-Mirror 경로를 탐색한다. 2-Prism을 비교하려면 **2 Lens + 2 Prism 탐색 허용**을 누른다. 이 버튼은 total/new/Lens/Prism 상한과 prism2 family만 허용하며 구경·공간·제조 치수는 바꾸지 않는다.
4. 작은 높이 차이에서 후보가 없으면 **구조별 탐색 상태**의 body clearance, 공간, 구경, 치수·예산 사유를 확인한다. 미발견은 불가능 판정이 아니다. 결과를 만들기 위해 MFD나 제조 범위를 자동 변경하지 않는다.
5. 의도적으로 편심 조립을 설계할 때만 고급 모드를 선택한다. 조립 모드를 바꾸면 이전 결과는 stale이고 Apply할 수 없다. 조건 저장·후보 Apply는 Undo가 가능하다.

## 저장·기존 파일·재검증

- Schema는 optional `lensMount: 'port-axis' | 'free'`를 추가한다. 새 저장은 policy를 명시한다.
- 이전 파일에 policy가 없으면 **port-axis**로 해석한다. 과거 `lensAlignment` 범위가 저장돼 있어도 편심 조립에 동의한 것으로 간주하지 않는다. UI에서 이전 범위를 사용하지 않는다고 안내한다.
- 기본 모드에서는 alignment와 interior Lens 컨트롤이 비활성화된다. 과거 all-air 설정도 동축 정책을 우회하지 못한다.
- 기존 prescription을 열거나 수동 편집한 광학계를 자동으로 이동·삭제하지 않는다. 새 Search / Preview / Apply에 조립 정책을 적용한다. 예전 파일의 solution/효율 표시는 새 조건으로 다시 탐색·검증해야 한다.
- nominal fit 시작, 최종 후보 유지, Apply replay에서 정책을 확인한다. Lens의 실제 surface world frame을 사용하므로 nested assembly나 global rigid transform에서도 같다.
- Lens front/rear는 Input 앞 첫 구간 또는 Output 앞 마지막 구간에 있어야 한다. Port 축으로부터 nominal lateral offset ≤1 nm, axis dot ≥1−10⁻¹⁰를 검사한다. 이는 nominal 구조의 수치 검증 허용치이며 제조 공차 1 nm를 요구한다는 뜻이 아니다. OAT/joint 공차 오차는 별도 기존 평가에서 처리한다.
- Report와 탐색 설정은 요청한 조립 정책과 기존 형상의 일치/미완성/불일치를 구분한다. Report는 조립 정책을 표시하고 Project / Report SVG metadata의 synthesis contract에 보존한다.

## 재현 결과

1번 예시, Output X=10 mm / Y=0, 원래 방향과 SMF Mode 유지, total/new=4, Lens/Mirror=2, 기본 제조 범위·기본 예산.

| Output Z | 기본 동축 모드 결과 |
|---:|---|
| 100 µm | 후보 미확보. Alignment ray trace 0회. 검사한 경로에 conservative body clearance 충돌 등이 기록됨. 편심 2-Lens로 대체하지 않음. |
| 500 µm | 양 끝 동축 Lens 2개 + Mirror 2개 후보 확보. Conditional Gaussian overlap ≈1. Apply 재검증 통과, Port/Mode 유지, alignment trace 0회. |

100 µm에서 다른 치수·구경·topology로 해가 없다는 뜻이 아니다. 현재 기본 Clear radius 200–500 µm는 Mirror disc 지름 440–1100 µm를 만든다. 가까운 두 90° fold의 작은 높이 차이와 body extent가 충돌할 수 있다. AABB screening은 보수적이고 bounded seed/budget도 partial이다. 치수 변경은 사용자가 제조 가정을 검토한 뒤 명시적으로 해야 한다.

Prism2는 family와 부품 상한 외에도 leg ≥4×Clear radius, finite body clearance를 통과해야 한다. **현재 Prism 이후 powered Lens의 Mode 전달은 미지원**이다. 기본 양 끝 Lens connector의 2-Prism nominal coupling을 이번 변경으로 해결했다고 주장하지 않는다. 기존 Lens 없는 두 Prism collimated-field 예시는 고급 자유 광학계 reference로 명시해 검증을 유지한다.

## 검증

- Default / missing-policy legacy bounds는 편심을 허용하지 않음.
- Nominal decenter / tilt 거부, nested global frame covariance, Folded 양 끝 Lens completeness.
- ±100 µm에서 편심 direct 후보 없음, Project 불변, 고급 모드의 기존 signed compensation 검증 유지.
- 500 µm의 실제 2-Lens + 2-Mirror Search→Apply, Port/Mode 불변, 동축 재검증.
- PC·모바일: 기본 100 µm 탐색·미발견 설명, 이전 파일 정책, explicit advanced opt-in, Prism 상한 버튼, 저장/Undo/Report.
- 전체 test/CI 결과와 standalone fingerprint는 PR/build manifest에 기록한다.

## 다음 계획 — Astra

1. Port–Lens 기본 조립 조건을 유지한 채 중간 expanded-beam 구간의 collimation 목표를 명시하고 검증한다. Nominal Mode 정합과 중간 beam 조건을 별도 판정한다.
2. Lens 내부·사이 diffraction을 포함하는 propagation reference를 analytic controls와 grid/window convergence로 검증한다.
3. Lens–Prism–Lens / 2-Prism의 powered Lens 이후 field 전달을 구현·검증하고 µm offset connector에 연결한다. 기존 physics gates를 근거 없이 완화하지 않는다.
4. Array의 Port–MLA 조립 관계와 채널별 성능을 검증한 뒤 SENKO/Teramount 공개 구조를 가정 치수와 구분해 예시로 추가한다.
