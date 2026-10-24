import {test,expect} from 'vitest';
import {fiberLensFiberProject} from '../src/authoring/starter';
import {applySmfReference} from '../src/authoring/smf';
import {newPhysicalProject} from '../src/authoring/commands';
import {materialIndex} from '../src/surface/materials';
import {prescription,modes,withPrescription,serializeProject,parseProject,projectExample} from '../src/project/model';
import {compile,pointToLocal,pose} from '../src/surface/model';
import {bodyGeometry} from '../src/project/geometry';
import {projectTrace} from '../src/project/compute';
test('starter is Input Fiber, one two-surface BK7 Lens, and Output Fiber at exactly 10 mm',()=>{
 const p=fiberLensFiberProject(),d=prescription(p),ss=compile(d);
 expect(d.surfaces.map(s=>s.id)).toEqual(['S1','S2','Output-Port']);expect(d.surfaces[0].assemblyId).toBe(d.surfaces[1].assemblyId);expect(d.surfaces[0].materialAfter).toBe('N-BK7');expect(d.surfaces[1].materialBefore).toBe('N-BK7');expect(d.surfaces[0].nAfter).toBe(d.surfaces[1].nBefore);expect(ss[0].world.origin.x).toBe(.0045);expect(ss[1].world.origin.x).toBeCloseTo(.0055,14);expect(ss.at(-1)!.world.origin.x-d.source.frame.origin.x).toBe(.01);expect(modes(p).target.mfdX).toBe(modes(p).source.mfdX);expect(p.sourceBody?.radius).toBe(62.5e-6);expect(p.targetBody?.radius).toBe(62.5e-6);expect(projectTrace(p).status).toBe('valid');expect(parseProject(serializeProject(p))).toEqual(p);
});
test.each([[587.6,1.51680],[1060,1.50669],[1529.6,1.50091],[2325.4,1.48921]])('BK7 dispersion agrees with independent SCHOTT table at %s nm', (nm,n)=>{expect(materialIndex('N-BK7',nm*1e-9)).toBeCloseTo(n,5);});
test('BK7 wavelength changes, paired manual n overrides, and explicit material reset are coherent',()=>{
 const p=fiberLensFiberProject(),d=prescription(p),changed=withPrescription(p,{...d,wavelength:1550e-9}),nd=prescription(changed);
 expect(nd.surfaces[0].nAfter).toBeCloseTo(1.500652,6);expect(nd.surfaces[1].nBefore).toBe(nd.surfaces[0].nAfter);
 const manual=withPrescription(p,{...d,surfaces:d.surfaces.map(s=>s.id==='S1'?{...s,nAfter:1.6}:s)}),md=prescription(manual);expect(md.surfaces[0].materialAfter).toBeUndefined();expect(md.surfaces[1].materialBefore).toBeUndefined();expect(md.surfaces[1].nBefore).toBe(1.6);
 const reset=withPrescription(manual,{...md,surfaces:md.surfaces.map(s=>s.id==='S1'?{...s,materialAfter:'N-BK7'}:s)});expect(prescription(reset).surfaces[1].materialBefore).toBe('N-BK7');expect(prescription(reset).surfaces[1].nBefore).toBe(prescription(reset).surfaces[0].nAfter);
 const bad=JSON.parse(serializeProject(p));bad.model.prescription.surfaces[0].nAfter=1.6;expect(()=>parseProject(JSON.stringify(bad))).toThrow('Material');expect(()=>withPrescription(p,{...d,wavelength:5e-6})).toThrow('300');
});
test('both Fiber bodies follow their frames and occupy opposite sides of their facet planes',()=>{
 const p=fiberLensFiberProject(),d=prescription(p);d.assemblies.find(a=>a.id==='Output')!.frame=pose(.01,.002,-.001,.7,.3,-.2);const ss=compile(d),g=bodyGeometry(d,ss,p.bodies,p.sourceBody,p.targetBody);expect(g.issues).toEqual([]);
 const f=ss.at(-1)!.world,output=g.faces.filter(x=>x.bodyId==='@target').flatMap(x=>x.points).map(p=>pointToLocal(f,p));expect(Math.min(...output.map(p=>p.x))).toBeCloseTo(0,14);expect(Math.max(...output.map(p=>p.x))).toBeCloseTo(.001,14);expect(Math.max(...output.map(p=>Math.hypot(p.y,p.z)))).toBeCloseTo(62.5e-6,14);
 const input=g.faces.filter(x=>x.bodyId==='@source').flatMap(x=>x.points);expect(Math.min(...input.map(p=>p.x))).toBe(-.001);expect(Math.max(...input.map(p=>p.x))).toBe(0);
 const noBody={...p,sourceBody:null,targetBody:null};expect(projectTrace(noBody).paths).toEqual(projectTrace(p).paths);
});
test('Output SMF template preserves Input Mode and both poses, and old files remain unchanged',()=>{
 const p=newPhysicalProject(),d=prescription(p),next=applySmfReference(p,'target');expect(modes(next).source).toEqual(modes(p).source);expect(modes(next).target.mfdX).toBe(9.2e-6);expect(compile(prescription(next)).at(-1)!.world).toEqual(compile(d).at(-1)!.world);expect(prescription(next).source).toEqual(d.source);const legacy=projectExample('lens');expect(parseProject(serializeProject(legacy))).toEqual(legacy);expect(parseProject(serializeProject(legacy)).targetBody).toBeUndefined();
});
