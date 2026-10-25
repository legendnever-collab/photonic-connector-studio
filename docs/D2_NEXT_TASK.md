# D2.1 — Blank Project Automatic Synthesis 첫 구현 지시문

**상태: 다음 작업 계획. 사용자 구현 지시 전 실행 금지.**
Repository: https://github.com/legendnever-collab/photonic-connector-studio
기준: D2.0 문서 branch `docs/d2-0-synthesis-architecture` 및 그 parent D1.
새 구현 branch 권장: `feature/d2-1-blank-project-synthesis`.

## 0. Mission과 정지 조건

빈 Physical Project에서 필요한 Lens/planar Mirror를 직접 생성하고, 제한된 조합의
연속 변수를 조정하여 실제 Output Gaussian Mode reference와 비교하는 첫 end-to-end
slice를 만든다. Prism은 같은 pipeline의 geometry/Q-reference 후보로 연결하고
Mode overlap 미평가를 표시한다. D1과 기존 학습/편집·Physics·Report를 보존한다.

이번 지시문을 사용자가 실행하라고 요청한 경우 **D2.1만** 구현한다. 다음 D2.2,
Parabolic/Freeform, 전체 robust engine, 선행 stack/main 병합은 시작하지 않는다.
검증된 실행 HTML·manifest·Draft PR·사용자 확인 순서를 완성하고 멈춘다.

## 1. Recovery-first

1. 최신 remote main/PR #13–#17 및 D2.0 문서 branch/PR의 상태·HEAD·CI를 확인한다.
   [D2_RECOVERY_AUDIT.md](D2_RECOVERY_AUDIT.md)의 값은 재확인의 기준이지 최신값 보장이 아니다.
2. AGENTS.md와 사용자 변경/local dirty state를 확인한다. 최신 D1 tree를 보존한다.
   SHA가 다르면 tree와 source를 비교하고 main만 기반으로 시작하지 않는다.
3. [Roadmap](AUTOMATIC_SYNTHESIS_ROADMAP.md) → [계약](D2_AUTOMATIC_SYNTHESIS_CONTRACT.md)
   → D1/B1/S2/S3.1/S3.2 문서를 읽는다. 기존 문서를 전부 재작성하지 않는다.
4. D2.0은 문서만 작성했으며 새 엔진/overlap/constructor는 없다. D1 HTML version은
   `0.10.0-d1`이다. D2.0 문서만으로 새 기능이 작동한다고 가정하지 않는다.

## 2. 이번 구현의 범위

| 영역 | 이번에 완료할 것 | 후속으로 남길 것 |
|---|---|---|
| Problem | fixed Mode Ports, 기존 locks/part/space limits, finite manufacturing family/bounds와 전역 budget | arbitrary shape parameterization |
| 생성 | 0/1/2 Lens constructor, Direct/1 Mirror/2 Mirrors, TIR Prism/Mirror+Prism reference branch | curved Mirror, Asphere departure, Freeform, 배열 |
| 배치 | 첫/마지막 free-space segment 중심의 Lens allocation; known initial 4-Surface train 유지/교체/추가 | 모든 중간 segment allocation과 arbitrary fixed-anchor route |
| 최적화 | route closure seeds + Lens bounded fitting + Mode 평가를 통한 route placement 재방문 | global optimum 보장 |
| Mode | 직선/B1 parity 및 ideal planar Mirror 경로의 새 conditional normalized scalar Gaussian overlap | Prism/TIR η, 실제 PIC field/효율, full diffraction/transmission |
| 공차 | 비교 가능한 supported OAT의 observed minη·coverage·부분 feedback | combined-error worst case, Yield, 전체 robust optimization |
| UX | New Physical Project에서 시작, 명시적 Output SMF 선택, 한 번의 자동 설계 action, 후보/실패/residual, read-only Preview와 one-Undo Apply | PC 환경과 무관한 모바일 대규모 재설계 |

Prism branch가 η 미평가인 이유를 후보와 Report에 보존한다. 첫 Mode-qualified slice가
Lens/planar Mirror domain이라는 점을 release/PR에 명시한다. 모든 Lens/Mirror/Prism
조합의 성능 설계를 완료했다고 보고하지 않는다.

## 3. 내부 검증 순서

A. 새 Output-frame tensor Gaussian overlap부터 독립 complex quadrature, unfolded
reference, rigid transforms, B1 logη parity로 검증한다. 미통과 상태에서 folded η를 UI에
붙이지 않는다. 이는 별도 전체 field solver 개발이 아니라 이 slice의 필수 evaluator gate다.

B. 빈 Project에 real Lens pair/body를 만드는 constructor와 기존 row/ID/ancestor lock
보존을 검증한다. 렌즈가 있던 starter를 몰래 로드하거나 fixed answer를 주입하지 않는다.
Output reference 미정의는 명시적으로 해결하고, 임의 Mode/phase를 만들지 않는다.

C. topology별 연속 fitting과 Mode 기준 route placement feedback을 연결한다.
한 번의 자동 action이 0 optical component에서 시작해야 한다. 기존 geometry 상위
후보만 받아 순차 실행하는 것으로 통합 완료라 하지 않는다. nominal/partial/model-limited
후보와 budget/constraint/input/model 사유를 나눈다.

D. Preview/Apply/Undo/Redo/SaveLoad/Report를 연결하고 실제 PC workflow를 검증한다.
각 내부 단계는 작은 commit으로 남긴다. 독립 물리 검증이 막히면 scope를 속여 줄이지
말고 blockers·best verified checkpoint를 보고하며 멈춘다.

## 4. 필수 재현 조건과 수용 기준

New Physical Project의 Input은 원점 +X, λ=1310 nm, MFD=9.2 µm인 SMF reference다.
Output도 명시적으로 SMF reference로 선택하고 X=10 mm, Y=0, Z=5 mm, +X로 설정한다.
UI가 µm를 쓰면 X=`10000`, Y=`0`, Z=`5000`이다. New Project는 Lens가 없는 경로다.

기본 수용 fixture의 Design Space는 X=[0,10] mm, Y=[−3,3] mm, Z=[−2,7] mm로
명시한다. 이 값은 테스트 가정이며 사용자 Project에 강제로 저장할 자동 기본값이 아니다.
부품 body의 전체 extent를 검사하고 Fiber shells/Keep-out clearance도 유지한다.
maxParts=4, maxGenerated=4, per-kind Lens≤2, Mirror≤2, Prism≤1로 출발한다.
이는 Lens2+Mirror2를 허용하면서 Prism 대안을 검토하는 상한이지 고정 정답이 아니다.

| 수용 항목 | 판정 |
|---|---|
| 첫 자동 구성 | optical component 0개 → 한 action으로 real Lens와 Mirror 후보 생성. 수동 Lens 추가 요구 없음 |
| 5 mm Mode 정합 | 적어도 하나의 Lens/planar-Mirror 후보가 geometry/finite-body/space/clearance 및 기존 Gaussian validity gates 통과 |
| nominal 성능 | 해당 fixture에서 size error ≤5%, phase error ≤0.05 rad, 새 검증된 conditional scalar η≥0.90. 이 값은 engineering 수용 목표이며 실측/제품 성능 보장이 아님 |
| Port 보존 | Input/Output pose·Modes·wavelength/contract를 탐색과 Apply가 바꾸지 않음 |
| topology 일반성 | source 위치/거리/offset/방향을 읽어 생성. 특정 이름/5 mm 값/저장된 prescription으로 분기하지 않음 |
| 초기 4-Surface | 두 physical Lens pair를 초기안으로 전달. unlocked train은 유지/교체/추가 중 조건에 맞게 탐색; full lock/Min=Max는 정확히 보존 |
| UI와 상태 | Preview는 Project를 쓰지 않음. Apply 1회/Undo 1회, 모든 View와 JSON/Report의 실제 geometry 일치 |
| 미평가/실패 | Prism η 미평가, 누락 Mode, 제약 거절, 탐색 예산 소진, 취소, stale/tamper를 각각 검증 |

목표를 못 맞추면 단순히 partial 후보를 표시하는 기능만으로 이 fixture의 성공 gate를
통과시키지 않는다. budget/제조 범위/validity가 원인인지 기록하고, gates를 몰래 완화하지 않는다.

## 5. 추가 검증 matrix

- Blank coaxial 10 mm, positive/negative transverse offset 및 다른 source-target 거리의
  적어도 두 feasible held-out 사례. 기준 해를 독립 구성하여 물리 domain 안임을 확인하고
  해당 사례도 Mode 목표 도달을 검사한다. 단순 ‘어떤 결과든 나옴’ 테스트로 끝내지 않는다.
- 공통 3D rigid rotation/translation에서 경로·Q·η covariance. 별도 상대 Output 방향
  변경 사례에서 지원 가능한 family는 실제 수렴, 미지원 방향은 명시적 domain 결과.
- Lens max=0 / Mirror max=0, maxGenerated=0, 좁은 공간과 Keep-out, body size 상한,
  높은 clipping, Output Mode 누락/PIC imported field 미지원, 너무 적은 budget.
- 기존 Lens4-Surface 초기안의 무잠금·일부 full lock·전부 lock·interval freeze.
  잠긴 Surface, Body, ancestor 및 Port exact equality. unsupported initial train 비파괴 거절.
- 같은 budget/순서로 재현, family coverage와 거절 횟수 확인, nominal geometric-only ranking과
  달리 Mode metric이 route placement 탐색에 feedback됨을 수치 사례로 입증.
- OAT zero/cap/unsupported angles와 complete supported coverage를 구분. nominal locks가
  공차를 자동 0으로 만들지 않음. coverage가 다른 후보를 robust winner로 단정하지 않음.
- read-only Preview, cancel/Escape/close, changed settings/Project stale, tampered parameter
  재구성 거절, Apply/Undo/Redo/SaveLoad, Surface/Gaussian/3D Report 실제 치수·경로 일치.
- 기존 전체 Model/Physics regression. packaged offline Desktop browser와 기존 회귀,
  1366×768 및 1440×1000에서 실행·결과·Apply 조작 가능. 변경되지 않은 검사는 불필요하게 반복하지 않음.

## 6. 사용자 검토 시작 순서 — 구현 후 제공할 안내

**아래는 구현할 workflow다. 현재 D1에 새 버튼이 있다는 뜻이 아니다.**

1. 새 standalone HTML의 version/source를 확인하고 **New Physical Project**를 누른다.
2. Input SMF reference를 확인하고 Output에도 **Apply SMF 1310 Reference**를 명시적으로 적용한다.
3. **Design Setup**에서 Output X=`10000`, Y=`0`, Z=`5000` µm와 +X를 확인한다.
4. **Design Problem**에서 부품 상한·허용 공간과 제조 family/bounds를 설정한다.
5. 새 **Run Automatic Synthesis** action 한 번으로 생성한다. Lens를 미리 Add하지 않는다.
6. geometry와 Mode-qualified/partial/reference-only 후보, 잔여 오차, coverage를 비교한다.
7. Preview → Apply → Surface/Gaussian/Report → Undo를 확인한다. Prism/TIR 효율 미평가는 유지한다.

## 7. 마무리와 보고

원격 head/CI, source/물리 검증, standalone HTML/hash/manifest를 대조하고 Draft PR을
최신 D2.0/D1 계열 branch 위에 만든다. source를 작은 단위로 전송하고 큰 Base64 반복은
피한다. 실제 구현 범위와 미지원 항목, 사용자 확인 순서 및 남은 uncertainty를 간결하게
보고한다. **D2.1 완료 후 정지. 사용자 지시 없이 D2.2 시작 또는 main/stack 병합 금지.**
