import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { ArrowLeft, ArrowUp, ArrowDown, Download, Plus, RotateCcw, Trash2, Undo2, Redo2, Save, Upload } from 'lucide-react';
import Appearance from '../Appearance';
import type { Theme } from '../Appearance';
import { FieldValidity, NumberField } from '../Fields';
import { add, mul, pose, PrescriptionSchema, parsePrescription, serializePrescription } from './model';
import type { Prescription, Surface, Pose, Assembly } from './model';
import { surfaceExample, SURFACE_EXAMPLES } from './examples';
import type { SurfaceExample } from './examples';
import { tracePrescription } from './trace';
import { SurfaceScene, Footprint, INITIAL_CAMERA, sceneBounds, downloadScene } from './Scene';
import type { SceneView } from './Scene';
const mm = (v: number) => v / 1e-3, rad = (v: number) => v * Math.PI / 180, deg = (v: number) => v * 180 / Math.PI;
const fmt = (v: number) => Math.abs(v)<1e-10 ? "0" : Number(v.toPrecision(6)).toString();
type History = {
    past: Prescription[];
    present: Prescription;
    future: Prescription[];
};
export default function SurfaceWorkbench({ onReturn, theme, setTheme }: {
    onReturn: () => void;
    theme: Theme;
    setTheme: Dispatch<SetStateAction<Theme>>;
}) {
    const [history, setHistory] = useState<History>(() => ({ past: [], present: surfaceExample('compound'), future: [] }));
    const doc = history.present;
    const calculated = useMemo(() => tracePrescription(doc), [doc]);
    const [invalid, setInvalid] = useState<string[]>([]);
    const validity = useCallback((label: string, bad: boolean) => setInvalid(old => bad ? (old.includes(label) ? old : [...old, label]) : old.filter(x => x !== label)), []);
    const trace = invalid.length ? { ...calculated, status: 'invalid' as const, reason: '미반영 입력이 있습니다. 수정하거나 Enter / Blur로 마지막 유효 값을 복구하세요.', paths: [], reached: 0, centroid: null, centroidLocal:null, rms: null } : calculated;
    const [selection, setSelection] = useState(doc.surfaces[0].id), [editMode, setEditMode] = useState<'surface' | 'assembly' | 'source'>('surface');
    const [bodySelection, setBodySelection] = useState<string | null>(null);
    const surface = doc.surfaces.find(s => s.id === selection) ?? doc.surfaces[0], assembly = doc.assemblies.find(a => a.id === (bodySelection ?? surface.assemblyId)) ?? doc.assemblies[0];
    const [mobileTab, setMobileTab] = useState<'layout' | 'surfaces' | 'inspect' | 'analysis'>('layout'), [analysis, setAnalysis] = useState(false);
    const [view, setView] = useState<SceneView>('XY'), [presentation, setPresentation] = useState(false), [camera, setCamera] = useState(INITIAL_CAMERA);
    const [bounds, setBounds] = useState(() => sceneBounds(doc, calculated));
    const svg = useRef<SVGSVGElement>(null), file = useRef<HTMLInputElement>(null);
    const [notice, setNotice] = useState('Surface를 선택하면 Local Frame과 Normal을 확인할 수 있습니다. 예제는 모두 학습용 가정입니다.'), [error, setError] = useState('');
    const [saved, setSaved] = useState(() => serializePrescription(surfaceExample('compound')));
    const dirty = serializePrescription(doc) !== saved;
    useEffect(() => { const guard = (e: BeforeUnloadEvent) => { if (dirty)
        e.preventDefault(); }; window.addEventListener('beforeunload', guard); return () => window.removeEventListener('beforeunload', guard); }, [dirty]);
    function change(next: Prescription) { try {
        PrescriptionSchema.parse(next);
        if (JSON.stringify(next) !== JSON.stringify(doc))
            setHistory(h => ({ past: [...h.past.slice(-49), h.present], present: next, future: [] }));
        setError('');
        return true;
    }
    catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return false;
    } }
    function patchSurface(patch: Partial<Surface>) { return change({ ...doc, surfaces: doc.surfaces.map(s => s.id === surface.id ? { ...s, ...patch } : s) }); }
    function patchAssembly(patch: Partial<Assembly>) { return change({ ...doc, assemblies: doc.assemblies.map(a => a.id === assembly.id ? { ...a, ...patch } : a) }); }
    const undo = () => { setHistory(h => h.past.length ? { past: h.past.slice(0, -1), present: h.past.at(-1)!, future: [h.present, ...h.future] } : h); setError(''); };
    const redo = () => { setHistory(h => h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) } : h); setError(''); };
    const fit = () => { setBounds(sceneBounds(doc, calculated)); setCamera(INITIAL_CAMERA); };
    function select(id: string, open = true) { setSelection(id); setBodySelection(null); setEditMode('surface'); setAnalysis(false); if (open)
        setMobileTab('inspect'); }
    function loadExample(which: SurfaceExample) { const next = surfaceExample(which); change(next); setSelection(next.surfaces[0].id); setBodySelection(null); setEditMode('surface'); setMobileTab('layout'); setBounds(sceneBounds(next, tracePrescription(next))); setCamera(INITIAL_CAMERA); setNotice(`${SURFACE_EXAMPLES[which]}을 불러왔습니다. Undo로 이전 Prescription을 복원할 수 있습니다.`); }
    function save() { const text = serializePrescription(doc), url = URL.createObjectURL(new Blob([text], { type: 'application/json' })), a = document.createElement('a'); a.href = url; a.download = 'surface-prescription.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); setSaved(text); setNotice('Surface Prescription JSON을 저장했습니다. 계산 결과는 저장하지 않습니다.'); }
    async function open(f?: File) { if (!f)
        return; try {
        if (f.size > 2000000)
            throw Error('JSON exceeds 2 MB');
        const next = parsePrescription(await f.text());
        if (change(next)) {
            setSaved(serializePrescription(next));
            setSelection(next.surfaces[0].id);
            setBodySelection(null);
            setBounds(sceneBounds(next, tracePrescription(next)));
            setCamera(INITIAL_CAMERA);
            setNotice(`${f.name}을 불러왔습니다.`);
        }
    }
    catch (e) {
        setError(`Import rejected; 기존 Prescription 유지. ${e instanceof Error ? e.message : e}`);
    }
    finally {
        if (file.current)
            file.current.value = '';
    } }
    function addSurface() {
        const index = Math.min(doc.surfaces.findIndex(s => s.id === surface.id), doc.surfaces.length - 2), start = calculated.surfaces[Math.max(0, index)], end = calculated.surfaces[index + 1];
        const center = start && end ? mul(add(start.world.origin, end.world.origin), .5) : assembly.frame.origin;
        const id = `Probe-${crypto.randomUUID().slice(0, 8)}`, next: Surface = { ...surface, id, name: 'New Probe', frame: pose(), shape: 'plane', interaction: 'probe', aperture: surface.aperture + (surface.array ? surface.array.pitch * Math.hypot(surface.array.cols - 1, surface.array.rows - 1) / 2 : 0), array: null, nBefore: surface.nAfter, nAfter: surface.nAfter };
        // Use a new global Assembly so adding a probe does not infer a local frame from pixels.
        const bodyId = `Body-${id}`;
        next.assemblyId = bodyId;
        next.frame = pose();
        const body: Assembly = { id: bodyId, name: 'Probe Assembly', kind: 'group', parentId: null, frame: { ...pose(), origin: center } };
        const surfaces = [...doc.surfaces];
        surfaces.splice(index + 1, 0, next);
        if (change({ ...doc, assemblies: [...doc.assemblies, body], surfaces }))
            select(id);
    }
    function addAssembly() { const id = `Assembly-${crypto.randomUUID().slice(0, 8)}`; const probe: Surface = { ...surface, id: `Surface-${id}`, name: 'New Surface', assemblyId: id, frame: pose(), shape: 'plane', interaction: 'probe', array: null, nBefore: 1, nAfter: 1 }; const surfaces = [...doc.surfaces]; surfaces.splice(surfaces.length - 1, 0, probe); if (change({ ...doc, assemblies: [...doc.assemblies, { id, name: 'New Assembly', kind: 'group', parentId: null, frame: { ...pose(0, 0, 0, Math.atan2(calculated.surfaces.at(-1)!.world.axes[0].y, calculated.surfaces.at(-1)!.world.axes[0].x), -Math.asin(calculated.surfaces.at(-1)!.world.axes[0].z)), origin: mul(add(calculated.surfaces.at(-1)!.world.origin, calculated.surfaces.at(-2)?.world.origin ?? doc.source.frame.origin), .5) } }], surfaces })) {
        select(probe.id);
        setEditMode('assembly');
    } }
    function move(delta: number) { const index = doc.surfaces.findIndex(s => s.id === surface.id), next = index + delta; if (next < 0 || next >= doc.surfaces.length - 1)
        return; const surfaces = [...doc.surfaces]; [surfaces[index], surfaces[next]] = [surfaces[next], surfaces[index]]; change({ ...doc, surfaces }); }
    function finish() { (document.activeElement as HTMLElement)?.blur(); setMobileTab('layout'); setNotice('유효한 변경은 반영됐습니다. 파일 보존은 Save Surface JSON을 사용하세요.'); }
    const selectedWorld = calculated.surfaces.find(s => s.id === surface.id);
    const sourceFields = <><h3>Ray Source</h3><NumberField label="Surface Vacuum Wavelength" value={doc.wavelength * 1e9} unit="nm" min={200} max={20000} onChange={v => change({ ...doc, wavelength: v! * 1e-9 })}/><p className="surface-note">n은 입력 파장에서 지정한 상수입니다. 자동 분산 계산은 하지 않습니다.</p><PoseFields value={doc.source.frame} prefix="Source" onChange={frame => change({ ...doc, source: { ...doc.source, frame } })}/><NumberField label="Bundle Radius" value={mm(doc.source.radius)} unit="mm" min={.000001} max={1000} onChange={v => change({ ...doc, source: { ...doc.source, radius: v! * 1e-3 } })}/><NumberField label="Source Index" value={doc.source.n} unit="n" min={1} max={5} onChange={v => change({ ...doc, source: { ...doc.source, n: v! } })}/><label className="field">Pupil Samples / Diameter<select aria-label="Ray Sampling" value={doc.source.samples} onChange={e => change({ ...doc, source: { ...doc.source, samples: Number(e.target.value) } })}>{[1, 3, 5, 7, 9, 11, 13, 15].map(n => <option key={n}>{n}</option>)}</select></label><ArrayFields value={doc.source.channels} onChange={channels => change({ ...doc, source: { ...doc.source, channels } })} prefix="Source Channels"/><p className="surface-note">평행 Ray의 동일 가중치 샘플입니다. Gaussian Intensity / NA 분포는 포함하지 않습니다.</p></>;
    const currentFields = editMode === 'source' ? sourceFields : editMode === 'assembly' ? <><h3>{assembly.name}</h3><label className="field">Assembly Name<input aria-label="Assembly Name" value={assembly.name} onChange={e => patchAssembly({ name: e.target.value })}/></label><label className="field">Assembly Type<select aria-label="Assembly Type" value={assembly.kind} onChange={e => patchAssembly({ kind: e.target.value as Assembly['kind'] })}>{['group', 'lens', 'mirror', 'prism', 'array', 'target'].map(k => <option key={k}>{k}</option>)}</select></label><p className="surface-note">Parent: {assembly.parentId ?? 'Global'} · Origin이 회전 Pivot입니다. 모든 Child Surface에 적용됩니다.</p><PoseFields value={assembly.frame} prefix="Assembly" onChange={frame => patchAssembly({ frame })}/><p className="surface-note">Local Surface 값과 공통 Assembly 자세를 분리합니다. Parent 관계는 JSON으로 정의할 수 있습니다.</p></> : <><h3>S{doc.surfaces.indexOf(surface) + 1} · {surface.name}</h3><label className="field">Surface Name<input aria-label="Surface Name" value={surface.name} onChange={e => patchSurface({ name: e.target.value })}/></label><label className="field">Assembly<select aria-label="Surface Assembly" value={surface.assemblyId} onChange={e => patchSurface({ assemblyId: e.target.value })}>{doc.assemblies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label><p className="surface-note">Assembly를 바꾸면 Local Frame은 유지되며 World 위치가 달라집니다.</p><div className="fields-two"><label className="field">Shape<select aria-label="Surface Shape" value={surface.shape} onChange={e => patchSurface({ shape: e.target.value as Surface['shape'] })}><option value="plane">Plane</option><option value="sphere">Sphere</option></select></label><label className="field">Interaction<select aria-label="Surface Interaction" value={surface.interaction} disabled={surface === doc.surfaces.at(-1)} onChange={e => { const interaction = e.target.value as Surface['interaction']; patchSurface({ interaction, ...(interaction === 'refract' ? {} : { nAfter: surface.nBefore }) }); }}>{['probe', 'refract', 'reflect', 'tir'].map(k => <option key={k}>{k}</option>)}</select></label></div><NumberField label="Radius" value={mm(surface.radius)} unit="mm" min={-1000} max={1000} disabled={surface.shape === 'plane'} onChange={v => patchSurface({ radius: v! * 1e-3 })}/><NumberField label="Clear Radius" value={mm(surface.aperture)} unit="mm" min={.000001} max={1000} onChange={v => patchSurface({ aperture: v! * 1e-3 })}/><div className="fields-two"><NumberField label="Incident Index" value={surface.nBefore} unit="n" min={1} max={5} onChange={v => patchSurface({ nBefore: v!, ...(surface.interaction === 'refract' ? {} : { nAfter: v! }) })}/><NumberField label="Exit Index" value={surface.nAfter} unit="n" min={1} max={5} disabled={surface.interaction !== 'refract'} onChange={v => patchSurface({ nAfter: v! })}/></div>{surface.interaction === 'tir' && <NumberField label="TIR Outside Index" value={surface.outsideIndex} unit="n" min={1} max={5} onChange={v => patchSurface({ outsideIndex: v! })}/>}<PoseFields value={surface.frame} prefix="Local" onChange={frame => patchSurface({ frame })}/><label className="surface-check"><input type="checkbox" aria-label="Repeat Lenslets" checked={!!surface.array} onChange={e => patchSurface({ array: e.target.checked ? { rows: 3, cols: 3, pitch: Math.max(surface.aperture * 2.1, .0006) } : null })}/> Repeat Lenslets</label>{surface.array && <ArrayFields value={surface.array} prefix="Lenslet" onChange={array => patchSurface({ array })}/>}<div className="surface-actions"><button aria-label="Move Surface Up" disabled={doc.surfaces.indexOf(surface) === 0 || surface === doc.surfaces.at(-1)} onClick={() => move(-1)}><ArrowUp size={15}/>Up</button><button aria-label="Move Surface Down" disabled={doc.surfaces.indexOf(surface) >= doc.surfaces.length - 2} onClick={() => move(1)}><ArrowDown size={15}/>Down</button><button aria-label="Remove Surface" disabled={surface === doc.surfaces.at(-1)} onClick={() => { if (change({ ...doc, surfaces: doc.surfaces.filter(s => s.id !== surface.id) }))
        select(doc.surfaces.at(-1)!.id); }}><Trash2 size={15}/>Remove</button></div>{selectedWorld && <p className="surface-note">World XYZ: {['x', 'y', 'z'].map(k => fmt(mm(selectedWorld.world.origin[k as 'x']))).join(' / ')} mm</p>}</>;
    return <FieldValidity.Provider value={validity}><div className={`app-shell surface-workbench surface-mobile-${mobileTab}`} data-theme={theme}>
 <header className="app-header"><button className="surface-back" onClick={onReturn}><ArrowLeft size={17}/><span>Gaussian Workspace</span></button><div className="surface-brand"><strong>Surface Workbench</strong><span>P2.1 · SEQUENTIAL OPTICS</span></div><div className="header-right"><Appearance theme={theme} onChange={setTheme}/></div></header>
 <nav className="surface-menubar" aria-label="Surface Design controls"><button onClick={() => file.current?.click()}><Upload size={15}/>Open Surface JSON</button><button onClick={save}><Save size={15}/>Save Surface JSON</button><input className="file-input" ref={file} data-testid="surface-json-input" type="file" accept=".json,application/json" onChange={e => void open(e.target.files?.[0])}/><button aria-label="Undo Surface" disabled={!history.past.length} onClick={undo}><Undo2 size={17}/></button><button aria-label="Redo Surface" disabled={!history.future.length} onClick={redo}><Redo2 size={17}/></button><label>Example<select aria-label="Surface Example" value="" onChange={e => { if (e.target.value)
        loadExample(e.target.value as SurfaceExample); }}><option value="">선택</option>{Object.entries(SURFACE_EXAMPLES).map(([id, name]) => <option value={id} key={id}>{name}</option>)}</select></label><span className="surface-save">{dirty ? '● Unsaved' : 'Synthetic inputs'}</span></nav>
 <div className="surface-heading"><div><span className="eyebrow">SURFACE PRESCRIPTION / SI STATE</span><h1>{doc.name}</h1></div><p>Surface → Ray Trace → Layout / 3D · Constant n · Geometric Optics 전용</p></div>
 <div className="surface-body">
 <aside className="surface-tree panel"><div className="panel-toolbar"><strong>Assemblies & Surfaces</strong><span className="count">{doc.surfaces.length}</span></div><div className="surface-tree-scroll">{doc.assemblies.map(a => <section key={a.id}><button className="assembly-title" data-testid={`assembly-${a.id}`} onClick={() => { const s = doc.surfaces.find(s => s.assemblyId === a.id) || surface; setSelection(s.id); setBodySelection(a.id); setEditMode('assembly'); setAnalysis(false); setMobileTab('inspect'); }}>{a.parentId ? '↳ ' : ''}{a.name}<small>{a.kind}{a.parentId ? ` · ${a.parentId}` : ''}</small></button>{doc.surfaces.filter(s => s.assemblyId === a.id).map(s => <button className={`surface-tree-item ${s.id === surface.id ? 'selected' : ''}`} key={s.id} data-testid={`surface-tree-${s.id}`} onClick={() => select(s.id)}><b>S{doc.surfaces.indexOf(s) + 1}</b><span>{s.name}<small>{s.shape} · {s.interaction}{s.array ? ` · ${s.array.cols}×${s.array.rows}` : ''}</small></span></button>)}</section>)}</div><div className="surface-tree-add"><button onClick={addSurface}><Plus size={15}/>Surface</button><button onClick={addAssembly}><Plus size={15}/>Assembly</button></div></aside>
 <main className="surface-main"><section className="surface-kpis" aria-label="Geometric Ray results"><div><span>Sampled rays reached</span><strong data-testid="surface-reached">{trace.status === 'valid' ? `${trace.reached} / ${trace.paths.length}` : 'Not calculated'}</strong></div><div><span>Target RMS radius [µm]</span><strong data-testid="surface-rms">{trace.rms === null ? '—' : fmt(trace.rms * 1e6)}</strong></div><div><span>Target Centroid u / v [µm]</span><strong className="surface-centroid" data-testid="surface-centroid">{trace.centroidLocal?`${fmt(trace.centroidLocal.y*1e6)} / ${fmt(trace.centroidLocal.z*1e6)}`:"—"}</strong></div><p>Source {doc.source.channels.cols} × {doc.source.channels.rows} · Ray 도달 개수는 Optical Efficiency / Coupling η가 아닙니다.</p></section>
 <section className="panel surface-layout"><div className="surface-layout-toolbar"><div className="surface-view-tabs" aria-label="Surface Views">{(['XY', 'XZ', 'YZ', '3D'] as SceneView[]).map(v => <button key={v} aria-pressed={view === v} onClick={() => setView(v)}>{v}</button>)}</div><div className="surface-layout-actions"><label className="surface-check"><input type="checkbox" aria-label="Presentation Shading" checked={presentation} onChange={e => setPresentation(e.target.checked)}/>Shaded</label><button onClick={() => svg.current && downloadScene(svg.current, 'surface-layout.svg', { solver: 'surface-sequential-3d/2.1.0', fingerprint: trace.fingerprint, wavelengthM: doc.wavelength, view, units: 'SI', resultScope: 'geometrical rays only', camera, presentation, selectedSurface: surface.id })}><Download size={15}/>SVG</button></div></div><SurfaceScene doc={doc} trace={trace} view={view} camera={camera} setCamera={setCamera} bounds={bounds} selected={surface.id} onSelect={id => select(id, false)} presentation={presentation} svgRef={svg}/><div className="surface-layout-footer"><button aria-label="Zoom Surface Out" onClick={() => setCamera(c => ({ ...c, zoom: Math.max(.25, c.zoom / 1.25) }))}>−</button><output data-testid="surface-zoom">{Math.round(camera.zoom * 100)}%</output><button aria-label="Zoom Surface In" onClick={() => setCamera(c => ({ ...c, zoom: Math.min(8, c.zoom * 1.25) }))}>+</button><button onClick={fit}><RotateCcw size={14}/>Fit</button><span>Global XYZ · Local +X Normal · 실제 자세 · 각도 과장 없음</span></div></section>
 <section className="panel surface-table-panel"><div className="panel-toolbar"><strong>Surface Data</strong><span className="tiny-label">ORDER · LOCAL RADIUS / CLEAR RADIUS · WORLD XYZ</span></div><div className="surface-table-scroll"><table><thead><tr>{['SURFACE', 'ACTION', 'R [mm]', 'CLEAR R [mm]', 'n IN / OUT', 'WORLD X / Y / Z [mm]'].map(t => <th key={t}>{t}</th>)}</tr></thead><tbody>{doc.surfaces.map((s, i) => { const world = calculated.surfaces[i]?.world.origin; return <tr key={s.id} className={s.id === surface.id ? 'selected' : ''}><td><button onClick={() => select(s.id)}>S{i + 1} · {s.name}</button></td><td>{s.interaction}</td><td>{s.shape === 'plane' ? '∞' : <NumberField label={`S${i + 1} Radius`} value={mm(s.radius)} unit="mm" min={-1000} max={1000} onChange={v => change({ ...doc, surfaces: doc.surfaces.map(x => x.id === s.id ? { ...x, radius: v! * 1e-3 } : x) })}/>}</td><td><NumberField label={`S${i + 1} Clear Radius`} value={mm(s.aperture)} unit="mm" min={.000001} max={1000} onChange={v => change({ ...doc, surfaces: doc.surfaces.map(x => x.id === s.id ? { ...x, aperture: v! * 1e-3 } : x) })}/></td><td>{s.nBefore} / {s.nAfter}</td><td>{world ? `${fmt(mm(world.x))} / ${fmt(mm(world.y))} / ${fmt(mm(world.z))}` : '—'}</td></tr>; })}</tbody></table></div></section>
 </main>
 <aside className="surface-inspector"><nav className="inspector-tabs" aria-label="Surface Inspector tabs"><button aria-pressed={!analysis} onClick={() => setAnalysis(false)}>Inspect</button><button aria-pressed={analysis} onClick={() => setAnalysis(true)}>Ray Analysis</button></nav><section className={`panel surface-editor ${analysis ? 'surface-desktop-hide' : ''}`}><div className="panel-toolbar"><strong>Properties</strong><button className="finish-editing" onClick={finish}>편집 종료 · Layout</button></div><div className="surface-editor-scroll"><label className="field">Edit Target<select aria-label="Surface Edit Target" value={editMode} onChange={e => setEditMode(e.target.value as typeof editMode)}><option value="surface">Selected Surface</option><option value="assembly">Parent Assembly</option><option value="source">Ray Source</option></select></label><div key={surface.id + editMode}>{currentFields}</div></div></section><section className={`panel surface-analysis ${!analysis ? 'surface-desktop-hide' : ''}`}><div className="panel-toolbar"><strong>Ray Analysis</strong><span data-testid="surface-status">{trace.status === 'valid' ? (trace.reached === trace.paths.length ? 'All reached' : 'Some blocked') : 'Invalid input'}</span></div><div className="surface-editor-scroll">{trace.status === 'valid' ? <><Footprint trace={trace} selected={surface.id}/><h3>Ray Termination</h3><p data-testid="surface-termination">{trace.paths.filter(p => p.status === 'blocked').length} / {trace.paths.length} blocked</p>{[...new Set(trace.paths.filter(p => p.reason).map(p => p.reason))].map(reason => <p className="surface-reason" key={reason}>{reason}</p>)}<h3>Geometric path / OPL</h3><p data-testid="surface-opl">{trace.paths[0] ? `${fmt(trace.paths[0].opl * 1000)} mm · first sampled ray` : ''}</p><p>OPL = Σ n × 실제 경로 길이. Coating / Fresnel / Absorption / Polarization은 계산하지 않습니다.</p><p className="surface-note">surface-sequential-3d / 2.1.0 · Input {trace.fingerprint} · λ {fmt(doc.wavelength * 1e9)} nm · Constant supplied n.</p></> : <p className="surface-reason">{trace.reason}</p>}</div></section></aside>
 </div><footer className={`surface-statusbar ${error ? 'error' : ''}`} role={error ? 'alert' : 'status'}>{error || notice}</footer><nav className="surface-mobile-nav" aria-label="Surface Workspace tabs">{(['layout', 'surfaces', 'inspect', 'analysis'] as const).map(t => <button key={t} aria-pressed={mobileTab === t} onClick={() => { setMobileTab(t); if (t === 'analysis')
        setAnalysis(true); if (t === 'inspect')
        setAnalysis(false); }}>{t === 'layout' ? 'Layout' : t === 'surfaces' ? 'Surfaces' : t === 'inspect' ? 'Inspect' : 'Analysis'}</button>)}</nav>
 </div></FieldValidity.Provider>;
}
function PoseFields({ value, prefix, onChange }: {
    value: Pose;
    prefix: string;
    onChange: (v: Pose) => boolean;
}) { return <><h4>Position · {prefix} [mm]</h4><div className="fields-three">{(['x', 'y', 'z'] as const).map(axis => <NumberField key={axis} label={`${prefix} ${axis.toUpperCase()}`} value={mm(value.origin[axis])} unit="mm" min={-1000} max={1000} onChange={v => onChange({ ...value, origin: { ...value.origin, [axis]: v! * 1e-3 } })}/>)}</div><h4>Orientation · Rz · Ry · Rx</h4><div className="fields-three">{(['roll', 'pitch', 'yaw'] as const).map(axis => <NumberField key={axis} label={`${prefix} ${axis[0].toUpperCase() + axis.slice(1)}`} value={deg(value.rotation[axis])} unit="°" min={-180} max={180} onChange={v => onChange({ ...value, rotation: { ...value.rotation, [axis]: rad(v!) } })}/>)}</div></>; }
function ArrayFields({ value, prefix, onChange }: {
    value: NonNullable<Surface['array']>;
    prefix: string;
    onChange: (v: NonNullable<Surface['array']>) => boolean;
}) { return <><h4>{prefix}</h4><div className="fields-three"><NumberField label={`${prefix} Rows`} value={value.rows} unit="" min={1} max={11} step={1} onChange={v => onChange({ ...value, rows: v! })}/><NumberField label={`${prefix} Columns`} value={value.cols} unit="" min={1} max={11} step={1} onChange={v => onChange({ ...value, cols: v! })}/><NumberField label={`${prefix} Pitch`} value={mm(value.pitch)} unit="mm" min={.000001} max={1000} onChange={v => onChange({ ...value, pitch: v! * 1e-3 })}/></div></>; }
