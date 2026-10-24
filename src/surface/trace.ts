import { add, sub, mul, dot, norm, unit, V, frame, pointToWorld, vectorToWorld, pointToLocal, vectorToLocal, compile, PrescriptionSchema, sag } from "./model";
import type { Vec, Compiled, Prescription } from "./model";
export const EPS = 1e-11;
export type Ray = {
    origin: Vec;
    direction: Vec;
    n: number;
    channel: string;
};
export type Hit = {
    surfaceId: string;
    point: Vec;
    local: Vec;
    normal: Vec;
    direction: Vec;
    cell: string;
    opl: number;
    event: string;
};
export type RayPath = {
    channel: string;
    points: Vec[];
    hits: Hit[];
    status: "reached" | "blocked";
    reason: string;
    opl: number;
};
export type Trace = {
    status: "valid" | "invalid";
    reason: string;
    paths: RayPath[];
    surfaces: Compiled[];
    reached: number;
    centroid: Vec | null;
    centroidLocal: Vec | null;
    rms: number | null;
    fingerprint: string;
};
export function sourceRays(d: Prescription): Ray[] {
    const src = d.source, f = frame(src.frame), rays: Ray[] = [];
    if (src.n === null) throw Error("Input Port medium is undefined · Draft");
    const a = src.channels;
    for (let row = 0; row < a.rows; row++)
        for (let col = 0; col < a.cols; col++)
            for (let j = 0; j < src.samples; j++)
                for (let i = 0; i < src.samples; i++) {
                    const u = src.samples === 1 ? 0 : (2 * i / (src.samples - 1) - 1) * src.radius, v = src.samples === 1 ? 0 : (2 * j / (src.samples - 1) - 1) * src.radius;
                    if (u * u + v * v > src.radius ** 2 * (1 + 1e-12))
                        continue;
                    rays.push({ origin: pointToWorld(f, V(0, u + (col - (a.cols - 1) / 2) * a.pitch, v + (row - (a.rows - 1) / 2) * a.pitch)), direction: f.axes[0], n: src.n, channel: `${row}:${col}` });
                }
    return rays;
}
export function reflect(d: Vec, n: Vec) { return unit(sub(d, mul(n, 2 * dot(d, n)))); }
export function refract(d: Vec, normal: Vec, n1: number, n2: number): Vec | null {
    const n = dot(d, normal) > 0 ? mul(normal, -1) : normal, c = -dot(d, n), eta = n1 / n2, k = 1 - eta * eta * Math.max(0, 1 - c * c);
    if (k < -1e-12)
        return null;
    return unit(add(mul(d, eta), mul(n, eta * c - Math.sqrt(Math.max(0, k)))));
}
export type Intersection = {
    point: Vec;
    local: Vec;
    normal: Vec;
    t: number;
    cell: string;
    clipped: boolean;
};
export function intersect(ray: Ray, s: Compiled): Intersection | null {
    const p = pointToLocal(s.world, ray.origin), d = vectorToLocal(s.world, ray.direction);
    // The array cell is selected at its vertex plane; general neighboring-cell search is not sequential tracing.
    if (Math.abs(d.x) < 1e-13 && (s.shape === "plane" || s.array))
        return null;
    const tPlane = -p.x / d.x, uPlane = p.y + tPlane * d.y, vPlane = p.z + tPlane * d.z, a = s.array;
    const col = a ? Math.round(uPlane / a.pitch + (a.cols - 1) / 2) : 0, row = a ? Math.round(vPlane / a.pitch + (a.rows - 1) / 2) : 0;
    const u = a ? (col - (a.cols - 1) / 2) * a.pitch : 0, v = a ? (row - (a.rows - 1) / 2) * a.pitch : 0;
    const q = sub(p, V(0, u, v));
    let roots: number[];
    if (s.shape === "plane")
        roots = [tPlane];
    else {
        const R = s.radius, oc = sub(q, V(R)), b = dot(oc, d), c = dot(oc, oc) - R * R, perpendicular = sub(oc, mul(d, b)), discriminant = R * R - dot(perpendicular, perpendicular);
        if (discriminant < -1e-12 * Math.max(R * R, dot(perpendicular, perpendicular), 1e-30))
            return null;
        const sqrt = Math.sqrt(Math.max(0, discriminant));
        const stable = -b - (b >= 0 ? sqrt : -sqrt);
        roots = Math.abs(stable) > 1e-25 ? [stable, c / stable] : [-b];
    }
    for (const t of roots.filter(t => Number.isFinite(t) && t > EPS).sort((a, b) => a - b)) {
        const local = add(p, mul(d, t)), relative = sub(local, V(0, u, v));
        if (s.shape === "sphere" && (s.radius > 0 ? relative.x > s.radius : relative.x < s.radius))
            continue;
        const radius = Math.hypot(relative.y, relative.z), clipped = radius > s.aperture * (1 + 1e-10) || (!!a && (col < 0 || col >= a.cols || row < 0 || row >= a.rows));
        const n = s.shape === "plane" ? V(1) : unit(mul(sub(relative, V(s.radius)), -Math.sign(s.radius)));
        return { point: pointToWorld(s.world, local), local, normal: vectorToWorld(s.world, n), t, cell: `${row}:${col}`, clipped };
    }
    return null;
}
export function traceRay(input: Ray, surfaces: Compiled[], accepts?: (point: Vec, surface: Compiled) => boolean): RayPath {
    let ray = { ...input, direction: unit(input.direction) }, opl = 0;
    const points = [ray.origin], hits: Hit[] = [];
    const blocked = (reason: string): RayPath => ({ channel: ray.channel, points, hits, status: "blocked", reason, opl });
    for (const s of surfaces) {
        if(s.nBefore === null || s.nAfter === null || (s.interaction === "tir" && s.outsideIndex === null)) return blocked(`${s.id}: undefined medium · Draft`);
        const hit = intersect(ray, s);
        if (!hit)
            return blocked(`${s.id}: missed / parallel / behind`);
        opl += norm(sub(hit.point, ray.origin)) * ray.n;
        points.push(hit.point);
        if (hit.clipped)
            return blocked(`${s.id}: aperture / cell clipping`);
        if (accepts && !accepts(hit.point, s))
            return blocked(`${s.id}: body boundary clipping`);
        if (Math.abs(ray.n - s.nBefore) > 1e-9)
            return blocked(`${s.id}: incident medium mismatch`);
        let direction = ray.direction, event = s.interaction, nextN = ray.n;
        if (s.interaction === "reflect")
            direction = reflect(ray.direction, hit.normal);
        if (s.interaction === "refract") {
            const next = refract(ray.direction, hit.normal, ray.n, s.nAfter);
            if (!next)
                return blocked(`${s.id}: unexpected TIR (sequence terminated)`);
            direction = next;
            nextN = s.nAfter;
        }
        if (s.interaction === "tir") {
            if (refract(ray.direction, hit.normal, ray.n, s.outsideIndex!) !== null)
                return blocked(`${s.id}: TIR condition not met`);
            direction = reflect(ray.direction, hit.normal);
        }
        hits.push({ surfaceId: s.id, point: hit.point, local: hit.local, normal: hit.normal, direction, cell: hit.cell, opl, event });
        ray = { ...ray, origin: hit.point, direction, n: nextN };
    }
    return { channel: ray.channel, points, hits, status: "reached", reason: "", opl };
}
export function fingerprint(d: Prescription) { let h = 2166136261; for (const c of JSON.stringify(d)) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
} return (h >>> 0).toString(16).padStart(8, "0"); }
export function tracePrescription(input: Prescription, accepts?: (point: Vec, surface: Compiled) => boolean): Trace {
    const fingerprintValue = fingerprint(input);
    try {
        const d = PrescriptionSchema.parse(input), surfaces = compile(d);
        if(d.source.n === null || d.surfaces.some(s=>s.nBefore===null||s.nAfter===null||(s.interaction==="tir"&&s.outsideIndex===null))) return {status:"invalid", reason:"Draft: Medium n이 미정의입니다. Surface Data에서 입력하세요.",surfaces,paths:[],reached:0,centroid:null,centroidLocal:null,rms:null,fingerprint:fingerprintValue};
        const paths = sourceRays(d).map(r => traceRay(r, surfaces, accepts));
        const reached = paths.filter(p => p.status === "reached");
        const centroid = reached.length ? mul(reached.reduce((a, p) => add(a, p.points.at(-1)!), V()), 1 / reached.length) : null;
        const meanU = reached.reduce((sum, p) => sum + p.hits.at(-1)!.local.y, 0) / reached.length, meanV = reached.reduce((sum, p) => sum + p.hits.at(-1)!.local.z, 0) / reached.length;
        const rms = centroid ? Math.sqrt(reached.reduce((sum, p) => sum + (p.hits.at(-1)!.local.y - meanU) ** 2 + (p.hits.at(-1)!.local.z - meanV) ** 2, 0) / reached.length) : null;
        return { status: "valid", reason: "", surfaces, paths, reached: reached.length, centroid, centroidLocal:centroid ? V(0,meanU,meanV) : null, rms, fingerprint: fingerprintValue };
    }
    catch (e) {
        return { status: "invalid", reason: e instanceof Error ? e.message : String(e), surfaces: [], paths: [], reached: 0, centroid: null, centroidLocal:null, rms: null, fingerprint: fingerprintValue };
    }
}
export function surfaceRing(s: Compiled, u = 0, v = 0, steps = 48): Vec[] { return Array.from({ length: steps }, (_, i) => { const a = i * 2 * Math.PI / steps, y = s.aperture * Math.cos(a), z = s.aperture * Math.sin(a); return pointToWorld(s.world, V(sag(s, y, z), y + u, z + v)); }); }
