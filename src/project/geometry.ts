import {profileDomainIssue,positiveThickness} from '../surface/evaluator';
import { V, add, sub, mul, dot, norm, pointToWorld, pointToLocal, cellCenters, frame } from '../surface/model';
import type { Compiled, Vec, Prescription } from '../surface/model';
import type { Body, Project } from './model';
import type { ReportFace, ReportEdge } from '../surface/reportGeometry';
import { compatiblePair, prismEnvelope, cross } from '../surface/reportGeometry';
import { surfaceRing } from '../surface/trace';
export type BodyGeometry = {
    faces: ReportFace[];
    edges: ReportEdge[];
    issues: string[];
    solids: {
        body: Body;
        surfaces: Compiled[];
        faces: Vec[][];
    }[];
};
export function bodyGeometry(d: Prescription, surfaces: Compiled[], bodies: Body[], sourceBody: Project['sourceBody'] = null, targetBody:Project['targetBody']=null): BodyGeometry {
    const result: BodyGeometry = { faces: [], edges: [], issues: [], solids: [] };
    const addFaces = (points: Vec[][], s: Compiled, material: ReportFace['material']) => { for (const ps of points) {
        result.faces.push({ points: ps, material, surfaceId: s.id, illustrative: false, bodyId: s.assemblyId ?? '@source' });
        result.edges.push({ points: [...ps, ps[0]], surfaceId: s.id, illustrative: false, bodyId: s.assemblyId ?? '@source' });
    } };
    for (const body of bodies) {
        const ss = surfaces.filter(s => s.assemblyId === body.assemblyId), s = ss[0];
        let error = '';
        let faces: Vec[][] = [];
        if (!s) {
            error = 'No optical Surface';
        }
        else if (body.kind === 'lens' || body.kind === 'array') {
            if (ss.length !== 2 || !compatiblePair(ss[0], ss[1]))
                error = 'Body needs two coaxial matching Surface frames';
            else if (ss.some(s => s.interaction !== 'refract') || (body.kind === 'lens' && ss.some(s => s.array)) || (body.kind === 'array' && ss.some(s => !s.array)))
                error = 'Body and Surface type mismatch';
            else {
                const outer = body.kind === 'lens' ? body.outerRadius : s.aperture;
                if (ss.some(s => s.aperture > outer || !!profileDomainIssue(s,outer)))
                    error = 'Outer radius must cover Clear Radius and remain inside the Surface sag domain';
                const cells = cellCenters(s);
                if (body.kind === 'array' && cells.some(c => Math.abs(c.u) + s.aperture > body.width / 2 + 1e-12 || Math.abs(c.v) + s.aperture > body.height / 2 + 1e-12))
                    error = 'Array substrate must cover all Lenslet clear apertures';
                const thickness = pointToLocal(s.world, ss[1].world.origin).x;
                if (!positiveThickness(ss[0],ss[1],thickness,outer))
                    error = 'Lens edge thickness or interior thickness is nonpositive / unresolved';
                if (!error && body.kind === 'lens') {
                    const front = surfaceRing({ ...s, aperture: outer }), back = surfaceRing({ ...ss[1], aperture: outer });
                    faces = front.map((p, i) => [p, front[(i + 1) % 48], back[(i + 1) % 48], back[i]]);
                    // Exact sag annuli join the optical clear cap to the supplied outer radius.
                    for (const cap of ss) {
                        const inner = surfaceRing(cap), outerRing = surfaceRing({ ...cap, aperture: outer });
                        for (let i = 0; i < 48; i++)
                            faces.push([inner[i], outerRing[i], outerRing[(i + 1) % 48], inner[(i + 1) % 48]]);
                    }
                }
                if (!error && body.kind === 'array') {
                    const corners = (x: number) => [V(x, -body.width / 2, -body.height / 2), V(x, body.width / 2, -body.height / 2), V(x, body.width / 2, body.height / 2), V(x, -body.width / 2, body.height / 2)].map(p => pointToWorld(s.world, p));
                    const a = corners(0), b = corners(thickness);
                    faces = [a, b, ...a.map((p, i) => [p, a[(i + 1) % 4], b[(i + 1) % 4], b[i]])];
                }
            }
        }
        else if (body.kind === 'mirror') {
            if (ss.length !== 1 || s.interaction !== 'reflect' || s.shape !== 'plane' || s.array)
                error = 'Mirror body needs one planar reflecting Surface';
            else {
                const front = body.outline === 'disc' ? surfaceRing({ ...s, aperture: body.width / 2 }) : [V(0, -body.width / 2, -body.height / 2), V(0, body.width / 2, -body.height / 2), V(0, body.width / 2, body.height / 2), V(0, -body.width / 2, body.height / 2)].map(p => pointToWorld(s.world, p));
                const back = front.map(p => sub(p, mul(s.world.axes[0], body.thickness)));
                faces = [front, back, ...front.map((p, i) => [p, front[(i + 1) % front.length], back[(i + 1) % front.length], back[i]])];
            }
        }
        else if (body.kind === 'prism') {
            // The optical side planes determine the profile; depth is supplied, never inferred from aperture.
            const shell = prismEnvelope(ss, 1);
            if (!shell)
                error = 'Prism body needs three compatible planar side faces';
            else if (ss.some(s => Math.abs(dot(sub(s.world.origin, ss[0].world.origin), ss[0].world.axes[2])) > 1e-10))
                error = 'Prism faces must share an extrusion center';
            else {
                const z = ss[0].world.axes[2], origin = ss[0].world.origin;
                faces = shell.map(ps => ps.map(p => add(p, mul(z, (Math.sign(dot(sub(p, origin), z)) * body.depth / 2) - dot(sub(p, origin), z)))));
            }
        }
        if (error) {
            result.issues.push(`${body.assemblyId}: ${error}`);
            continue;
        }
        addFaces(faces, s, body.kind === 'mirror' ? 'metal' : 'glass');
        result.solids.push({ body, surfaces: ss, faces });
    }
    for(const which of ['source','target'] as const){
        const body=which==='source'?sourceBody:targetBody;if(!body)continue;
        const f=which==='source'?frame(d.source.frame):surfaces.at(-1)!.world,r=body.radius;
        const ch=which==='source'?d.source.channels:{rows:1,cols:1,pitch:1};
        for(let row=0;row<ch.rows;row++)for(let col=0;col<ch.cols;col++){
            const u=(col-(ch.cols-1)/2)*ch.pitch,v=(row-(ch.rows-1)/2)*ch.pitch;
            const ring=(x:number)=>Array.from({length:48},(_,i)=>pointToWorld(f,V(x,u+r*Math.cos(i*Math.PI/24),v+r*Math.sin(i*Math.PI/24))));
            const a=ring(which==='source'?-body.length:0),b=ring(which==='source'?0:body.length);
            const id=which==='source'?'@source':surfaces.at(-1)!.id,aid=which==='source'?'@source':'@target';
            const fake={id,assemblyId:aid} as Compiled;
            addFaces([a,b,...a.map((p,i)=>[p,a[(i+1)%48],b[(i+1)%48],b[i]])],fake,'glass');
        }
    }
    return result;
}
export function insideBody(point: Vec, s: Compiled, geometry: BodyGeometry): boolean {
    const solid = geometry.solids.find(g => g.body.assemblyId === s.assemblyId);
    if (!solid)
        return true;
    const { body } = solid, p = pointToLocal(solid.surfaces[0].world, point), tol = 1e-10;
    if (body.kind === 'mirror')
        return body.outline === 'disc' ? Math.hypot(p.y, p.z) <= body.width / 2 + tol : Math.abs(p.y) <= body.width / 2 + tol && Math.abs(p.z) <= body.height / 2 + tol;
    if (body.kind === 'lens')
        return Math.hypot(p.y, p.z) <= body.outerRadius + tol;
    if (body.kind === 'array')
        return Math.abs(p.y) <= body.width / 2 + tol && Math.abs(p.z) <= body.height / 2 + tol;
    const points = solid.faces.flat(), center = mul(points.reduce(add, V()), 1 / points.length);
    return solid.faces.every(face => { const n = cross(sub(face[1], face[0]), sub(face[2], face[0])), sign = Math.sign(dot(n, sub(center, face[0]))); return dot(n, sub(point, face[0])) * sign >= -tol * norm(n); });
}
/** Clip display polygons against the same finite prism/mirror boundary used by the ray gate.
 * Surfaces remain circular analytical apertures; the visible patch is their intersection with the body. */
export function clipToBody(points: Vec[], surfaceId: string, geometry: BodyGeometry): Vec[] {
    const solid = geometry.solids.find(s => s.surfaces.some(s => s.id === surfaceId));
    if (!solid || !['mirror', 'prism'].includes(solid.body.kind))
        return points;
    const all = solid.faces.flat(), center = mul(all.reduce(add, V()), 1 / all.length);
    let polygon = points;
    for (const plane of solid.faces) {
        const normal = cross(sub(plane[1], plane[0]), sub(plane[2], plane[0])), size = norm(normal);
        if (size < 1e-24)
            continue;
        const n = mul(normal, Math.sign(dot(normal, sub(center, plane[0]))) / size), distance = (p: Vec) => dot(n, sub(p, plane[0]));
        const output: Vec[] = [];
        for (let i = 0; i < polygon.length; i++) {
            const a = polygon[i], b = polygon[(i + 1) % polygon.length], da = distance(a), db = distance(b), insideA = da >= -1e-11, insideB = db >= -1e-11;
            if (insideA)
                output.push(a);
            if (insideA !== insideB)
                output.push(add(a, mul(sub(b, a), da / (da - db))));
        }
        polygon = output;
        if (polygon.length < 3)
            return [];
    }
    return polygon;
}
