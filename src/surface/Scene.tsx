import type { BodyGeometry } from '../project/geometry';
import type { Project } from '../project/model';
import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { V, add, mul, sub, norm, pointToWorld, cellCenters, sag, frame } from './model';
import type { Vec, Prescription, Compiled } from './model';
import { surfaceRing } from './trace';
import type { Trace } from './trace';
export type SceneView = 'XY' | 'XZ' | 'YZ' | '3D';
export type Camera = {
    yaw: number;
    pitch: number;
    zoom: number;
};
export const INITIAL_CAMERA: Camera = { yaw: -.6, pitch: .45, zoom: 1 };
export function sceneBounds(d: Prescription, t: Trace,extraPoints:Vec[]=[]) { const pts = [...extraPoints,d.source.frame.origin, ...t.surfaces.flatMap(s => cellCenters(s).flatMap(c => surfaceRing(s, c.u, c.v, 12))), ...t.paths.flatMap(p => p.points)]; const lo = V(...(['x', 'y', 'z'] as const).map(k => Math.min(...pts.map(p => p[k]))) as [
    number,
    number,
    number
]), hi = V(...(['x', 'y', 'z'] as const).map(k => Math.max(...pts.map(p => p[k]))) as [
    number,
    number,
    number
]); return { center: mul(add(lo, hi), .5), span: Math.max(norm(sub(hi, lo)), .002), points: pts }; }
export type Bounds = ReturnType<typeof sceneBounds>;
export function SurfaceScene({ geometry,opticalProject,doc, trace, view, camera, setCamera, bounds, selected, onSelect, presentation, svgRef }: {
    geometry?:BodyGeometry;
    opticalProject?:Project;
    doc: Prescription;
    trace: Trace;
    view: SceneView;
    camera: Camera;
    setCamera: (c: Camera) => void;
    bounds: Bounds;
    selected: string;
    onSelect: (id: string) => void;
    presentation: boolean;
    svgRef: RefObject<SVGSVGElement | null>;
}) {
    const [size, setSize] = useState({ width: 1000, height: 600 });
    useEffect(() => { const el = svgRef.current; if (!el)
        return; const observer = new ResizeObserver(([entry]) => { if (entry.contentRect.width > 0 && entry.contentRect.height > 0)
        setSize({ width: entry.contentRect.width, height: entry.contentRect.height }); }); observer.observe(el); return () => observer.disconnect(); }, [svgRef]);
    const drag = useRef<{
        x: number;
        y: number;
        camera: Camera;
    } | null>(null);
    const [dragging, setDragging] = useState(false);
    function rawProject(p: Vec) { const q = sub(p, bounds.center); if (view === '3D') {
        const c = Math.cos, s = Math.sin, u = c(camera.yaw) * q.x - s(camera.yaw) * q.y, back = s(camera.yaw) * q.x + c(camera.yaw) * q.y;
        return { u, v: c(camera.pitch) * q.z - s(camera.pitch) * back, depth: s(camera.pitch) * q.z + c(camera.pitch) * back };
    } const [u, v, depth] = view === 'XY' ? [q.x, q.y, q.z] : view === 'XZ' ? [q.x, q.z, q.y] : [q.y, q.z, q.x]; return { u, v, depth }; }
    const frozen = bounds.points.map(rawProject), spanU = Math.max(...frozen.map(p => p.u)) - Math.min(...frozen.map(p => p.u)), spanV = Math.max(...frozen.map(p => p.v)) - Math.min(...frozen.map(p => p.v));
    const displayScale = Math.min(Math.max(100, size.width - 100) / Math.max(spanU, .0001), Math.max(20, size.height - 58) / Math.max(spanV, .0001)) * camera.zoom;
    function project(p: Vec) { const q = rawProject(p); return { x: size.width / 2 + q.u * displayScale, y: size.height / 2 - q.v * displayScale, depth: q.depth }; }
    const line = (pts: Vec[]) => pts.map(p => { const a = project(p); return `${a.x},${a.y}`; }).join(' ');
    const color = (s: Compiled) => s.interaction === 'reflect' || s.interaction === 'tir' ? '#ae6820' : s.interaction === 'probe' ? '#8b63bd' : '#167d91';
    const all = trace.surfaces.flatMap(s => cellCenters(s).map(c => ({ s, c, ring: surfaceRing(s, c.u, c.v) }))).sort((a, b) => project(a.s.world.origin).depth - project(b.s.world.origin).depth);
    const inputName=opticalProject?.authoring?.ports.source.preset?'Input Fiber':'Input Port',outputName=opticalProject?.authoring?.ports.target.preset?'Output Fiber':'Output Port';
    const selectedSurface = trace.surfaces.find(s => s.id === selected);
    return <svg ref={svgRef} className={`surface-scene ${dragging ? 'dragging' : ''}`} viewBox={`0 0 ${size.width} ${size.height}`} role="img" aria-label="Surface optical layout" data-testid="surface-canvas" onPointerDown={e => { if (view !== '3D' || (e.target as Element).closest('[data-surface]'))
        return; e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, camera }; setDragging(true); }} onPointerMove={e => { if (!drag.current)
        return; const old = drag.current; setCamera({ ...old.camera, yaw: old.camera.yaw + (e.clientX - old.x) * .008, pitch: Math.max(-1.4, Math.min(1.4, old.camera.pitch + (e.clientY - old.y) * .008)) }); }} onPointerUp={() => { drag.current = null; setDragging(false); }} onPointerCancel={() => { drag.current = null; setDragging(false); }}>
 <defs><pattern id="surface-grid" width="30" height="30" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".7" fill="var(--grid)"/></pattern></defs><rect width={size.width} height={size.height} fill="var(--canvas)"/><rect width={size.width} height={size.height} fill="url(#surface-grid)"/>
 <text x="14" y="22" className="scene-caption">{view === '3D' ? 'GLOBAL 3D · drag to rotate' : `${view} ORTHOGRAPHIC · equal coordinate scale`}</text>
 {geometry&&[...new Set(geometry.faces.map(f=>f.bodyId))].map(id=>{const fs=geometry.faces.filter(f=>f.bodyId===id).sort((a,b)=>project(a.points[0]).depth-project(b.points[0]).depth),fiber=id==='@source'||id==='@target',sid=fs[0]?.surfaceId;return <g key={id} data-testid={`layout-body-${id}`} data-defined-body={id} data-surface={sid} role="button" tabIndex={0} aria-label={`Select ${id==='@source'?inputName:id==='@target'?outputName:doc.assemblies.find(a=>a.id===id)?.name}`} onClick={()=>sid&&onSelect(sid!)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();if(sid)onSelect(sid);}}}>{fs.map((f,i)=><polygon key={i} points={line(f.points)} fill={presentation?(fiber?'#7899ad':'#73bfd0'):'none'} fillOpacity={fiber?.55:.15} stroke={fiber?'#456e84':'#468d9f'} strokeOpacity={fiber?.55:.28} strokeWidth={fiber?.8:.5}/>)}</g>;})}
 {all.map(({ s, c, ring }) => <g key={s.id + c.id} data-surface={s.id} data-testid={`surface-node-${s.id}-${c.id}`} role="button" tabIndex={0} aria-label={`Select Surface ${s.id} cell ${c.id}`} onClick={() => onSelect(s.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(s.id);
        } }}>
 <polygon points={line(ring)} fill={presentation ? color(s) : 'transparent'} fillOpacity={s.interaction === 'probe' ? .06 : .12} stroke={s.id === selected ? '#d05d12' : color(s)} strokeWidth={s.id === selected ? 3 : 1.5}/>
 {([0, 1] as const).map(axis => <polyline key={axis} points={line(Array.from({ length: 41 }, (_, i) => { const v = (i / 20 - 1) * s.aperture; return pointToWorld(s.world, V(sag(s, axis === 0 ? v : 0, axis === 1 ? v : 0), c.u + (axis === 0 ? v : 0), c.v + (axis === 1 ? v : 0))); }))} fill="none" stroke={s.id === selected ? '#d05d12' : color(s)} strokeWidth="1.4"/>)}
 </g>)}
 {trace.status === 'valid' && <g data-testid="surface-rays" pointerEvents="none">{trace.paths.map((p, i) => <polyline key={i} data-testid={`surface-ray-${i}`} points={line(p.points)} fill="none" stroke={p.status === 'reached' ? '#c18b24' : '#cc5646'} strokeOpacity={i % 5 === 0 ? .9 : .28} strokeWidth={i % 5 === 0 ? 1.6 : 1}/>)}</g>}
 {trace.surfaces.map((s, i) => { const p = project(s.world.origin); return <g key={s.id} pointerEvents="none"><circle cx={p.x} cy={p.y} r={s.id === selected ? 4 : 2} fill={color(s)}/><text x={p.x} y={p.y + (i % 2 ? 42 : -32)} textAnchor="middle" className="surface-label">{i===trace.surfaces.length-1?outputName:`S${i+1}`}{s.id === selected&&i!==trace.surfaces.length-1 ? ` · ${s.name}` : ''}</text></g>; })}
 {selectedSurface && <g data-testid="surface-normal"><polyline points={line([selectedSurface.world.origin, add(selectedSurface.world.origin, mul(selectedSurface.world.axes[0], bounds.span * .09))])} stroke="#d05d12" strokeWidth="3"/><text x={project(add(selectedSurface.world.origin, mul(selectedSurface.world.axes[0], bounds.span * .1))).x} y={project(add(selectedSurface.world.origin, mul(selectedSurface.world.axes[0], bounds.span * .1))).y - 8} className="surface-label">+n</text></g>}
 {(() => { const p = project(doc.source.frame.origin); return <g data-testid="input-port-anchor" data-surface="@source" role="button" tabIndex={0} aria-label="Select Input Port" onClick={()=>onSelect('@source')} onKeyDown={e=>{if(e.key==='Enter')onSelect('@source');}}><circle cx={p.x} cy={p.y} r="3" fill="#187b68"/><polyline points={line([doc.source.frame.origin, add(doc.source.frame.origin, mul(frame(doc.source.frame).axes[0], bounds.span * .1))])} stroke="#187b68" strokeWidth="3"/><text x={p.x} y={p.y + 26} textAnchor="middle" className="surface-label">{inputName}</text></g>; })()}
 {opticalProject?.targetBody&&(()=>{const a=doc.source.frame.origin,b=trace.surfaces.at(-1)!.world.origin,offset=V(0,.0018,-.0008),mid=project(add(mul(add(a,b),.5),offset));return <g data-testid="fiber-facet-gap" pointerEvents="none"><polyline points={line([add(a,offset),add(b,offset)])} stroke="#7993a3" strokeDasharray="4 3"/><text x={mid.x} y={mid.y+18} textAnchor="middle" className="scene-caption">Fiber Facets · {(norm(sub(b,a))*1e3).toFixed(2)} mm</text></g>;})()}
 {doc.assemblies.filter(a=>a.kind==='lens').map(a=>{const ss=trace.surfaces.filter(s=>s.assemblyId===a.id);if(ss.length!==2)return null;const p=project(add(mul(add(ss[0].world.origin,ss[1].world.origin),.5),V(0,0,Math.max(...ss.map(s=>s.aperture))*1.5)));return <text key={a.id} data-testid="lens-assembly-label" x={p.x} y={p.y-8} textAnchor="middle" className="surface-label">{ss[0].materialAfter==='N-BK7'?'BK7 Lens':'Lens'} · S{trace.surfaces.indexOf(ss[0])+1}–S{trace.surfaces.indexOf(ss[1])+1}</text>;})}
 <g transform={`translate(25 ${size.height - 35})`}>{(['x', 'y', 'z'] as const).map((key, i) => { const a = project(add(bounds.center, mul(V(key === 'x' ? 1 : 0, key === 'y' ? 1 : 0, key === 'z' ? 1 : 0), bounds.span * .055))), o = project(bounds.center); return <g key={key}><line x1="0" y1="0" x2={a.x - o.x} y2={a.y - o.y} stroke={['#af5838', '#278975', '#6575b0'][i]} strokeWidth="2"/><text x={a.x - o.x + 4} y={a.y - o.y + 4} className="scene-caption">{key.toUpperCase()}</text></g>; })}</g>
 {doc.name!=='Fiber → BK7 Lens → Fiber'&&<text x={size.width - 15} y={size.height - 12} textAnchor="end" className="scene-caption">Computed geometric rays · no optical-mode coupling / field intensity</text>}
 </svg>;
}
export function Footprint({ trace, selected }: {
    trace: Trace;
    selected: string;
}) {
    const surface = trace.surfaces.find(s => s.id === selected) ?? trace.surfaces.at(-1);
    if (!surface)
        return null;
    const hits = trace.paths.flatMap(p => p.hits.filter(h => h.surfaceId === surface.id)), span = Math.max(...hits.flatMap(h => [Math.abs(h.local.y), Math.abs(h.local.z)]), ...cellCenters(surface).flatMap(c => [Math.abs(c.u) + surface.aperture, Math.abs(c.v) + surface.aperture]), .000001) * 1.15;
    return <figure className="surface-footprint"><figcaption>{surface.id} · Geometric Footprint</figcaption><svg viewBox="0 0 300 280" role="img" aria-label="Selected Surface geometric footprint"><path d="M150 12 V248 M20 130 H280" stroke="var(--line)"/>{cellCenters(surface).map(c => <circle key={c.id} cx={150 + c.u / span * 110} cy={130 - c.v / span * 110} r={surface.aperture / span * 110} fill="none" stroke="#8b63bd" strokeDasharray="4 4"/>)}{hits.map((h, i) => <circle key={i} cx={150 + h.local.y / span * 110} cy={130 - h.local.z / span * 110} r="2.4" fill="#c18b24"/>)}<text x="20" y="266" fill="var(--muted)" fontSize="12">u / v · ±{(span * 1000).toPrecision(3)} mm · {hits.length} hits</text></svg><small>동일 가중치 Ray 점군입니다. Intensity / Mode Profile은 아닙니다.</small></figure>;
}
export function downloadScene(svg: SVGSVGElement, name: string, metadata: Record<string, unknown> = {}) { const copy = svg.cloneNode(true) as SVGSVGElement; const originals = [svg, ...svg.querySelectorAll('*')], clones = [copy, ...copy.querySelectorAll('*')]; originals.forEach((el, i) => { const st = getComputedStyle(el); for (const key of ['fill', 'stroke', 'font-family', 'font-size', 'font-weight']) {
    const resolved = st.getPropertyValue(key).replace(/url\(["']?[^)"']*#([^)"']+)["']?\)/g, 'url(#$1)');
    (clones[i] as SVGElement).style.setProperty(key, resolved);
    if (clones[i].hasAttribute(key))
        clones[i].setAttribute(key, resolved);
} }); const meta = document.createElementNS('http://www.w3.org/2000/svg', 'metadata'); meta.textContent = JSON.stringify(metadata); copy.prepend(meta); copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copy)], { type: 'image/svg+xml' })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
