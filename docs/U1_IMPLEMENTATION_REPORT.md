# SMF Input Reference 업데이트 — 0.3.1-u1

사용자 요청에 따라 앱 시작 및 New Physical Project의 Input을 SMF Fiber Gaussian
Reference로 설정했다. 기본 λ=1310 nm, MFD X/Y=9.2 µm, Waist=Fiber Facet,
Flat Phase, Unit-power 정규화, 출사 기준면 매질=air다. 실제 입력 Power와
Polarization은 지정하지 않았으며 Output Reference Mode도 사용자 정의로 남긴다.

기준값은 SMF-28 Ultra의 nominal MFD를 참고한 Gaussian 근사다. 측정 eigenmode나
Facet Fresnel / MFD dispersion 계산으로 표시하지 않는다. Source Profile을
보여주며 값을 바꾸면 Custom으로 표시한다. 기존 저장 파일과 예제는 보존한다.

후속 검증: Model / Physics / Schema / Font **191 PASS**, PC Browser **54 PASS**.
아래 U1 최초 Checkpoint의 수치와 Source는 과거 기록이다. 최신 Source와 실행 HTML
SHA256은 `artifacts/build-info-u1.json` / `artifacts/SHA256SUMS-u1.txt`를 참조한다.

---

# U1 — Mode-Port Authoring · 검증 및 Play Review

작성: 2026-10-24 KST. Version: `0.3.0-u1`.
PR: https://github.com/legendnever-collab/photonic-connector-studio/pull/10
Branch: `feature/u1-mode-port-authoring`.
Baseline main: `1b4e8f9b483d8c7b3e625839e05247e75d61a9d9`.
검증된 Source: `3adbf66c89691e3f5219b64611522e33a05b3839`.
상태: Draft PR / 사용자 Play Review 대기. main 병합 및 F1.1 자동 시작 없음.

## 구현 결과

사용자의 PC 우선 요구를 반영했다. 좌측 Explorer / 중앙 Layout + Surface Data /
우측 Properties·Analysis를 한 화면에서 사용한다. 1366×768과 1920×1080을 확인했다.
Mobile은 기존 Canvas / Surfaces / Inspect / Analysis 전환을 유지한다.

- New Physical Project는 예제를 열지 않고 Input / Output Mode Port만으로 시작한다.
  MFD / Polarization / 기준면 / Phase / 정규화 / Power / Adapter 의도를 저장한다.
  Project의 파장 및 기존 Port Frame은 공통 값이며 중복 저장하지 않는다.
- Current Project / Component Catalog / Example Projects를 구분했다. Assembly 계층과
  Surface 행을 탐색하며 Catalog 검색은 현재 설계 항목을 필터링하지 않는다.
- Lens / Mirror / Prism / Array / Probe / Blank Component / Single Surface를 추가한다.
  Catalog 선택 시 치수·면 구성 Preview를 보고 숫자로 Global Pose를 확인한다.
  Double-click은 명시된 기본 Pose를 사용하고 Drag는 삽입 위치 표시 후 Preview를 연다.
- Catalog와 Surface Data는 같은 prescription, body, 선택, Undo, JSON을 사용한다.
  행 Insert Before / After / Duplicate / Delete, Context Menu, Editor 범위 단축키와
  연속 Surface의 Lens / Assembly 그룹화를 지원한다. Text 입력의 Delete는 보존한다.
- 수정한 leaf Component를 User Building Block으로 저장해 Project JSON에 보존하고
  재삽입할 수 있다. 중첩 Assembly 전체를 하나의 사용자 Template로 저장하는 기능은
  이번 범위가 아니며 명시적으로 제한한다. 기존 중첩 Project 구조는 유지한다.
- Paired Lens 두께는 Front Anchor에 대해 Rear만 이동한다. 비축 Gap은 World XYZ의
  차이를 축방향 Thickness로 오인하지 않고 실제 3D 거리의 Derived 값으로 표시한다.
- Surface Data Splitter, 내부 Dock / Float / Move / Resize / Close / Restore를 제공한다.
  같은 Panel의 DOM과 편집 상태를 유지하며 Session 배치는 Optical Project와 분리한다.
- 미저장 Project를 교체하기 전 Keep Editing / Save & Open / Discard & Open을 제공한다.
  이전 설계는 Undo로도 복구한다. 기존 JSON과 P2.4 예제·계산·Report는 보존한다.

## 물리 결과의 범위

Physical 예제의 평행 Ray는 Geometric Diagnostic이다. Source MFD와 Bundle Radius를
연동하거나 Ray 도달 비율을 Coupling으로 사용하지 않는다. Medium이 없는 Surface는
null / Draft로 저장하고 Trace를 보류한다.

Incident Field와 Output Reference Mode를 별도 표시하고 Transmission / Mode Overlap /
Total Coupling은 각각 Not calculated로 표시한다. 아직 Physical Mode Bridge가 연결되지
않았기 때문이다. 기존 Ideal Gaussian 결과는 Legacy Scalar / Paraxial 범위로 유지하며,
미지원 Imported / Confined / 비공기 Port 계약이면 해당 Gaussian 결과도 억제한다.

Alignment는 움직일 대상, World Reference Pose, Reference-local ΔXYZ / ΔRoll·Pitch·Yaw,
Origin Pivot을 저장한다. `applied=false`이며 U1의 Delta를 실제 전파에 적용했다고
표시하지 않는다. Imported Field의 복소 Grid 계약은 있지만 Import UI는 F2다.

Conic 열은 Sphere / Plane limit로 읽기 전용이다. 실제 Conic / Aspheric 계산은 F1.1,
Physical Gaussian 연결은 B1, 일반 Field / Overlap은 A1 / W1 후속 Checkpoint다.
Mixed Ideal / Physical은 자동 변환하지 않는다. 외부 Browser Pop-out도 아직 지원하지 않는다.

## 검증

| 검사 | 결과 |
|---|---|
| TypeScript / Production Build | PASS |
| Model / Physics / Schema / Font | 190 PASS |
| 전체 Browser 회귀 (Desktop + Mobile) | 101 PASS / Desktop 전용 5개 Mobile에서 SKIP |
| 마지막 표 밀도 보정 후 실행 HTML Authoring 재검증 | Desktop 6 PASS |
| 1366×768 / 1920×1080 Layout + Surface Data | PASS |
| Offline file:// / 저장·불러오기 / Undo / Report / Theme | PASS |
| Port Pose 보존 / Folded Frame 그룹화 / 독립 두께 기준 사례 | PASS |
| Source inputs / HTML / Export byte 및 SHA256 일치 | PASS |

기존 Browser 회귀의 Example / Open 동작은 새 미저장 보호창에서 명시적으로 Discard를
선택하도록 갱신했다. 광학 기대값 검증은 유지했다. 기존 끝부분 삽입 기대값 1개는
사용자가 지시한 '선택한 Component 다음에 삽입' 순서에 맞춰 수정했다.

실행 산출물: `photonic-connector-studio-u1.html` (545,198 bytes).
HTML SHA256: `f0ff23a389495e5095fd7cbb85dca2d48c437f2cc7fb0f6c9fc034534d8dbe4e`.
Source fingerprint: `36f05fb3d43172ddee4f6f4efa44461e6c21c5101571f43d4ab06d4c3d3953c8`.
상세 입력 Hash는 `artifacts/build-info-u1.json`, HTML Hash는 `artifacts/SHA256SUMS-u1.txt`.
실행 HTML은 별도 다운로드 산출물로 제공하며 `npm run artifact`로 재생성한다.

## PC에서 확인할 순서

1. New Physical Project → Input Mode / Output Reference Mode에서 MFD와 기준을 입력한다.
2. Add 또는 Catalog에서 Lens / Prism을 넣고 Preview에서 XYZ와 각도를 확인한다.
3. Layout을 보면서 Surface Data의 Radius / n / Clear Aperture / Lens Thickness를 바꾼다.
4. Surface 행 추가·복제·그룹화, User Building Block 저장·재삽입을 확인한다.
5. Splitter, Float / Dock / Resize / Close / Restore 후 값·선택·Undo가 이어지는지 확인한다.
6. Save Project JSON → Open, Report 전환, 미저장 예제 교체 동작을 확인한다.

Physical Mode Coupling의 정확도는 이번 검토 대상이 아니다. U1 입력 환경 검토 후
후속 F1.1 Surface 계산 Checkpoint로 진행한다.
