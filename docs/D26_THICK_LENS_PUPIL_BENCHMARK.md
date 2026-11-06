# D2.6 · 두꺼운 Lens의 finite-ray pupil 비교

Version `0.26.0-d26` · 권장 모델 **Astra**.

## 사용자 확인 순서

1. 새 HTML에서 **1번 예시 열기 → ④ 계산 결과**를 누른다.
2. Analysis의 **두꺼운 Lens · 수차와 Mode 비교 → 두꺼운 Lens 비교 실행**을 누른다.
3. `converged`이면 finite-ray pupil overlap, 기존 Gaussian overlap, linear ray control과 residual OPD를 비교한다. OPD 그림은 Input frame Y/Z의 출구 표본이며 intensity map이 아니다. Quadratic 성분을 제거한 phase의 OPD만 표시한다.
4. 조건을 바꾸면 기존 결과는 `stale`로 숨긴다. 다시 실행하거나 Undo로 정확히 같은 조건을 복원한다. 계산 중에는 중지할 수 있다.
5. **Export Train Pupil JSON**과 Report의 JSON/SVG metadata는 같은 입력 signature, engine, 수렴 이력과 한계를 보존한다. 계산은 Project, 기존 Mode, 자동 설계 점수 또는 physical gate를 바꾸지 않는다.

## 구현한 모델과 이번 단계의 범위

D2.5의 local differential Q 검증 다음 단계로, 유한 pupil 전체를 추적하는 독립 reference를 추가했다. 단일 phase screen으로 Lens를 붕괴시키지 않는다. 독립 Euler frame, Sphere/Plane 교차와 vector Snell로 실제 두 굴절면 사이를 통과시키고 glass 내부 OPL을 누적한다. 기존 단일 Lens phase-screen benchmark는 별도로 유지한다.

**전체 POP 개발이 완료된 것은 아니다.** 이번에는 single-step ray-pupil reference를 구현했다. Input waist→입구와 출구→Output의 free-space diffraction은 analytic Fresnel Gaussian으로 취급하지만, Lens 내부 및 Lens 사이 diffraction은 전파하지 않는다. 중간 focus/caustic, 유의미한 clipping 또는 수치적으로 해결되지 않은 경우에는 비교 수치를 확정하지 않는다. D2.5 계획의 전체 finite-beam propagation 검증은 아래 D2.7에 남아 있다.

Supported: 1–2개의 두꺼운 Lens, Sphere/Plane, single-channel air Gaussian waist Ports, 평행 Input/Output axes, elliptical MFD와 roll, 작은 Lens decenter/tilt. 두 Lens face는 동일 local axis와 양의 thickness를 가져야 한다. Mechanical tilt ≤50 mrad, aperture/|R| ≤0.5, Port divergence ≤0.1 rad. Benchmark ray launch/exit 방향은 source axis에서 0.3 rad 이내이다. 이는 독립 reference 계산 한계이며 production Gaussian의 incidence/footprint/NA gate를 완화하지 않는다.

Unsupported: Prism/Mirror/folds, aspheres, PIC/imported fields, Array field, 비평행 Port axes, vector/polarization response, coatings/Fresnel transmission, absorption. `physicalEtaErrorBound`와 `totalCoupling`은 항상 null이다.

## 수학과 normalization

입구 Gaussian intensity는 `I=2/(π wy wz) exp[-2((y/wy)²+(z/wz)²)]`이다. Complex field convention은 exp(+iωt), propagation phase는 exp(−ikS)이다. Gaussian phase gradient의 transverse direction cosine으로 ray를 발사한다. `S = ½(Cy y²+Cz z²)+Σ nL−OPLchief`를 출구 pupil에서 계산한다. 실제 glass 두께와 refracted path가 Σ nL에 들어간다.

출구의 source-normal plane에 투영한 ray tube Jacobian을 `J=det(∂(Y,Z)/∂(y,z))`라 한다. Longitudinal power flux 보존으로 출구 field amplitude를 sqrt(I/J)로 근사한다. Unit-normalized target waist를 동일 exit plane으로 Fresnel back-propagation한 field를 V라 하면 normalized overlap은 다음과 같다.

`η = |∫ sqrt(I J) V* exp(−ikS) dy dz|² / ∫ I dy dz`

여기서 적분은 살아남은 pupil 표본에 대해 수행한다. Significant blocked power에서는 결과를 converged로 승격하지 않는다. 따라서 이 값을 throughput로 사용하면 안 된다. Target coverage는 `∫ |V|² J dy dz`로 별도 적분한다. 큰 target 또는 작고 멀리 떨어진 target을 grid가 놓쳐 거짓 0을 반환하지 않도록 coverage가 충분하지 않으면 unresolved이다. 이는 보수적인 계산 범위 제한이다.

Linear ray control은 같은 입구 amplitude/phase와 출구 위치·direction의 chief 주변 differential을 사용한다. 이 control도 내부 diffraction을 생략한다. Gaussian과 control 차이는 해당 생략과 근사 영향의 진단 근거이지 물리 오차 상한이 아니다. Full ray와 Gaussian 차이 전체를 수차로 단정할 수 없다.

Intensity-weighted least squares로 출구 OPD에서 `[1,Y,Z,Y²,YZ,Z²]`를 fit한다. Y/Z는 weighted center와 standard deviation으로 정규화하며 계수와 normalization을 JSON에 저장한다. Residual RMS와 phase-only fidelity `|〈exp(ik residual)〉I|²`는 piston/tilt/defocus/astigmatism을 제거한 진단이다. Fit은 Mode overlap 최대화가 아니며, quadratic-phase overlap이 원래 overlap보다 높다는 보장은 없다. Fidelity를 Strehl ratio라고 부르지 않는다.

## 수치 수렴과 실패 처리

- Elliptical pupil radius 3.5 Gaussian radii까지 r² Gauss–Legendre × uniform angle 적분. 제외된 input power는 exp(−24.5) ≈2.3×10⁻¹¹이다. 미세 target sampling의 정확도는 coverage 및 refinement로 별도 검사한다.
- Grid 16×32 →32×64 →64×128 →128×256. 최소 세 grid의 연속 두 refinement를 검사한다.
- Overlap/control/fitted phase/fidelity/input power/target coverage의 최대 변화 <2×10⁻⁵, OPD RMS 변화 <λ×10⁻⁵, significant-weight 이웃의 phase step <π.
- Ray-tube Jacobian은 입구 step min(w)×10⁻⁴와 half-step을 비교한다. Relative change <2×10⁻⁵. 각 직선 segment의 determinant는 quadratic이므로 양 끝과 내부 minimum을 검사해 중간 caustic도 검출한다. Minimum >10⁻⁶이어야 한다.
- Rejected input power <10⁻⁷, input power와 1의 차이 <10⁻⁷, target coverage >0.999, normalized probabilities의 수치 범위를 확인한다.
- Grid cap에서 통과하지 못하면 `unresolved`. 상세 진단/관측 이력은 export할 수 있지만 UI에서 overlap을 확정 수치로 표시하지 않는다. Invalid schema/지원하지 않는 구조는 `unsupported`. Cancel은 metrics를 비우며 input 변경은 정확한 signature로 stale 처리한다.

이 조건들은 구현상의 convergence guard이며 엄밀한 numerical enclosure 또는 물리 오차 인증이 아니다.

## 검증 결과

1번 예시(1310 nm, MFD 9.2 µm, 실제 1 mm BK7 Lens 두 개, Fiber 간격 10 mm)는 grid 64에서 수렴했다.

| 항목 | D2.6 reference 결과 |
|---|---:|
| 기존 Gaussian η | ≈1 |
| Finite-ray pupil η | 0.86627337 |
| Linear ray control η | 0.99975130 |
| Quadratic fitted phase + same amplitude η | 0.83468978 |
| Residual OPD RMS | 43.6480 nm |
| Phase-only fidelity | 0.96863347 |
| Target coverage | 0.999998997 |
| Rejected input power | 2.08×10⁻⁹ |

위 값은 **single-step model의 비교 결과**이다. 실제 효율이 86.6%라는 측정·인증 결과가 아니며, 자동 설계 후보의 qualified 판정을 변경하지 않는다.

독립 test oracle는 축대칭 meridional scalar Snell angle과 8192-interval radial Simpson 적분을 사용한다. Benchmark의 vector trace/Jacobian/Legendre/phase-fit 또는 production Gaussian 코드를 호출하지 않고 η 10⁻⁶ 및 OPD RMS 3×10⁻¹² m 이내에서 일치한다. 추가로 flat slab Snell/OPL 해석해, elliptical Gaussian normalization, 두 중간 caustic, exact quadratic fit, signed decenter/tilt, nested global transform, 실제 glass thickness 변화, clipping/phase aliasing/target 누락, unsupported/취소/stale/복원을 검사한다. UI 검증은 offline PC·모바일의 실행·export·Report SVG·Project 불변·Undo·취소를 포함한다. 최종 전체 test 결과는 PR에 기록한다.

## 계산 방법 참고

- [Ansys: About Physical Optics Propagation](https://ansyshelp.ansys.com/public/Views/Secured/Zemax/v251/en/OpticStudio_User_Guide/OpticStudio_Help/topics/About_Physical_Optics_Propagation.html): ray 분포와 OPL로 exit pupil을 구성하는 single-step approximation 및 intermediate focus/long collimated propagation에서의 한계. 이 설명을 범위 결정에 참고했으며 OpticStudio와 수치 비교를 완료했다는 뜻은 아니다.
- [Ansys: POP vs Single Mode Fiber coupling](https://optics.ansys.com/hc/en-us/articles/43071096032403-Why-does-my-POP-fiber-coupling-efficiency-differ-from-the-Single-Mode-Fiber-coupling-efficiency): 내부 diffraction을 포함하는 POP와 ray 기반 single-step coupling은 서로 다른 결과를 줄 수 있다. D2.6의 결과 해석에서도 이 차이를 유지한다.

## 다음 D2.7 계획 — Astra

1. Lens 내부·사이 diffraction을 포함하는 wave/beamlet propagation reference를 설계한다. Gaussian free space, flat slab, paraxial quadratic train을 analytic control로 먼저 검증한다.
2. Grid/window 또는 beamlet 분해 수렴, energy normalization, 중간 focus와 aperture truncation을 검증한다. D2.6 pupil 모델 및 Gaussian과 비교하여 수치 오차와 모델 차이를 분리한다.
3. 이 근거가 확보된 뒤 signed µm offset/tilt sweep과 후보 진단에 연결한다. 물리 정확도 근거 없이 기존 gate를 확대하지 않는다.
4. 이후 Lens–Prism–Lens / 2-Prism, clearance, Array 1×8·2D MLA로 확장한다. SENKO/Teramount의 공개 구조와 가정 치수는 구분한다.

UI 문구·배치만의 후속 작업은 Sol로 가능하다. D2.7의 field propagation·physics 검증은 Astra 권장이다.
