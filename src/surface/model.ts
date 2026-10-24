import { materialIndex } from './materials';
import { z } from "zod";
export type Vec = {
    x: number;
    y: number;
    z: number;
};
export const V = (x = 0, y = 0, z = 0): Vec => ({ x, y, z });
export const add = (a: Vec, b: Vec): Vec => V(a.x + b.x, a.y + b.y, a.z + b.z);
export const sub = (a: Vec, b: Vec): Vec => V(a.x - b.x, a.y - b.y, a.z - b.z);
export const mul = (a: Vec, s: number): Vec => V(a.x * s, a.y * s, a.z * s);
export const dot = (a: Vec, b: Vec) => a.x * b.x + a.y * b.y + a.z * b.z;
export const norm = (a: Vec) => Math.hypot(a.x, a.y, a.z);
export const unit = (a: Vec): Vec => { const n = norm(a); if (n < 1e-15 || !Number.isFinite(n))
    throw Error("Invalid direction"); return mul(a, 1 / n); };
export type Pose = {
    origin: Vec;
    rotation: {
        roll: number;
        pitch: number;
        yaw: number;
    };
};
export type Frame = {
    origin: Vec;
    axes: [
        Vec,
        Vec,
        Vec
    ];
};
export const pose = (x = 0, y = 0, z = 0, yaw = 0, pitch = 0, roll = 0): Pose => ({ origin: V(x, y, z), rotation: { roll, pitch, yaw } });
export function rotate(p: Pose, v: Vec): Vec {
    const { roll: r, pitch: pitch, yaw: y } = p.rotation;
    const c = Math.cos, s = Math.sin;
    const a = V(v.x, c(r) * v.y - s(r) * v.z, s(r) * v.y + c(r) * v.z);
    const b = V(c(pitch) * a.x + s(pitch) * a.z, a.y, -s(pitch) * a.x + c(pitch) * a.z);
    return V(c(y) * b.x - s(y) * b.y, s(y) * b.x + c(y) * b.y, b.z);
}
export const frame = (p: Pose): Frame => ({ origin: p.origin, axes: [rotate(p, V(1)), rotate(p, V(0, 1)), rotate(p, V(0, 0, 1))] });
export const vectorToWorld = (f: Frame, v: Vec) => add(add(mul(f.axes[0], v.x), mul(f.axes[1], v.y)), mul(f.axes[2], v.z));
export const pointToWorld = (f: Frame, v: Vec) => add(f.origin, vectorToWorld(f, v));
export const vectorToLocal = (f: Frame, v: Vec) => V(...f.axes.map(a => dot(v, a)) as [
    number,
    number,
    number
]);
export const pointToLocal = (f: Frame, v: Vec) => vectorToLocal(f, sub(v, f.origin));
export const compose = (a: Frame, b: Frame): Frame => ({ origin: pointToWorld(a, b.origin), axes: b.axes.map(v => vectorToWorld(a, v)) as [
        Vec,
        Vec,
        Vec
    ] });
const finite = z.number().finite(), position = finite.min(-1).max(1), positive = finite.positive().max(1);
const vec = z.object({ x: position, y: position, z: position }).strict();
export const poseSchema = z.object({ origin: vec, rotation: z.object({ roll: finite.min(-Math.PI).max(Math.PI), pitch: finite.min(-Math.PI).max(Math.PI), yaw: finite.min(-Math.PI).max(Math.PI) }).strict() }).strict();
const id = z.string().min(1).max(80), index = finite.min(1).max(5);
const oddCount = z.number().int().min(1).max(15).refine(n => n % 2 === 1, "Use an odd sample count");
const arraySchema = z.object({ rows: z.number().int().min(1).max(11), cols: z.number().int().min(1).max(11), pitch: positive }).strict();
export const surfaceSchema = z.object({ id, name: z.string().min(1).max(80), assemblyId: id, frame: poseSchema, shape: z.enum(["plane", "sphere"]), radius: finite.min(-1).max(1), aperture: positive, interaction: z.enum(["refract", "reflect", "tir", "probe"]), materialBefore:z.enum(['air','N-BK7']).optional(), materialAfter:z.enum(['air','N-BK7']).optional(), nBefore: index.nullable(), nAfter: index.nullable(), outsideIndex: index.nullable(), array: arraySchema.nullable() }).strict();
export const PrescriptionSchema = z.object({ kind: z.literal("surface-prescription"), schemaVersion: z.literal(1), units: z.literal("SI"), name: z.string().min(1).max(120), wavelength: finite.min(200e-9).max(20e-6), provenance: z.literal("synthetic-assumptions"), source: z.object({ frame: poseSchema, radius: positive, samples: oddCount, n: index.nullable(), channels: arraySchema }).strict(), assemblies: z.array(z.object({ id, name: z.string().min(1).max(80), kind: z.enum(["lens", "mirror", "prism", "array", "group", "target"]), parentId: id.nullable(), frame: poseSchema }).strict()).min(1).max(50), surfaces: z.array(surfaceSchema).min(1).max(100) }).strict().superRefine((d, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: "custom", message });
    if (new Set(d.assemblies.map(a => a.id)).size !== d.assemblies.length)
        fail("Duplicate Assembly ID");
    if (new Set(d.surfaces.map(s => s.id)).size !== d.surfaces.length)
        fail("Duplicate Surface ID");
    const ids = new Set(d.assemblies.map(a => a.id));
    for (const a of d.assemblies) {
        let next: typeof a | undefined = a;
        const seen = new Set<string>();
        while (next) {
            if (seen.has(next.id)) {
                fail("Assembly cycle");
                break;
            }
            seen.add(next.id);
            if (next.parentId && !ids.has(next.parentId))
                fail("Unknown parent Assembly");
            next = d.assemblies.find(x => x.id === next!.parentId);
        }
    }
    for (const s of d.surfaces) {
        for(const [tag,key] of [['materialBefore','nBefore'],['materialAfter','nAfter']] as const){if(s[tag]){try{if(s[key]===null||Math.abs(s[key]!-materialIndex(s[tag]!,d.wavelength))>1e-10)fail(`${s.id}: Material / index mismatch`);}catch(e){fail(String(e));}}}
        if (!ids.has(s.assemblyId))
            fail("Unknown Surface Assembly");
        if (s.shape === "sphere" && Math.abs(s.radius) <= s.aperture)
            fail("Sphere clear radius must be smaller than |R|");
        if (s.array && 2 * s.aperture > s.array.pitch)
            fail("Lenslets overlap: 2 × aperture > pitch");
        if (["reflect", "tir", "probe"].includes(s.interaction) && s.nAfter !== s.nBefore)
            fail("Reflection / probe must retain medium n");
    }
    if (d.surfaces.at(-1)?.interaction !== "probe")
        fail("Last Surface must be a target probe");
    if (d.source.samples ** 2 * d.source.channels.rows * d.source.channels.cols > 6000)
        fail("Source ray sampling exceeds 6000");
});
export type Prescription = z.infer<typeof PrescriptionSchema>;
export type Surface = z.infer<typeof surfaceSchema>;
export type Assembly = Prescription["assemblies"][number];
export type Compiled = Surface & {
    world: Frame;
};
export function compile(d: Prescription): Compiled[] {
    const cache = new Map<string, Frame>();
    function resolve(id: string): Frame { const old = cache.get(id); if (old)
        return old; const a = d.assemblies.find(a => a.id === id)!; const f = a.parentId ? compose(resolve(a.parentId), frame(a.frame)) : frame(a.frame); cache.set(id, f); return f; }
    return d.surfaces.map(s => ({ ...s, world: compose(resolve(s.assemblyId), frame(s.frame)) }));
}
export function sag(s: Pick<Surface, "shape" | "radius">, u: number, v: number) { if (s.shape === "plane")
    return 0; const r2 = u * u + v * v, R = s.radius; if (r2 > R * R)
    return NaN; return r2 / (R + Math.sign(R) * Math.sqrt(R * R - r2)); }
export function cellCenters(s: Surface) { return Array.from({ length: s.array ? s.array.rows * s.array.cols : 1 }, (_, i) => { const a = s.array; return { id: a ? `${Math.floor(i / a.cols)}:${i % a.cols}` : "0:0", u: a ? (i % a.cols - (a.cols - 1) / 2) * a.pitch : 0, v: a ? (Math.floor(i / a.cols) - (a.rows - 1) / 2) * a.pitch : 0 }; }); }
export function serializePrescription(d: Prescription) { return JSON.stringify(PrescriptionSchema.parse(d), null, 2); }
export function parsePrescription(raw: string) { if (raw.length > 2000000)
    throw Error("JSON exceeds 2 MB"); return PrescriptionSchema.parse(JSON.parse(raw)); }
