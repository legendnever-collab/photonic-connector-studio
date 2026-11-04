# Golden Benchmark 001 — Handoff

2026-11-04 · Sol · #36 위의 `benchmark/golden-001` Draft. Main 및 기존 Draft Branch 변경·병합 없음.

## 완료 범위
- PR #36 D2.6.1 Physics를 보존하고 PR #37 지침을 적용했다.
- `npm run benchmark:golden`: 0, ±50, 100, 500 µm와 invalid / unsupported controls. 입력·후보·SHA/hash·gate별 결과는 JSON으로 재현한다.
- 기존 CI에 자동 포함되며 `golden-benchmark-001` artifact를 보존한다. 실제 실행 결과와 조건은 [Runner](GOLDEN_BENCHMARK_001_RUNNER.md)를 참조한다.
- Model 및 실제 Browser lifecycle 검증을 분리했다. UI 기능 추가·Physics 제약 완화 없음.

## 다음 작업
1. Draft PR의 exact-head CI와 machine-readable artifact를 검토한다. Benchmark PASS는 검증 환경의 PASS이며 +50 µm connector 확보를 뜻하지 않는다.
2. Astra: expanded-beam 조건 및 diffraction reference, TIR 이후 powered Lens field의 모델/수렴 검증을 설계한다. 기존 Gaussian 목표와 total coupling을 분리한다.
3. ±50/100 µm에서 geometry gate / conservative clearance / finite seed coverage를 독립적인 정밀 reference로 분석한다. 후보 확보를 위해 제조 범위를 조용히 변경하지 않는다.
4. 합동 공차·Yield·throughput 및 제조 사양 합격 기준은 현재 Uncomputed다. 물리 가정·architecture 변경이 필요한 후속 구현은 별도 승인 후 진행한다.

Main 병합은 사용자 명시 승인 전 금지한다. PR #37의 원본 지침 문서는 해당 Draft에 보존되어 있다.
