import { V, add, sub, mul, dot, norm, unit, pointToWorld, pointToLocal, cellCenters, sag } from './model';
import type { Compiled, Prescription, Vec } from './model';
import type { Trace } from './trace';
import { surfaceRing } from './trace';

export type ReportFace = { points: Vec[]; material: 'glass' | 'metal' | 'probe'; surfaceId: string; illustrative: boolean };
export type ReportEdge = { points: Vec[]; surfaceId: string; illustrative: boolean };
export type ReportGeometry = { faces: ReportFace[]; edges: ReportEdge[]; inferred: string[] };
export const cross = (a: Vec, b: Vec) => V(a.y*b.z-a.z*b.y, a.z*b.x-a.x*b.z, a.x*b.y-a.y*b.x);

/** Optical caps and paired rims use the compiled world frames, including nested assembly poses.
 * Inferred prism/mirror envelopes are presentation geometry only, never sent to the tracer. */
export function reportGeometry(doc: Prescription, trace: Trace, envelopes: boolean): ReportGeometry {
    const faces: ReportFace[] = [], edges: ReportEdge[] = [], inferred: string[] = [];
    const cells = trace.surfaces.reduce((n,s) => n+cellCenters(s).length,0);
    const steps = cells > 1000 ? 8 : cells > 100 ? 16 : 48, rings = cells > 100 ? 1 : 4;
    const face = (points: Vec[], s: Compiled, material: ReportFace['material'], illustrative = false) => faces.push({ points, material, surfaceId:s.id, illustrative });
    const edge = (points: Vec[], s: Compiled, illustrative = false) => edges.push({ points, surfaceId:s.id, illustrative });
    for (const s of trace.surfaces) {
        const material = s.interaction === 'probe' ? 'probe' : s.interaction === 'reflect' ? 'metal' : 'glass';
        for (const c of cellCenters(s)) {
            const at = (r: number, i: number) => { const t = i/steps*Math.PI*2, y = r*Math.cos(t), z = r*Math.sin(t); return pointToWorld(s.world,V(sag(s,y,z),c.u+y,c.v+z)); };
            if(s.shape==='plane')face(surfaceRing(s,c.u,c.v,steps),s,material);
            else for(let j=0;j<rings;j++) for(let i=0;i<steps;i++) {
                const r0=s.aperture*j/rings,r1=s.aperture*(j+1)/rings;
                face(j ? [at(r0,i),at(r1,i),at(r1,i+1),at(r0,i+1)] : [at(0,0),at(r1,i),at(r1,i+1)],s,material);
            }
            const ring = surfaceRing(s,c.u,c.v,steps); edge([...ring,ring[0]],s);
            // Thin metal backing is an explicitly illustrative thickness.
            if (envelopes && s.interaction === 'reflect') {
                const back = ring.map(p=>sub(p,mul(s.world.axes[0],s.aperture*.16)));
                for(let i=0;i<steps;i++)face([ring[i],ring[(i+1)%steps],back[(i+1)%steps],back[i]],s,'metal',true);
                face([...back].reverse(),s,'metal',true);edge([...back,back[0]],s,true);inferred.push(s.id);
            }
        }
    }
    for(const a of doc.assemblies) {
        const ss=trace.surfaces.filter(s=>s.assemblyId===a.id);
        if(['lens','array'].includes(a.kind) && ss.length===2 && compatiblePair(ss[0],ss[1])) {
            for(const c of cellCenters(ss[0])) {
                const front=surfaceRing(ss[0],c.u,c.v,steps), back=surfaceRing(ss[1],c.u,c.v,steps);
                for(let i=0;i<steps;i++)face([front[i],front[(i+1)%steps],back[(i+1)%steps],back[i]],ss[0],'glass');
            }
        }
        if(envelopes && a.kind==='prism') {
            const shell=prismEnvelope(ss);
            if(shell) { shell.forEach(points=>{face(points,ss[0],'glass',true);edge([...points,points[0]],ss[0],true);});inferred.push(a.id); }
        }
    }
    return {faces,edges,inferred:[...new Set(inferred)]};
}
// Do not invent a body joining independent, tilted or mismatched lenslets.
export function compatiblePair(a: Compiled,b: Compiled) {
    const delta=pointToLocal(a.world,b.world.origin);
    return Math.abs(delta.y)<1e-10 && Math.abs(delta.z)<1e-10 && delta.x>0 &&
        a.world.axes.every((axis,i)=>dot(axis,b.world.axes[i])>1-1e-10) &&
        JSON.stringify(a.array)===JSON.stringify(b.array);
}
/** Three planar side faces with a common transverse extrusion axis define an illustrative
 * triangular prism. Aperture disks are retained separately. Other configurations fall back to caps. */
export function prismEnvelope(ss: Compiled[]): Vec[][] | null {
    if(ss.length!==3 || ss.some(s=>s.shape!=='plane'||s.array))return null;
    const z=ss[0].world.axes[2];
    if(ss.some(s=>Math.abs(dot(s.world.axes[0],z))>1e-8))return null;
    const origin=ss[0].world.origin, x=ss[0].world.axes[0], y=unit(cross(z,x));
    const planes=ss.map(s=>({a:dot(s.world.axes[0],x),b:dot(s.world.axes[0],y),c:dot(s.world.axes[0],sub(s.world.origin,origin))}));
    const vertices:Vec[]=[];
    for(const [i,j] of [[0,1],[1,2],[2,0]]) {
        const p=planes[i],q=planes[j],det=p.a*q.b-q.a*p.b;
        if(Math.abs(det)<1e-8)return null;
        const u=(p.c*q.b-q.c*p.b)/det,v=(p.a*q.c-q.a*p.c)/det;
        vertices.push(add(origin,add(mul(x,u),mul(y,v))));
    }
    const span=Math.max(...ss.map(s=>s.aperture)), center=mul(vertices.reduce(add,V()),1/3);
    if(vertices.some(v=>norm(sub(v,center))>span*20) || norm(cross(sub(vertices[1],vertices[0]),sub(vertices[2],vertices[0])))<1e-20)return null;
    // Every optical vertex must lie on its triangular side segment; no extrapolated wedge.
    for(let i=0;i<3;i++) {
        const on=vertices.filter(v=>Math.abs(dot(ss[i].world.axes[0],sub(v,ss[i].world.origin)))<1e-9);
        if(on.length!==2)return null;
        const segment=sub(on[1],on[0]),t=dot(sub(ss[i].world.origin,on[0]),segment)/dot(segment,segment);
        if(t<-.00001||t>1.00001)return null;
    }
    const low=vertices.map(v=>sub(v,mul(z,span))),high=vertices.map(v=>add(v,mul(z,span)));
    return [low,high,...low.map((v,i)=>[v,low[(i+1)%3],high[(i+1)%3],high[i]])];
}

/** Convex hull indices, used only for a sampled geometric bundle silhouette. */
export function hullIndices(points:{x:number;y:number}[]):number[] {
    const ids=points.map((_,i)=>i).sort((a,b)=>points[a].x-points[b].x||points[a].y-points[b].y);
    if(ids.length<3)return ids;
    const turn=(a:number,b:number,c:number)=>(points[b].x-points[a].x)*(points[c].y-points[a].y)-(points[b].y-points[a].y)*(points[c].x-points[a].x);
    const half=(list:number[])=>{const h:number[]=[];for(const i of list){while(h.length>=2&&turn(h.at(-2)!,h.at(-1)!,i)<=0)h.pop();h.push(i);}return h;};
    return [...half(ids).slice(0,-1),...half([...ids].reverse()).slice(0,-1)];
}
