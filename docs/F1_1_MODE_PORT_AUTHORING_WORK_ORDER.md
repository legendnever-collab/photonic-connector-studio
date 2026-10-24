# Mode-Port 기반 Optical Design · 입력 UX 검토 및 후속 Work Order

작성: 2026-10-24 KST
검증 기준: main `1b4e8f9b483d8c7b3e625839e05247e75d61a9d9` / 병합된 P2.4.
상태: 설계 검토·개발 지시. 아래 신규 기능의 구현 완료를 의미하지 않는다.

## 1. 제품의 중심 — Input Mode → Optical Train → Output Reference Mode

우리 제품은 Fiber / Photonic Substrate 등의 Input Port Mode를 출사시키고, 기하광학 부품으로
구성된 광학계를 통과한 Field가 Output Port의 Reference Mode에 얼마나 결합되는지와 정렬
민감도를 설계하는 도구다. 기본 설계의 양 끝은 Object / Image가 아니라 Input / Output Mode Port다.
Ray Layout과 Spot은 이 설계를 돕는 진단 결과이며, 최종 목적은 Mode Coupling / Alignment다.

한 Project에 다음을 유지한다.

- Input Port: Mode 모델/데이터, 파장, Polarization, Local Frame, Reference Plane, 입력 Power / 정규화,
  Gaussian Waist 또는 복소 Field의 Amplitude·Phase, 물리 좌표와 Sampling 정보.
- Optical Train: 실제 Surfaces / Media / Coatings의 정의, Component / Assembly의 Local·World Frame,
  명시적 전파 순서와 각 Element의 Model Class. Ideal Lens는 Ideal이며 곡률·두께를 추론하지 않는다.
- Output Port: 목표 Reference Mode, Local Frame / 기준면 / Polarization / 정규화, Alignment의 기준점.
  전파 후 얻은 Incident Field와 목표 Mode를 별도로 저장/표시한다. 둘을 같은 데이터로 덮어쓰지 않는다.
- Alignment: 어느 Port·Component·Mating Assembly가 움직이는지 지정하고, Reference Pose에 대한
  ΔX/ΔY/ΔZ/ΔRoll/ΔPitch/ΔYaw를 명시한다. 단위와 회전 Pivot을 보존한다.

Mode의 Intensity 그림만으로 Phase나 Wavefront를 알아낼 수 없다. Source MFD를 Ray Bundle Radius로
대체하거나, 입사 Field를 재계산하지 않고 Ray 도달 비율을 Mode Coupling으로 표시하지 않는다.
현재 Physical 예제의 평행 Ray Source는 Geometric Diagnostic 상태로 유지하되, Mode에서 유도된
전파인 것처럼 표시하지 않는다. Source/Target Mode가 누락되면 Mode 계산은 명시적으로 미계산이다.

## 2. 계산 연결의 계약

Port의 복소 Field를 정의한 뒤 각 계산이 이 Field의 어떤 근사/표현을 전달하는지 명시한다.
Gaussian q/Beamlet/Geometric Reference Ray/Complex Field는 서로 다른 표현이며, View 버튼은 Solver를
바꾸지 않는다. Paraxial 근사, Folded Local Frame, Sampling Window / 해상도 / 위상과 Power의 전달
규칙을 검증한 경우에만 다음 단계의 물리 결과를 활성화한다.

Output Reference Plane의 동일 좌표계에서 Incident Field와 Target Mode의 정규화된 복소 Overlap을
평가한다. Scalar / 동일 매질·평면 근사의 수식은 참고용이며, Vector / 고 NA / 강한 구속 Mode에는
해당 유효 영역의 E/H·Power 정규화 및 투영 규칙이 필요하다. 다음 세 값을 구분한다.

| 결과 | 의미 |
|---|---|
| Transmission | Input Power 대비 Output Plane까지 전달된 Power |
| Mode Overlap | 도착 Field 중 목표 Mode와 일치하는 비율 |
| Total Coupling | 동일한 Power·평면 기준에서 Transmission과 Mode Overlap을 합친 결과 |

Input/Output의 강하게 구속된 근접장은 바로 일반 Ray 또는 두 Transverse E 성분만의 Beam 형식으로
바꾸지 않는다. Facet / Interface 근처는 EM / Near-to-Far 처리가 필요할 수 있다. Homogeneous
Propagation Plane으로 이어지는 명시적 Adapter와 유효 영역을 먼저 정의한다. Imported Mode는 Gaussian
Fit 결과와 원본 Field를 구분하고, Phase·좌표·Reference Plane을 누락하면 원인을 표시한다.

## 3. Explorer — Project / Catalog / Examples의 의미 분리

| 영역 | 표시할 내용 | 동작 |
|---|---|---|
| Current Project | Input Port → Optical Train의 Component / Surface → Output Port, Alignment Frame | 현재 설계의 항목 선택·편집 |
| Component Catalog | Ports, Lenses, Mirrors, Prisms, Arrays, Single Surface, 사용자 Building Blocks | 현재 설계에 삽입 |
| Example Projects | Mode Matching, Folded Connector, Array 등 완성된 설계 예제 | 별도 명시적 Open / 새 Project로 열기 |

한 Explorer의 구분된 Tree / Section으로 제공한다. 예제를 여는 것은 Project 교체이며, 부품을 추가하는
것과 다른 명령이다. 미저장 설계는 자동으로 덮어쓰지 않는다. 검색은 현재 Catalog / Examples 영역에
적용한다. Material / Surface Catalog는 필요할 때 관련 편집 항목에서 연다. 기존 예제는 보존한다.

## 4. 추가 — Component 조립과 Surface 정밀 입력을 한 모델로 연결

### Component-first: VirtualLab Fusion에서 참고할 흐름

Catalog Tree에서 부품을 선택하고 Preview / Properties로 크기·면 구성·배치 기준을 확인한 뒤
선택한 Block 또는 Surface 다음에 삽입한다. Double-click은 명시된 기본 삽입 위치를 사용하며,
Drag-and-drop은 삽입 Marker와 배치 Preview를 보여준다. Mobile에서는 선택 → Add로 같은 작업을 한다.
배치 후 Global / Local 숫자 입력으로 위치를 정확하게 확정할 수 있어야 한다.

Lens는 Front / Back Surface + Medium / Thickness를, Prism은 Interface Sequence + Body를 함께 생성한다.
Insertion은 하나의 Undo Transaction이며 기존 Input / Output Port와 다른 부품의 World Pose를 기본적으로
유지한다. Downstream 이동은 범위가 보이는 별도 명령으로 한다. 드롭 화면 위치를 정밀한 3D 좌표로
가정하지 않는다. 2D에서는 기준 Plane / Depth를 표시하고 3D에서는 배치 Plane과 정확한 Pose를 확인한다.

### Surface-first: OpticStudio / CODE V 계열에 익숙한 입력 흐름

Layout과 Surface Data를 동시에 보고 Surface 행을 삽입·편집한다. Context Menu / 단축키는 활성화된
Surface Editor 범위에서 동작한다. 입력 중인 Text/Number에는 일반 Insert / Delete 동작을 보존한다.

- Insert Before / Insert After / Duplicate / Delete를 행에서 제공한다.
- 기본 Column: Component / Surface ID, Type, Radius, Thickness 또는 Gap, Material 또는 n,
  Clear Aperture, Conic. Decenter / Tilt / Reference Frame / 고차 계수는 필요한 곳에서 펼친다.
- Component를 펼치면 그 부품의 Surface 행이 보인다. Surface 선택은 Tree / Layout / Report의 동일
  Surface ID를 Highlight하고, 편집은 같은 Project의 Surface Evaluator에 전달한다.
- Blank Component / Single Surface로 시작하여 면을 직접 정의하고, 필요한 면을 하나의 Lens / Assembly로
  묶는 흐름을 허용한다. Material이 없는 중간 상태는 Draft로 남기고 해당 계산을 보류한다.
- Catalog로 생성한 부품도 같은 Surface Data에서 편집한다. Catalog 부품과 수동 Surface를 별도
  설계로 저장하지 않는다. 직접 Surface 편집 후 원래 Template와 달라지면 Custom 상태를 표시한다.
- Thickness / Gap을 바꿀 때 이동 기준·방향·영향 범위를 명확히 한다. Global XYZ와 상대 Spacing을
  독립적으로 동시에 저장해 충돌시키지 않는다. Paired Lens Thickness는 지정 Anchor에 대해 Rear
  Surface를 이동한다. 일반 비축 간격은 활성 Frame / Constraint를 명시하기 전에는 Derived 값으로
  표시한다. 거리를 World X 차이로 계산하거나 Fold 뒤에 X 순서로 Surface를 재정렬하지 않는다.

OpticStudio의 행 삽입/표 편집 흐름과 VirtualLab Fusion의 부품 추가 흐름을 조합한다. CODE V의
현재 버전별 정확한 키 조합 / 메뉴명은 확인된 자료 없이 동일하다고 주장하지 않는다.

## 5. 한 화면과 Window 배치

Desktop 기본 배치: 좌측 Explorer, 중앙 상단 Layout / Gaussian / Report, 중앙 하단 Surface Data,
우측 Properties / Analysis. Input Mode와 Output Reference Mode는 항상 접근 가능하며, Result에서
Incident Field와 Reference Mode를 비교한다. 상위 Project 메뉴와 추가 경로는 모든 View에서 고정한다.
Surface Data는 작은 부가 창이 아니라 주 설계 입력 면적을 확보하고 Splitter로 크기를 조절한다.

첫 Window 단계는 앱 내부 Dock / Float / Resize / Restore다. 같은 Panel을 배치만 바꾸며 Project,
Selection, Undo History, 편집 Draft를 복제하지 않는다. Surface Data나 Analysis를 닫아도 설계 데이터는
남는다. Layout 배치는 Optical Project와 분리된 Session 설정으로 보존한다.

실제 Browser Pop-out은 다음 단계다. Parent 하나가 Canonical Store와 Solver를 소유하고, Child는
Revision을 가진 편집 명령을 전달한다. 충돌·재접속·창 종료·Popup 차단·file:// 환경을 검증한다.
Child 닫기는 데이터 삭제가 아니며, Pop-out 실패 시 내부 Float로 돌아간다. 새 Native Desktop 창과
같은 기능이 바로 보장되는 것으로 표현하지 않는다. Mobile은 기본 Canvas + Surface / Properties
전환을 유지하고 Desktop의 여러 Float 창을 강제하지 않는다.

## 6. 다음 실행 범위와 순서

이번 피드백은 기존 Freeform 계획을 보완한다. Aspheric 형상만 먼저 추가하는 단계 대신 아래
순서로 사용자 검토 가능한 Checkpoint를 구성한다.

| Checkpoint | 구현 범위 | 검증 / 사용자 확인 |
|---|---|---|
| U1: Mode-Port Authoring | Port Mode 계약, Explorer의 Project/Catalog/Examples, Component 추가와 Surface 행 입력의 연결, Layout+Surface 동시 편집 / Splitter, 내부 Dock/Float | 예제를 열지 않고 Input/Output Mode를 정하고 Lens/Prism을 추가; 두 추가 경로의 데이터 일치, 동일 Selection/History/Save·Load, Port Pose 보존, Mobile 편집 |
| F1.1: Conic / Aspheric | 공통 sag/gradient/normal/intersection/Report geometry, Radius/Conic/계수 편집, Decenter/Tilt | Sphere limit, 독립 Normal 검증, Root residual, 물리 형상과 Report/Trace 일치 |
| B1: Physical Mode Bridge | 검증된 Local Paraxial / Folded Gaussian 연결, Mode 기반 출력 Beam과 Alignment | 직선 ABCD 일치, Fold/좌표변환 불변성, Tilt/Decenter 기준 사례; 미지원 상태가 Coupling 값으로 표시되지 않음 |
| F1.2 / F2 | XY Polynomial, Control Points, Mode/Surface 데이터 Import; 후속 CAD Adapter | 표면·Field 데이터의 좌표 / 정규화 / 오차 / Round Trip |
| A1 / W1 | Channel별 Spot/OPD와 Complex Field / Output Mode Overlap | Sampling / Grid / Power 수렴, Phase / Offset / Tilt 기준 사례 |

U1에서는 실제 Conic / Aspheric 계산을 완료했다고 주장하지 않는다. F1.1에서도 일반 Freeform / EM
Mode Coupling 완료를 주장하지 않는다. 처음부터 Mode-Port 데이터와 결과 UI를 유지하여, 이후 계산
연결 때문에 UI나 Project를 다시 만들지 않도록 한다. Ideal/Physical의 혼합 Project는 Model Class를
Element 단위로 명시하는 Migration 계약을 먼저 확정하고, 구현 전에는 자동 변환하지 않는다.

## 7. 회귀 기준

P2.4의 기존 Gaussian/Surface 물리, 기존 예제, 결과 / 저장 데이터와 실행 HTML을 보존한다.
Source-first, 단계별 Commit / Draft PR / 검증된 HTML, Play Review 전 main 병합 금지 원칙을 따른다.
새 Surface Type, 임의 기본 Material, Phase, Input Power, Target Mode를 기존 파일에 조용히 채우지 않는다.
입력값과 Mode를 변경하면 결과의 Input Hash가 바뀌고 미계산/계산 중/유효/무효 상태를 구분한다.
View/Window/Theme 전환만으로 Field Propagation을 다시 실행하지 않는다.

## 8. 공식 자료 확인과 제안의 구분

아래 자료는 설계 방향의 근거이며 우리 구현의 검증 결과가 아니다. Window 명칭 / Source-Target
Port 중심의 제품 구성 / 삽입 Transaction / Spacing 정책 / Checkpoint 순서는 이번 프로젝트의 제안이다.

- Ansys, How to design a singlet lens, Part 1: Setup — Surface 행, Insert Before/After,
  Radius/Thickness/Material 입력:
  https://optics.ansys.com/hc/en-us/articles/42661252179987-How-to-design-a-singlet-lens-Part-1-Setup
- Ansys, Exploring Sequential Mode — LDE의 Dock/Float, Layout과 Surface 선택 연동:
  https://optics.ansys.com/hc/en-us/articles/42661713256723-Exploring-Sequential-Mode-in-OpticStudio
- LightTrans, Introduction to the Optical Setup — Source/Component/Detector, Tree/Search,
  Drag-and-drop 추가와 Setup Editor 연동:
  https://www.lighttrans.com/fileadmin/shared/UseCases/Feature_UC_Introduction%20to%20the%20Optical%20Setup.pdf
- LightTrans, User's Manual — Component/Surface 등 Catalog, Field Source와 Optical Setup:
  https://www.lighttrans.com/products-services/learning/users-manual.html
- Ansys, Single-mode fiber coupling — Complex Mode Overlap, System/Receiver/Total Efficiency:
  https://optics.ansys.com/hc/en-us/articles/42661682185107-Single-mode-fiber-coupling-in-OpticStudio
- Ansys, Coupling between PC and SMF fibers using Zemax interoperability — Mode→Macro Optics→Mode,
  강한 구속 근접장의 Beam 형식 변환 유효 영역:
  https://optics.ansys.com/hc/en-us/articles/1500007226562-Coupling-between-PC-and-SMF-fibers-using-Zemax-interoperability
