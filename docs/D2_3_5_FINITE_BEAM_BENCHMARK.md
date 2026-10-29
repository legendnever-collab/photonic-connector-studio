# D2.3.5 — Finite-beam Lens benchmark

PR #26을 main `7a4029d`에 병합한 후 진행한 Astra checkpoint다.
D2.3.4의 differential ray 검증은 infinitesimal Gaussian map을 검증하지만,
finite beam 전체의 higher-order phase 또는 실제 coupling 오차를 보증하지 않는다.
이번에는 독립적인 scalar phase-screen benchmark와 명시적인 수렴 검사를 추가한다.

## 이번에 검증하는 대상

단일 Lens의 두 spherical/plane face를 **front vertex plane의 한 phase screen**으로
투영한다. Source / Output 축과 Lens 두 face 축은 parallel이어야 하며, transverse
Port offset과 ellipse roll은 허용한다. Source는 screen까지 homogeneous Gaussian으로
전달하고, Output waist는 같은 scalar Fresnel operator로 screen까지 역전파한다.
두 field의 pupil-plane inner product로 Output overlap을 계산하므로 아주 작은 focal
spot을 큰 Cartesian window에서 직접 sampling할 필요가 없다.

이 계산은 Lens 내부의 finite-thickness propagation을 생략한다. 저장된 thickness는
형상 검증·provenance·Output의 선후관계에 쓰며, optical propagation에는 쓰지 않는다.
따라서 비교 대상은 **동일한 thin-screen 모델의 exact sag phase와 quadratic phase**다.
기존 physical two-interface Gaussian result와 직접적인 오차 비교를 하지 않는다.
Tilt / oblique refraction, 다중 Lens, Mirror / Prism / TIR, higher-order Asphere,
PIC / imported field, array는 이 benchmark에서 unsupported다. 이 제한은 기존 solver가
계산 가능한 경우에도 유지한다. 새 물리 domain이나 합성 후보 순위를 열지 않는다.

## Phase / normalization

`exp(+i omega t)` convention, vacuum wavelength `lambda`, exterior index `n`,
glass index `ng`, signed sphere radii `R1/R2`를 사용한다. R=0은 plane이다.

- `sag(R,r) = r² / [R (1 + sqrt(1-r²/R²))]`.
- Piston thickness를 제거한 exact screen phase는
  `phi = -k0 (ng-n) [sag(R2,r)-sag(R1,r)]`.
- Quadratic phase는 `phi2 = k0 P r²/2`,
  `P=(ng-n)(1/R1-1/R2)`다.
- 작은 r에서 cancellation을 피하기 위해 residual sag는
  `r⁴ / [2 R³ (1+sqrt(1-r²/R²))²]`로 계산한다.

Pupil radius는 두 clear aperture의 최솟값이다. 그 밖의 field는 0인 hard circular
pupil을 가정한다. Output probe aperture를 별도 stop으로 넣지 않는다. Explicit Gaussian
receiving Mode는 전체 transverse plane에서 normalize한다. 이 screen의 pupil diffraction은
inner product에 포함되지만 실제 Lens edge diffraction / vector boundary 해석은 아니다.

Input field `u`, back-propagated target `v`는 각각 전체 plane에서 unit norm이다.
`T = integral_pupil |u|²`를 계산하고
`eta_exact = |integral_pupil u exp(i phi) conj(v)|² / T`로 정의한다.
Quadratic + same pupil도 같은 T로 normalize한다. 따라서 표시되는 eta는 transmitted
screen field에 대한 **conditional normalized overlap**이다. T를 실제 Lens transmission,
eta 또는 total coupling으로 바꾸어 부르지 않는다.

## Reference gate의 의미

`A = integral_pupil |u|² exp(i(phi-phi2))`로 두 fidelity를 구분한다.

- `F_phase=|A|²/T²`: 같은 pupil 안에서 phase만 비교.
- `F_reference=|A|²/T`: exact clipped screen field와 untruncated quadratic
  Gaussian reference를 비교. Clipping과 phase departure를 함께 포함한다.

Normalized fields `a,b`에 대해 projector difference
`|a><a| - |b><b|`의 두 nonzero eigenvalue는
`±sqrt(1-|<a,b>|²)`다. 따라서 같은 unitary Fresnel propagation 뒤의 임의 normalized
receiving Mode에 대한 power-overlap 차이는 `sqrt(1-F_reference)` 이하이다.
이는 **정확한 integral을 알고 있을 때의 screen-model 수학적 bound**다.
후속 lossy stop과 renormalization 또는 다른 physical model에는 그대로 적용하지 않는다.

구현에서는 grid refinement 차이로 F의 numerical uncertainty를 추정하고 그 구간을
sqrt bound로 전달한다. 이 구간은 certified numerical enclosure가 아니므로 UI에도
**estimated**라고 표시한다. Threshold는 absolute eta 0.01이다.

- upper estimate ≤0.01: `within-threshold`.
- lower estimate >0.01: `exceeds-threshold`.
- 수렴 미확인 또는 threshold를 걸치는 구간: `unresolved`.

이 gate는 현재 target에서 관측된 eta 차이와 다르다. 보수적인 any-target deviation
estimate가 크더라도 특정 target의 관측 차이는 작을 수 있으며 두 값을 나란히 표시한다.
어느 경우에도 `physicalEtaErrorBound`와 `totalCoupling`은 **null**이다. Thin-screen gate가
통과했다고 실제 finite-thickness Lens나 전체 3D route를 qualified로 바꾸지 않는다.

## 수치 방법과 독립 검증

`r²/a²`에 대한 Gauss–Legendre와 uniform azimuth quadrature를 사용한다. Circular pupil을
pixel staircase로 근사하지 않는다. Radial grid는 32, 64, 128, 256, 384, 512이며 angular
node는 그 두 배다. 서로 다른 세 grid의 두 연속 차이를 비교해 pupil / overlap / fidelity의
absolute difference가 2e-6 아래인지 검사한다. 의미 있는 amplitude 영역의 인접 phase step도
pi 미만이어야 한다. 마지막 grid에서 부족하면 `unresolved`이고 UI에서 확정 수치는 숨긴다.
JSON에는 상태와 refinement history가 남아 수치 문제를 재현할 수 있다.

`tests/lensFieldBenchmark.test.ts`는 다음 기준을 사용한다.

- Plane / index-matched circular Gaussian의 analytic pupil energy
  `1-exp(-2a²/w²)`와 conditional normalization.
- Application의 sag / quadrature를 호출하지 않는 16,384-interval radial Simpson
  integral로 signed sphere phase, overlap, fidelity, phase RMS 검증.
- Small-footprint quartic scaling과 fixed-footprint wavelength scaling.
- Offset / rolled ellipse에 대해 adjoint Fresnel integral과 analytic thin Gaussian 비교.
- 전역 rigid motion covariance, supported / unsupported / cancellation / grid budget,
  exact-input stale와 Undo, Project와 기존 Mode 결과의 불변성.

기본 Fiber–Lens–Fiber의 coarse grid는 aliased overlap을 만들 수 있다. Phase-fidelity 하나가
안정적으로 보인다는 이유만으로 수렴을 승인하지 않는다. 작은 footprint의 비교 사례와
더 큰 phase departure 사례로 pass / fail을 각각 검증한다. 이것은 얇은 Lens를 실제 3D
field solver로 검증했다는 주장이 아니다. Finite-thickness benchmark가 다음 단계다.

## UI / export / 재현

1. 실행 HTML에서 **Analysis → Run Lens Field Benchmark**를 선택한다.
2. Exact phase-screen / quadratic + pupil / analytic thin Gaussian, pupil fraction,
   phase RMS와 screen gate를 확인한다. 기존 Mode Overlap은 바뀌지 않는다.
3. **Export Lens Benchmark JSON** 또는 Report의 같은 버튼으로 동일 결과를 저장한다.
   Report SVG metadata에도 동일한 `lensFieldBenchmark`를 기록한다.
4. Project 변경이나 invalid numeric draft는 이전 결과를 stale로 만들며 current export의
   result를 null로 만든다. Exact Undo만 같은 session 결과를 복원한다. Reload 후에는 재평가한다.
5. **Cancel Lens Benchmark**는 refinement 사이에 취소하며 metric을 확정하지 않는다.

설계 값이나 Undo history에 benchmark 결과를 저장하지 않는다. 결과는 session에만 있으며
Project JSON schema는 바뀌지 않는다. JSON/SVG는 전체 provenance를 포함한다. PNG의
새 benchmark 숫자 annotation은 이번 범위가 아니며 수치 보고에는 JSON/SVG를 사용한다.

## 근거

- MIT 2.71/2.710, *The ideal thin lens as a Fourier transform engine*, pp. 2, 5–7:
  Fresnel operator와 thickness-dependent lens transmission.
  https://web.mit.edu/2.710/Fall06/2.710-wk10-a-sl.pdf
- IBM Quantum Learning, *Fidelity*: normalized pure-state overlap / trace-distance
  관계의 수학적 배경. 여기서는 **squared** field fidelity F를 사용한다.
  https://quantum.cloud.ibm.com/learning/en/courses/general-formulation-of-quantum-information/purifications-and-fidelity/fidelity

근거 문헌은 이 application's physical error나 thickness approximation을 보증하지 않는다.
최종 test 수, CI와 standalone fingerprint는 PR에 기록한다.

## 다음 checkpoint

D2.3.6 — **finite-thickness / curved-interface scalar field benchmark**.
Astra 권장: phase-screen collapse의 오차와 실제 curved refraction / propagation을 구분해
검증해야 한다. 이후에만 oblique Lens + TIR 결합 domain과 물리 accuracy gate 확장을
판단한다. Parabolic / Asphere / Freeform, Engineering release와 multi-channel은 후속
roadmap으로 유지한다. 이번 Draft PR의 병합과 다음 checkpoint 시작은 사용자 지시 후 진행한다.
