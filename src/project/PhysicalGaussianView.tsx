import {useState,useRef,useLayoutEffect} from 'react';
import type {PhysicalGaussian} from './physicalGaussian';
import './physicalGaussian.css';
export const gaussianPercent=(eta:number)=>eta===0?'Underflow':eta<1e-5?`${(eta*100).toExponential(2)}%`:`${Number((eta*100).toPrecision(5))}%`;
const number=(n:number)=>Number(n.toPrecision(5)).toString();
const curve=(values:{x:number;y:number}[])=>values.map((v,i)=>`${i?'L':'M'}${v.x.toFixed(3)},${v.y.toFixed(3)}`).join(' ');
type Valid=Extract<PhysicalGaussian,{status:'valid'}>;
function usePlotSize(){
 const ref=useRef<SVGSVGElement>(null),[size,setSize]=useState({width:720,height:270});
 useLayoutEffect(()=>{if(!ref.current)return;const observer=new ResizeObserver(([e])=>{const {width,height}=e.contentRect;if(width>0&&height>0)setSize({width,height});});observer.observe(ref.current);return()=>observer.disconnect();},[]);
 return {ref,...size};
}
export default function PhysicalGaussianView({result}:{result:PhysicalGaussian}) {
 const [axis,setAxis]=useState<'y'|'z'>('y'),[plot,setPlot]=useState<'propagation'|'output'>('propagation'),[scale,setScale]=useState<'reference'|'beam'>('reference');
 return <section className="physical-gaussian" data-testid="physical-gaussian"><header><div><strong>Gaussian Beam</strong><small>Same Surface prescription · Scalar / Paraxial</small></div><span data-testid="physical-gaussian-status">{result.status==='valid'?(result.higherOrder?'Paraxial reference':'Propagated'):result.status}</span></header>
 {result.status!=='valid'?<div className="physical-gaussian-unavailable" data-testid="physical-gaussian-reason"><h3>Gaussian propagation unavailable</h3><p>{result.reason}</p><small>Surface View shows the geometric diagnostic for this Project.</small></div>:<>
 <div className="physical-gaussian-tools"><div>{(['propagation','output'] as const).map(v=><button key={v} aria-pressed={plot===v} onClick={()=>setPlot(v)}>{v==='propagation'?'Beam Propagation':'Output Field'}</button>)}</div><div>{(['y','z'] as const).map(v=><button key={v} aria-label={`Physical Gaussian X${v.toUpperCase()}`} aria-pressed={axis===v} onClick={()=>setAxis(v)}>X–{v.toUpperCase()}</button>)}</div></div>
 <div className="physical-gaussian-plot">{plot==='propagation'?<Envelope result={result} axis={axis}/>:<><div className="field-scale"><span>Output Local {axis.toUpperCase()} · shared coordinates</span><label>Window <select aria-label="Output Field Window" value={scale} onChange={e=>setScale(e.target.value as typeof scale)}><option value="reference">Reference Mode</option><option value="beam">Full Incident Beam</option></select></label></div><OutputProfile result={result} axis={axis} scale={scale}/></>}</div>
 <div className="physical-gaussian-metrics"><div><small>Output beam diameter · 2w</small><strong data-testid="physical-beam-diameter">{number(2*result.incident[axis].radius*1e6)} µm</strong></div><div><small>Wavefront radius · R</small><strong data-testid="physical-wavefront">{Math.abs(result.incident[axis].curvature)<1e-10?'∞':`${number(1e3/result.incident[axis].curvature)} mm`}</strong></div><div><small>Mode overlap · conditional</small><strong data-testid="physical-overlap">{result.overlap.status==='valid'?gaussianPercent(result.overlap.eta):'Not calculated'}</strong></div></div>
 <p className="physical-gaussian-scope">1/e² intensity radius · normalized field · no Fresnel / aberration / clipping propagation. {result.overlap.status!=='valid'&&result.overlap.reason}</p>
 </>}
 </section>;
}
function Envelope({result:r,axis}:{result:Valid;axis:'y'|'z'}) {
 const {ref,width,height}=usePlotSize(),left=62,right=24,top=32,bottom=34,start=r.samples[0].x,end=r.incident.x;
 const h=(s:Valid['incident'])=>axis==='y'?s.heightY:s.heightZ;
 const span=Math.max(...r.samples.map(s=>Math.abs(h(s))+s[axis].radius))*1.15;
 const X=(x:number)=>left+(x-start)/(end-start)*(width-left-right),Y=(y:number)=>top+(span-y)/(2*span)*(height-top-bottom);
 const upper=r.samples.map(s=>({x:X(s.x),y:Y(h(s)+s[axis].radius)})),lower=r.samples.map(s=>({x:X(s.x),y:Y(h(s)-s[axis].radius)}));
 const points=[...upper,...lower.reverse()].map(v=>`${v.x},${v.y}`).join(' ');
 return <svg ref={ref} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Physical Gaussian beam envelope" data-testid="physical-beam-envelope">
 <title>1/e² Gaussian envelope from the same S1 and S2 prescription. Axial and transverse scales differ.</title>
 {r.surfaces.slice(0,-1).map((s,i)=>s.nAfter!==1?<rect key={s.id} x={X(s.x)} y={top} width={Math.max(0,X(r.surfaces[i+1].x)-X(s.x))} height={height-top-bottom} className="gaussian-glass"/>:null)}
 {[-1,-.5,0,.5,1].map(v=><g key={v}><path d={`M${left},${Y(v*span)}H${width-right}`} className="gaussian-grid"/><text x={left-8} y={Y(v*span)+4} textAnchor="end">{number(v*span*1e6)}</text></g>)}
 <polygon points={points} className="gaussian-envelope"/><path d={curve(r.samples.map(s=>({x:X(s.x),y:Y(h(s))})))} className="gaussian-axis"/>
 {r.surfaces.map(s=><g key={s.id} data-surface-id={s.id}><path d={`M${X(s.x)},${top}V${height-bottom}`} className="gaussian-interface"/><text x={X(s.x)} y={top-12} textAnchor="middle">{s===r.surfaces.at(-1)?'Output':s.id}</text></g>)}
 <text x={left} y={top-12}>Input</text>{[0,.25,.5,.75,1].map(v=><text key={v} x={X(start+v*(end-start))} y={height-bottom+18} textAnchor="middle">{number(v*(end-start)*1e3)}</text>)}
 <text x={left} y={height-4}>Distance from Input [mm]</text><text x={width-right} y={height-4} textAnchor="end">{axis.toUpperCase()} [µm] · 1/e² envelope</text>
 </svg>;
}
function OutputProfile({result:r,axis,scale}:{result:Valid;axis:'y'|'z';scale:'reference'|'beam'}) {
 const {ref,width,height}=usePlotSize();
 const b=r.incident[axis],target=r.referenceMode?.[axis]??null,center=(axis==='y'?r.incident.heightY-r.targetCenter.y:r.incident.heightZ-r.targetCenter.z),angle=axis==='y'?r.incident.slopeY-r.targetSlope.y:r.incident.slopeZ-r.targetSlope.z;
 const span=scale==='reference'&&target?target*3:Math.max(Math.abs(center)+b.radius*2.5,(target??0)*3),N=300,left=62,right=80,plotWidth=width-left-right;
 const X=(u:number)=>left+(u+span)/(2*span)*plotWidth;
 const intensity=(u:number,w:number,c:number)=>Math.sqrt(2/Math.PI)/w*Math.exp(-2*((u-c)/w)**2);
 const iTop=31,iBottom=height*.46,pMiddle=height*.76,pRange=Math.max(10,height*.13);
 const peak=Math.max(intensity(center,b.radius,center),target?intensity(0,target,0):0),I=(n:number)=>iBottom-n/peak*(iBottom-iTop);
 const samples=Array.from({length:N+1},(_,i)=>-span+i*2*span/N),phase=(u:number)=>-2*Math.PI/r.wavelength*r.incident.n*(b.curvature*(u-center)**2/2+angle*(u-center));
 const phaseSpan=Math.max(1,...samples.map(u=>Math.abs(phase(u)))),P=(p:number)=>pMiddle-p/phaseSpan*pRange;
 return <svg ref={ref} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Output intensity and relative phase profiles" data-testid="physical-output-field"><title>Incident and reference share one coordinate and intensity scale. Phase is relative to the flat target; global piston is omitted.</title>
 <text x={left} y={18}>Unit-integral marginal intensity [1/µm]</text><text x={width-right} y={18} textAnchor="end">Incident <tspan className="gaussian-reference-label"> / Reference</tspan></text>
 <path d={`M${left},${iBottom}H${width-right}M${X(0)},${iTop}V${height-27}M${left},${pMiddle}H${width-right}`} className="gaussian-grid"/>
 <text x={left-8} y={iTop+4} textAnchor="end">{number(peak*1e-6)}</text><text x={left-8} y={iBottom+4} textAnchor="end">0</text>
 <path d={curve(samples.map(u=>({x:X(u),y:I(intensity(u,b.radius,center))})))} className="gaussian-incident-profile"/>
 {target&&<path d={curve(samples.map(u=>({x:X(u),y:I(intensity(u,target,0))})))} className="gaussian-target-profile"/>}
 <text x={left} y={height*.58}>Relative unwrapped phase [rad] · piston omitted</text><text x={left-8} y={pMiddle-pRange+4} textAnchor="end">{number(phaseSpan)}</text><text x={left-8} y={pMiddle+4} textAnchor="end">0</text><text x={left-8} y={pMiddle+pRange+4} textAnchor="end">−{number(phaseSpan)}</text>
 <path d={curve(samples.map(u=>({x:X(u),y:P(phase(u))})))} className="gaussian-incident-profile"/>{target&&<path d={`M${left},${pMiddle}H${width-right}`} className="gaussian-target-profile"/>}
 {[-1,-.5,0,.5,1].map(v=><text key={v} x={X(v*span)} y={height-8} textAnchor="middle">{number(v*span*1e6)}</text>)}<text x={width-4} y={height-8} textAnchor="end">{axis.toUpperCase()} [µm]</text>
 </svg>;
}
