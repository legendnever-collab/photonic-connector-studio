import { PortContractFields } from '../authoring/Ports';
import { ArrowUp, ArrowDown, Trash2, LockKeyhole, UnlockKeyhole } from 'lucide-react';
import { NumberField } from '../Fields';
import { isPort, isTerminal, mm, um, toMM, toUM, degrees, radians, reorderComponent, removeComponent, replaceComponent, DocumentSchema, errorMessage } from '../domain';
import type { DesignDocument, OpticalComponent } from '../domain';
import { useProject } from './Store';
export default function IdealProperties({ component, onError }: { component:OpticalComponent; onError:(s:string)=>void }) {
 const shared=useProject(); if(shared.project.model.kind!=='ideal')return null;
 const doc=shared.project.model.design;
 function change(transform:(d:DesignDocument)=>DesignDocument){try{shared.updateIdeal(DocumentSchema.parse(transform(doc)));onError('');return true;}catch(e){onError(errorMessage(e));return false;}}
 const update=(next:OpticalComponent)=>change(d=>replaceComponent(d,next));
 const remove=()=>{if(change(d=>removeComponent(d,component.id)))shared.setSelection(doc.components[0].id);};
 return <>{isPort(component)&&<PortContractFields which={component.kind==='fiber'?'source':'target'}/>}<div className="ideal-selection"><h3>{component.name}</h3><button aria-label={component.locked?'Unlock Component':'Lock Component'} onClick={()=>update({...component,locked:!component.locked})}>{component.locked?<LockKeyhole size={16}/>:<UnlockKeyhole size={16}/>}</button></div>
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
</>;
}
