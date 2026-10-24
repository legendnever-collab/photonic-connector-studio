import { expect, test } from 'vitest';
import { V, pose, frame, compose, pointToLocal, pointToWorld, vectorToWorld, compile, PrescriptionSchema, serializePrescription, parsePrescription, sag, norm, sub, dot, mul } from '../src/surface/model';
import { sourceRays, traceRay, tracePrescription, reflect, refract, intersect } from '../src/surface/trace';
import { surfaceExample, SURFACE_EXAMPLES } from '../src/surface/examples';
const rad = (d: number) => d * Math.PI / 180, mm = (n: number) => n * 1e-3;
test('3D frames roundtrip and right-handed rotations match independent basis cases', () => {
    const p = pose(.1, .2, .3, .8, -.4, .2), f = frame(p), v = V(.001, .002, -.003);
    expect(norm(sub(pointToLocal(f, pointToWorld(f, v)), v))).toBeLessThan(1e-16);
    expect(vectorToWorld(frame(pose(0, 0, 0, Math.PI / 2)), V(1)).y).toBeCloseTo(1, 14);
    expect(vectorToWorld(frame(pose(0, 0, 0, 0, Math.PI / 2)), V(1)).z).toBeCloseTo(-1, 14);
    const c = compose(f, frame(pose(.01, 0, 0, .3)));
    expect(norm(sub(c.origin, pointToWorld(f, V(.01))))).toBeLessThan(1e-15);
});
test.each([0, 10, 30, 60, 80])('Snell air/glass transmitted angle independently at %s degrees', deg => {
    const d = V(Math.cos(rad(deg)), Math.sin(rad(deg))), out = refract(d, V(1), 1, 1.5)!;
    expect(Math.atan2(out.y, out.x)).toBeCloseTo(Math.asin(Math.sin(rad(deg)) / 1.5), 13);
    expect(norm(out)).toBeCloseTo(1, 14);
    const back = refract(mul(out, -1), V(1), 1.5, 1)!;
    expect(norm(sub(back, mul(d, -1)))).toBeLessThan(1e-12);
});
test('TIR either side of critical angle and arbitrary outside index', () => {
    const critical = Math.asin(1 / 1.5);
    expect(refract(V(Math.cos(critical - 1e-6), Math.sin(critical - 1e-6)), V(1), 1.5, 1)).not.toBeNull();
    expect(refract(V(Math.cos(critical + 1e-6), Math.sin(critical + 1e-6)), V(1), 1.5, 1)).toBeNull();
    expect(refract(V(Math.cos(rad(45)), Math.sin(rad(45))), V(1), 1.5, 1.4)).not.toBeNull();
});
test.each([-5, 0, 5])('mirror rotation produces twice angular change at %s degrees', tilt => {
    const n = V(Math.cos(rad(-45 + tilt)), Math.sin(rad(-45 + tilt))), out = reflect(V(1), n);
    expect(Math.atan2(out.y, out.x)).toBeCloseTo(rad(90 + 2 * tilt), 13);
    expect(dot(out, n)).toBeCloseTo(-dot(V(1), n), 13);
});
test('parallel slab displacement and OPL agree with independent trigonometry', () => {
    const d = surfaceExample('lens');
    d.source.samples = 1;
    d.source.frame.rotation.yaw = rad(30);
    d.source.radius = mm(.01);
    d.surfaces = d.surfaces.map(s => ({ ...s, shape: 'plane', aperture: mm(10) }));
    d.surfaces[0].frame.origin.x = 0;
    d.surfaces[1].frame.origin.x = mm(1);
    const result = tracePrescription(d), ray = result.paths[0];
    expect(ray.status).toBe('reached');
    const theta = Math.asin(Math.sin(rad(30)) / 1.5);
    const hit = ray.hits[1];
    expect(hit.point.y).toBeCloseTo(mm(2) * Math.tan(rad(30)) + mm(1) * Math.tan(theta), 13);
    expect(Math.atan2(hit.direction.y, hit.direction.x)).toBeCloseTo(rad(30), 13);
    expect(hit.opl).toBeCloseTo(mm(2) / Math.cos(rad(30)) + 1.5 * mm(1) / Math.cos(theta), 13);
});
test('spherical paraxial focus agrees with thick lensmaker BFL and converges', () => {
    const d = surfaceExample('lens'), surfaces = compile(d);
    const R = .005, t = .001, n = 1.5;
    const power = (n - 1) * (2 / R - (n - 1) * t / (n * R * R));
    const bfl = (1 - t * (n - 1) / (n * R)) / power;
    const errors = [1e-4, 1e-5, 1e-6].map(height => { const p = traceRay({ origin: V(0, height), direction: V(1), n: 1, channel: 'test' }, surfaces.slice(0, 2)); const last = p.hits[1], focus = last.point.x - last.point.y / last.direction.y * last.direction.x; return Math.abs(focus - (.003 + bfl)); });
    expect(errors[2]).toBeLessThan(2e-9);
    expect(errors[2]).toBeLessThan(errors[1] / 50);
    expect(errors[1]).toBeLessThan(errors[0] / 50);
});
test('sphere selects vertex cap, rejects far hemisphere and tests actual aperture', () => {
    const s = compile(surfaceExample('lens'))[0];
    const hit = intersect({ origin: V(0, .0002), direction: V(1), n: 1, channel: '' }, s)!;
    expect(hit.point.x).toBeCloseTo(.002 + sag(s, .0002, 0), 14);
    const clipped = intersect({ origin: V(0, .0012), direction: V(1), n: 1, channel: '' }, s)!;
    expect(clipped.clipped).toBe(true);
    expect(intersect({ origin: V(.003), direction: V(1), n: 1, channel: '' }, s)).toBeNull();
    expect(intersect({ origin: V(), direction: V(0, 1), n: 1, channel: '' }, s)).toBeNull();
});
test.each(Object.keys(SURFACE_EXAMPLES) as (keyof typeof SURFACE_EXAMPLES)[])('synthetic %s has complete physical sequence and conserved sampled ray count', name => {
    const d = surfaceExample(name), r = tracePrescription(d);
    expect(r.status).toBe('valid');
    expect(r.reached).toBe(r.paths.length);
    expect(r.paths.length).toBe(sourceRays(d).length);
    for (const p of r.paths) {
        expect(p.hits).toHaveLength(d.surfaces.length);
        expect(p.opl).toBeGreaterThan(0);
        for (const h of p.hits)
            expect(norm(h.direction)).toBeCloseTo(1, 12);
    }
});
test('compound path folds +X to +Y and back to +X and preserves 9 lenslet channels', () => {
    const d = surfaceExample('compound'), r = tracePrescription(d);
    expect(new Set(r.paths.map(p => p.channel)).size).toBe(9);
    expect(new Set(r.paths.map(p => p.hits[0].cell)).size).toBe(9);
    const p = r.paths.find(p => p.channel === '1:1' && norm(sub(p.points[0], V())) < 1e-10)!;
    expect(p.hits[3].direction.y).toBeCloseTo(1, 12);
    expect(p.hits[5].direction.x).toBeCloseTo(1, 12);
    expect(p.points.at(-1)!.x).toBeCloseTo(.008, 13);
    expect(p.points.at(-1)!.y).toBeCloseTo(.004, 13);
});
test('entire system is covariant under arbitrary rigid body transforms', () => {
    const d = surfaceExample('compound'), baseline = tracePrescription(d), global = pose(.02, -.01, .03, .4, .2, -.3), g = frame(global);
    d.assemblies.push({ id: 'Global', name: 'Global', kind: 'group', parentId: null, frame: global });
    d.assemblies = d.assemblies.map(a => a.id !== 'Global' && !a.parentId ? { ...a, parentId: 'Global' } : a);
    const source = sourceRays(d).map(r => ({ ...r, origin: pointToWorld(g, r.origin), direction: vectorToWorld(g, r.direction) })), surfaces = compile(d);
    source.forEach((ray, i) => { const p = traceRay(ray, surfaces); expect(p.status).toBe(baseline.paths[i].status); expect(p.opl).toBeCloseTo(baseline.paths[i].opl, 12); p.points.forEach((v, j) => expect(norm(sub(v, pointToWorld(g, baseline.paths[i].points[j])))).toBeLessThan(1e-12)); });
});
test('Assembly pivot moves all child optical surfaces while independent target stays fixed', () => {
    const d = surfaceExample('compound'), old = compile(d);
    d.assemblies.find(a => a.id === 'Module')!.frame = pose(0, 0, 0, .1);
    const next = compile(d);
    for (const id of ['P-entry', 'P-TIR', 'P-exit', 'M1']) {
        expect(norm(sub(next.find(s => s.id === id)!.world.origin, old.find(s => s.id === id)!.world.origin))).toBeGreaterThan(1e-5);
    }
    expect(next.at(-1)!.world.origin).toEqual(old.at(-1)!.world.origin);
});
test('aperture blocking, incorrect medium and unexpected TIR have explicit causes', () => {
    const d = surfaceExample('prism');
    d.surfaces[0].aperture = 1e-6;
    expect(tracePrescription(d).paths.some(p => p.reason.includes('clipping'))).toBe(true);
    d.surfaces[0].aperture = .0015;
    d.surfaces[0].nBefore = 1.1;
    expect(tracePrescription(d).paths.every(p => p.reason.includes('medium mismatch'))).toBe(true);
    d.surfaces[0].nBefore = 1;
    d.surfaces[1].interaction = 'refract';
    d.surfaces[1].nAfter = 1;
    expect(tracePrescription(d).paths.every(p => p.reason.includes('unexpected TIR'))).toBe(true);
    d.surfaces[1].interaction = 'tir';
    d.surfaces[1].nAfter = 1.5;
    d.surfaces[1].outsideIndex = 1.4;
    expect(tracePrescription(d).paths.every(p => p.reason.includes('TIR condition'))).toBe(true);
});
test('schema rejects cycles, unbound surfaces, overlapping array caps and unsupported fields transactionally', () => {
    const initial = serializePrescription(surfaceExample('array'));
    expect(serializePrescription(parsePrescription(initial))).toBe(initial);
    const bad = JSON.parse(initial);
    bad.surfaces[0].radius = bad.surfaces[0].aperture;
    expect(PrescriptionSchema.safeParse(bad).success).toBe(false);
    bad.surfaces[0].radius = .005;
    bad.surfaces[0].array.pitch = .0001;
    expect(PrescriptionSchema.safeParse(bad).success).toBe(false);
    const cyc = surfaceExample('compound');
    cyc.assemblies.find(a => a.id === 'Module')!.parentId = 'Prism';
    expect(PrescriptionSchema.safeParse(cyc).success).toBe(false);
    expect(() => parsePrescription(JSON.stringify({ ...JSON.parse(initial), unsupported: true }))).toThrow();
    expect(() => parsePrescription(' '.repeat(2000001))).toThrow();
});
test('target RMS uses local transverse coordinates and aperture sampling approaches area ratio', () => {
    const d = surfaceExample('mirror'), r = tracePrescription(d), samples = sourceRays(d), expected = Math.sqrt(samples.reduce((sum, p) => sum + p.origin.y ** 2 + p.origin.z ** 2, 0) / samples.length);
    expect(r.rms).toBeCloseTo(expected, 13);
    d.source.frame.origin.y=.0003;const shifted=tracePrescription(d);expect(shifted.rms).toBeCloseTo(r.rms!,13);// The +90-degree target frame has local +u = global -X; mirror x-y=3mm maps source +Y to target -u.
    expect(shifted.centroidLocal!.y).toBeCloseTo(-.0003,13);
    const stop = surfaceExample('mirror');
    stop.surfaces = [{ ...stop.surfaces[1], frame: pose(.003), aperture: stop.source.radius / 2 }];
    stop.source.samples = 15;
    const sampled = tracePrescription(stop);
    expect(Math.abs(sampled.reached / sampled.paths.length - .25)).toBeLessThan(.05);
    expect(sampled.paths.filter(p => p.status === 'blocked').length + sampled.reached).toBe(sampled.paths.length);
});
