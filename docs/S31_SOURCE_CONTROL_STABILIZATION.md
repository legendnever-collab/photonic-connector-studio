# S3.1 — Source Calibration & Numerical Control Stabilization

2026-11-07 KST · Base S3 #47 `0b5e0d5dc19444e53019cbb42a371dbe60c18bb3` · Stacked Draft.

## 판단

**A: 원인 분리 및 DFT 읽기 경로 보완. B: 일부 Control만 통과. C: 실제 두 m 주입과 짧은 전파 검증까지, Unresolved. D: Lens 계산 진입 차단.**

원래 300 µm Slab과 두 Vector Source의 전체 Frozen Reference Plane 검증은 완료되지 않았다. 실제 Lens Field/Flux/Mode, Full Connector Total Coupling, Assembly Yield는 모두 **Uncomputed**다. Main, Production Physics, Gaussian Gate, Coaxial Mount, Frozen Port/Mode/Lens와 S3 Lock/Runner는 변경하지 않았다.

## A — 재현과 원인

기존 S3 Runner를 변경 없이 실행했다. CI #151의 [원본 Artifact](https://github.com/legendnever-collab/photonic-connector-studio/actions/runs/42340803930/artifacts/13560893698)와 6개 Control의 T/R/Field/Flux/Balance 차이는 최대 2.78e-17이었다. Fixture, 환경 Lock, Controls/Contract Adapter 해시가 일치했다. 원본 수치와 출처의 작은 Snapshot은 `tests/coherent/s31/baseline-planar.json`에 보존한다. RSS/Runtime은 환경 의존 측정값으로 별도 기록한다.

좌표는 Global (X,Y,Z) = Meep (z,x,y), 시간은 exp(-iωt), 전진파는 exp(+ikz), 정방향 Ex/Hy는 같은 부호다. 1D Huygens Sheet와 반대 Magnetic Sign의 음성 Control로 방향을 검증한다. Independent Boundary Continuity의 4×4 복소 선형계를 Fresnel/Fabry–Pérot 식과 비교한다. E/H 모두 같은 출력 평면의 Vacuum 성분으로 나누고, Flux는 같은 Monitor의 입사 Flux로 정규화한다. Field 오차에 Piston/Amplitude/Defocus Fitting을 하지 않는다.

균질 Yee Grid의 전파 상수는 다음 식으로 진단했다. S=Δt/Δz, Solver 단위에서 c=1이다.

`k_num = 2/Δz asin[(n/S) sin(ω Δt/2)]`

10/20/40 glass points/wavelength에서 Air/Glass의 1/10/100/299 µm 경로를 검사했다. 약 299 µm의 실제 Complex Field와 Discrete Dispersion 예측 차이는 최대 2.71e-6, Unwrapped Phase Slope 차이는 최대 약 2.7e-11 rad/µm였다. 연속매질 k=nω와의 누적 Phase 차이는 별도로 크다. **수치 분산을 사후 보정해 합격시키지 않는다.** Interface/Slab의 잔차에는 경계 표현, 보간, Settling이 남아 있다.

추가로 Meep 1.35.1에서 일부 Half-cell Zero-size DFT Monitor가 E/H=0을 반환하지만 같은 위치의 Flux와 유한 길이 DFT에는 파동이 존재하는 현상을 재현했다. 8/16/32 cells/µm의 Half-cell 위치에서 확인했다. 새 Planar Adapter는 유한 길이 DFT의 실제 좌표를 읽고 요청 평면으로 선형 보간한다. 기존 위치 40-point Control에서는 두 읽기 경로의 차이가 약 7.5e-14 이하로, **원래 큰 S3 오차의 주원인은 이 현상이 아니다.** 원본 S3 Runner는 재현용으로 보존한다. 라이브러리 내부 원인까지 확정한 것은 아니다.

Meep Flux API와 따로 보간된 E/H의 곱도 구분한다. Complex harmonic SI Power의 1/2를 명시하고, Yee Grid에서 Flux를 보간하는 연산과 각 Field를 보간한 뒤 곱하는 연산의 차이를 독립 수렴 항목으로 남겼다.

## B — 실제 통과 범위

아래는 로컬 실제 측정값이다. 마지막 자리와 Runtime은 정확한 HEAD의 CI JSON을 우선한다.

| Control | Glass points/wavelength | Complex E 상대 오차 | 입사 기준 Flux 절대 오차 |
|---|---:|---:|---:|
| 짧은 Interface 경로 | 40 / 80 / 160 | 0.03736 / 0.009306 / 0.002328 | 0.000333 / 0.0000830 / 0.0000207 |
| 3 µm Slab | 40 / 80 / 160 | 0.01639 / 0.004061 / 0.000998 | 0.002259 / 0.000557 / 0.000128 |
| 원래 Interface 경로 | 40 / 80 | 0.75586 / 0.19319 | 0.000333 / 0.0000830 |
| 원래 300 µm Slab, 기본 Settling | 40 / 80 | 1.41804 / 0.37769 | 0.018769 / 0.072097 |

짧은 Domain의 160-point Interface와 Slab은 E/H 1%, Flux/R/Power Balance 0.5% 목표와 독립 PML 4→5 µm, Settling 4→8 검사를 통과했다. **짧은 진단 Control을 Frozen 300 µm Slab의 합격으로 대체하지 않는다.**

원래 Slab의 40-point Settling 배수를 4→8→16으로 늘리면 Balance 오차는 2.681e-3→2.284e-6→2.447e-8로 감소한다. 8→16의 T 변화는 약 2.02e-6이다. 충분히 기다려도 Continuous Reference 대비 Field 오차 약 1.41642와 Flux 오차 약 0.016286이 남는다. 수치 분산과 다중 반사 잔류가 함께 영향을 준다는 증거다.

OAT 실험은 PML 두께, 경계 Padding, Interface 0.25-cell 이동, ε Averaging, Pulse Bandwidth를 별도로 바꾼다. 실제 ε Profile/좌표, E/H, Incident-subtracted R, 기존 Net R, T, Balance를 저장한다. 짧은 종료시간에는 입사파가 출력 Monitor에 도착하지 않아 분모가 0이 되는 것을 검출하고 `invalid-incident-reference`로 반환한다. 비유한 Ratio를 Physics 결과로 출력하지 않는다.

## C — Vector Source 구현과 미통과 범위

Frozen Gaussian의 w=53.2734 µm, C=1695.2288 m⁻¹, λ=1.31 µm를 사용한다. 기존 D2.8-B FFT Grid를 재사용한 Cartesian Angular Spectrum과 독립 Hankel Quadrature를 비교한다. Transverse Ex에 대해 Ez=−kx Ex/kz, H=(k×E)/k0를 완성하고 q≤k0/4만 남긴다. 이 테스트 Adapter는 Lens Solver가 아니다.

- Cartesian/Hankel Field 차이: 약 6.23e-5–1.23e-4. 2πr Jacobian을 사용한 Flux 비교: 최대 4.45e-5. Quadrature 차이: 약 8.1e-14.
- Global Y 편광은 m=(+1,−1)을 (1,1)로, Z 편광은 (−i,+i)로 합성한다. Reference Rotation 오차는 약 2.3e-16. 실제 ±m Field Parity도 저장 Field로 검사한다. 별도의 회전 Source 재실행은 하지 않으며 선형 중첩과 축대칭 범위에 한정한다.
- 고정 Spectrum Cut의 Scalar Spectral Power 제거량은 약 2.475e-7. Source Plane의 Tangential Current L2에서 150 µm 밖은 약 1.30e-7, 100 µm 밖은 약 6.77e-4다. 이를 물리적 흡수로 해석하지 않는다.
- 실제 Meep에는 Source Plane = Launch−10 µm의 Huygens Je/Jm Sheet를 주입하고 Launch−5, Launch, +5, +10, +20 µm에서 6개 E/H 성분과 Flux를 읽는다. m별 Raw Field/Reference는 NPZ로 보존한다.
- **Input Calibration:** Launch Flux로 Amplitude를, Launch E Projection으로 Phase를 한 번 정한다. 그 뒤 E/H 및 모든 출력 평면에 같은 계수를 적용한다. Launch Flux=1 W는 이 정의의 결과이며 검증 증거가 아니다. Field Error, Field-integrated/API Flux 차이, 출력 Plane Flux/Projection을 독립적으로 평가한다. 선형 Rescaling이며 별도의 재주입 Run은 아니다.
- 4/6/8 cells/µm의 Launch E 오차는 약 0.280/0.121/0.0678, H 오차는 약 0.107/0.0434/0.0238로 목표를 충족하지 못했다. 독립 Disk/Window/PML/Settling/Source Sampling 실험은 Runner 및 정확한 HEAD의 Artifact에서 확인한다. Mesh별 위상 Wrapping 때문에 특정 출력 평면의 오차 크기만으로 단조 수렴을 주장하지 않는다.

2 cells/µm는 Courant 0.3, λ=1.31 µm에서 위 Discrete Dispersion 식의 asin 인자가 1보다 커 전파 Band 밖이다. 이 해상도는 원본 S3의 Allocation/Timing Pilot 용도만 유지한다. 새로운 Calibration Runner는 이를 실행 전에 거부한다.

현재 계산은 **짧은 No-Lens Domain**이다. Frozen Exit=Launch+364.55 µm 및 그 뒤의 Plane 검증은 Not run이다. Vector Source Calibration 전체 통과를 선언하지 않는다. Scalar Paraxial Gaussian과 Vector Completion의 차이는 Launch/+20 µm에서 별도 계산한다. 전체 Frozen Plane의 모델 차이 비교는 미완료다.

## D — 자원과 재개 조건

원본 전체 Lens의 재실행 Pilot은 2/4 cells/µm에서 Peak RSS 188808/410788 KiB, 20 Step 0.455/2.745 s였다. Calibration Source의 실제 CPU Time/RSS와 CPU Affinity/Host Memory는 JSON에 추가한다. 보장된 Job Memory/Time은 이 로컬 환경에서 노출되지 않았다. Host 수치를 보장된 할당으로 간주하지 않는다. CI에는 명시적인 Job Timeout과 Run별 Timeout을 둔다.

균질 Glass의 299 µm Phase 오차는 40-point에서 약 1.977 rad다. 이 오차를 단순 Δ² Scaling으로 0.01 rad까지 줄이려면 약 560 points/wavelength가 예상된다. **진단용 예상이며 실제 Lens의 필요 Mesh 또는 검증 결과가 아니다.** 전체 Lens에서 이를 곧바로 적용하는 Brute-force 계획은 승인할 수 있는 자원 근거가 없다.

다음은 (1) Source와 DFT Readout의 Numerical Control을 계속 좁혀 검증하고, (2) 정확한 Frozen 300 µm Complex Field 목표를 감당할 수 있는 외부 Solver/실행 예산을 비교하는 일이다. Higher-order/Frequency-domain/축대칭 FEM은 검토 후보이며 설치·검증 완료를 뜻하지 않는다. Threshold 완화, 임의 Phase 보정 또는 자체 범용 Solver로 우회하지 않는다. B/C 통과 및 실제 자원 확보 전 Lens Checkpoint C를 재개하지 않는다.

## 재현, CI, 사용자 확인

S3 문서의 Micromamba Explicit Lock 설치를 그대로 사용한다. `OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1`을 설정한다.

```sh
python tests/coherent/run_s3_preflight.py
python tests/coherent/run_s3_meep_controls.py
python tests/coherent/run_s31_suite.py planar
python tests/coherent/summarize_s31.py --profile planar
python tests/coherent/run_s31_suite.py gaussian
python tests/coherent/summarize_s31.py --profile gaussian
```

위 `python`은 Frozen Meep 환경의 Python이다. `s3-meep-pilot` Artifact에 기존 결과와 S3.1 Planar JSON, `s31-vector-source` Artifact에 Calibration JSON/NPZ를 저장한다. `*-execution.json`은 명령·실제 시간·실행 시작 시 Source 해시·실패/Timeout을 기록한다. Run 성공은 Physics 성공이 아니다. Summary의 A/B/C/D, 원본 Fixture/Source/Lock 해시, `headSHA`와 `gitSHA`(PR Merge Checkout일 수 있음)를 먼저 확인한다.

기존 Typecheck/Build는 로컬 실행했다. 로컬 Model Run은 500/502 통과 후 Timeout, Worker를 줄인 재실행도 496/502 통과 후 Timeout이었다. Chromium은 시스템 Socket 제한으로 기동하지 못했다. 이 로컬 결과를 회귀 PASS로 쓰지 않는다. 기존 Model 502개, Browser, S2/Golden와 D2.8 Reference의 최종 결과는 정확한 PR HEAD의 CI 링크를 기준으로 보고한다.

후속 승인 순서는 S4 2-Lens 검증 → S5 연결 후보 확보 → S5.5 Engineering Workflow & UI Simplification(Sol) → S6 자동 설계 강화다. 현재는 S3.1 Numerical Gate가 선행한다.

## 공식 근거와 한계

2026-11-07 KST 확인. API의 실제 동작은 고정된 Meep 1.35.1 설치본과 작은 Control로 대조했다.

- [Yee Lattice](https://meep.readthedocs.io/en/latest/Yee_Lattice/): 공간 Stagger와 보간.
- [Python User Interface](https://meep.readthedocs.io/en/latest/Python_User_Interface/): DFT Fields, Array Metadata/Slice, Source, Flux API.
- [Magnetic/Electric Synchronization](https://meep.readthedocs.io/en/latest/Synchronizing_the_Magnetic_and_Electric_Fields/): 시간 Stagger. Instantaneous Synchronization을 DFT에 임의로 중복 적용하지 않는다.
- [Cylindrical Coordinates](https://meep.readthedocs.io/en/latest/Python_Tutorials/Cylindrical_Coordinates/): exp(imφ), ±m와 선형 편광의 관계.

작은 Control의 독립 검증은 해당 Domain에만 적용된다. Frozen Lens나 Full Connector의 물리적 유효성으로 확대하지 않는다.
