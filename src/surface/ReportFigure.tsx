import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Camera, Download, RotateCcw, X } from 'lucide-react';
import { add, sub, mul, dot, norm, unit, V, cellCenters } from './model';
import type { Prescription, Vec } from './model';
import type { Trace } from './trace';
import { sceneBounds, downloadScene } from './Scene';
import { cross, hullIndices, reportGeometry } from './reportGeometry';
import { surfaceRing,SURFACE_SOLVER_ID } from './trace';
import { useProject } from '../project/Store';
import { bodyGeometry, clipToBody } from '../project/geometry';
import { projectFingerprint, modes } from '../project/model';
import './report.css';

type ReportCamera = { yaw:number; pitch:number; zoom:number };
const ISOMETRIC: ReportCamera = {yaw:-.55,pitch:.62,zoom:1};
type Projected = { x:number;y:number;depth:number };
type Primitive = { depth:number; node:ReactNode };

export default function ReportFigure({doc,trace,initialSelection,onClose,embedded=false}:{doc:Prescription;trace:Trace;initialSelection:string;onClose?:()=>void;embedded?:boolean}) {
    const shared=useProject(),opticalProject=shared.project,gaussian=shared.gaussian;
    const dialog=useRef<HTMLDialogElement>(null), svg=useRef<SVGSVGElement>(null);
    const [mode,setMode]=useState<'B'|'C'>('B'),[localSelected,setLocalSelected]=useState(initialSelection);
    const [camera,setCamera]=useState(ISOMETRIC),[envelopes,setEnvelopes]=useState(true),[labels,setLabels]=useState(true),[beams,setBeams]=useState(true);
    const [exportError,setExportError]=useState(''),[busy,setBusy]=useState(false);
    const drag=useRef<{x:number;y:number;camera:ReportCamera}|null>(null);
    const selected=trace.surfaces.some(s=>s.id===shared.selection)?shared.selection:localSelected;
    const setSelected=(id:string)=>{setLocalSelected(id);shared.setSelection(id);};
    const geometry=useMemo(()=>{const optical=reportGeometry(doc,trace,false),body=bodyGeometry(doc,trace.surfaces,opticalProject.bodies,opticalProject.sourceBody,opticalProject.targetBody);return {...optical,faces:[...optical.faces.map(f=>({...f,points:clipToBody(f.points,f.surfaceId,body)})).filter(f=>f.points.length>=3),...(envelopes?body.faces:[])],edges:[...optical.edges.map(e=>{const ps=clipToBody(e.points,e.surfaceId,body);return {...e,points:ps.length?[...ps,ps[0]]:[]};}).filter(e=>e.points.length>=3),...(envelopes?body.edges:[])],issues:body.issues};},[doc,trace,envelopes,opticalProject]);
    const bounds=useMemo(()=>sceneBounds(doc,trace),[doc,trace]);
    useEffect(()=>{if(embedded)return;const opener=document.activeElement as HTMLElement|null,el=dialog.current;el?.showModal();return ()=>{el?.close();opener?.focus();};},[embedded]);
    const focusSurface=trace.surfaces.find(s=>s.id===selected)??trace.surfaces.at(-1);
    const metadata={renderer:'report-figure/2.3.0',solver:SURFACE_SOLVER_ID,fingerprint:projectFingerprint(opticalProject),wavelengthM:doc.wavelength,units:'SI',prescription:doc,mode,camera,selectedSurface:focusSurface?.id,sourceMode:modes(opticalProject).source,targetMode:modes(opticalProject).target,bodies:opticalProject.bodies,sourceBody:opticalProject.sourceBody,targetBody:opticalProject.targetBody,bodyIssues:geometry.issues,modelClass:opticalProject.model.kind,beamScope:opticalProject.model.kind==='ideal'?'validated ideal Gaussian envelope':'sampled geometric bundle; no intensity or Gaussian propagation'};
    const W=1600,H=1000,sceneWidth=mode==='B'?1480:1090,sceneHeight=610,sceneX=60,sceneY=180;
    const cy=Math.cos(camera.yaw),sy=Math.sin(camera.yaw),cp=Math.cos(camera.pitch),sp=Math.sin(camera.pitch);
    const eye=V(sy*cp,cy*cp,sp),light=unit(V(-.4,-.65,1));
    function raw(p:Vec){const q=sub(p,bounds.center),u=cy*q.x-sy*q.y,b=sy*q.x+cy*q.y;return {x:u,y:cp*q.z-sp*b,depth:dot(q,eye)};}
    const points=[...geometry.faces.flatMap(f=>f.points),...bounds.points], rawPoints=points.map(raw);
    const extremes=rawPoints.reduce((a,p)=>({loX:Math.min(a.loX,p.x),hiX:Math.max(a.hiX,p.x),loY:Math.min(a.loY,p.y),hiY:Math.max(a.hiY,p.y)}),{loX:Infinity,hiX:-Infinity,loY:Infinity,hiY:-Infinity});
    const {loX,hiX,loY,hiY}=extremes;
    const scale=Math.min((sceneWidth-160)/Math.max(hiX-loX,1e-5),(sceneHeight-140)/Math.max(hiY-loY,1e-5))*camera.zoom;
    function project(p:Vec):Projected{const q=raw(p);return {x:sceneX+sceneWidth/2+(q.x-(hiX+loX)/2)*scale,y:sceneY+sceneHeight/2-(q.y-(hiY+loY)/2)*scale,depth:q.depth};}
    const coords=(ps:Vec[])=>ps.map(p=>{const q=project(p);return `${q.x.toFixed(3)},${q.y.toFixed(3)}`;}).join(' ');
    const primitives:Primitive[]=[];
    const depth=(ps:Vec[])=>ps.reduce((s,p)=>s+raw(p).depth,0)/ps.length;
    const focusTargets=new Set<string>();
    geometry.faces.forEach((f,i)=>{
        const focusable=!focusTargets.has(f.surfaceId);focusTargets.add(f.surfaceId);
        const normal=cross(sub(f.points[1],f.points[0]),sub(f.points[2],f.points[0]));
        if(norm(normal)<1e-24)return;
        const n=unit(normal),lambert=Math.abs(dot(n,light)),fresnel=(1-Math.abs(dot(n,eye)))**3;
        const selectedFace=mode==='C'&&f.surfaceId===focusSurface?.id;
        const fill=f.material==='metal'?((f.illustrative||f.bodyId&&Math.abs(dot(n,trace.surfaces.find(s=>s.id===f.surfaceId)?.world.axes[0]??n))<.99)?`rgb(${Math.round(60+lambert*90)},${Math.round(83+lambert*88)},${Math.round(100+lambert*83)})`:'url(#report-metal)'):f.material==='probe'?'#a3a4e0':`rgb(${Math.round(125+lambert*75)},${Math.round(190+lambert*47)},${Math.round(205+lambert*42)})`;
        const alpha=f.material==='glass'?.19+fresnel*.2:f.material==='probe'?.05:.88;
        primitives.push({depth:depth(f.points),node:<polygon key={`f${i}`} data-report-face={f.surfaceId} data-surface={f.surfaceId} role={focusable?'button':undefined} tabIndex={focusable?0:undefined} aria-label={focusable?`Select report Surface ${f.surfaceId}`:undefined} onClick={()=>setSelected(f.surfaceId)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected(f.surfaceId);}}} data-defined-body={f.bodyId} data-illustrative={f.illustrative||undefined} points={coords(f.points)} fill={selectedFace?'#ada0dc':fill} fillOpacity={selectedFace?.24:alpha} stroke="none"/>});
    });
    geometry.edges.forEach((e,i)=>primitives.push({depth:depth(e.points)+bounds.span*1e-7,node:<polyline key={`e${i}`} points={coords(e.points)} fill="none" stroke={mode==='C'&&e.surfaceId===focusSurface?.id?'#7756b0':e.illustrative?'#7398ad':'#527d90'} strokeOpacity={e.illustrative?.6:.75} strokeWidth={mode==='C'&&e.surfaceId===focusSurface?.id?2:1.1}/> }));
    trace.surfaces.filter(s=>s.interaction==='refract').forEach(s=>cellCenters(s).forEach(c=>{
        const rim=surfaceRing(s,c.u,c.v,48).slice(4,21);
        primitives.push({depth:depth(rim)+bounds.span*1e-6,node:<polyline key={`glint-${s.id}-${c.id}`} points={coords(rim)} fill="none" stroke="#ffffff" strokeOpacity=".85" strokeWidth="2"/>});
    }));
    if(trace.status==='valid') {
        // The convex silhouette contains only sampled rays that share the same sequence prefix.
        // Blocked samples are excluded from envelopes; their actual segments remain red.
        const channels=[...new Set(trace.paths.map(p=>p.channel))];
        if(beams) for(const channel of channels) for(let stage=0;stage<trace.surfaces.length;stage++) {
            const ps=trace.paths.filter(p=>p.channel===channel&&p.hits.length>stage);
            if(ps.length<3)continue;
            const ends=ps.flatMap(p=>[p.points[stage],p.points[stage+1]]),projected=ends.map(project),hull=hullIndices(projected);
            const polygon=hull.map(i=>ends[i]);
            if(polygon.length<3)continue;
            primitives.push({depth:depth(ends),node:<polygon key={`b${channel}-${stage}`} data-testid="report-bundle" points={coords(polygon)} fill="url(#report-beam)" fillOpacity=".38" stroke="#dfac31" strokeOpacity=".25" strokeWidth=".65"/>});
        }
        // Limit visible sample lines, never the calculated result or exported count.
        const stride=Math.max(1,Math.ceil(trace.paths.length/220));
        trace.paths.forEach((p,i)=>{if(i%stride!==0)return;p.points.slice(1).forEach((end,j)=>primitives.push({depth:depth([p.points[j],end])+bounds.span*1e-6,node:<polyline key={`r${i}-${j}`} data-testid="report-ray" points={coords([p.points[j],end])} fill="none" stroke={p.status==='reached'?'#b77b14':'#c74037'} strokeOpacity={i%5===0?.8:.33} strokeWidth={i%5===0?1.7:.85}/> }));});
    }
    if(opticalProject.model.kind==='ideal'&&gaussian.status==='valid'&&beams&&!shared.invalid.length){
        const samples=gaussian.samples;
        const upper:Vec[]=[],lower:Vec[]=[];
        for(let i=0;i<samples.length;i++){
            const s=samples[i],center=V(s.x,s.axis.y.height,s.axis.z.height),c=project(center);
            const next=samples[Math.min(samples.length-1,i+1)],previous=samples[Math.max(0,i-1)];
            const start=project(V(previous.x,previous.axis.y.height,previous.axis.z.height)),end=project(V(next.x,next.axis.y.height,next.axis.z.height));
            const dx=end.x-start.x,dy=end.y-start.y,length=Math.hypot(dx,dy)||1,nx=-dy/length,ny=dx/length;
            const y=project(add(center,V(0,s.y.radius,0))),z=project(add(center,V(0,0,s.z.radius)));
            const uy=(y.x-c.x)*nx+(y.y-c.y)*ny,uz=(z.x-c.x)*nx+(z.y-c.y)*ny,amplitude=Math.hypot(uy,uz)||1;
            const offset=V(0,s.y.radius*uy/amplitude,s.z.radius*uz/amplitude);
            upper.push(add(center,offset));lower.push(sub(center,offset));
        }
        const pts=[...upper,...lower.reverse()];
        primitives.push({depth:depth(pts),node:<polygon key="gaussian-envelope" data-testid="report-gaussian-envelope" points={coords(pts)} fill="url(#report-beam)" fillOpacity=".55" stroke="#d7a338" strokeOpacity=".5" strokeWidth=".8"/>});
    }
    primitives.sort((a,b)=>a.depth-b.depth);
    const bodies=doc.assemblies.flatMap(a=>{const ss=trace.surfaces.filter(s=>s.assemblyId===a.id);if(!ss.length)return [];return [{id:a.id,name:a.name,surface:ss[0],center:mul(ss.reduce((p,s)=>add(p,s.world.origin),V()),1/ss.length)}];});
    const anchors=[{id:'source',name:opticalProject.authoring?.ports.source.preset?'Input Fiber':'Input Port',surface:undefined,center:doc.source.frame.origin},...bodies].sort((a,b)=>project(a.center).x-project(b.center).x);
    const groundZ=points.reduce((z,p)=>Math.min(z,p.z),Infinity)-bounds.span*.035;
    const sourceCenter=project(doc.source.frame.origin);
    const selectedHits=trace.status==='valid'?trace.paths.flatMap(p=>p.hits.filter(h=>h.surfaceId===focusSurface?.id)):[];
    const localSpan=focusSurface?Math.max(...cellCenters(focusSurface).flatMap(c=>[Math.abs(c.u)+focusSurface.aperture,Math.abs(c.v)+focusSurface.aperture]),...selectedHits.flatMap(h=>[Math.abs(h.local.y),Math.abs(h.local.z)]),1e-9)*1.12:1;
    async function png(){if(!svg.current)return;setBusy(true);setExportError('');try{await downloadReportPNG(svg.current,metadata);}catch(e){setExportError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}}
    const Container=embedded?'section':'dialog';
    return <Container ref={embedded?undefined:dialog} className={`report-dialog ${embedded?'report-inline':''}`} aria-label={embedded?'Report Figure':undefined} aria-labelledby={embedded?undefined:'report-title'} onCancel={e=>{e.preventDefault();onClose?.();}}>
        {!embedded&&<header className="report-toolbar"><div><Camera size={19}/><h2 id="report-title">보고용 그림 <span>Report Figure</span></h2></div><button aria-label="Close Report Figure" onClick={onClose}><X size={19}/></button></header>}
        <nav className="report-controls" aria-label="Report Figure controls"><div className="report-mode"><button aria-pressed={mode==='B'} onClick={()=>setMode('B')}>B · Technical Isometric</button><button aria-pressed={mode==='C'} onClick={()=>setMode('C')}>C · Linked Inspector</button></div><label><input type="checkbox" checked={envelopes} onChange={e=>setEnvelopes(e.target.checked)}/>Show defined bodies</label><label><input type="checkbox" checked={beams} onChange={e=>setBeams(e.target.checked)}/>Beam / Ray bundles</label><label><input type="checkbox" checked={labels} onChange={e=>setLabels(e.target.checked)}/>Labels</label><label className="report-surface-select">Surface<select aria-label="Report selected Surface" value={focusSurface?.id??''} onChange={e=>setSelected(e.target.value)}>{trace.surfaces.map((s,i)=><option key={s.id} value={s.id}>S{i+1} · {s.name}</option>)}</select></label><div className="report-exports"><button onClick={()=>svg.current&&downloadScene(svg.current,'optical-report.svg',metadata)}><Download size={15}/>SVG</button><button disabled={busy} onClick={()=>void png()}><Download size={15}/>{busy?'Saving…':'PNG 2×'}</button></div></nav>
        <div className="report-paper-wrap"><svg ref={svg} className="report-paper" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Optical Report Figure" data-testid="report-figure" data-fingerprint={projectFingerprint(opticalProject)} onPointerDown={e=>{if((e.target as Element).closest('[data-surface]'))return;e.currentTarget.setPointerCapture(e.pointerId);drag.current={x:e.clientX,y:e.clientY,camera};}} onPointerMove={e=>{if(!drag.current)return;const d=drag.current;setCamera({...d.camera,yaw:d.camera.yaw+(e.clientX-d.x)*.007,pitch:Math.max(-1.3,Math.min(1.3,d.camera.pitch+(e.clientY-d.y)*.007))});}} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}>
        <defs><linearGradient id="report-paper-bg" x2="0" y2="1"><stop stopColor="#ffffff"/><stop offset="1" stopColor="#f5f8fb"/></linearGradient><linearGradient id="report-metal" x1="0" y1="0" x2=".8" y2="1"><stop stopColor="#4b6373"/><stop offset=".25" stopColor="#dce5e9"/><stop offset=".46" stopColor="#f9fcfd"/><stop offset=".53" stopColor="#8fa4af"/><stop offset="1" stopColor="#354f61"/></linearGradient><linearGradient id="report-beam" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#ffe5a1" stopOpacity=".7"/><stop offset=".5" stopColor="#ffc84e"/><stop offset="1" stopColor="#f3ad2c" stopOpacity=".4"/></linearGradient><filter id="report-shadow" x="-60%" y="-100%" width="220%" height="300%"><feGaussianBlur stdDeviation="11"/></filter><clipPath id="report-scene-clip"><rect x={sceneX} y={sceneY-30} width={sceneWidth} height={sceneHeight+80}/></clipPath><clipPath id="report-uv-clip"><rect x="1215" y="345" width="300" height="300"/></clipPath></defs>
        <rect width={W} height={H} fill="url(#report-paper-bg)"/>
        <text x="70" y="66" fontFamily="Inter,Arial,sans-serif" fontSize="13" fontWeight="600" letterSpacing="3" fill="#53788b">PHOTONIC CONNECTOR STUDIO / OPTICAL DESIGN</text>
        <text x="70" y="118" fontFamily="Inter,Arial,sans-serif" fontSize="33" fontWeight="650" letterSpacing="-1" fill="#142f43">{doc.name}</text>
        <text x="1530" y="66" textAnchor="end" fontFamily="ui-monospace,monospace" fontSize="13" fill="#687b8b">{mode==='B'?'B / TECHNICAL ISOMETRIC':'C / LINKED INSPECTOR'}</text>
        <text x="1530" y="107" textAnchor="end" fontFamily="ui-monospace,monospace" fontSize="13" fill="#53788b">λ {(doc.wavelength*1e9).toFixed(0)} nm · SI geometry</text>
        <line x1="70" x2="1530" y1="146" y2="146" stroke="#d4e0e7"/>
        <g clipPath="url(#report-scene-clip)">
        {bodies.filter(a=>a.surface.interaction!=='probe').map(a=>{const p=project(V(a.center.x,a.center.y,groundZ));return <ellipse key={a.id} cx={p.x} cy={p.y} rx={Math.max(14,a.surface.aperture*scale*1.05)} ry={Math.max(4,a.surface.aperture*scale*.24)} fill="#4a6d85" opacity=".13" filter="url(#report-shadow)"/>;})}
        {primitives.map(p=>p.node)}
        <circle cx={sourceCenter.x} cy={sourceCenter.y} r="5" fill="#257d71" stroke="#e5fff6" strokeWidth="2"/>
        {labels&&anchors.map((a,i)=>{const p=project(a.center),top=i%2===0,labelY=top?sceneY+12:sceneY+sceneHeight+25,labelX=sceneX+75+(sceneWidth-150)*(anchors.length===1?.5:i/(anchors.length-1));return <g key={a.id} fontFamily="Inter,Arial,sans-serif"><polyline points={`${p.x},${p.y} ${p.x+(labelX-p.x)*.35},${labelY+(top?34:-27)} ${labelX},${labelY+(top?12:-12)}`} fill="none" stroke="#9fb1bd" strokeWidth="1"/><circle cx={p.x} cy={p.y} r="3" fill="#173d55"/><text x={labelX} y={labelY} textAnchor="middle" fontSize="16" fontWeight="600" fill="#203c50">{a.name}</text><text x={labelX} y={labelY+19} textAnchor="middle" fontSize="11" fill="#738997">{a.surface?`${doc.assemblies.find(b=>b.id===a.id)?.kind.toUpperCase()} · ${trace.surfaces.filter(s=>s.assemblyId===a.id).length} surfaces`:(opticalProject.model.kind==='ideal'?'GAUSSIAN SOURCE / MODE':'INPUT MODE / REFERENCE PLANE')}</text></g>;})}
        </g>
        {mode==='C'&&focusSurface&&<g data-testid="report-inspector" fontFamily="Inter,Arial,sans-serif"><rect x="1180" y="185" width="350" height="650" rx="15" fill="#ffffff" stroke="#d7e1e9"/><text x="1205" y="222" fontSize="12" letterSpacing="1.6" fill="#6e7d98">LINKED SURFACE</text><text x="1205" y="252" fontSize="20" fontWeight="650" fill="#263e55">{focusSurface.id.slice(0,25)}</text><text x="1205" y="281" fontSize="12" fill="#7b689b">{opticalProject.model.kind==='ideal'?'Ideal model · geometric footprint undefined':'Geometric footprint · local u / v'}</text><rect x="1215" y="345" width="300" height="300" rx="8" fill="#f4f2fa"/><g clipPath="url(#report-uv-clip)"><path d="M1365 345V645M1215 495H1515" stroke="#d6cfe5"/>{cellCenters(focusSurface).map(c=><circle key={c.id} cx={1365+c.u/localSpan*135} cy={495-c.v/localSpan*135} r={focusSurface.aperture/localSpan*135} fill="none" stroke="#9d8db7" strokeWidth="1.4" strokeDasharray="5 4"/>)}{selectedHits.map((h,i)=><circle key={i} cx={1365+h.local.y/localSpan*135} cy={495-h.local.z/localSpan*135} r="3.2" fill="#c1821b" fillOpacity=".8"/>)}</g><text x="1205" y="681" fontSize="13" fill="#586d80">±{(localSpan*1e3).toPrecision(3)} mm · {selectedHits.length} accepted hits</text><line x1="1205" x2="1505" y1="703" y2="703" stroke="#e1e6ed"/><text x="1205" y="733" fontSize="12" fill="#687e91">NORMAL / WORLD XYZ</text><text x="1205" y="759" fontFamily="ui-monospace,monospace" fontSize="14" fill="#283f55">{focusSurface.world.axes[0].x.toFixed(3)} / {focusSurface.world.axes[0].y.toFixed(3)} / {focusSurface.world.axes[0].z.toFixed(3)}</text><text x="1205" y="804" fontSize="11" fill="#7e718f">Sample locations · no field intensity</text></g>}
        <g transform="translate(92 840)">{(['x','y','z'] as const).map((k,i)=>{const d=raw(add(bounds.center,mul(V(k==='x'?1:0,k==='y'?1:0,k==='z'?1:0),.0001)));const x=d.x*450000,y=-d.y*450000;return <g key={k}><line x2={x} y2={y} stroke={['#b16b55','#3b8c7e','#657fbe'][i]} strokeWidth="2.5"/><text x={x+6} y={y+4} fontSize="12" fontFamily="Inter,Arial,sans-serif" fill="#5a7386">{k.toUpperCase()}</text></g>;})}</g>
        <text x="170" y="846" fontFamily="Inter,Arial,sans-serif" fontSize="12" fill="#84929e">ORTHOGRAPHIC 3D · TRUE POSES · NO ANGLE EXAGGERATION</text>
        <line x1="70" x2="1530" y1="881" y2="881" stroke="#d4e0e7"/>
        <text x="70" y="915" fontFamily="Inter,Arial,sans-serif" fontSize="14" fill="#355267">{opticalProject.model.kind==='ideal'?(gaussian.status==='valid'&&!shared.invalid.length?`Ideal Gaussian · η ${(gaussian.eta*100).toPrecision(6)}% · 1/e² envelope`:'Gaussian · Not calculated') : trace.status==='valid'?`${trace.reached} / ${trace.paths.length} sampled rays reached · Target RMS ${trace.rms===null?'—':(trace.rms*1e6).toPrecision(5)} µm`:'Invalid input · ray results suppressed'}</text>
        <text x="1530" y="915" textAnchor="end" fontFamily="ui-monospace,monospace" fontSize="12" fill="#748696">INPUT {projectFingerprint(opticalProject)} · report-figure / 2.3.0</text>
        <text x="70" y="946" fontFamily="Inter,Arial,sans-serif" fontSize="11" fill="#7e8d9a">{geometry.issues.length?'Body mismatch: '+geometry.issues[0]:opticalProject.model.kind==='ideal'?'Ideal Thin Lens: zero thickness; physical curvature / lens body undefined; reference-plane disk sizes are markers.':'Defined body dimensions and optical Surfaces share the same project. Undefined bodies are omitted.'}</text>
        <text x="70" y="967" fontFamily="Inter,Arial,sans-serif" fontSize="11" fill="#7e8d9a">{opticalProject.model.kind==='ideal'?(gaussian.status==='valid'?'Envelope is the validated ideal Gaussian 1/e² radius. No physical lens solid is inferred.':gaussian.reason):'Golden envelopes show sampled geometric ray bundles. No field intensity or Gaussian mode coupling is implied.'}</text>
        </svg></div>
        <footer className="report-footer"><div><button onClick={()=>setCamera(ISOMETRIC)}><RotateCcw size={15}/>Isometric</button><button onClick={()=>setCamera({yaw:-.18,pitch:1.24,zoom:1})}>Top oblique</button><button aria-label="Report zoom out" onClick={()=>setCamera(c=>({...c,zoom:Math.max(.35,c.zoom/1.2)}))}>−</button><output>{Math.round(camera.zoom*100)}%</output><button aria-label="Report zoom in" onClick={()=>setCamera(c=>({...c,zoom:Math.min(4,c.zoom*1.2)}))}>+</button></div><p>{exportError||'Drag to orbit · Defined bodies / exact Surface poses · same Project'}</p></footer>
    </Container>;
}

async function downloadReportPNG(svg:SVGSVGElement,metadata:Record<string,unknown>) {
    const clone=svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns','http://www.w3.org/2000/svg');clone.setAttribute('width','3200');clone.setAttribute('height','2000');
    const meta=document.createElementNS('http://www.w3.org/2000/svg','metadata');meta.textContent=JSON.stringify(metadata);clone.prepend(meta);
    const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)],{type:'image/svg+xml'}));
    try {
        const image=new Image();image.src=url;await image.decode();
        const canvas=document.createElement('canvas');canvas.width=3200;canvas.height=2000;
        const ctx=canvas.getContext('2d');if(!ctx)throw Error('PNG export unavailable');ctx.drawImage(image,0,0);
        const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('PNG encoding failed')),'image/png'));
        const png=URL.createObjectURL(blob),a=document.createElement('a');a.href=png;a.download='optical-report.png';a.click();setTimeout(()=>URL.revokeObjectURL(png),1000);
    } finally {URL.revokeObjectURL(url);}
}
