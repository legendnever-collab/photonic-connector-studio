import { useEffect, useRef, useState } from "react";
import { Crosshair, Minus, Plus } from "lucide-react";
import type { GaussianResult } from "./physics";
import type { DesignDocument } from "./domain";
import { isPort, project, toMM, toUM } from "./domain";

type View = "XY" | "XZ";
type Props = {
  doc: DesignDocument;
  result: GaussianResult;
  designRevision: number;
  selected: string;
  select: (id: string) => void;
  view: View;
  setView: (view: View) => void;
};
export default function Layout({
  doc,
  result,
  designRevision,
  selected,
  select,
  view,
  setView,
}: Props) {
  const holder = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 900, height: 470 });
  const [camera, setCamera] = useState({ zoom: 1, dx: 0, dy: 0 });
  const drag = useRef<{ x: number; y: number; dx: number; dy: number } | null>(
    null,
  );
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) =>
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      }),
    );
    if (holder.current) observer.observe(holder.current);
    return () => observer.disconnect();
  }, []);
  const width = Math.max(280, size.width),
    height = Math.max(140, size.height);
  // Fix the fit bounds per loaded design; parameter edits do not change the camera.
  const [bounds, setBounds] = useState(() => fitBounds(doc));
  const [beamScale, setBeamScale] = useState(10);
  useEffect(() => { setBounds(fitBounds(doc)); setCamera({ zoom: 1, dx: 0, dy: 0 }); }, [designRevision]); // only explicit Load/Example resets fit
  const compact = width < 600;
  const padding = compact ? 60 : 85;
  const scale =
    Math.min(
      (width - padding * 2) / bounds.spanX,
      Math.max(30, height - 140) / bounds.spanT,
    ) * camera.zoom;
  const world = (x: number, t: number) => ({
    x: width / 2 + (x - bounds.centerX) * scale + camera.dx,
    y: height / 2 - 10 - (t - bounds.centerT) * scale + camera.dy,
  });
  const fit = () => {
    setBounds(fitBounds(doc));
    setCamera({ zoom: 1, dx: 0, dy: 0 });
  };
  const zoom = (mult: number) =>
    setCamera((c) => ({
      ...c,
      zoom: Math.max(0.25, Math.min(8, c.zoom * mult)),
    }));
  const axis = world(0, 0).y;
  const tickStep = niceStep(80 / scale);
  const low = bounds.centerX + (-width / 2 - camera.dx) / scale;
  const ticks = Array.from(
    { length: Math.min(60, Math.ceil(width / scale / tickStep) + 2) },
    (_, i) => Math.ceil(low / tickStep) * tickStep + i * tickStep,
  );
  const axisKey = view === "XY" ? "y" : "z";
  const sourceT = doc.components[0].frame.origin[axisKey];
  const envelope = result.status === "valid" ? [...result.samples.map(s=>world(s.x, sourceT + (s.axis[axisKey].height-sourceT+s[axisKey].radius)*beamScale)), ...[...result.samples].reverse().map(s=>world(s.x, sourceT + (s.axis[axisKey].height-sourceT-s[axisKey].radius)*beamScale))].map(p=>`${p.x},${p.y}`).join(" ") : "";
  const mating = doc.components.find((c) => c.kind === "mating-plane")!;
  const m = world(
    mating.frame.origin.x,
    view === "XY" ? mating.frame.origin.y : mating.frame.origin.z,
  );
  return (
    <section className="layout-panel panel" aria-label="Optical Layout">
      <div className="panel-toolbar">
        <div className="panel-title">
          <span className="live-dot" />
          Optical Layout <span className="tiny-label">SCHEMATIC</span>
        </div>
        <div className="projection" aria-label="Projection">
          {(["XY", "XZ"] as const).map((v) => (
            <button
              key={v}
              className={view === v ? "active" : ""}
              onClick={() => setView(v)}
              aria-pressed={view === v}
            >
              {v[0]}–{v[1]}
            </button>
          ))}
        </div>
      </div>
      <div className="layout-legend">
        <span>
          <i className="legend-line mint" />
          Removable
        </span>
        <span>
          <i className="legend-line violet" />
          Fixed
        </span>
        <span>
          <i className="legend-line amber" />
          Mating Plane
        </span>
      </div>
      <label className="beam-scale">Axis/Beam/Target display ×
        <select aria-label="Beam display scale" value={beamScale} onChange={e=>setBeamScale(Number(e.target.value))}>{[1,10,100].map(n=><option key={n} value={n}>{n}</option>)}</select>
        <span>Geometry는 1:1 · Center·Radius·Offset를 함께 확대</span>
      </label>
      <div ref={holder} className="canvas-holder">
        <svg
          data-testid="optical-canvas"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`${view} Optical Train schematic`}
          onPointerDown={(e) => {
            if ((e.target as Element).closest("[data-component]")) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = {
              x: e.clientX,
              y: e.clientY,
              dx: camera.dx,
              dy: camera.dy,
            };
          }}
          onPointerMove={(e) => {
            if (drag.current)
              setCamera((c) => ({
                ...c,
                dx: drag.current!.dx + e.clientX - drag.current!.x,
                dy: drag.current!.dy + e.clientY - drag.current!.y,
              }));
          }}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
        >
          <defs>
            <pattern
              id="grid"
              width="24"
              height="24"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="1" cy="1" r=".7" fill="var(--grid)" />
            </pattern>
            <marker
              id="axis-arrow"
              markerWidth="7"
              markerHeight="7"
              refX="6"
              refY="3"
              orient="auto"
            >
              <path d="M0,0 L6,3 L0,6" fill="none" stroke="#94a4ac" />
            </marker>
          </defs>
          <rect width={width} height={height} fill="url(#grid)" />
          <rect
            x="0"
            y="35"
            width={Math.max(0, Math.min(width, m.x))}
            height={height - 75}
            fill="#3d9d8a"
            opacity=".025"
          />
          <line
            x1="20"
            x2={width - 20}
            y1={axis}
            y2={axis}
            stroke="#aebdc4"
            strokeDasharray="6 6"
            markerEnd="url(#axis-arrow)"
          />
          <text x={width - 42} y={axis - 12} className="svg-axis">
            +X
          </text>
          {ticks.map((x) => {
            const p = world(x, 0);
            return (
              <g key={x}>
                <line
                  x1={p.x}
                  x2={p.x}
                  y1={height - 36}
                  y2={height - 30}
                  stroke="#a9b8c0"
                />
                <text
                  className="svg-tick"
                  x={p.x}
                  y={height - 13}
                  textAnchor="middle"
                >
                  {Number(toMM(x).toFixed(4))}
                </text>
              </g>
            );
          })}
          <line
            x1="12"
            x2={width - 12}
            y1={height - 36}
            y2={height - 36}
            stroke="#cbd5db"
          />
          <text x="14" y="26" className="svg-axis">
            +{view === "XY" ? "Y" : "Z"} ↑
          </text>
          <text
            x={width - 12}
            y={height - 44}
            textAnchor="end"
            className="svg-axis"
          >
            X [mm]
          </text>
          <text x="14" y="45" className="svg-tick">
            1:1 axis scale · +{view === "XY" ? "Z" : "Y"}{" "}
            {view === "XY" ? "⊙" : "⊗"}
          </text>
          {result.status === "valid" && <g className="gaussian-overlay" pointerEvents="none" data-testid="beam-overlay">
            <polyline data-testid="beam-axis" points={result.samples.map(s=>{const p=world(s.x,sourceT+(s.axis[axisKey].height-sourceT)*beamScale);return `${p.x},${p.y}`;}).join(" ")} fill="none" stroke="var(--axis)" strokeWidth="2"/>
            <polygon points={envelope} fill="var(--beam)" fillOpacity=".13" stroke="var(--beam)" strokeWidth="1.7"/>
            {(() => { const targetX=doc.components.at(-1)!.frame.origin.x, d=axisKey === "y" ? result.target.offsetY : result.target.offsetZ;
              const upper=world(targetX, sourceT+(d+result.target[axisKey])*beamScale), lower=world(targetX, sourceT+(d-result.target[axisKey])*beamScale);
              return <path d={`M${upper.x-6},${upper.y} H${upper.x+6} M${upper.x},${upper.y} V${lower.y} M${lower.x-6},${lower.y} H${lower.x+6}`} stroke="var(--canvas-fixed)" strokeWidth="3"/>;
            })()}
          </g>}
          {doc.components.map((c, index) => {
            const p = project(c.frame, view),
              point = world(p.x, p.transverse),
              active = selected === c.id;
            const color =
              c.kind === "mating-plane"
                ? "var(--canvas-boundary)"
                : c.region === "fixed"
                  ? "var(--canvas-fixed)"
                  : "var(--beam)";
            const isPlane =
              c.kind === "reference-plane" || c.kind === "mating-plane";
            const sizeMfd = isPort(c)
              ? view === "XY"
                ? c.mode.mfdX
                : c.mode.mfdY
              : null;
            const ap =
              c.kind === "lens"
                ? Math.max(12, Math.min(160, c.aperture * scale))
                : 0;
            const gapWidth = c.kind === "gap" ? c.length * scale : 0;
            return (
              <g
                key={c.id}
                data-component={c.id}
                data-testid={`layout-${c.id}`}
                role="button"
                aria-label={`Select ${c.name} in Layout`}
                aria-pressed={active}
                tabIndex={0}
                onClick={() => select(c.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    select(c.id);
                  }
                }}
                className="optical-element"
                opacity={c.enabled ? 1 : 0.35}
              >
                <rect
                  x={point.x - 23}
                  y={point.y - 85}
                  width={Math.max(46, gapWidth + 15)}
                  height="170"
                  rx="12"
                  fill={active ? color : "transparent"}
                  fillOpacity=".07"
                  stroke={active ? color : "transparent"}
                  strokeDasharray="3 4"
                />
                <g
                  transform={`translate(${point.x} ${point.y}) rotate(${(-p.angle * 180) / Math.PI})`}
                >
                  {isPlane ? (
                    <>
                      <line
                        x1="0"
                        x2="0"
                        y1={-Math.min(110, height / 2 - 35)}
                        y2={Math.min(110, height / 2 - 35)}
                        stroke={color}
                        strokeWidth="2"
                        strokeDasharray="7 5"
                      />
                      <path
                        d="M-5,-103 L0,-110 L5,-103"
                        fill="none"
                        stroke={color}
                      />
                    </>
                  ) : c.kind === "lens" ? (
                    <>
                      <path
                        d={`M0,${-ap / 2} Q17,0 0,${ap / 2} Q-17,0 0,${-ap / 2}`}
                        fill={color}
                        fillOpacity=".16"
                        stroke={color}
                        strokeWidth="2"
                      />
                      <line
                        x1="-8"
                        x2="8"
                        y1={-ap / 2}
                        y2={-ap / 2}
                        stroke={color}
                      />
                      <line
                        x1="-8"
                        x2="8"
                        y1={ap / 2}
                        y2={ap / 2}
                        stroke={color}
                      />
                    </>
                  ) : c.kind === "gap" ? (
                    <>
                      <line
                        x1="0"
                        x2={gapWidth}
                        y1="-24"
                        y2="-24"
                        stroke={color}
                      />
                      <path
                        d={`M0,-29 V-19 M${gapWidth},-29 V-19`}
                        stroke={color}
                      />
                      <text
                        x={gapWidth / 2}
                        y="-34"
                        textAnchor="middle"
                        className="svg-tick"
                      >
                        {Number(toMM(c.length).toFixed(3))} mm
                      </text>
                    </>
                  ) : (
                    <>
                      <rect
                        x={c.kind === "fiber" ? -52 : 0}
                        y="-16"
                        width="52"
                        height="32"
                        rx={c.kind === "fiber" ? 5 : 2}
                        fill={color}
                        fillOpacity=".15"
                        stroke={color}
                        strokeWidth="1.5"
                      />
                      {c.kind === "fiber" ? (
                        <>
                          <line
                            x1="-52"
                            x2="0"
                            y1="-4"
                            y2="-4"
                            stroke={color}
                          />
                          <line x1="-52" x2="0" y1="4" y2="4" stroke={color} />
                        </>
                      ) : (
                        <path
                          d="M0,0 H22 L40,-7 H52 M22,0 L40,7 H52"
                          fill="none"
                          stroke={color}
                          strokeWidth="2"
                        />
                      )}
                      <ellipse
                        cx="0"
                        cy="0"
                        rx="7"
                        ry={
                          sizeMfd
                            ? Math.max(4, Math.min(25, (sizeMfd * scale) / 2))
                            : 22
                        }
                        stroke={color}
                        strokeWidth="1.5"
                        strokeDasharray={sizeMfd ? undefined : "3 3"}
                        fill="white"
                        fillOpacity=".6"
                      />
                      <line
                        x1="3"
                        y1="0"
                        x2="25"
                        y2="0"
                        stroke={color}
                        markerEnd="url(#axis-arrow)"
                      />
                    </>
                  )}
                </g>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={active ? 4 : 2.5}
                  fill={color}
                />
                <text
                  x={point.x}
                  y={
                    point.y +
                    (index % 2 === 0
                      ? Math.min(78, height / 2 - 60)
                      : -Math.min(64, height / 2 - 45))
                  }
                  textAnchor="middle"
                  className="svg-name"
                  fill={color}
                >
                  {compact && c.kind === "mating-plane"
                    ? "Mating"
                    : c.name.length > 22
                      ? c.name.slice(0, 20) + "…"
                      : c.name}
                </text>
                <text
                  x={point.x}
                  y={
                    point.y +
                    (index % 2 === 0
                      ? Math.min(78, height / 2 - 60) + 18
                      : -Math.min(64, height / 2 - 45) + 18)
                  }
                  textAnchor="middle"
                  className="svg-tick"
                >
                  {isPort(c)
                    ? sizeMfd
                      ? `MFD${view === "XY" ? "x" : "y"} ${Number(toUM(sizeMfd).toFixed(3))} µm`
                      : "Mode TBD"
                    : c.kind === "lens"
                      ? `f ${Number(toMM(c.focalLength).toFixed(3))} mm`
                      : c.kind === "mating-plane"
                        ? compact
                          ? "Boundary"
                          : "DETACHABLE BOUNDARY"
                        : `X ${Number(toMM(c.frame.origin.x).toFixed(3))} mm`}
                </text>
              </g>
            );
          })}
        </svg>
        <div className="canvas-tools">
          <button
            title="Zoom out"
            aria-label="Zoom out"
            onClick={() => zoom(1 / 1.25)}
          >
            <Minus size={16} />
          </button>
          <span data-testid="zoom-level">{Math.round(camera.zoom * 100)}%</span>
          <button
            title="Zoom in"
            aria-label="Zoom in"
            onClick={() => zoom(1.25)}
          >
            <Plus size={16} />
          </button>
          <span className="separator" />
          <button
            onClick={fit}
            title="Fit to system"
            aria-label="Fit to system"
          >
            <Crosshair size={16} />
            <span>Fit</span>
          </button>
        </div>
      </div>
      <div className="layout-caption">
        <span>{result.status === "valid" ? `η ${Number((result.eta*100).toPrecision(6))}% · Coupling Loss ${Number.isFinite(result.lossDB) ? Number(result.lossDB.toPrecision(5)) : "∞"} dB · ${view} radius ×${beamScale}` : "Beam 미계산 · Analysis에서 사유 확인"}</span>
        <span>Axis/Envelope/Target 동일 배율 · 각도 값은 Analysis · 배경 Drag로 Pan</span>
      </div>
    </section>
  );
}
function fitBounds(doc: DesignDocument) {
  const xs = doc.components.map((c) => c.frame.origin.x),
    ts = doc.components.flatMap((c) => [c.frame.origin.y, c.frame.origin.z]);
  const min = Math.min(...xs),
    max = Math.max(...xs),
    tmin = Math.min(...ts),
    tmax = Math.max(...ts);
  return {
    centerX: (min + max) / 2,
    centerT: (tmin + tmax) / 2,
    spanX: Math.max(0.00001, max - min),
    spanT: Math.max(0.0001, tmax - tmin),
  };
}
function niceStep(value: number) {
  const exp = 10 ** Math.floor(Math.log10(value)),
    f = value / exp;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * exp;
}
