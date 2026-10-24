import { useEffect, useMemo, useRef, useState } from "react";
import type { DesignDocument } from "./domain";
import { um } from "./domain";
import type { GaussianResult } from "./physics";
import { computeSensitivity, DEFAULT_SENSITIVITY, sensitivityCSV } from "./sensitivity";
import type { Acceptance, ScanPoint } from "./sensitivity";
const fmt=(v:number,n=5)=>Number(v.toPrecision(n)).toString();
function AcceptanceText({value,scale,unit}:{value:Acceptance;scale:number;unit:string}){
  if(value.status!=="passes")return <p className="scan-warning">Nominal η가 Threshold보다 낮습니다. Nominal 기준 통과 구간이 없습니다.</p>;
  const describe=(edge:typeof value.low)=>`${fmt(edge.delta*scale)} ${unit} (${edge.kind==="crossing"?"Threshold 교차":edge.kind==="scan-edge"?"Scan 끝까지 통과":"Domain 경계 전 마지막 통과 Sample"})`;
  return <p className="acceptance-range">Δ {describe(value.low)} ~ {describe(value.high)}</p>;
}
function Curve({points,kind,span,threshold,nominal}:{points:ScanPoint[];kind:"offset"|"rotation";span:number;threshold:number;nominal:number}){
  let prior=false;const d=points.map(p=>{if(p.eta===null){prior=false;return "";}const command=prior?"L":"M";prior=true;return `${command}${40+280*(p[kind]+span)/(2*span)},${130-110*p.eta}`;}).join(" ");
  const factor=kind==="offset"?1e6:1e3,unit=kind==="offset"?"µm":"mrad";
  return <figure className="scan-plot"><figcaption>{kind==="offset"?"WG Offset":"WG Port Rotation"} · absolute η [%]</figcaption><svg viewBox="0 0 350 170" role="img" aria-label={`${kind} sensitivity curve`}>
    <path d="M40 18 V130 H325" stroke="#a4b5bd" fill="none"/><path d={`M40,${130-110*threshold} H325`} stroke="#a77a36" strokeDasharray="5 4"/>
    <path data-testid={`${kind}-curve-path`} d={d} stroke="var(--mint)" strokeWidth="2.4" fill="none"/>
    <circle cx="180" cy={130-110*nominal} r="4" fill="var(--ink)"/><text x="5" y="24">100</text><text x="20" y="134">0</text>
    <text x="35" y="154">−{fmt(span*factor,3)}</text><text x="175" y="154">0</text><text x="280" y="154">+{fmt(span*factor,3)} {unit}</text>
  </svg></figure>;
}
export default function Sensitivity({doc,result}:{doc:DesignDocument;result:GaussianResult}){
  const [axis,setAxis]=useState<"y"|"z">("y");
  const [offsetRaw,setOffsetRaw]=useState("30"),[tiltRaw,setTiltRaw]=useState("20"),[thresholdRaw,setThresholdRaw]=useState("80");
  const [expanded,setExpanded]=useState(false);
  useEffect(()=>{document.body.classList.toggle("alignment-expanded",expanded);return()=>document.body.classList.remove("alignment-expanded");},[expanded]);const expandButton=useRef<HTMLButtonElement>(null);
  const [selected,setSelected]=useState<{key:string;index:number}|null>(null);
  const settings=useMemo(()=>({...DEFAULT_SENSITIVITY,axis,offsetSpan:um(Number(offsetRaw)),tiltSpan:Number(tiltRaw)*1e-3,threshold:Number(thresholdRaw)/100}),[axis,offsetRaw,tiltRaw,thresholdRaw]);
  const scan=useMemo(()=>result.status==="valid"?computeSensitivity(doc,settings):{status:"invalid" as const,reason:result.reason},[doc,settings,result.status,result.status!=="valid"?result.reason:""]);
  const key=result.provenance.fingerprint+JSON.stringify(settings);
  const inspect=scan.status==="valid"&&selected?.key===key?scan.map[selected.index]:undefined;
  const close=()=>{setExpanded(false);expandButton.current?.focus();};
  const csv=()=>{if(scan.status!=="valid")return;const url=URL.createObjectURL(new Blob([sensitivityCSV(scan)],{type:"text/csv;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download="photonic-connector-p1.2-sensitivity.csv";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  return <section className={`sensitivity ${expanded?"expanded":""}`} role={expanded?"dialog":"region"} aria-modal={expanded?true:undefined} aria-label="Alignment Analysis" data-testid="sensitivity-panel" onKeyDown={e=>{
    if(!expanded)return;if(e.key==="Escape"){e.stopPropagation();close();}
    if(e.key==="Tab"){const focusable=e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input,select,[tabindex="0"]');const first=focusable[0],last=focusable[focusable.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}
  }}>
    <div className="scan-heading"><h3>Alignment Sensitivity</h3><button ref={expandButton} onClick={()=>expanded?close():setExpanded(true)} aria-label={expanded?"Close Alignment Analysis":"Expand Alignment Analysis"}>{expanded?"닫기":"Expand"}</button></div>
    <p>현재 Design에서 WG Offset·Tilt만 변화시킵니다. 다른 값은 고정하며 Design/History를 바꾸지 않습니다.</p>
    <div className="scan-controls">
      <label>Axis<select aria-label="Sensitivity Axis" value={axis} onChange={e=>setAxis(e.target.value as "y"|"z")}><option value="y">Y / Yaw</option><option value="z">Z / Pitch</option></select></label>
      <label>Offset ± [µm]<input aria-label="Offset Scan Span" type="number" value={offsetRaw} onChange={e=>setOffsetRaw(e.target.value)} min="0.001" max="10000" step="1"/></label>
      <label>Tilt ± [mrad]<input aria-label="Tilt Scan Span" type="number" value={tiltRaw} onChange={e=>setTiltRaw(e.target.value)} min="0.001" max="100" step="1"/></label>
      <label>η Threshold [%]<input aria-label="Coupling Threshold" type="number" value={thresholdRaw} onChange={e=>setThresholdRaw(e.target.value)} min="0.001" max="100" step="1"/></label>
    </div>
    <div className="scan-actions"><button onClick={()=>{setOffsetRaw("30");setTiltRaw("20");setThresholdRaw("80");setAxis("y");}}>Reset Scan</button><button onClick={csv} disabled={scan.status!=="valid"}>Export Sweep CSV</button></div>
    <p className="scan-note">Δ는 현재 값에서의 변화량입니다. Tilt는 WG {axis==="y"?"Yaw (sY=Yaw)":"Pitch (sZ=−Pitch)"}. Source/WG의 Pitch·Yaw는 Train → Edit [°]에서 변경합니다. Scan 설정은 Session 안에서만 유지합니다.</p>
    {scan.status!=="valid"?<p className="scan-warning" data-testid="scan-invalid">{scan.reason}</p>:<>
      <p data-testid="scan-provenance">Nominal η {fmt(scan.nominalEta*100,6)}% · Threshold {fmt(scan.settings.threshold*100)}% · Input {scan.fingerprint}</p>
      <div className="scan-grid"><div>
        <Curve points={scan.offsetCurve} kind="offset" span={scan.settings.offsetSpan} threshold={scan.settings.threshold} nominal={scan.nominalEta}/><div data-testid="offset-acceptance"><AcceptanceText value={scan.offsetAcceptance} scale={1e6} unit="µm"/></div>
        <Curve points={scan.tiltCurve} kind="rotation" span={scan.settings.tiltSpan} threshold={scan.settings.threshold} nominal={scan.nominalEta}/><div data-testid="tilt-acceptance"><AcceptanceText value={scan.tiltAcceptance} scale={1e3} unit="mrad"/></div>
      </div><figure className="scan-map"><figcaption>Offset–Tilt Map · absolute η</figcaption><svg viewBox="0 0 350 325" role="group" aria-label="Offset–Tilt Coupling Map">
        {scan.map.map((p,i)=>{const col=i%scan.settings.mapPoints,row=Math.floor(i/scan.settings.mapPoints),step=260/scan.settings.mapPoints,x=55+col*step,y=280-(row+1)*step;
          return <rect key={i} x={x} y={y} width={step+.15} height={step+.15} data-testid={`map-cell-${i}`} fill={p.eta===null?"#c2cbd2":`hsl(164 42% ${94-58*p.eta}%)`} stroke={selected?.key===key&&selected.index===i?"#d79a24":p.eta!==null&&p.eta>=scan.settings.threshold?"#254d5b":"none"} strokeWidth=".8" role="button" tabIndex={0} aria-label={`Map offset ${fmt(p.offset*1e6)} µm rotation ${fmt(p.rotation*1e3)} mrad ${p.eta===null?p.status:fmt(p.eta*100)+"%"}`} onClick={()=>setSelected({key,index:i})} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();setSelected({key,index:i});}}}><title>{p.eta===null?p.reason:`η ${fmt(p.eta*100,6)}%${p.underflow?" (underflow)":""}`}</title></rect>;
        })}
        <path d="M179 150 H191 M185 144 V156" stroke="#142e43" strokeWidth="2" pointerEvents="none"/>
        <text x="55" y="299">−{fmt(scan.settings.offsetSpan*1e6,3)}</text><text x="175" y="299">0</text><text x="262" y="299">+{fmt(scan.settings.offsetSpan*1e6,3)} µm</text>
        <text x="1" y="24">+{fmt(scan.settings.tiltSpan*1e3,3)}</text><text x="22" y="154">0</text><text x="1" y="280">−{fmt(scan.settings.tiltSpan*1e3,3)}</text><text x="8" y="311">Δ {axis==="y"?"Yaw":"Pitch"} [mrad]</text>
      </svg><p>Green: η · Outline: Threshold 통과 · +: Nominal · Gray: Invalid/Out-of-domain</p><p data-testid="map-inspection">{inspect?`ΔOffset ${fmt(inspect.offset*1e6)} µm / ΔRotation ${fmt(inspect.rotation*1e3)} mrad → ${inspect.eta===null?inspect.reason:`η ${fmt(inspect.eta*100,6)}%${inspect.underflow?" (underflow)":""}`}`:"Cell을 선택하면 값과 Validity를 표시합니다."}</p></figure></div>
      <p className="scan-note">Curve 61점 · Map 21×21점. 교차는 Bracket 안에서 다시 계산합니다. Scan 끝과 Domain 경계 밖은 미확인입니다. 실제 제조·재결합 Tolerance는 P5에서 다룹니다.</p>
    </>}
  </section>;
}
