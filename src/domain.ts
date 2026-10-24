import { z } from "zod";

export const APP_VERSION = "0.3.1-u1";
export const mm = (value: number) => value * 1e-3;
export const um = (value: number) => value * 1e-6;
export const nm = (value: number) => value * 1e-9;
export const toMM = (value: number) => value / 1e-3;
export const toUM = (value: number) => value / 1e-6;
export const toNM = (value: number) => value / 1e-9;
export const radians = (degrees: number) => (degrees * Math.PI) / 180;
export const degrees = (radians: number) => (radians * 180) / Math.PI;
const finite = z.number().finite();
const distance = finite.min(-1).max(1);
const positive = finite.positive().max(1);
const mode = z
  .object({
    representation: z.literal("gaussian"),
    mfdX: positive.nullable(),
    mfdY: positive.nullable(),
    polarization: z.enum(["unspecified", "TE", "TM"]),
  })
  .strict();
const frame = z
  .object({
    origin: z.object({ x: distance, y: distance, z: distance }).strict(),
    rotation: z
      .object({
        roll: finite.min(-Math.PI).max(Math.PI),
        pitch: finite.min(-Math.PI).max(Math.PI),
        yaw: finite.min(-Math.PI).max(Math.PI),
      })
      .strict(),
  })
  .strict();
const base = {
  id: z.string().min(1).max(100),
  name: z.string().trim().min(1).max(80),
  frame,
  enabled: z.boolean(),
  locked: z.boolean(),
  region: z.enum(["removable", "fixed", "boundary"]),
  variables: z
    .array(
      z.enum([
        "x",
        "y",
        "z",
        "roll",
        "pitch",
        "yaw",
        "mfdX",
        "mfdY",
        "focalLength",
        "aperture",
        "length",
      ]),
    )
    .max(12),
};
const fiber = z.object({ ...base, kind: z.literal("fiber"), mode }).strict();
const waveguide = z
  .object({ ...base, kind: z.literal("waveguide"), mode })
  .strict();
const lens = z
  .object({
    ...base,
    kind: z.literal("lens"),
    focalLength: finite
      .min(-1)
      .max(1)
      .refine((v) => v !== 0, "Focal length는 0일 수 없습니다."),
    aperture: positive,
  })
  .strict();
const gap = z
  .object({ ...base, kind: z.literal("gap"), length: positive })
  .strict();
const plane = z
  .object({ ...base, kind: z.literal("reference-plane") })
  .strict();
const mating = z.object({ ...base, kind: z.literal("mating-plane") }).strict();
export const ComponentSchema = z.discriminatedUnion("kind", [
  fiber,
  waveguide,
  lens,
  gap,
  plane,
  mating,
]);
export type OpticalComponent = z.infer<typeof ComponentSchema>;
export type Kind = OpticalComponent["kind"];
export type Frame = z.infer<typeof frame>;
export const DocumentSchema = z
  .object({
    schemaVersion: z.literal(1),
    name: z.string().trim().min(1).max(120),
    units: z.literal("SI"),
    wavelength: finite.min(nm(200)).max(nm(20000)),
    provenance: z.literal("illustrative-assumptions"),
    components: z.array(ComponentSchema).min(3).max(100),
  })
  .strict()
  .superRefine((doc, ctx) => {
    const kinds = doc.components.map((c) => c.kind);
    const invalid = (message: string) =>
      ctx.addIssue({ code: "custom", message });
    if (
      kinds[0] !== "fiber" ||
      kinds.at(-1) !== "waveguide" ||
      kinds.filter((k) => k === "fiber").length !== 1 ||
      kinds.filter((k) => k === "waveguide").length !== 1
    )
      invalid("Fiber / WG Port는 Train의 처음과 끝에 하나씩 있어야 합니다.");
    if (kinds.filter((k) => k === "mating-plane").length !== 1)
      invalid("Mating Plane은 하나 있어야 합니다.");
    if (new Set(doc.components.map((c) => c.id)).size !== doc.components.length)
      invalid("Component ID가 중복되었습니다.");
    const first = doc.components[0],
      last = doc.components.at(-1)!;
    if (first.frame.origin.x >= last.frame.origin.x)
      invalid("Fiber X는 WG X보다 작아야 합니다.");
    if (
      doc.components.some(
        (c) =>
          c.frame.origin.x < first.frame.origin.x ||
          c.frame.origin.x > last.frame.origin.x,
      )
    )
      invalid("Component X는 두 Port 사이에 있어야 합니다.");
    for (const c of doc.components) {
      if (isPort(c) && !c.enabled)
        invalid("Terminal Port는 비활성화할 수 없습니다.");
      if (c.kind === "mating-plane" && (!c.enabled || c.region !== "boundary"))
        invalid("Mating Plane은 활성 Boundary여야 합니다.");
      const allowed = [
        "x",
        "y",
        "z",
        "roll",
        "pitch",
        "yaw",
        ...(isPort(c)
          ? ["mfdX", "mfdY"]
          : c.kind === "lens"
            ? ["focalLength", "aperture"]
            : c.kind === "gap"
              ? ["length"]
              : []),
      ];
      if (
        c.variables.some((v) => !allowed.includes(v)) ||
        new Set(c.variables).size !== c.variables.length
      )
        invalid("Component Variable이 유효하지 않습니다.");
      if (c.kind === "gap") {
        const endX = c.frame.origin.x + c.length * localNormal(c.frame).x;
        if (
          endX > last.frame.origin.x + 1e-12 ||
          endX < first.frame.origin.x - 1e-12
        )
          invalid("Air Gap의 끝은 두 Port 사이에 있어야 합니다.");
      }
    }
  });
export type DesignDocument = z.infer<typeof DocumentSchema>;
export const isPort = (c: OpticalComponent) =>
  c.kind === "fiber" || c.kind === "waveguide";
export const isTerminal = (c: OpticalComponent) =>
  isPort(c) || c.kind === "mating-plane";
export function newFrame(x = 0): Frame {
  return { origin: { x, y: 0, z: 0 }, rotation: { roll: 0, pitch: 0, yaw: 0 } };
}
export function exampleDocument(): DesignDocument {
  const common = {
    enabled: true,
    locked: false,
    variables: [],
    region: "removable",
  } as const;
  return DocumentSchema.parse({
    schemaVersion: 1,
    name: "1310 nm · Fiber to Waveguide",
    units: "SI",
    wavelength: nm(1310),
    provenance: "illustrative-assumptions",
    components: [
      {
        ...common,
        id: "fiber",
        kind: "fiber",
        name: "Fiber Port",
        frame: newFrame(0),
        mode: {
          representation: "gaussian",
          mfdX: null,
          mfdY: null,
          polarization: "unspecified",
        },
      },
      {
        ...common,
        id: "lens-f",
        kind: "lens",
        name: "Lens F",
        frame: newFrame(mm(3)),
        focalLength: mm(2),
        aperture: mm(1.2),
      },
      {
        ...common,
        id: "air-gap",
        kind: "gap",
        name: "Air Gap",
        frame: newFrame(mm(4)),
        length: mm(1),
      },
      {
        ...common,
        id: "mating",
        kind: "mating-plane",
        name: "Mating Plane",
        region: "boundary",
        frame: newFrame(mm(6)),
      },
      {
        ...common,
        id: "lens-s",
        kind: "lens",
        name: "Lens S",
        region: "fixed",
        frame: newFrame(mm(9)),
        focalLength: mm(2),
        aperture: mm(1.2),
      },
      {
        ...common,
        id: "waveguide",
        kind: "waveguide",
        name: "WG Port",
        region: "fixed",
        frame: newFrame(mm(12)),
        mode: {
          representation: "gaussian",
          mfdX: null,
          mfdY: null,
          polarization: "unspecified",
        },
      },
    ],
  });
}
// Rz(yaw) Ry(pitch) Rx(roll): the local +X normal, in a right-handed frame.
export function localNormal(f: Frame) {
  const { pitch, yaw } = f.rotation;
  return {
    x: Math.cos(yaw) * Math.cos(pitch),
    y: Math.sin(yaw) * Math.cos(pitch),
    z: -Math.sin(pitch),
  };
}
// Gaussian transverse axes: MFDx follows local Y; MFDy follows local Z.
export function project(f: Frame, view: "XY" | "XZ") {
  const normal = localNormal(f);
  return {
    x: f.origin.x,
    transverse: view === "XY" ? f.origin.y : f.origin.z,
    angle: Math.atan2(view === "XY" ? normal.y : normal.z, normal.x),
  };
}
export function serialize(doc: DesignDocument) {
  return JSON.stringify(DocumentSchema.parse(doc), null, 2);
}
export function parseDocument(raw: string): DesignDocument {
  if (raw.length > 2_000_000) throw new Error("JSON은 2 MB 이하여야 합니다.");
  return DocumentSchema.parse(JSON.parse(raw));
}
export function errorMessage(error: unknown): string {
  if (error instanceof z.ZodError)
    return error.issues
      .map((i) => `${i.path.join(".") || "Design"}: ${i.message}`)
      .join(" · ");
  return error instanceof Error ? error.message : "입력값을 확인하세요.";
}
export function replaceComponent(doc: DesignDocument, c: OpticalComponent) {
  const previous = doc.components.find((item) => item.id === c.id);
  if (!previous) throw new Error("Component를 찾을 수 없습니다.");
  if (
    previous.locked &&
    JSON.stringify({ ...previous, locked: false }) !==
      JSON.stringify({ ...c, locked: false })
  )
    throw new Error("잠긴 Component를 먼저 해제하세요.");
  return DocumentSchema.parse({
    ...doc,
    components: doc.components.map((item) => (item.id === c.id ? c : item)),
  });
}
export function removeComponent(doc: DesignDocument, id: string) {
  const c = doc.components.find((c) => c.id === id);
  if (!c || isTerminal(c) || c.locked) return doc;
  return DocumentSchema.parse({
    ...doc,
    components: doc.components.filter((c) => c.id !== id),
  });
}
export function reorderComponent(
  doc: DesignDocument,
  id: string,
  direction: -1 | 1,
) {
  const index = doc.components.findIndex((c) => c.id === id),
    next = index + direction;
  if (
    index <= 0 ||
    index >= doc.components.length - 1 ||
    next <= 0 ||
    next >= doc.components.length - 1 ||
    doc.components[index].locked
  )
    return doc;
  const components = [...doc.components];
  [components[index], components[next]] = [components[next], components[index]];
  return DocumentSchema.parse({ ...doc, components });
}
export function addComponent(
  doc: DesignDocument,
  kind: "lens" | "gap" | "reference-plane",
  id: string,
) {
  const start = doc.components[0].frame.origin.x,
    end = doc.components.at(-1)!.frame.origin.x;
  const shared = {
    id,
    name:
      kind === "lens"
        ? "Thin Lens"
        : kind === "gap"
          ? "Air Gap"
          : "Reference Plane",
    frame: newFrame((start + end) / 2),
    kind,
    enabled: true,
    locked: false,
    variables: [],
    region: "fixed",
  };
  const component = ComponentSchema.parse({
    ...shared,
    ...(kind === "lens"
      ? { focalLength: mm(2), aperture: mm(1) }
      : kind === "gap"
        ? { length: Math.min(mm(1), (end - start) / 4) }
        : {}),
  });
  return DocumentSchema.parse({
    ...doc,
    components: [
      ...doc.components.slice(0, -1),
      component,
      doc.components.at(-1)!,
    ],
  });
}
export type History = {
  past: DesignDocument[];
  present: DesignDocument;
  future: DesignDocument[];
};
export function commit(h: History, next: DesignDocument): History {
  if (JSON.stringify(h.present) === JSON.stringify(next)) return h;
  return {
    past: [...h.past.slice(-99), h.present],
    present: DocumentSchema.parse(next),
    future: [],
  };
}
export function undo(h: History): History {
  return h.past.length
    ? {
        past: h.past.slice(0, -1),
        present: h.past.at(-1)!,
        future: [h.present, ...h.future],
      }
    : h;
}
export function redo(h: History): History {
  return h.future.length
    ? {
        past: [...h.past, h.present],
        present: h.future[0],
        future: h.future.slice(1),
      }
    : h;
}
export interface Solver {
  modelId: string;
  evaluate(document: DesignDocument): { status: "unavailable"; reason: string };
}
export const P0_SOLVER: Solver = {
  modelId: "p0-geometry-only",
  evaluate: () => ({
    status: "unavailable",
    reason:
      "P0는 Geometry 편집 단계입니다. Optical Solver는 아직 구현되지 않았습니다.",
  }),
};
