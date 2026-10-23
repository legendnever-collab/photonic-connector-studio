import { useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import Appearance from '../Appearance';
import type { Theme } from '../Appearance';
import { useProject } from './Store';
import { projectFingerprint } from './model';
import { ModeFields, BodyFields } from './Fields';
import { SurfaceScene, INITIAL_CAMERA, sceneBounds } from '../surface/Scene';
import type { SceneView } from '../surface/Scene';
import ReportFigure from '../surface/ReportFigure';
import './project.css';
export default function LinkedGaussian({ onSurface, theme, setTheme }: {
    onSurface: () => void;
    theme: Theme;
    setTheme: Dispatch<SetStateAction<Theme>>;
}) {
    const shared = useProject(), { project, doc } = shared, computed = shared.trace;
    const trace = shared.invalid.length ? { ...computed, status: 'invalid' as const, reason: '미반영 입력이 있습니다.', paths: [], reached: 0, rms: null, centroid: null, centroidLocal: null } : computed;
    const [view, setView] = useState<SceneView>('XY'), [camera, setCamera] = useState(INITIAL_CAMERA), [report, setReport] = useState(false), [error, setError] = useState('');
    const svg = useRef<SVGSVGElement>(null), file = useRef<HTMLInputElement>(null), bounds = useMemo(() => sceneBounds(doc, trace), [shared.revision]);
    const s = doc.surfaces.find(s => s.id === shared.selection) ?? doc.surfaces[0];
    return <div className="app-shell linked-gaussian" data-theme={theme}>
 <header className="app-header"><div className="surface-brand"><strong>Gaussian Workspace</strong><span>P2.3 · COMMON OPTICAL PROJECT</span></div><div className="header-right"><button className="surface-launch" onClick={onSurface}>Surface Workbench</button><Appearance theme={theme} onChange={setTheme}/></div></header>
 <nav className="surface-menubar"><button onClick={() => file.current?.click()}>Open Project JSON</button><button onClick={shared.save}>Save Project JSON</button><button aria-label="Undo Project" disabled={!shared.history.past.length} onClick={shared.undo}>Undo</button><button aria-label="Redo Project" disabled={!shared.history.future.length} onClick={shared.redo}>Redo</button><button className="report-launch" onClick={() => setReport(true)}>보고용 그림 · Report</button><input ref={file} type="file" className="file-input" data-testid="linked-project-input" accept=".json" onChange={async (e) => { try {
        const f = e.target.files?.[0];
        if (f) {
            if (f.size > 2000000)
                throw Error('JSON exceeds 2 MB');
            shared.open(await f.text());
            setError('');
        }
    }
    catch (e) {
        setError(String(e));
    } }}/></nav>
 <div className="surface-heading"><div><span className="eyebrow">SHARED DESIGN / GAUSSIAN ANALYSIS</span><h1>{doc.name}</h1></div><p data-testid="shared-project-id">SURFACE · Project {projectFingerprint(project)}</p></div>
 <div className="linked-main"><aside className="panel linked-fields"><ModeFields which="source"/><ModeFields which="target"/></aside><main className="linked-center"><section className="panel gaussian-support" data-testid="gaussian-support"><strong>Gaussian η · Not calculated</strong><p>현재 Project의 Physical Surface / Folded Path 전파는 미지원입니다. Source/Target Mode와 형상은 공유하며, Gaussian Solver 연결은 다음 Checkpoint에서 검증합니다.</p><small>아래 Layout은 동일 설계의 Geometric Ray 참조입니다.</small></section><section className="panel surface-layout"><div className="surface-layout-toolbar"><div className="surface-view-tabs">{(['XY', 'XZ', 'YZ', '3D'] as SceneView[]).map(v => <button key={v} aria-pressed={view === v} onClick={() => setView(v)}>{v}</button>)}</div><button onClick={() => setCamera(INITIAL_CAMERA)}>Fit</button></div><SurfaceScene doc={doc} trace={trace} view={view} camera={camera} setCamera={setCamera} bounds={bounds} selected={s.id} onSelect={shared.setSelection} presentation={false} svgRef={svg}/></section></main><aside className="panel linked-fields"><label className="field">Selected Surface<select aria-label="Linked selected Surface" value={s.id} onChange={e => shared.setSelection(e.target.value)}>{doc.surfaces.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label><button onClick={onSurface}>Edit Surface Data</button><BodyFields assemblyId={s.assemblyId}/></aside></div>
 <footer className="surface-statusbar" role={error ? 'alert' : 'status'}>{error || 'One Project · shared Surfaces / Modes / Body dimensions · Save Project JSON'}</footer>
 {report && <ReportFigure doc={doc} trace={trace} initialSelection={s.id} onClose={() => setReport(false)}/>}
 </div>;
}
