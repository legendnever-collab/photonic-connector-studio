# S3 — Single-Lens Wave Reference Pilot

## 판단과 실행 범위

2026-11-07 · Base `5045c8f367267f8fbcc1a59b0662193a036b25a5`.

D2.8-E 이후 Serial Meep 1.35.1을 Conda로 설치했고 실제 Maxwell Time-stepping을 실행했다. 우선 경로는 축대칭 Vector Maxwell이다. CPython 3.12의 PyPI `pymeep` 조회·설치는 사용 가능한 배포본을 찾지 못했다. Micromamba 2.10.0의 기본 Sharded Repodata와 Flat Repodata 경로는 모두 설치를 완료했다. 실제 사용한 Linux x86-64/Python 3.11 환경을 Explicit Package Lock으로 고정했다.

Checkpoint A는 Geometry/Boundary/Source Contract와 실행 환경을 확보했다. Source Completion의 실제 주입·정규화 검증은 남아 있다. Checkpoint B는 1D Plane/Interface/Slab Controls와 전체 크기 Lens의 짧은 Resource Pilot까지 수행한다. No-Lens Gaussian의 두 독립 편광 Calibration 및 전체 Refinement 예산이 확보되어야 Checkpoint C를 시작할 수 있다. 실제 Lens Field/Flux/Mode, Fold/Free-Lens Total Coupling과 Assembly Yield는 Uncomputed다.

## Frozen Contract와 외부 실행

`tests/benchmark/d28e-single-lens.json`의 원본 SHA-256은 `ff97f32f92cf9e17200b1e09fb7f1f5349990b63fd82d919579b77b647f42f95`다. S2의 편심 Lens Fixture는 별도로 보존한다. `run_s3_preflight.py`는 원본 전체 해시를 검사하고 Fixed Ports를 포함한 Contract를 JSON으로 출력한다.

Ideal Bare Glass Control은 Clear Radius 200 µm부터 Outer Radius 240 µm까지 구면 Cap을 같은 유전체로 연장하고, 두 Cap을 원통형 Rim으로 닫는다. Glass는 기존 실수 굴절률을 사용하고 주변은 Air다. Coating과 흡수 Stop은 이 Control에 없다. 실제 제조품의 Boundary 사양과 대응시키려면 별도 확인이 필요하다.

전파축은 Global X에서 Meep z로 매핑한다. Source와 Monitor/PML 위치, 두 편광의 Fourier E/H Completion, 1 W Normal Poynting Flux Calibration, Mesh/Domain/PML/Reference Plane 및 Settling 목표는 JSON Contract에 정의했다. 단위는 SI이며 Solver에서 길이 단위만 µm로 변환한다. 이 Source Contract의 주입 구현과 검증은 후속 항목이다.

```sh
curl -fLsS https://micro.mamba.pm/api/micromamba/linux-64/2.10.0 -o /tmp/s3-micromamba.tar.bz2
mkdir -p /tmp/s3-bootstrap
tar -xjf /tmp/s3-micromamba.tar.bz2 -C /tmp/s3-bootstrap bin/micromamba
/tmp/s3-bootstrap/bin/micromamba create -y -p /tmp/s3-meep -f tests/coherent/s3/meep-linux-64-explicit.txt
/tmp/s3-meep/bin/python tests/coherent/run_s3_preflight.py
OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 /tmp/s3-meep/bin/python tests/coherent/run_s3_meep_controls.py
```

Micromamba archive SHA-256은 `9a97976244929bbae28fb1fae504e74a3e7e6d1932870e3a03321f01b7fbd07b`다. 환경을 확보한 후 `micromamba list --explicit`로 실제 Package를 대조할 수 있다. Solver 설치 실패, import 실패, Contract 검사와 Physics 상태는 각각 기록한다.

## Controls와 해석 한계

Planar Control은 Meep 1D에서 지원하는 Ex/Hy를 사용한다. 이를 Global Y 편광으로 매핑한다. Global Z 및 ±m 편광 재구성은 Not run이다. Vacuum Run의 DFT Field/Flux로 같은 Monitor에서 정규화하고, Fresnel Interface와 같은 굴절률·300 µm 두께의 Coherent Bare Slab 해석해를 비교한다. 상대 Complex E에는 Vacuum 경로의 위상도 동일하게 제거한다. PML 4 µm와 고정 종료시간을 사용하며 독립 PML/Settling 검증은 남아 있다.

10/20/40 points per glass wavelength의 차이는 수치 분산, 유한 Grid에서의 경계 표현, PML와 Settling 영향을 포함한다. Control 결과는 실제 Lens 모델 오차가 아니다. Field 1%, Flux 0.5%는 사전에 정한 Numerical 목표다. 수렴 실패를 실제 Lens 불가능 판정으로 해석하지 않는다.

Resource Pilot은 전체 Lens 외형과 곡률을 유지한 2/4 cells per µm, m=1 계산이다. 임의의 Er Dipole로 Vector Field 배열을 활성화하고 20 Step을 실행한다. Source는 Calibration되지 않았고 ε subpixel averaging은 꺼져 있다. 이 Pilot은 초기화/RSS/Step 비용 측정만 제공하며 광학 결과를 출력하지 않는다.

## 이번 실행의 관측값

| Control | Glass points / wavelength | Flux 절대 오차 | Complex E 상대 오차 |
|---|---:|---:|---:|
| Interface | 10 / 20 / 40 | 0.005514 / 0.001341 / 0.000333 | 0.48685 / 1.99032 / 0.75586 |
| Bare Slab | 10 / 20 / 40 | 0.062040 / 0.057889 / 0.018769 | 0.06911 / 0.18720 / 1.41804 |

이 3-grid Control은 사전 수치 목표를 통과하지 못했다. 긴 Glass 경로의 누적 위상과 Grid 경계 표현, 고정 종료시간/PML의 영향을 아직 분리하지 못했으므로 원인을 특정하지 않는다. Checkpoint B는 **Unresolved**이며 C는 **Not run**이다.

실제 전체 크기 Lens Resource Pilot에서 2/4 cells per µm의 Peak RSS는 192044/413160 KiB, 초기화는 6.61/29.47 s, 20 Step은 0.656/2.246 s였다. Runtime은 실행 환경에 의존한다. 이 값은 저해상도·짧은 계산의 측정치다. Full-size 10/20/40 points Refinement를 실행한 값은 아니다. 두 편광 Source Calibration과 PML/Settling 검증 및 Refinement 자원이 확보되면 재개한다.

## 재개 조건

1. No-Lens 환경에서 Contract의 두 편광 E/H를 주입하고 Launch Plane의 복소장·Normal Flux를 비교한다. Propagating Spectrum cut과 유한 Source Disk의 영향도 기록한다.
2. Planar Control의 위상·Flux 오차 원인을 Grid, Interface 위치, PML, Settling별로 확인한다. 독립 Phase convention과 Power Balance를 통과시킨다.
3. 실제 Job의 Memory/CPU/시간 할당을 확보한다. 현재 관측 CPU affinity는 9, Host Memory는 약 9.73 GiB이고 보장된 Job 한도는 미노출이다. D2.8-E의 10/20/40 points 계획은 Component Storage만 약 2.17/8.67/34.69 GiB다. Pilot 측정과 함께 Full Refinement 자원 예산을 승인 가능한 수준으로 산정한다.
4. B를 통과한 뒤 C에서 실제 Field, 반사/투과/측면 Flux와 Mode Projection을 계산한다. Piston만 보정한 Field L2, Power Ledger, Reference Plane consistency와 Numerical uncertainty를 기록한다. 이후 S2의 실제 곡률과 약 7 µm 편심 입력을 별도 확장한다.

CI의 `s3-meep-pilot` 성공은 실행 절차의 성공이다. Physics Reference 상태는 JSON의 `physicsReferenceStatus`를 확인한다. 기존 S2/Golden/Model/Build/Browser와 D2.8 Reference Job 결과는 Draft PR에 연결한다.

## 공식 근거

- Meep 설치와 실행 환경, 2026-11-07 확인. https://meep.readthedocs.io/en/latest/Installation/
- 축대칭 m harmonic과 편광 재구성. https://meep.readthedocs.io/en/latest/Python_Tutorials/Cylindrical_Coordinates/
- DFT Flux, Simulation, PML의 기본 사용법. https://meep.readthedocs.io/en/latest/Python_Tutorials/Basics/
