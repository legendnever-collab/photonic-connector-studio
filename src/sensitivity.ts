import { ComponentSchema } from "./domain";
import type { DesignDocument } from "./domain";
import { axisLogOverlap, MAX_SLOPE, SOLVER_VERSION, solveGaussian } from "./physics";
import type { GaussianResult } from "./physics";
export type SensitivitySettings = { axis: "y" | "z"; offsetSpan: number; tiltSpan: number; threshold: number; points: number; mapPoints: number };
export const DEFAULT_SENSITIVITY: SensitivitySettings = { axis: "y", offsetSpan: 30e-6, tiltSpan: 0.02, threshold: 0.8, points: 61, mapPoints: 21 };
export type ScanPoint = { offset: number; rotation: number; eta: number | null; status: GaussianResult["status"]; reason?: string; logEta?: number; underflow?: boolean };
export type Boundary = { delta: number; kind: "crossing" | "scan-edge" | "domain-edge" };
export type Acceptance = { status: "passes"; low: Boundary; high: Boundary } | { status: "nominal-below-threshold" };
export type SensitivityResult = { status: "valid"; fingerprint: string; settings: SensitivitySettings; nominalEta: number; offsetCurve: ScanPoint[]; tiltCurve: ScanPoint[]; map: ScanPoint[]; offsetAcceptance: Acceptance; tiltAcceptance: Acceptance } | { status: "invalid"; reason: string };
// Independent immutable delta application; saved Design and History are never touched.
export function shiftedTarget(doc: DesignDocument, axis: "y" | "z", offset: number, rotation: number): DesignDocument {
  const target = doc.components.at(-1)!;
  return { ...doc, components: [...doc.components.slice(0, -1), { ...target, frame: { origin: { ...target.frame.origin, [axis]: target.frame.origin[axis] + offset }, rotation: { ...target.frame.rotation, [axis === "y" ? "yaw" : "pitch"]: target.frame.rotation[axis === "y" ? "yaw" : "pitch"] + rotation } } }] };
}
export function computeSensitivity(doc: DesignDocument, settings: SensitivitySettings = DEFAULT_SENSITIVITY): SensitivityResult {
  const s = { ...settings };
  if (!([s.offsetSpan,s.tiltSpan,s.threshold].every(Number.isFinite) && s.offsetSpan > 0 && s.offsetSpan <= 0.01 && s.tiltSpan > 0 && s.tiltSpan <= 0.1 && s.threshold > 0 && s.threshold <= 1 && [s.points,s.mapPoints].every(n=>Number.isInteger(n)&&n>=3&&n%2===1) && s.points<=121 && s.mapPoints<=31 && (s.axis === "y" || s.axis === "z"))) return {status:"invalid",reason:"Scan 범위: Offset 0~10000 µm, Tilt 0~100 mrad, Threshold 0~100% (0 제외), 홀수 Grid가 필요합니다."};
  const nominal = solveGaussian(doc, {sampleBeam:false});
  if (nominal.status !== "valid") return {status:"invalid",reason:nominal.reason};
  const point = (offset:number,rotation:number):ScanPoint => {
    // Frozen train: only accepted WG field changes. Reuse validated W incident field,
    // avoiding hundreds of q propagations and full-design fingerprints per keystroke.
    const changed = shiftedTarget(doc,s.axis,offset,rotation).components.at(-1)!;
    const parsed = ComponentSchema.safeParse(changed);
    if (!parsed.success) return {offset,rotation,eta:null,status:"invalid",reason:parsed.error.issues.map(i=>i.message).join(" · ")};
    if (Math.hypot(changed.frame.rotation.yaw,changed.frame.rotation.pitch)>MAX_SLOPE) return {offset,rotation,eta:null,status:"out-of-domain",reason:"WG Tilt norm >50 mrad"};
    const dY=nominal.mismatch.offsetY+(s.axis==="y"?offset:0),dZ=nominal.mismatch.offsetZ+(s.axis==="z"?offset:0);
    const angleY=nominal.mismatch.angleY-(s.axis==="y"?rotation:0),angleZ=nominal.mismatch.angleZ+(s.axis==="z"?rotation:0);
    try {
      const log=axisLogOverlap(nominal.incident.y.radius,nominal.target.y,nominal.incident.y.curvature,dY,doc.wavelength,angleY)+axisLogOverlap(nominal.incident.z.radius,nominal.target.z,nominal.incident.z.curvature,dZ,doc.wavelength,angleZ);
      const eta=Math.exp(log);return {offset,rotation,eta,logEta:log,underflow:eta===0,status:"valid"};
    } catch(error) { return {offset,rotation,eta:null,status:"invalid",reason:String(error)}; }
  };
  const grid = (span:number,n:number) => Array.from({length:n},(_,i)=>(i-(n-1)/2)*span/((n-1)/2));
  const offsetCurve=grid(s.offsetSpan,s.points).map(d=>point(d,0));
  const tiltCurve=grid(s.tiltSpan,s.points).map(d=>point(0,d));
  const map=grid(s.tiltSpan,s.mapPoints).flatMap(t=>grid(s.offsetSpan,s.mapPoints).map(d=>point(d,t)));
  const interval=(curve:ScanPoint[],key:"offset"|"rotation"):Acceptance=>{
    const center=(curve.length-1)/2;
    if (nominal.eta < s.threshold) return {status:"nominal-below-threshold"};
    const edge=(direction:-1|1):Boundary=>{
      let inside=center;
      while(inside+direction>=0&&inside+direction<curve.length){
        const next=curve[inside+direction];
        if(next.eta===null)return {delta:curve[inside][key],kind:"domain-edge"};
        if(next.eta < s.threshold){
          let pass=curve[inside][key],fail=next[key];
          for(let n=0;n<32;n++){
            const mid=(pass+fail)/2,p=key==="offset"?point(mid,0):point(0,mid);
            if(p.eta===null)return {delta:pass,kind:"domain-edge"};
            if(p.eta>=s.threshold)pass=mid;else fail=mid;
          }
          return {delta:(pass+fail)/2,kind:"crossing"};
        }
        inside+=direction;
      }
      return {delta:curve[inside][key],kind:"scan-edge"};
    };
    return {status:"passes",low:edge(-1),high:edge(1)};
  };
  return {status:"valid",fingerprint:nominal.provenance.fingerprint,settings:s,nominalEta:nominal.eta,offsetCurve,tiltCurve,map,offsetAcceptance:interval(offsetCurve,"offset"),tiltAcceptance:interval(tiltCurve,"rotation")};
}
export function sensitivityCSV(r:Extract<SensitivityResult,{status:"valid"}>) {
  const quote=(v:unknown)=>`"${String(v??"").replaceAll('"','""')}"`;
  const rows=[['kind','axis','delta_offset_m','delta_port_rotation_rad','eta','validity','reason','nominal_fingerprint','absolute_eta_threshold','solver_version','log_eta','underflow']];
  for(const [kind,points] of [['offset',r.offsetCurve],['tilt',r.tiltCurve],['map',r.map]] as const) for(const p of points) rows.push([kind,r.settings.axis,String(p.offset),String(p.rotation),p.eta===null?'':String(p.eta),p.status,p.reason??'',r.fingerprint,String(r.settings.threshold),SOLVER_VERSION,p.logEta===undefined?'':String(p.logEta),String(p.underflow??'')]);
  return rows.map(row=>row.map(quote).join(',')).join('\n')+'\n';
}
