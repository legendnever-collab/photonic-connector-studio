# D2.1 — Blank Project Automatic Synthesis

Release: `0.11.0-d2.1`. Engine: `bounded-mode-synthesis/1.0.0`.
기준: D2.0 문서 commit `d2b53b9eefe6bed3729b603bae0547595b91ddb9` 및 D1 tree.
기존 main과 PR #13–#17을 보존한다. 이 checkpoint를 main에 자동 병합하지 않는다.

## 구현한 사용자 결과

New Physical Project의 optical component 0개에서 Output SMF reference, 부품 상한과
허용 공간을 지정하고 **Automatic Synthesis → Run Automatic Synthesis**를 실행한다.
Lens를 먼저 Add하지 않아도 real BK7 Lens pair와 planar Mirror/Prism route가 생성된다.
Lens 0/1/2개 및 first/last segment allocation, finite size seeds, route placement를
비교하며 기존 4-Surface train도 유지하거나 허용된 범위에서 교체한다.

Preview는 live Project를 쓰지 않는다. Apply는 설정/원본/recipe/bounds/geometry와
field를 재검증하고 실제 prescription/body를 shared Project에 한 번 적용한다.
Undo 한 번, Redo/JSON/Surface/Gaussian/3D Report가 같은 형상을 사용한다.
Source/Output pose, Mode, wavelength와 Port metadata는 탐색에서 바꾸지 않는다.

Output SMF reference를 **명시적으로 선택할 때만** blank Output probe의 medium을
air로 정한다. 이전에는 Mode Contract만 air로 바꾸고 probe medium은 null로 남는
차이가 있었다. Port 위치와 방향을 움직이지 않으며 기존 저장 파일은 소급 변경하지 않는다.

## 계산과 탐색

- 기존 finite Surface/Ray/body/clearance, S2 closure/build, S3.2 Lens domain/seed/
  bounded Nelder–Mead를 재사용한다. D1의 lens/route action과 의미는 그대로다.
- 새 `tensorOverlap.ts`는 Output 좌표계에서 정규화한 full complex 2×2 Gaussian
  field의 복소 내적을 계산한다. curvature, ellipse rotation/cross phase, centroid와
  relative first-order slope를 포함한다. 기존 B1 수치를 바꾸지 않는다.
- 새 constructor는 실제 S1/glass/S2와 finite body를 만든다. 양쪽 circular reference가
  같은 경우 source divergence와 aperture를 고려한 symmetric thick-Lens Gaussian
  seed를 만든다. 실제 tracing/유효범위 검사와 연속 fitting을 통과해야만 유지한다.
  특정 Project 이름, 5 mm 값, 미리 저장한 정답 prescription으로 분기하지 않는다.
- geometry로 상위 후보만 잘라 순차 호출하지 않는다. family/size/count/side별 초기
  placement를 보존하고 Mode metric으로 promising closure의 placement 이웃을
  다시 구성·fitting한다. 이미 유효한 nominal seed에는 작은 local refinement를 쓴다.
- nominal 통과 후보에는 같은 첫 nonzero Output translation ±OAT 두 사례의 supported
  observed minη를 placement feedback 비용에 반영한다. 이 소범위 feedback coverage는
  result.placementFeedback에 남기며 전체 OAT/공동 오차 완료로 표시하지 않는다.
- 전체 OAT는 기존 Port/leaf Assembly 선언과 maxCases를 재사용한다. Lens decenter/
  tilt 등 미지원 field는 partial이며 zero/cap도 assessed로 바꾸지 않는다. 같은 coverage의
  assessed 후보끼리만 observed minη로 비교한다.

초기 budget: geometry ≤128, nominal transported forward solves ≤8192,
local fitting ≤1536(설정 최대2048), retained 후보 ≤8, 전체 OAT ≤1024.
Geometry 예산의 25%를 feedback에 예약하고 size/family별 처음 최대3개 seed를
초기 fitting에 사용한다. 미검토 seed가 남거나 cap에 도달하면 budget-exhausted로
coverage가 부분임을 알린다. 후보의 nominal qualification과 run termination은 별도다.
입력 미정의, 미지원 train, constraint 거절, 유한 탐색 no-candidate와 취소를 구분한다.

## 지원 범위

| 항목 | D2.1 의미 |
|---|---|
| Lens | 1/2 leaf Sphere/Plane air–BK7–air, centered-normal, 위치/곡률/두께 bounds. 0 Lens도 비교 가능 |
| Planar Mirror | ideal scalar reflection의 conditional normalized Gaussian Mode shape overlap |
| TIR Prism / Mirror+Prism | finite geometry/TIR 및 Q reference; **η 미평가**. Mirror 수치 성능 후보와 별도 표시 |
| 공간 | 전체 body extent 및 기존 conservative AABB/Keep-out/segment crossing. 제조 인증/정밀 solid collision이 아님 |
| Mode | scalar co-polarized 조건부 정합. Transmission / total coupling 미계산 |
| 공차 | OAT 관측값과 coverage. 공동 오차 worst case / 통계 Yield / global robust optimum 아님 |
| PIC | receiving complex field/eigenmode 미정의 시 device coupling 미계산 |
| 미지원 | curved/Parabolic Mirror, 고차 Asphere field, Freeform, array, arbitrary locked-anchor re-routing |

기존 divergence ≤0.1 rad, centered-normal curved encounter, 2w/|R|≤0.2와 누적
aperture tail ≤0.1% gate를 유지했다. Clipped Gaussian을 전달 field로 간주하지 않는다.
Output small-slope/plane projection은 first-order이며 exact rotated-facet diffraction이 아니다.

## 데이터 / 보존

Optional strict `Project.synthesis.version=1`만 추가한다. 이전 JSON에는 기본값을 넣지 않는다.
공간/per-kind limits는 `routing`, total/new limits와 locks/OAT는 `designProblem`을 재사용한다.
새 설정은 family/유한 제조 범위/목표/budget을 소유한다. saved solution provenance는
engine, baseline/design fingerprints, topology와 evaluation counts이며 인증서가 아니다.
Report SVG/PNG metadata에 synthesis와 conditional Mode 결과/scope가 포함된다.

전체 Surface lock는 paired component/body/ancestor를 보수적으로 고정한다. interval
freeze는 해당 ID를 보존하며 Lens builder에서 정확한 bounds를 검사한다. 잠긴 optics의
arbitrary route 재배치는 D2.2 이후이며, 이번에는 retained train fitting만 허용한다.

## 검증

- Tensor integral: 동일 Mode, B1 logη parity, 독립 offset/tilt analytic limits,
  rotated elliptical cross-phase의 midpoint complex-field quadrature 및 window/grid 수렴.
- 자동 생성: Input 원점 +X, Output (10,0,5) mm +X, λ1310 nm, MFD9.2 µm,
  component0에서 Lens2+Mirror2 후보의 size≤5%, phase≤0.05 rad, conditional η≥0.90.
- Hold-out: (12,0,−3) mm, (8,0,2) mm, coaxial10 mm에서도 동일 nominal gates.
  별도 (5,0,5) mm +Z Output에서 one-Mirror Mode solution 및 common rigid-transform invariance.
- 생성한 실제 folded train의 Q를 독립 [height,angle]/physical-q thick-interface
  matrix 계산과 대조한다. normalized overlap과 전송 효율을 혼동하지 않는다.
- strict state/roundtrip, frozen4-Surface/Min=Max, tampered/stale Apply, 예산/Keep-out/
  part cap, undefined field 및 취소. 기존 전체 Model/Physics 회귀를 유지한다.
- packaged offline PC 검증: blank 생성→Mode 설정→5 mm→Preview→Apply→공통 View와
  Report→Undo/Redo; missing input, read-only settings, cancel/Escape, laptop controls.

최종 CI와 artifact identity는 해당 Draft PR 및 `artifacts/build-info-u1.json`을 참조한다.
오래된 README의 구현/미구현 문장보다 이 문서와 현재 source/검증 결과를 우선한다.

## 사용자 확인 순서

1. 새 HTML 상단 **D2.1**을 확인하고 **New Physical Project**를 누른다.
2. **Design Setup**에서 Output X=10000 / Y=0 / Z=5000 µm, 방향 +X를 정한다.
3. 상단 **Automatic Synthesis**를 열고 **Apply Output SMF 1310 Reference**를 누른다.
4. Max components=4, Max new parts=4, Lens≤2/Mirror≤2를 확인한다. Design Space가
   활성화됐다면 Output과 부품을 담을 범위인지 확인한다. 기본 시험 box는 X0–10,
   Y−3–3, Z−2–7 mm이며 사용자가 켤 때만 draft에 들어간다.
5. **Run Automatic Synthesis**를 누르고 Nominal Mode goals met 후보와 residual,
   OAT coverage를 확인한다. budget-exhausted는 해당 예산의 부분 탐색 상태다.
6. **Beam / Output Mode**로 실제 Output reference를 보고, **Apply Synthesis Candidate**
   후 Surface/Gaussian/Report를 비교한다. Undo 한 번으로 빈 광학계가 복원돼야 한다.

D2.1 checkpoint에서 정지한다. 다음은 D2.2의 Prism 평가/domain 및 탐색 범위 확장이다.
사용자 지시 없이 D2.2 구현 또는 main/선행 stack 병합을 시작하지 않는다.
