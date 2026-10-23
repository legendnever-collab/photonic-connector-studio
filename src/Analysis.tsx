import type { GaussianResult } from "./physics";
import { toMM, toNM, toUM } from "./domain";
export const number = (v: number, digits = 4) => Number.isFinite(v) ? Number(v.toPrecision(digits)).toString() : "∞";
export function Metrics({ result, compact = false }: { result: GaussianResult; compact?: boolean }) {
  return <div className={compact ? "result-summary" : "result-metrics"} data-testid={compact ? "live-summary" : "analysis-metrics"}>
    <div className="metric"><span>Gaussian Mode Coupling η</span><strong data-testid={compact ? "summary-eta" : "eta"}>{result.status === "valid" ? `${number(result.eta * 100, 6)}%${result.underflow ? " (underflow)" : ""}` : "Not calculated"}</strong></div>
    <div className="metric"><span>Gaussian Coupling Loss</span><strong>{result.status === "valid" ? `${number(result.lossDB, 6)} dB` : "Not calculated"}</strong></div>
    <div className="metric"><span>W Beam / Target Radius Y · Z [µm]</span><strong>{result.status === "valid" ? `${number(toUM(result.incident.y.radius))} / ${number(toUM(result.target.y))} · ${number(toUM(result.incident.z.radius))} / ${number(toUM(result.target.z))}` : "Not calculated"}</strong></div>
    {!compact && <p>Gaussian Coupling만 계산합니다. 전체 Connector Insertion Loss가 아닙니다.</p>}
    {compact && result.status !== "valid" && <p>{result.reason}</p>}
    {compact && result.warnings.some(w => w.includes("Polarization")) && <p>{result.warnings.find(w => w.includes("Polarization"))}</p>}
  </div>;
}
function Trace({ series, label, unit }: { series: { x: number; y: number; z: number }[]; label: string; unit: string }) {
  const xmin = series[0].x, xmax = series.at(-1)!.x;
  const ymin = Math.min(0, ...series.flatMap(p => [p.y, p.z])), ymax = Math.max(...series.flatMap(p => [p.y, p.z]), 1e-30);
  const point = (p: typeof series[number], axis: "y" | "z") => `${40 + 300 * (p.x - xmin) / (xmax - xmin)},${130 - 110 * (p[axis] - ymin) / (ymax - ymin)}`;
  return <figure className="scientific-plot"><figcaption>{label} · Y — / Z ⋯</figcaption><svg viewBox="0 0 360 165" role="img" aria-label={label}>
    <path d="M40 15 V130 H345" fill="none" stroke="#9db0b8"/>
    <polyline points={series.map(p => point(p,"y")).join(" ")} fill="none" stroke="#218977" strokeWidth="2"/>
    <polyline points={series.map(p => point(p,"z")).join(" ")} fill="none" stroke="#7658ab" strokeWidth="2" strokeDasharray="5 3"/>
    <text x="38" y="12">{number(ymax)} {unit}</text><text x="3" y="134">{number(ymin)}</text>
    <text x="40" y="153">{number(toMM(xmin))}</text><text x="290" y="153">{number(toMM(xmax))} mm</text>
  </svg></figure>;
}
function ModeProfile({ result, axis }: { result: Extract<GaussianResult,{status:"valid"}>; axis: "y" | "z" }) {
  const wi=result.incident[axis].radius, wt=result.target[axis], offset=axis === "y" ? result.target.offsetY : result.target.offsetZ;
  const lo=Math.min(-3*wi,offset-3*wt), hi=Math.max(3*wi,offset+3*wt);
  const samples=Array.from({length:181},(_,i)=>lo+(hi-lo)*i/180);
  const points=(target:boolean)=>samples.map((u,i)=>`${30+i*300/180},${115-90*Math.exp(-2*((u-(target?offset:0))/(target?wt:wi))**2)}`).join(" ");
  return <figure className="scientific-plot"><figcaption>W · {axis.toUpperCase()} Intensity · Incident — / Target ⋯</figcaption>
    <svg viewBox="0 0 360 150" role="img" aria-label={`W ${axis} mode profile`}><path d="M30 20 V115 H335" fill="none" stroke="#a0b2bb"/>
      <polyline points={points(false)} fill="none" stroke="#218977" strokeWidth="2"/><polyline points={points(true)} fill="none" stroke="#7658ab" strokeWidth="2" strokeDasharray="5 3"/>
      <text x="30" y="138">{number(toUM(lo))} µm</text><text x="270" y="138">{number(toUM(hi))} µm</text><text x="3" y="25">1</text>
    </svg><small>각 Peak=1로 표시 · Phase Curvature는 아래 1/R에서 확인</small></figure>;
}
export default function Analysis({result}:{result:GaussianResult}) {
  return <><Metrics result={result}/>
    {result.status !== "valid" ? <p className="calculation-error" data-testid="calculation-reason">{result.reason}</p> : <>
      <p className="waist-assumption">Source waist: F · Target waist: W · WG Y/Z Offset만 지원</p>
      {result.warnings.map(w=><p className="physics-warning" key={w}>{w}</p>)}
      <Trace label="Beam Radius w(X)" unit="µm" series={result.samples.map(s=>({x:s.x,y:toUM(s.y.radius),z:toUM(s.z.radius)}))}/>
      <details><summary>Curvature · Mode · Waist 상세</summary>
        <Trace label="Wavefront Curvature 1/R(X)" unit="m⁻¹" series={result.samples.map(s=>({x:s.x,y:s.y.curvature,z:s.z.curvature}))}/>
        <p>W Incident 1/R: Y {number(result.incident.y.curvature)} / Z {number(result.incident.z.curvature)} m⁻¹. Target: 0 (R=∞).</p>
        <p>마지막 구간의 Waist X: Y {number(toMM(result.incident.y.waistX),6)} / Z {number(toMM(result.incident.z.waistX),6)} mm. 구간 밖이면 해당 q의 Virtual/연장 위치입니다.</p>
        <p>Waist Radius Y/Z: {number(toUM(result.incident.y.waistRadius))} / {number(toUM(result.incident.z.waistRadius))} µm.</p>
        <ModeProfile result={result} axis="y"/><ModeProfile result={result} axis="z"/>
      </details>
    </>}
    <details className="provenance"><summary>Solver Provenance · 적용 범위</summary>
      <p>{result.provenance.modelId} / v{result.provenance.version} · {result.status}</p><p>λ {number(toNM(result.provenance.wavelength))} nm · FNV64 {result.provenance.fingerprint}</p>
      {result.status==="valid"&&<p>Log η={number(result.logEta,12)}</p>}
      <ul>{result.provenance.assumptions.map(a=><li key={a}>{a}</li>)}</ul>
      <p>결과는 저장하지 않고 현재 Input에서 재계산합니다. Source/Target waist 위치, Scalar Polarization, Ideal Aperture 가정은 측정 데이터가 아닙니다.</p>
    </details>
  </>;
}
