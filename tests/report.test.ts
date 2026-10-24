import { expect, test } from 'vitest';
import { surfaceExample } from '../src/surface/examples';
import { compile, V, pose, frame, pointToWorld, norm, sub } from '../src/surface/model';
import { tracePrescription } from '../src/surface/trace';
import { compatiblePair, hullIndices, prismEnvelope, reportGeometry } from '../src/surface/reportGeometry';

test('report caps follow nested world transforms, not a separate pixel model',()=>{
    const d=surfaceExample('lens'),before=JSON.stringify(d),t=tracePrescription(d),g=reportGeometry(d,t,false);
    expect(JSON.stringify(d)).toBe(before);
    const cap=g.faces.find(f=>f.surfaceId===d.surfaces[0].id)!;
    expect(norm(sub(cap.points[0],t.surfaces[0].world.origin))).toBeLessThan(1e-14);
    const parent={id:'Rotated',name:'Rotated',kind:'group' as const,parentId:null,frame:pose(.002,.003,.001,.2,.3)};
    d.assemblies.push(parent);d.assemblies.filter(a=>a.id!==parent.id).forEach(a=>{a.parentId=parent.id;});
    const rotated=reportGeometry(d,{...t,surfaces:compile(d)},false).faces;
    for(let i=0;i<g.faces.length;i++) for(let j=0;j<g.faces[i].points.length;j++)
        expect(norm(sub(rotated[i].points[j],pointToWorld(frame(parent.frame),g.faces[i].points[j])))).toBeLessThan(1e-12);
});
test('inferred prism and mirror envelopes can be disabled without changing optical geometry or rays',()=>{
    const d=surfaceExample('compound'),before=JSON.stringify(tracePrescription(d)),t=tracePrescription(d);
    const off=reportGeometry(d,t,false),on=reportGeometry(d,t,true);
    expect(off.inferred).toEqual([]);expect(on.inferred).toEqual(expect.arrayContaining(['Prism','M1']));
    expect(on.faces.filter(f=>!f.illustrative)).toEqual(off.faces);
    expect(on.edges.filter(f=>!f.illustrative)).toEqual(off.edges);
    expect(JSON.stringify(tracePrescription(d))).toBe(before);
    const prism=t.surfaces.filter(s=>s.assemblyId==='Prism');
    expect(prismEnvelope(prism)).toHaveLength(5);
    expect(prismEnvelope(prism.slice(0,2))).toBeNull();
    expect(prismEnvelope(prism.map(s=>({...s,shape:'sphere'})))).toBeNull();
});
test('unrelated lens surfaces do not silently become a solid lens',()=>{
    const d=surfaceExample('lens'),[a,b]=compile(d);
    expect(compatiblePair(a,b)).toBe(true);
    expect(compatiblePair(a,{...b,world:{...b.world,origin:{...b.world.origin,y:1e-4}}})).toBe(false);
    expect(compatiblePair(a,{...b,array:{rows:2,cols:2,pitch:.002}})).toBe(false);
    expect(compatiblePair(a,{...b,world:{...b.world,axes:[V(0,1),V(-1),V(0,0,1)]}})).toBe(false);
});
test('sampled ray silhouette excludes interior and collinear points',()=>{
    const pts=[{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1},{x:.5,y:.5},{x:.5,y:0}];
    expect(new Set(hullIndices(pts))).toEqual(new Set([0,1,2,3]));
    expect(hullIndices([])).toEqual([]);expect(hullIndices([{x:1,y:1}])).toEqual([0]);
});
