import { useCallback, useMemo, useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  Box,
  Check,
  ChevronRight,
  CircleHelp,
  FileJson,
  Focus,
  Layers,
  LockKeyhole,
  PanelLeft,
  Plus,
  Redo2,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Trash2,
  Undo2,
  UnlockKeyhole,
  Upload,
  X,
} from "lucide-react";
import type { DesignDocument, History, OpticalComponent } from "./domain";
import {
  APP_VERSION,
  DocumentSchema,
  addComponent,
  commit,
  degrees,
  errorMessage,
  exampleDocument,
  isPort,
  isTerminal,
  mm,
  nm,
  parseDocument,
  radians,
  redo,
  removeComponent,
  reorderComponent,
  replaceComponent,
  serialize,
  toMM,
  toNM,
  toUM,
  um,
  undo,
} from "./domain";
import Appearance from "./Appearance";
import SurfaceWorkbench from "./surface/Workbench";
import Layout from "./Layout";
import Analysis, { Metrics } from "./Analysis";
import { solveGaussian } from "./physics";
import type { GaussianResult } from "./physics";
import { EXAMPLES, syntheticExample } from "./examples";
import type { ExampleId } from "./examples";
import { FieldValidity, NumberField, format } from "./Fields";

type Tab = "layout" | "tree" | "properties" | "analysis";
export default function App() {
  const [history, setHistory] = useState<History>(() => ({
    past: [],
    present: exampleDocument(),
    future: [],
  }));
  const doc = history.present;
  const [invalidFields, setInvalidFields] = useState<string[]>([]);
  const fieldValidity = useCallback((label: string, invalid: boolean, recovered?: boolean) => {
    if (recovered) setFailure("");
    setInvalidFields(old => invalid ? (old.includes(label) ? old : [...old, label]) : (old.includes(label) ? old.filter(x => x !== label) : old));
  }, []);
  const [editNotice, setEditNotice] = useState("유효한 값은 자동 반영됩니다. 파일 보존은 Save JSON을 사용하세요.");
  useEffect(() => {
    const viewport = window.visualViewport;
    const resize = () => {
      document.documentElement.style.setProperty("--visible-height", `${viewport?.height ?? innerHeight}px`);
      document.documentElement.style.setProperty("--visible-top", `${viewport?.offsetTop ?? 0}px`);
    };
    resize(); viewport?.addEventListener("resize", resize); viewport?.addEventListener("scroll", resize);
    return () => { viewport?.removeEventListener("resize", resize); viewport?.removeEventListener("scroll", resize); };
  }, []);
  const finishEditing = () => {
    (document.activeElement as HTMLElement | null)?.blur();
    setTab("layout"); setFailure("");
    setMessage("편집을 종료했습니다. 유효한 변경은 이미 반영됐으며 미반영 입력은 마지막 유효 값으로 복구했습니다. 파일 보존: Save JSON.");
  };
  const [designRevision, setDesignRevision] = useState(0);
  const [selected, setSelected] = useState("fiber");
  const component =
    doc.components.find((c) => c.id === selected) ?? doc.components[0];
  const [view, setView] = useState<"XY" | "XZ">("XY");
  const [surfaceOpen, setSurfaceOpen] = useState(() => location.hash === "#surfaces");
  const [theme, setTheme] = useState<"light" | "dark" | "hybrid">("light");
  const [inspector, setInspector] = useState<"properties" | "analysis">("properties");
  const [tab, setTab] = useState<Tab>("layout");
  const [insert, setInsert] = useState<"lens" | "gap" | "reference-plane">(
    "lens",
  );
  const [message, setMessage] = useState(
    "1310 nm Example을 불러왔습니다. 위치와 Lens 값은 학습용 가정입니다.",
  );
  const [failure, setFailure] = useState("");
  const [help, setHelp] = useState(false);
  const [lastSaved, setLastSaved] = useState(() =>
    serialize(exampleDocument()),
  );
  const file = useRef<HTMLInputElement>(null);
  const dirty = serialize(doc) !== lastSaved;
  function change(
    transform: (d: DesignDocument) => DesignDocument,
    success?: string,
  ) {
    try {
      const next = transform(doc);
      DocumentSchema.parse(next);
      setHistory((h) => commit(h, next));
      setFailure("");
      setEditNotice("변경사항이 반영되었습니다. 파일 보존: Save JSON.");
      if (success) setMessage(success);
      return true;
    } catch (e) {
      setFailure(errorMessage(e));
      return false;
    }
  }
  function update(next: OpticalComponent) {
    return change((d) => replaceComponent(d, next));
  }
  const select = (id: string) => {
    setSelected(id);
    setInspector("properties");
    setFailure("");
  };
  const selectInTree = (id: string) => {
    select(id);
    setTab("properties");
  };
  const undoAction = () => {
    setHistory(undo);
    setFailure("");
  };
  const redoAction = () => {
    setHistory(redo);
    setFailure("");
  };
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest("input,textarea,select")) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        setHistory(event.shiftKey ? redo : undo);
        setFailure("");
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, []);
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);
  const save = () => {
    const json = serialize(doc),
      blob = new Blob([json], { type: "application/json" }),
      url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "photonic-connector-design.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setLastSaved(json);
    setMessage("JSON을 저장했습니다. Open JSON으로 다시 불러올 수 있습니다.");
  };
  const open = async (f: File | undefined) => {
    if (!f) return;
    try {
      if (f.size > 2_000_000) throw new Error("JSON은 2 MB 이하여야 합니다.");
      const next = parseDocument(await f.text());
      if (change(() => next)) {
        setSelected(next.components[0].id);
        setDesignRevision(n => n + 1);
        setLastSaved(serialize(next));
        setMessage(
          `${f.name}을 불러왔습니다. Undo로 이전 Design을 복원할 수 있습니다.`,
        );
      }
    } catch (e) {
      setFailure(
        `JSON을 열 수 없습니다. 기존 Design을 유지합니다. ${errorMessage(e)}`,
      );
    } finally {
      if (file.current) file.current.value = "";
    }
  };
  const add = () => {
    const id = crypto.randomUUID();
    if (
      change(
        (d) => addComponent(d, insert, id),
        "Component를 추가했습니다. Train Order와 절대 Position은 독립적입니다.",
      )
    ) {
      select(id);
      setTab("properties");
    }
  };
  const remove = () => {
    if (
      change(
        (d) => removeComponent(d, component.id),
        "Component를 삭제했습니다.",
      )
    )
      select("fiber");
  };
  const computed = useMemo(() => solveGaussian(doc), [doc]);
  const result: GaussianResult = invalidFields.length || failure ? {status: "invalid", reason: "미반영 입력/오류가 있습니다. 유효한 값으로 수정하거나 편집 종료로 마지막 유효 값을 복구하세요.", provenance: computed.provenance, warnings: []} : computed;
  const loadSynthetic = (id: ExampleId) => {
    change(() => syntheticExample(id), EXAMPLES[id].description); select("fiber");
    setTab("layout"); setDesignRevision(n => n + 1);
  };
  return (
    <FieldValidity.Provider value={fieldValidity}>
    <>
    <div className="app-shell" data-theme={theme} style={surfaceOpen ? {display:"none"} : undefined}>
      <header className="app-header">
        <div className="brand-mark">
          <Activity size={25} />
        </div>
        <div className="brand">
          <strong>
            PHOTONIC<span>CONNECTOR STUDIO</span>
          </strong>
          <span className="header-caption">OPTICAL DESIGN WORKSPACE</span>
        </div>
        <span className="build-tag">P1.3 · WORKSTATION</span>
        <div className="header-right">
          <button className="surface-launch" onClick={() => setSurfaceOpen(true)}>Surface Workbench</button>
          <Appearance theme={theme} onChange={setTheme}/>
          <span className="local-status">
            <span className="live-dot" />
            Browser local
          </span>
          <button
            className="icon-button"
            title="Help"
            aria-label="Help"
            onClick={() => setHelp(true)}
          >
            <CircleHelp size={19} />
          </button>
        </div>
      </header>
      <nav className="menubar" aria-label="File and Design controls">
        <div className="menu-group">
          <span className="menu-label">File</span>
          <button onClick={() => file.current?.click()}>
            <Upload size={15} />
            <span>Open JSON</span>
          </button>
          <button onClick={save}>
            <Save size={15} />
            <span>Save JSON</span>
          </button>
          <input
            ref={file}
            data-testid="json-input"
            className="file-input"
            type="file"
            accept=".json,application/json"
            onChange={(e) => void open(e.target.files?.[0])}
          />
        </div>
        <div className="menu-divider" />
        <div className="menu-group">
          <span className="menu-label">Design</span>
          <button
            onClick={undoAction}
            disabled={!history.past.length}
            aria-label="Undo"
            title="Undo (Ctrl/⌘ Z)"
          >
            <Undo2 size={16} />
          </button>
          <button
            onClick={redoAction}
            disabled={!history.future.length}
            aria-label="Redo"
            title="Redo (Ctrl/⌘ Shift Z)"
          >
            <Redo2 size={16} />
          </button>
          <button
            onClick={() => {
              if (
                change(
                  () => exampleDocument(),
                  "1310 nm Example을 불러왔습니다. Undo로 이전 Design을 복원할 수 있습니다.",
                )
              )
                { select("fiber"); setDesignRevision(n => n + 1); }
            }}
          >
            <RotateCcw size={15} />
            <span>1310 nm Example</span>
          </button>
        </div>
        <div className="menu-spacer" />
        <span className="version">v{APP_VERSION}</span>
      </nav>
      <div className="project-strip">
        <div>
          <span className="eyebrow">DESIGN / 001</span>
          <h1>{doc.name}</h1>
        </div>
        <div className="project-meta">
          <span className="example-tag">ILLUSTRATIVE EXAMPLE</span>
          <span className={dirty ? "save-state dirty" : "save-state"}>
            {dirty ? (
              "● Unsaved changes"
            ) : (
              <>
                <Check size={13} />{" "}
                {lastSaved === serialize(exampleDocument())
                  ? "Example loaded"
                  : "JSON saved"}
              </>
            )}
          </span>
        </div>
      </div>
      <section className="example-bar" aria-label="Synthetic Examples">
        <label>Synthetic Example<select aria-label="Synthetic Example" value="" onChange={e => {if (e.target.value) loadSynthetic(e.target.value as ExampleId);}}>
          <option value="">선택하세요</option>{Object.entries(EXAMPLES).map(([id,ex])=><option key={id} value={id}>{ex.label}</option>)}
        </select></label>
        <button onClick={() => loadSynthetic("matching")}>Reset Matching</button>
        <span>학습용 가정 · 측정/실물 부품 데이터 아님</span>
      </section>
      <div className={`workspace mobile-${tab}`}>
        <aside className="tree-panel panel" aria-label="Component Tree">
          <div className="panel-toolbar">
            <div className="panel-title">
              <Layers size={16} />
              Optical Train
            </div>
            <span className="count">{doc.components.length}</span>
          </div>
          <div className="tree-subtitle">Fiber → Optical Train → Waveguide</div>
          <div className="tree-list">
            {doc.components.map((c, index) => (
              <button
                key={c.id}
                data-testid={`tree-${c.id}`}
                className={`tree-item ${component.id === c.id ? "selected" : ""} ${!c.enabled ? "off" : ""}`}
                onClick={() => selectInTree(c.id)}
                aria-pressed={component.id === c.id}
              >
                <span className="tree-order">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className={`component-symbol ${c.kind}`}>
                  <ComponentIcon c={c} />
                </span>
                <span className="tree-item-text">
                  <strong>{c.name}</strong>
                  <small>
                    {c.kind === "mating-plane"
                      ? "Boundary"
                      : c.region === "fixed"
                        ? "Fixed side"
                        : "Removable side"}{" "}
                    · {format(toMM(c.frame.origin.x))} mm
                  </small>
                </span>
                {c.locked ? (
                  <LockKeyhole size={12} />
                ) : isPort(c) ? (
                  <span className="port-tag">PORT</span>
                ) : (
                  <ChevronRight size={13} />
                )}
              </button>
            ))}
          </div>
          <div className="insert-box">
            <label htmlFor="insert-type">Insert Component</label>
            <div className="insert-row">
              <select
                id="insert-type"
                aria-label="Component type"
                value={insert}
                onChange={(e) => setInsert(e.target.value as typeof insert)}
              >
                <option value="lens">Thin Lens</option>
                <option value="gap">Air Gap</option>
                <option value="reference-plane">Reference Plane</option>
              </select>
              <button
                className="add-button"
                onClick={add}
                aria-label="Add Component"
              >
                <Plus size={18} />
              </button>
            </div>
            <p>추가 순서는 Position을 바꾸지 않습니다.</p>
          </div>
          <div className="tree-bottom">
            <Box size={18} />
            <div>
              <strong>Single-channel workspace</strong>
              <p>Connector 구조를 탐색하는 첫 단계입니다.</p>
            </div>
          </div>
        </aside>
        <main className="main-workspace">
          <div className="system-strip">
            <div className="system-end fiber-end">
              <span className="endpoint-dot" />
              FIBER PORT
            </div>
            <div className="system-link">
              <span>EDITABLE OPTICAL TRAIN</span>
              <ArrowLeftRight size={15} />
            </div>
            <div className="system-end wg-end">
              <span className="endpoint-dot" />
              PHOTONIC SUBSTRATE
            </div>
          </div>
          <Metrics result={result} compact/>
          <Layout
            doc={doc}
            result={result}
            designRevision={designRevision}
            selected={component.id}
            select={select}
            view={view}
            setView={setView}
          />
          <section className="data-panel panel" aria-label="Component Data">
            <div className="panel-toolbar">
              <div className="panel-title">
                <FileJson size={16} />
                Component Data
              </div>
              <span className="tiny-label">SI STATE · DISPLAY IN mm</span>
            </div>
            <div className="data-scroll">
              <table>
                <thead>
                  <tr>
                    <th>ORDER / COMPONENT</th>
                    <th>X [mm]</th>
                    <th>Y [mm]</th>
                    <th>Z [mm]</th>
                    <th>STATE</th>
                  </tr>
                </thead>
                <tbody>
                  {doc.components.map((c, i) => (
                    <tr
                      key={c.id}
                      className={component.id === c.id ? "selected" : ""}
                    >
                      <td>
                        <button
                          className="table-select"
                          aria-label={`Select ${c.name} in Data`}
                          onClick={() => selectInTree(c.id)}
                        >
                          <span>{i + 1}</span>
                          {c.name}
                        </button>
                      </td>
                      {(["x", "y", "z"] as const).map((axis) => (
                        <td key={axis}>
                          <input
                            aria-label={`${c.name} ${axis.toUpperCase()} table`}
                            type="number"
                            step="0.1"
                            value={Number(
                              toMM(c.frame.origin[axis]).toPrecision(10),
                            )}
                            disabled={c.locked}
                            onChange={(e) => {
                              if (e.target.value === "") {
                                setFailure("Position 값을 입력하세요.");
                                return;
                              }
                              update({
                                ...c,
                                frame: {
                                  ...c.frame,
                                  origin: {
                                    ...c.frame.origin,
                                    [axis]: mm(Number(e.target.value)),
                                  },
                                },
                              });
                            }}
                          />
                        </td>
                      ))}
                      <td>
                        <span
                          className={`state-pill ${c.enabled ? "" : "disabled"}`}
                        >
                          {c.enabled ? "Enabled" : "Disabled"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="table-caption">
              Train Order와 절대 Position은 독립적입니다. Position 변경 후
              필요하면 Fit을 누르세요.
            </div>
          </section>
        </main>
        <aside className={`properties-column inspector-${inspector}`}>
          <nav className="inspector-tabs" aria-label="Inspector tabs">
            <button aria-pressed={inspector === "properties"} onClick={() => setInspector("properties")}>Inspect</button>
            <button aria-pressed={inspector === "analysis"} onClick={() => setInspector("analysis")}>Analyze</button>
          </nav>
          <section
            className="properties-panel panel"
            aria-label="Properties Editor"
          >
            <div className="panel-toolbar editor-toolbar">
              <div className="panel-title">
                <SlidersHorizontal size={16} />
                Properties
              </div>
              <button className="finish-editing" onClick={finishEditing}>편집 종료 · Layout</button>
              <button
                className="icon-button"
                title={component.locked ? "Unlock Component" : "Lock Component"}
                aria-label={
                  component.locked ? "Unlock Component" : "Lock Component"
                }
                onClick={() =>
                  update({ ...component, locked: !component.locked })
                }
              >
                {component.locked ? (
                  <LockKeyhole size={15} />
                ) : (
                  <UnlockKeyhole size={15} />
                )}
              </button>
            </div>
            <div className="properties-content" key={component.id}>
              <p className="editing-notice" aria-live="polite">{invalidFields.length ? "입력이 반영되지 않았습니다. 유효한 값을 입력하거나 Enter/Blur로 복구하세요." : editNotice}</p>
              <div className="selection-heading">
                <span className={`component-symbol ${component.kind}`}>
                  <ComponentIcon c={component} />
                </span>
                <div>
                  <h2>{component.name}</h2>
                  <span>
                    {isPort(component)
                      ? "Terminal Optical Port"
                      : component.kind === "mating-plane"
                        ? "Detachable Reference"
                        : "Optical Component"}
                  </span>
                </div>
              </div>
              <label className="field">
                <span>Component Name</span>
                <input
                  aria-label="Component Name"
                  value={component.name}
                  maxLength={80}
                  disabled={component.locked}
                  onChange={(e) =>
                    update({ ...component, name: e.target.value })
                  }
                />
              </label>
              <div className="section-label">
                POSITION <span>Global · SI → mm</span>
              </div>
              <div className="fields-three">
                {(["x", "y", "z"] as const).map((axis) => (
                  <NumberField
                    key={axis}
                    label={`${axis.toUpperCase()} Position`}
                    unit="mm"
                    value={toMM(component.frame.origin[axis])}
                    min={-1000}
                    max={1000}
                    step={0.1}
                    disabled={component.locked}
                    onChange={(v) =>
                      update({
                        ...component,
                        frame: {
                          ...component.frame,
                          origin: { ...component.frame.origin, [axis]: mm(v!) },
                        },
                      })
                    }
                  />
                ))}
              </div>
              <div className="section-label">
                ORIENTATION <span>Rz · Ry · Rx</span>
              </div>
              <div className="fields-three">
                {(["roll", "pitch", "yaw"] as const).map((axis) => (
                  <NumberField
                    key={axis}
                    label={axis[0].toUpperCase() + axis.slice(1)}
                    unit="°"
                    value={degrees(component.frame.rotation[axis])}
                    min={-180}
                    max={180}
                    step={isPort(component) ? 0.01 : 1}
                    disabled={component.locked}
                    onChange={(v) =>
                      update({
                        ...component,
                        frame: {
                          ...component.frame,
                          rotation: {
                            ...component.frame.rotation,
                            [axis]: radians(v!),
                          },
                        },
                      })
                    }
                  />
                ))}
              </div>
              {isPort(component) && <p className="field-note">Port Pitch/Yaw: Small-angle Phase ramp · norm ≤50 mrad (약2.865°) · Roll 미지원. sY=Yaw, sZ=−Pitch. Common X Plane 근사입니다.</p>}
              {isPort(component) && "mode" in component ? (
                <>
                  <div className="section-label">
                    GAUSSIAN PORT <span>Waist at this Plane</span>
                  </div>
                  <div className="fields-two">
                    {(["mfdX", "mfdY"] as const).map((axis) => (
                      <NumberField
                        key={axis}
                        label={axis === "mfdX" ? "MFDx" : "MFDy"}
                        unit="µm"
                        value={
                          component.mode[axis] === null
                            ? null
                            : toUM(component.mode[axis]!)
                        }
                        nullable
                        min={0.001}
                        max={1e6}
                        step={0.1}
                        disabled={component.locked}
                        onChange={(v) =>
                          update({
                            ...component,
                            mode: {
                              ...component.mode,
                              [axis]: v === null ? null : um(v),
                            },
                          })
                        }
                      />
                    ))}
                  </div>
                  <p className="field-note">
                    빈 값은 TBD입니다. MFDx → local Y, MFDy → local Z. Intensity
                    1/e² diameter.
                  </p>
                  <label className="field">
                    <span>Polarization</span>
                    <select
                      aria-label="Polarization"
                      value={component.mode.polarization}
                      disabled={component.locked}
                      onChange={(e) =>
                        update({
                          ...component,
                          mode: {
                            ...component.mode,
                            polarization: e.target.value as
                              "TE" | "TM" | "unspecified",
                          },
                        })
                      }
                    >
                      <option value="unspecified">Unspecified / TBD</option>
                      <option value="TE">TE</option>
                      <option value="TM">TM</option>
                    </select>
                  </label>
                </>
              ) : component.kind === "lens" ? (
                <>
                  <div className="section-label">
                    IDEAL THIN LENS <span>Gaussian ABCD</span>
                  </div>
                  <div className="fields-two">
                    <NumberField
                      label="Focal Length"
                      value={toMM(component.focalLength)}
                      unit="mm"
                      min={-1000}
                      max={1000}
                      disabled={component.locked}
                      onChange={(v) =>
                        update({ ...component, focalLength: mm(v!) })
                      }
                    />
                    <NumberField
                      label="Aperture"
                      value={toMM(component.aperture)}
                      unit="mm"
                      min={0.001}
                      max={1000}
                      disabled={component.locked}
                      onChange={(v) =>
                        update({ ...component, aperture: mm(v!) })
                      }
                    />
                  </div>
                  <p className="field-note">
                    Ideal Lens / Aperture clipping not modeled. Beam Envelope는 Gaussian q로 계산합니다.
                  </p>
                </>
              ) : component.kind === "gap" ? (
                <>
                  <div className="section-label">
                    FREE SPACE <span>Geometry</span>
                  </div>
                  <NumberField
                    label="Gap Length"
                    value={toMM(component.length)}
                    unit="mm"
                    min={0.001}
                    max={1000}
                    disabled={component.locked}
                    onChange={(v) => update({ ...component, length: mm(v!) })}
                  />
                </>
              ) : (
                <p className="field-note">
                  {component.kind === "mating-plane"
                    ? "두 결합면 사이의 Reference입니다. Optical Train에서 위치와 Orientation을 편집하세요."
                    : "Power를 바꾸지 않는 관찰 Plane입니다."}
                </p>
              )}
              <div className="section-label">ASSEMBLY / STATE</div>
              <div className="fields-two">
                <label className="field">
                  <span>Assembly Side</span>
                  <select
                    aria-label="Assembly Side"
                    value={component.region}
                    disabled={
                      component.locked || component.kind === "mating-plane"
                    }
                    onChange={(e) =>
                      update({
                        ...component,
                        region: e.target.value as OpticalComponent["region"],
                      })
                    }
                  >
                    <option value="removable">Removable</option>
                    <option value="fixed">Fixed</option>
                    {component.kind === "mating-plane" && (
                      <option value="boundary">Boundary</option>
                    )}
                  </select>
                </label>
                <label className="toggle-field">
                  <input
                    type="checkbox"
                    aria-label="Enabled"
                    checked={component.enabled}
                    disabled={component.locked || isTerminal(component)}
                    onChange={(e) =>
                      update({ ...component, enabled: e.target.checked })
                    }
                  />
                  <span>Enabled</span>
                </label>
              </div>
              <label className="toggle-field variable">
                <input
                  type="checkbox"
                  aria-label="X Variable"
                  checked={component.variables.includes("x")}
                  disabled={component.locked}
                  onChange={(e) =>
                    update({
                      ...component,
                      variables: e.target.checked
                        ? [...component.variables, "x"]
                        : component.variables.filter((v) => v !== "x"),
                    })
                  }
                />
                <span>
                  X Variable <small>Flag only · Optimizer 미구현</small>
                </span>
              </label>
              <div className="component-actions">
                <button
                  aria-label="Move Component up"
                  title="Move up in Train Order"
                  disabled={
                    isPort(component) ||
                    component.locked ||
                    doc.components.indexOf(component) <= 1
                  }
                  onClick={() =>
                    change((d) => reorderComponent(d, component.id, -1))
                  }
                >
                  <ArrowUp size={15} />
                  Up
                </button>
                <button
                  aria-label="Move Component down"
                  title="Move down in Train Order"
                  disabled={
                    isPort(component) ||
                    component.locked ||
                    doc.components.indexOf(component) >=
                      doc.components.length - 2
                  }
                  onClick={() =>
                    change((d) => reorderComponent(d, component.id, 1))
                  }
                >
                  <ArrowDown size={15} />
                  Down
                </button>
                <button
                  className="danger"
                  aria-label="Delete Component"
                  disabled={isTerminal(component) || component.locked}
                  onClick={remove}
                >
                  <Trash2 size={15} />
                  Delete
                </button>
              </div>
              {isPort(component) && (
                <p className="field-note">
                  Terminal Port는 삭제하거나 순서를 바꿀 수 없습니다.
                </p>
              )}
            </div>
          </section>
          <section className="analysis-panel panel" aria-label="Analysis">
            <div className="panel-toolbar">
              <div className="panel-title">
                <Focus size={16} />
                Analysis
              </div>
              <span className={`unavailable ${result.status}`} data-testid="solver-status">{result.status === "valid" ? "Valid · Scalar" : result.status}</span>
            </div>
            <div className="analysis-body"><Analysis result={result} doc={doc}/></div>
          </section>
        </aside>
      </div>
      <footer className={`statusbar ${failure ? "error" : ""}`}>
        <div role={failure ? "alert" : "status"}>
          <span className="status-indicator" />
          {failure || message}
        </div>
        <span>
          λ {format(toNM(doc.wavelength))} nm{" "}
          <span className="status-sep">/</span> {view}{" "}
          <span className="status-sep">/</span> SI
        </span>
      </footer>
      <nav className="mobile-tabs" aria-label="Workspace tabs">
        {(
          [
            { id: "layout", label: "Layout", icon: Focus },
            { id: "tree", label: "Train", icon: PanelLeft },
            { id: "properties", label: "Edit", icon: SlidersHorizontal },
            { id: "analysis", label: "Analysis", icon: Activity },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
          >
            <Icon size={19} />
            {label}
          </button>
        ))}
      </nav>
      {help && (
        <div className="modal-backdrop" onClick={() => setHelp(false)}>
          <section
            className="help-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Workspace Help"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="panel-toolbar">
              <h2>First Optical Workspace</h2>
              <button
                className="icon-button"
                onClick={() => setHelp(false)}
                aria-label="Close Help"
              >
                <X size={20} />
              </button>
            </div>
            <p>
              Component를 선택하고 Position · Orientation · Mode를 편집하세요.
              중앙 Layout과 아래 Data가 같은 State를 공유합니다.
            </p>
            <ol>
              <li>
                Tree 또는 Layout에서 Component를 선택합니다. Mobile에서는 Train
                → Edit를 사용합니다.
              </li>
              <li>
                Position은 mm, MFD는 µm로 입력합니다. 내부 저장 단위는 m /
                rad입니다.
              </li>
              <li>
                XY는 local Y 방향 MFDx, XZ는 local Z 방향 MFDy를 표시합니다. MFD
                glyph는 도식이며 수치 라벨로 확인합니다.
              </li>
              <li>
                Insert / Up / Down은 Train Order를 바꿉니다. 절대 Position은
                별도로 편집합니다.
              </li>
              <li>
                Save JSON → Open JSON으로 Design을 복원합니다. Undo / Redo로
                변경을 되돌립니다.
              </li>
            </ol>
            <NumberField
              label="Vacuum Wavelength"
              value={toNM(doc.wavelength)}
              unit="nm"
              min={200}
              max={20000}
              onChange={(v) => change((d) => ({ ...d, wavelength: nm(v!) }))}
            />
            <p className="field-note">
              P1.2는 Air Gaussian과 Centered Ideal Lens, Port의 Small-angle Tilt를 계산합니다. Source/Target는 Common X Plane의 Waist입니다. Lens Tilt·Decenter, Roll 및 Clipping은 지원하지 않습니다. 입력값은 예제 가정이며 측정값이 아닙니다.
            </p>
            <button className="primary" onClick={() => setHelp(false)}>
              Workspace로 돌아가기
            </button>
          </section>
        </div>
      )}
    </div>
    <div hidden={!surfaceOpen}><SurfaceWorkbench onReturn={() => setSurfaceOpen(false)} theme={theme} setTheme={setTheme}/></div>
    </>
    </FieldValidity.Provider>
  );
}
function ComponentIcon({ c }: { c: OpticalComponent }) {
  return c.kind === "fiber" ? (
    <span>F</span>
  ) : c.kind === "waveguide" ? (
    <span>W</span>
  ) : c.kind === "lens" ? (
    <span className="lens-icon">◊</span>
  ) : c.kind === "gap" ? (
    <ArrowLeftRight size={17} />
  ) : (
    <span>┆</span>
  );
}
