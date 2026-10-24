import { fiberLensFiberProject } from '../authoring/starter';
import { newPhysicalProject } from '../authoring/commands';
import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { idealProject, projectExample, ProjectSchema, serializeProject, parseProject, prescription, withPrescription, gaussianForProject, projectFingerprint } from './model';
import type { Project } from './model';
import type { Prescription } from '../surface/model';
import { projectTrace } from './compute';
import type { DesignDocument } from '../domain';
type ProjectHistory = {
    past: Project[];
    present: Project;
    future: Project[];
};
function useProjectStore() {
    const [history, setHistory] = useState<ProjectHistory>(() => ({ past: [], present: location.hash === '#surfaces' ? projectExample('compound') : location.hash==='#ideal'?idealProject():location.hash==='#blank'?newPhysicalProject():fiberLensFiberProject(), future: [] }));
    const project = history.present, [saved, setSaved] = useState(() => serializeProject(project));
    const [selection, setSelection] = useState(() => project.authoring?.ports.source.preset?'@source':prescription(project).surfaces[0].id), [revision, setRevision] = useState(0);
    const [pending, setPending] = useState<Project|null>(null);
    const [invalid, setInvalid] = useState<string[]>([]);
    function commit(next: Project) { ProjectSchema.parse(next); setHistory(h => JSON.stringify(next) === JSON.stringify(h.present) ? h : { past: [...h.past.slice(-49), h.present], present: next, future: [] }); }
    function replace(next: Project) { commit(next); setSelection(next.authoring?.ports.source.preset?'@source':prescription(next).surfaces[0].id); setRevision(r => r + 1); setInvalid([]); }
    const undo = () => { setHistory(h => h.past.length ? { past: h.past.slice(0, -1), present: h.past.at(-1)!, future: [h.present, ...h.future] } : h); setInvalid([]); };
    const redo = () => { setHistory(h => h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) } : h); setInvalid([]); };
    const doc = useMemo(() => prescription(project), [project.model]);
    const rawTrace = useMemo(() => projectTrace(project), [doc, project.bodies]);
    const trace = useMemo(() => ({ ...rawTrace, fingerprint: projectFingerprint(project) }), [rawTrace, project]);
    const gaussian = useMemo(() => gaussianForProject(project), [project.model.kind, project.model.kind === 'ideal' ? project.model.design : null, project.authoring?.ports]);
    function updateIdeal(d: DesignDocument) { commit({ ...project, model: idealProject(d, project.sourceBody).model }); }
    function updateSurface(d: Prescription) { commit(withPrescription(project, d)); }
    function save() { const text = serializeProject(project), url = URL.createObjectURL(new Blob([text], { type: 'application/json' })), a = document.createElement('a'); a.href = url; a.download = 'photonic-optical-project.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); setSaved(text); }
    function open(raw: string) { const next = parseProject(raw); if(serializeProject(project)!==saved){setPending(next);return;} replace(next); setSaved(serializeProject(next)); }
    function requestReplace(next:Project){if(serializeProject(project)!==saved){setPending(next);return;}replace(next);}
    function acceptPending(){if(pending){replace(pending);setPending(null);}}
    return { project, doc, trace, gaussian, history, pending, setPending, requestReplace, acceptPending, commit, replace, updateIdeal, updateSurface, undo, redo, selection, setSelection, revision, save, open, dirty: serializeProject(project) !== saved, invalid, setInvalid };
}
const Context = createContext<ReturnType<typeof useProjectStore> | null>(null);
export function ProjectProvider({ children }: {
    children: ReactNode;
}) { return <Context.Provider value={useProjectStore()}>{children}</Context.Provider>; }
export function useProject() { const value = useContext(Context); if (!value)
    throw Error('ProjectProvider required'); return value; }
