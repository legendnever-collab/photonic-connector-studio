import { test,expect } from 'vitest';
import { exampleDocument } from '../src/domain';
import { syntheticExample } from '../src/examples';
import { surfaceExample } from '../src/surface/examples';
import { compile,pointToLocal,pointToWorld,frame,pose,V,norm,sub } from '../src/surface/model';
import { projectExample,idealProject,prescription,parseProject,serializeProject,withPrescription,withMode,modes,ProjectSchema,projectFingerprint,gaussianForProject } from '../src/project/model';
import { bodyGeometry,insideBody,clipToBody } from '../src/project/geometry';
import { projectTrace } from '../src/project/compute';

test('common project round trips either authoritative model, preserving old imports without invented solids',()=>{
 const ideal=syntheticExample('pointing'),physical=surfaceExample('compound');
 const a=parseProject(JSON.stringify(ideal)),b=parseProject(JSON.stringify(physical));
 expect(a.model).toEqual({kind:'ideal',design:ideal});expect(b.model.kind).toBe('surface');expect(b.bodies).toEqual([]);expect(b.sourceBody).toBeNull();
 for(const p of [a,b,projectExample('compound')])expect(parseProject(serializeProject(p))).toEqual(p);
 expect(()=>parseProject(JSON.stringify({...a,extra:1}))).toThrow();
 expect(()=>parseProject(JSON.stringify({...b,bodies:[{kind:'prism',assemblyId:'missing',depth:.001}]}))).toThrow('Unknown body');
 expect(()=>parseProject(' '.repeat(2_000_001))).toThrow('2 MB');
});
test('Gaussian project Surface adapter preserves diameter, actual placement, source tilt and stable IDs',()=>{
 const p=idealProject(exampleDocument()),d=prescription(p),lens=p.model.kind==='ideal'?p.model.design.components.find(c=>c.kind==='lens')!:null;
 expect(lens?.kind).toBe('lens');if(lens?.kind!=='lens')throw Error();
 const s=d.surfaces.find(s=>s.id===lens.id)!;expect(s.aperture*2).toBe(lens.aperture);expect(s.shape).toBe('plane');expect(p.bodies).toEqual([]);
 const moved={...d,assemblies:d.assemblies.map(a=>a.id===lens.id?{...a,frame:pose(.004)}:a)};
 const next=withPrescription(p,moved);if(next.model.kind!=='ideal')throw Error();
 expect(next.model.design.components.find(c=>c.id===lens.id)!.frame.origin.x).toBe(.004);
 expect(next.model.design.components.find(c=>c.id===lens.id)).toMatchObject({kind:'lens',focalLength:lens.focalLength});
 expect(prescription(next).assemblies.find(a=>a.id===lens.id)!.frame.origin.x).toBe(.004);
 expect(()=>withPrescription(p,{...d,surfaces:d.surfaces.map(x=>x.id===s.id?{...x,shape:'sphere'}:x)})).toThrow('undefined');
});
test('Mode edits are separate from body dimensions and geometric source sampling',()=>{
 const p=projectExample('compound'),d=prescription(p),next=withMode(p,'source',{...modes(p).source,mfdX:20e-6,mfdY:30e-6});
 expect(prescription(next)).toEqual(d);expect(next.bodies).toEqual(p.bodies);expect(next.sourceBody).toEqual(p.sourceBody);
 expect(modes(parseProject(serializeProject(next))).source.mfdX).toBe(20e-6);
 expect(projectFingerprint(next)).not.toBe(projectFingerprint(p));expect(gaussianForProject(next).status).toBe('out-of-domain');
 const ideal=idealProject(syntheticExample('pointing')),g=gaussianForProject(ideal);expect(g.status).toBe('valid');if(g.status==='valid')expect(g.eta).toBeCloseTo(.924465,5);
});
for(const which of ['lens','mirror','prism','array','compound'] as const)test(`explicit ${which} example has compatible body geometry and full sampled reach`,()=>{
 const p=projectExample(which),d=prescription(p),ss=compile(d),geometry=bodyGeometry(d,ss,p.bodies,p.sourceBody);
 expect(geometry.issues).toEqual([]);expect(geometry.faces.length).toBeGreaterThan(0);expect(geometry.faces.every(f=>!f.illustrative)).toBe(true);
 const result=projectTrace(p);expect(result.status).toBe('valid');expect(result.reached).toBe(result.paths.length);expect(result.reached).toBeGreaterThan(0);
});
test('Mirror finite rectangle clips rays independently of unchanged circular clear aperture',()=>{
 const p=projectExample('mirror'),d=prescription(p),reduced={...p,bodies:p.bodies.map(b=>b.kind==='mirror'?{...b,outline:'rectangle' as const,width:.0001,height:.0001}:b)};
 expect(prescription(reduced)).toEqual(d);const t=projectTrace(reduced);expect(t.status).toBe('valid');expect(t.reached).toBe(1);expect(t.paths.filter(p=>p.reason.includes('body boundary clipping')).length).toBe(12);
 const geom=bodyGeometry(d,compile(d),reduced.bodies);expect(insideBody(pointToWorld(compile(d)[0].world,V(0,0,0)),compile(d)[0],geom)).toBe(true);
});
test('Prism extrusion depth sets rendered thickness and finite optical acceptance',()=>{
 const p=projectExample('prism'),small={...p,bodies:p.bodies.map(b=>b.kind==='prism'?{...b,depth:.00005}:b)},d=prescription(small),ss=compile(d),geometry=bodyGeometry(d,ss,small.bodies);
 expect(geometry.issues).toEqual([]);const prism=geometry.solids[0];
 const zs=prism.faces.flat().map(v=>pointToLocal(ss[0].world,v).z);expect(Math.max(...zs)-Math.min(...zs)).toBeCloseTo(.00005,12);
 const trace=projectTrace(small);expect(trace.reached).toBeLessThan(trace.paths.length);expect(trace.paths.some(p=>p.reason.includes('body boundary clipping'))).toBe(true);
});
test('body geometry rigidly follows nested Assembly frames, including prism extrusion',()=>{
 const p=projectExample('compound');if(p.model.kind!=='surface')throw Error();const d=prescription(p),ss=compile(d),before=bodyGeometry(d,ss,p.bodies).faces;
 const transform=pose(.001,.002,.003,.3,.2,.1);d.assemblies.push({id:'Root',name:'Root',kind:'group',parentId:null,frame:transform});d.assemblies.filter(a=>a.id!=='Root'&&!a.parentId).forEach(a=>a.parentId='Root');
 const after=bodyGeometry(d,compile(d),p.bodies).faces;expect(after).toHaveLength(before.length);
 for(let i=0;i<after.length;i++)for(let j=0;j<after[i].points.length;j++)expect(norm(sub(after[i].points[j],pointToWorld(frame(transform),before[i].points[j])))).toBeLessThan(1e-11);
});
test('incompatible lens edge/pose, array substrate or prism faces suppress current physical results',()=>{
 const p=projectExample('lens'),d=prescription(p);
 const broken=withPrescription(p,{...d,surfaces:d.surfaces.map((s,i)=>i===1?{...s,frame:{...s.frame,origin:{...s.frame.origin,x:.00001}}}:s)});
 expect(projectTrace(broken).status).toBe('invalid');expect(projectTrace(broken).reason).toContain('edge thickness');
 const array=projectExample('array'),small={...array,bodies:array.bodies.map(b=>b.kind==='array'?{...b,width:.0001}:b)};expect(projectTrace(small).reason).toContain('cover all Lenslet');
 const prism=projectExample('prism'),pr=prescription(prism);const nonplanar=withPrescription(prism,{...pr,surfaces:pr.surfaces.map((s,i)=>i===0?{...s,shape:'sphere'}:s)});expect(projectTrace(nonplanar).status).toBe('invalid');
 expect(ProjectSchema.safeParse({...p,bodies:[...p.bodies,...p.bodies]}).success).toBe(false);
});
test('source cylinder dimensions do not constrain rays launched at its reference plane',()=>{
 const p=projectExample('mirror'),changed={...p,sourceBody:{radius:.00001,length:.01}};
 expect(projectTrace(changed).paths).toEqual(projectTrace(p).paths);
});

test('report optical patches are clipped to the finite mirror/prism body used by ray acceptance',()=>{
 const p=projectExample('mirror'),d=prescription(p),s=compile(d)[0];
 p.bodies=p.bodies.map(b=>b.kind==='mirror'?{...b,outline:'rectangle',width:.0001,height:.0002}:b);
 const g=bodyGeometry(d,compile(d),p.bodies),polygon=[V(0,-.001,-.001),V(0,.001,-.001),V(0,.001,.001),V(0,-.001,.001)].map(p=>pointToWorld(s.world,p));
 const clipped=clipToBody(polygon,s.id,g);expect(clipped).toHaveLength(4);
 for(const point of clipped){expect(insideBody(point,s,g)).toBe(true);const local=pointToLocal(s.world,point);expect(Math.abs(local.y)).toBeCloseTo(.00005,12);expect(Math.abs(local.z)).toBeCloseTo(.0001,12);}
});
test('multi-channel source body repeats at the same channel pitch without using MFD as a diameter',()=>{
 const p=projectExample('compound'),d=prescription(p),ss=compile(d),g=bodyGeometry(d,ss,[],p.sourceBody);
 expect(g.faces.filter(f=>f.surfaceId==='@source')).toHaveLength(9*50);
 const local=g.faces.filter(f=>f.surfaceId==='@source').flatMap(f=>f.points).map(p=>pointToLocal(frame(d.source.frame),p));
 const lo=Math.min(...local.map(p=>p.y)),hi=Math.max(...local.map(p=>p.y));expect(hi-lo).toBeCloseTo(2*d.source.channels.pitch+2*p.sourceBody!.radius,12);
});

test('reducing a Prism clear aperture does not resize or invalidate its mechanical profile',()=>{
 const p=projectExample('prism'),d=prescription(p),before=bodyGeometry(d,compile(d),p.bodies).solids[0].faces;
 const next=withPrescription(p,{...d,surfaces:d.surfaces.map(s=>({...s,aperture:.000001}))}),nd=prescription(next);
 const after=bodyGeometry(nd,compile(nd),next.bodies);expect(after.issues).toEqual([]);expect(after.solids[0].faces).toEqual(before);expect(projectTrace(next).status).toBe('valid');expect(projectTrace(next).reached).toBe(1);
});

test('locked ideal components and ports retain their restrictions through shared adapters',()=>{
 const d=exampleDocument();d.components[0].locked=true;d.components[1].locked=true;const p=idealProject(d),pr=prescription(p);
 expect(()=>withPrescription(p,{...pr,assemblies:pr.assemblies.map((a,i)=>i===0?{...a,frame:pose(.004)}:a)})).toThrow('locked');
 expect(()=>withMode(p,'source',{...modes(p).source,mfdX:.00002})).toThrow('locked');
 expect(withPrescription(p,pr)).toEqual(p);
});
