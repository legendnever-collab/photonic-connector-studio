import { DocumentSchema } from "./domain";
import type { DesignDocument } from "./domain";

export type Complex = { re: number; im: number };
export type Matrix = readonly [number, number, number, number];
export const SOLVER_ID = "aligned-gaussian-air";
export const SOLVER_VERSION = "1.1.0";
export const ASSUMPTIONS = [
  "Air n=1 · Scalar co-polarized · Monochromatic paraxial Gaussian",
  "Source waist at F · Target waist at W (1/R=0)",
  "MFDx → local Y · MFDy → local Z · Intensity 1/e² diameter",
  "WG Y/Z Offset only · Source/Lens aligned · Rotation unsupported",
  "Ideal Lens / Aperture clipping not modeled · Fresnel/aberration 제외",
];
export function rayleigh(w: number, wavelength: number) {
  if (!(w > 0 && wavelength > 0 && Number.isFinite(w + wavelength))) throw new Error("Positive finite w / λ required");
  return Math.PI * w * w / wavelength;
}
export function abcd(q: Complex, [a, b, c, d]: Matrix): Complex {
  const u = c * q.re + d, v = c * q.im, den = u * u + v * v;
  const re = ((a * q.re + b) * u + a * q.im * v) / den;
  const im = q.im * (a * d - b * c) / den;
  if (!(Number.isFinite(re + im) && im > 0)) throw new Error("Nonphysical q / singular ABCD");
  return { re, im };
}
export type Beam = { radius: number; curvature: number; waistX: number; waistRadius: number; rayleigh: number };
export function beam(q: Complex, wavelength: number, x: number): Beam {
  if (!(q.im > 0 && Number.isFinite(q.re + q.im))) throw new Error("Nonphysical q");
  const w0 = Math.sqrt(wavelength * q.im / Math.PI);
  return { radius: w0 * Math.hypot(1, q.re / q.im), curvature: q.re / (q.re * q.re + q.im * q.im), waistX: x - q.re, waistRadius: w0, rayleigh: q.im };
}
// Normalized 1-D power overlap with a displaced, flat-wavefront target waist.
// Scale integration coordinate by sqrt(wi*wt) to avoid SI-sized powers.
export function axisLogOverlap(wi: number, wt: number, curvature: number, offset: number, wavelength: number) {
  if (!(wi > 0 && wt > 0 && wavelength > 0 && [wi, wt, curvature, offset, wavelength].every(Number.isFinite))) throw new Error("Invalid overlap inputs");
  const a = wt / wi, t = wi / wt, s = a + t;
  const b = Math.PI * curvature * wi * wt / wavelength;
  const den = s * s + b * b, delta = offset / Math.sqrt(wi * wt);
  const log = Math.log(2 / Math.hypot(s, b)) - 2 * t * delta * delta * (a * s + b * b) / den;
  if (!Number.isFinite(log) || log > 1e-12) throw new Error("Overlap normalization / numerical range failure");
  return Math.min(0, log); // roundoff only; large violations throw above
}
export type Sample = { x: number; y: Beam; z: Beam; side: "before" | "after" };
export type Provenance = { modelId: string; version: string; wavelength: number; fingerprint: string; inputJSON: string; assumptions: string[] };
export type GaussianResult = {
  status: "valid"; provenance: Provenance; warnings: string[]; samples: Sample[];
  incident: { y: Beam; z: Beam }; target: { y: number; z: number; offsetY: number; offsetZ: number };
  eta: number; logEta: number; lossDB: number; underflow: boolean;
} | { status: "invalid" | "out-of-domain"; reason: string; provenance: Provenance; warnings: string[] };
export function fingerprint(text: string) {
  let hash = 0xcbf29ce484222325n;
  for (const char of new TextEncoder().encode(text)) hash = BigInt.asUintN(64, (hash ^ BigInt(char)) * 0x100000001b3n);
  return hash.toString(16).padStart(16, "0");
}
export function solveGaussian(input: DesignDocument): GaussianResult {
  const inputJSON = JSON.stringify(input);
  const provenance: Provenance = { modelId: SOLVER_ID, version: SOLVER_VERSION, wavelength: input.wavelength, fingerprint: fingerprint(inputJSON), inputJSON, assumptions: ASSUMPTIONS };
  const warnings: string[] = [];
  const fail = (reason: string, status: "invalid" | "out-of-domain" = "invalid"): GaussianResult => ({ status, reason, warnings, provenance });
  const parsed = DocumentSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues.map(i => i.message).join(" · "));
  const doc = parsed.data, lambda = doc.wavelength;
  const source = doc.components[0], target = doc.components.at(-1)!;
  if (source.kind !== "fiber" || target.kind !== "waveguide") return fail("Terminal Ports 필요");
  if ([source.mode.mfdX, source.mode.mfdY, target.mode.mfdX, target.mode.mfdY].some(v => v === null)) return fail("Required MFD가 TBD입니다. Fiber/WG의 MFDx·MFDy를 입력하거나 Synthetic Example을 선택하세요.");
  const enabled = doc.components.filter(c => c.enabled);
  for (let i = 0; i < enabled.length; i++) {
    const c = enabled[i];
    if (Object.values(c.frame.rotation).some(v => v !== 0)) return fail(`${c.name}: Rotation은 P1.1 범위 밖입니다. Roll/Pitch/Yaw를 0으로 복구하세요.`, "out-of-domain");
    if (i && c.frame.origin.x < enabled[i - 1].frame.origin.x) return fail(`${enabled[i - 1].name} → ${c.name}: Tree Order와 X 순서가 충돌합니다. Position 또는 Up/Down을 수정하세요.`);
    if (c.kind === "lens" && (c.frame.origin.y !== source.frame.origin.y || c.frame.origin.z !== source.frame.origin.z)) return fail(`${c.name}: Lens Decenter는 미지원입니다. Source의 Y/Z에 정렬하세요.`, "out-of-domain");
    if (c.kind === "gap") {
      const start = c.frame.origin.x, end = start + c.length;
      if (end > target.frame.origin.x + 1e-12) return fail(`${c.name}: Air Gap 끝이 W 밖입니다.`);
      if (enabled.some(other => other.kind === "lens" && other.frame.origin.x > start + 1e-12 && other.frame.origin.x < end - 1e-12)) return fail(`${c.name}: Gap 내부 Lens가 있습니다. Lens 앞뒤로 Gap을 분리하세요.`);
      if (enabled.slice(0, i).some(other => other.kind === "gap" && other.frame.origin.x + other.length > start + 1e-12)) return fail(`${c.name}: Air Gap 구간이 중복됩니다. Position/Length를 수정하세요.`);
    }
  }
  const sp = source.mode.polarization, tp = target.mode.polarization;
  if (sp !== "unspecified" && tp !== "unspecified" && sp !== tp) return fail("TE/TM 불일치: Scalar 모델에서 Polarization Coupling을 검증할 수 없습니다.", "out-of-domain");
  if (sp === "unspecified" || tp === "unspecified") warnings.push("Polarization Unspecified: 아래 결과는 co-polarized 가정에 대한 조건부 Scalar Coupling입니다.");
  let qY: Complex = { re: 0, im: rayleigh(source.mode.mfdX! / 2, lambda) };
  let qZ: Complex = { re: 0, im: rayleigh(source.mode.mfdY! / 2, lambda) };
  const samples: Sample[] = [];
  let x = source.frame.origin.x;
  const append = (side: Sample["side"]) => samples.push({ x, y: beam(qY, lambda, x), z: beam(qZ, lambda, x), side });
  const paraxial = () => [qY, qZ].every(q => lambda / (Math.PI * Math.sqrt(lambda * q.im / Math.PI)) <= 0.1);
  if (!paraxial() || [target.mode.mfdX!, target.mode.mfdY!].some(mfd => lambda / (Math.PI * mfd / 2) > 0.1)) return fail("Paraxial gate: Waist divergence가 0.1 rad를 넘습니다. 더 큰 MFD / 더 약한 Lens가 필요합니다.", "out-of-domain");
  try {
    append("before");
    for (const c of enabled.slice(1)) {
      const start = x, end = c.frame.origin.x, distance = end - start;
      const count = Math.max(1, Math.ceil(distance / (target.frame.origin.x - source.frame.origin.x) * 240));
      const startY = qY, startZ = qZ;
      for (let i = 1; i <= count; i++) {
        x = start + distance * i / count;
        qY = { re: startY.re + (x - start), im: startY.im };
        qZ = { re: startZ.re + (x - start), im: startZ.im };
        append("before");
      }
      if (c.kind === "lens") {
        const by = beam(qY, lambda, x), bz = beam(qZ, lambda, x);
        if (Math.max(by.radius, bz.radius) >= c.aperture / 4) warnings.push(`${c.name}: Beam이 Aperture에 접근합니다. Clipping 미계산으로 실제 Coupling은 달라질 수 있습니다.`);
        qY = abcd(qY, [1, 0, -1 / c.focalLength, 1]);
        qZ = abcd(qZ, [1, 0, -1 / c.focalLength, 1]);
        if (!paraxial()) return fail(`${c.name}: Lens 뒤 Waist divergence > 0.1 rad. Paraxial 범위 밖입니다.`, "out-of-domain");
        append("after");
      }
    }
    const incident = { y: beam(qY, lambda, x), z: beam(qZ, lambda, x) };
    const accepted = { y: target.mode.mfdX! / 2, z: target.mode.mfdY! / 2, offsetY: target.frame.origin.y - source.frame.origin.y, offsetZ: target.frame.origin.z - source.frame.origin.z };
    const logEta = axisLogOverlap(incident.y.radius, accepted.y, incident.y.curvature, accepted.offsetY, lambda) + axisLogOverlap(incident.z.radius, accepted.z, incident.z.curvature, accepted.offsetZ, lambda);
    const eta = Math.exp(logEta), underflow = eta === 0;
    if (underflow) warnings.push("η underflow: Float64에서 0으로 표시됩니다. Coupling Loss는 ∞로 표시합니다. Log η는 Provenance 상세에서 확인하세요.");
    return { status: "valid", provenance, warnings, samples, incident, target: accepted, eta, logEta, underflow, lossDB: underflow ? Infinity : -10 * logEta / Math.LN10 };
  } catch (error) { return fail(`Numerical failure: ${error instanceof Error ? error.message : String(error)}`); }
}
