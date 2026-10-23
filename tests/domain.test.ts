import { describe, expect, it } from "vitest";
import {
  DocumentSchema,
  P0_SOLVER,
  addComponent,
  commit,
  degrees,
  exampleDocument,
  localNormal,
  mm,
  nm,
  parseDocument,
  project,
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
} from "../src/domain";
import type { History } from "../src/domain";

describe("SI units and coordinate conventions", () => {
  it.each([
    [1, mm, toMM, 0.001],
    [1, um, toUM, 0.000001],
    [1310, nm, toNM, 0.00000131],
  ] as const)("round-trips units: %s", (value, into, from, si) => {
    expect(into(value)).toBeCloseTo(si, 14);
    expect(from(into(value))).toBeCloseTo(value, 10);
  });
  it.each([-180, -45, 0, 30, 90, 180])("round-trips angle %d", (angle) =>
    expect(degrees(radians(angle))).toBeCloseTo(angle, 10),
  );
  it("uses a right-handed +X local normal", () => {
    const f = exampleDocument().components[0].frame;
    expect(localNormal(f)).toEqual({ x: 1, y: 0, z: -0 });
    expect(
      localNormal({ ...f, rotation: { roll: 0, pitch: 0, yaw: radians(90) } })
        .y,
    ).toBeCloseTo(1);
    expect(
      localNormal({ ...f, rotation: { roll: 0, pitch: radians(90), yaw: 0 } })
        .z,
    ).toBeCloseTo(-1);
  });
  it("projects one common frame to XY and XZ", () => {
    const frame = {
      origin: { x: 0.01, y: 0.002, z: 0.003 },
      rotation: { roll: 0, pitch: 0, yaw: 0 },
    };
    expect(project(frame, "XY")).toEqual({
      x: 0.01,
      transverse: 0.002,
      angle: 0,
    });
    expect(project(frame, "XZ")).toEqual({
      x: 0.01,
      transverse: 0.003,
      angle: -0,
    });
  });
});
describe("Schema and persistence", () => {
  it("loads the example with MFD explicitly unknown", () => {
    const d = exampleDocument();
    expect(d.components[0].kind).toBe("fiber");
    expect(d.components.at(-1)!.kind).toBe("waveguide");
    for (const c of d.components) {
      if ("mode" in c) expect(c.mode.mfdX).toBeNull();
    }
    expect(toNM(d.wavelength)).toBeCloseTo(1310);
  });
  it("save/load preserves the complete optical train including unknown modes", () => {
    let doc = addComponent(exampleDocument(), "reference-plane", "plane");
    doc.components[0].frame.rotation.yaw = radians(12);
    const wg = doc.components.at(-1)!;
    if ("mode" in wg) {
      wg.mode.mfdX = um(3.2);
      wg.mode.mfdY = um(2.1);
    }
    expect(parseDocument(serialize(doc))).toEqual(doc);
    expect(serialize(parseDocument(serialize(doc)))).toBe(serialize(doc));
  });
  it.each(["{broken", "null", "[]", "{}"])("rejects malformed JSON %s", (raw) =>
    expect(() => parseDocument(raw)).toThrow(),
  );
  it("rejects oversized imports", () =>
    expect(() => parseDocument(" ".repeat(2_000_001))).toThrow(/2 MB/));
  it.each([
    [
      "unknown schema",
      (d: Record<string, unknown>) => {
        d.schemaVersion = 2;
      },
    ],
    [
      "wrong units",
      (d: Record<string, unknown>) => {
        d.units = "mm";
      },
    ],
    [
      "unknown top-level fields",
      (d: Record<string, unknown>) => {
        d.coupling = 0.95;
      },
    ],
    [
      "invalid wavelength",
      (d: Record<string, unknown>) => {
        d.wavelength = -1;
      },
    ],
  ])("rejects %s", (_, mutate) => {
    const d = structuredClone(exampleDocument()) as unknown as Record<
      string,
      unknown
    >;
    mutate(d);
    expect(() => DocumentSchema.parse(d)).toThrow();
  });
  it("rejects NaN and Infinity coordinates", () => {
    for (const invalid of [NaN, Infinity, -Infinity]) {
      const d = exampleDocument();
      d.components[0].frame.origin.y = invalid;
      expect(() => DocumentSchema.parse(d)).toThrow();
    }
  });
  it("rejects duplicated IDs", () => {
    const d = exampleDocument();
    d.components[1].id = d.components[0].id;
    expect(() => DocumentSchema.parse(d)).toThrow(/중복/);
  });
  it("rejects reversed endpoints", () => {
    const d = exampleDocument();
    d.components.reverse();
    expect(() => DocumentSchema.parse(d)).toThrow();
  });
  it("rejects swapped port coordinates", () => {
    const d = exampleDocument();
    d.components[0].frame.origin.x = mm(20);
    expect(() => DocumentSchema.parse(d)).toThrow();
  });
  it("rejects a missing boundary", () => {
    const d = exampleDocument();
    d.components = d.components.filter((c) => c.kind !== "mating-plane");
    expect(() => DocumentSchema.parse(d)).toThrow();
  });
  it("rejects disabled terminal ports", () => {
    const d = exampleDocument();
    d.components[0].enabled = false;
    expect(() => DocumentSchema.parse(d)).toThrow();
  });
  it("rejects invalid MFD", () => {
    const d = exampleDocument();
    const c = d.components[0];
    if ("mode" in c) c.mode.mfdX = 0;
    expect(() => DocumentSchema.parse(d)).toThrow();
  });
  it("rejects unknown mode metadata instead of silently dropping it", () => {
    const d = JSON.parse(serialize(exampleDocument()));
    d.components[0].mode.fieldData = [1, 2, 3];
    expect(() => DocumentSchema.parse(d)).toThrow();
  });
  it("rejects impossible component variables", () => {
    const d = exampleDocument();
    d.components[0].variables = ["focalLength"];
    expect(() => DocumentSchema.parse(d)).toThrow();
  });
  it("rejects zero focal length", () => {
    const d = exampleDocument();
    const c = d.components[1];
    if (c.kind === "lens") c.focalLength = 0;
    expect(() => DocumentSchema.parse(d)).toThrow();
  });
  it("rejects gaps extending beyond the target", () => {
    const d = exampleDocument();
    const c = d.components[2];
    if (c.kind === "gap") c.length = mm(20);
    expect(() => DocumentSchema.parse(d)).toThrow();
  });
});
describe("Editor commands and history", () => {
  it.each(["fiber", "waveguide", "mating"])(
    "preserves terminal/reference %s",
    (id) => {
      const d = exampleDocument();
      expect(removeComponent(d, id)).toBe(d);
    },
  );
  it.each(["fiber", "waveguide"])("cannot reorder port %s", (id) => {
    const d = exampleDocument();
    expect(reorderComponent(d, id, -1)).toBe(d);
    expect(reorderComponent(d, id, 1)).toBe(d);
  });
  it.each(["lens", "gap", "reference-plane"] as const)(
    "inserts %s before WG",
    (kind) => {
      const d = addComponent(exampleDocument(), kind, "new");
      expect(d.components.at(-2)!.kind).toBe(kind);
      expect(d.components.at(-1)!.kind).toBe("waveguide");
    },
  );
  it("reorders the train without changing absolute geometry", () => {
    const d = exampleDocument(),
      moved = reorderComponent(d, "lens-f", 1);
    expect(moved.components[2].id).toBe("lens-f");
    expect(
      [...moved.components].sort((a, b) => a.id.localeCompare(b.id)),
    ).toEqual([...d.components].sort((a, b) => a.id.localeCompare(b.id)));
  });
  it("moves a component immutably", () => {
    const d = exampleDocument(),
      c = d.components[1];
    const moved = replaceComponent(d, {
      ...c,
      frame: { ...c.frame, origin: { ...c.frame.origin, x: mm(3.5) } },
    });
    expect(d.components[1].frame.origin.x).toBe(mm(3));
    expect(moved.components[1].frame.origin.x).toBe(mm(3.5));
    expect(moved.components[1].id).toBe(c.id);
  });
  it("preserves locked components", () => {
    const d = exampleDocument();
    d.components[1].locked = true;
    const c = d.components[1];
    expect(removeComponent(d, c.id)).toBe(d);
    expect(() => replaceComponent(d, { ...c, name: "edited" })).toThrow(/잠긴/);
    expect(
      replaceComponent(d, { ...c, locked: false }).components[1].locked,
    ).toBe(false);
  });
  it("undo and redo restore data, including null modes", () => {
    const d = exampleDocument(),
      h: History = { past: [], present: d, future: [] },
      next = addComponent(d, "lens", "new");
    const applied = commit(h, next);
    expect(undo(applied).present).toEqual(d);
    expect(redo(undo(applied)).present).toEqual(next);
  });
  it("new edits discard the redo branch; no-op edits do not", () => {
    const d = exampleDocument(),
      h: History = { past: [], present: d, future: [] },
      applied = commit(h, addComponent(d, "lens", "new")),
      back = undo(applied);
    expect(commit(back, back.present)).toBe(back);
    expect(commit(back, addComponent(d, "gap", "other")).future).toEqual([]);
  });
  it("does not calculate any coupling or loss", () =>
    expect(P0_SOLVER.evaluate(exampleDocument())).toEqual({
      status: "unavailable",
      reason: expect.any(String),
    }));
});
