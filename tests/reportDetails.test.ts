import {test,expect} from 'vitest';
import {fiberLensFiberProject} from '../src/authoring/starter';
import {routingExample} from '../src/routing/examples';
import {prescription,serializeProject} from '../src/project/model';
import {projectTrace} from '../src/project/compute';
import {bodyGeometry} from '../src/project/geometry';
import {reportGeometry} from '../src/surface/reportGeometry';
import {reportDetailRegions,reportBeamSamples,diameterText} from '../src/surface/reportDetails';
import {solvePhysicalGaussian} from '../src/project/physicalGaussian';
import {solveFoldedGaussian} from '../src/project/foldedGaussian';
import {norm,sub} from '../src/surface/model';

function regions(p:ReturnType<typeof fiberLensFiberProject>){const d=prescription(p),t=projectTrace(p),g=reportGeometry(d,t,false),b=bodyGeometry(d,t.surfaces,p.bodies);return reportDetailRegions(d,t,{faces:[...g.faces,...b.faces]},p);}
test('detail regions preserve exact Lens geometry, body diameter, thickness and signed radii without modifying Project',()=>{
 const p=fiberLensFiberProject(),before=serializeProject(p),r=regions(p);
 expect(r).toHaveLength(1);expect(r[0].surfaceIds).toHaveLength(2);expect(r[0].dimensions.join(' ')).toContain('t = 1.000 mm');expect(r[0].dimensions.join(' ')).toContain('-5.000 mm');expect(r[0].dimensions.join(' ')).toContain('Body Ø 2.400 mm');expect(serializeProject(p)).toBe(before);
});
test('Prism region uses supplied depth and actual world geometry, including rigid assembly translation',()=>{
 const p=routingExample('prism'),r=regions(p),prism=r.find(r=>r.dimensions.some(d=>d.includes('Prism depth')))!;
 expect(prism).toBeDefined();expect(prism.points.length).toBeGreaterThan(20);
 const d=prescription(p),assembly=d.assemblies.find(a=>a.id===prism.ids.at(-1))!;
 assembly.frame.origin.z+=.02;
 const after=regions(p).find(r=>r.ids.includes(assembly.id))!;
 expect(Math.min(...after.points.map(p=>p.z))-Math.min(...prism.points.map(p=>p.z))).toBeCloseTo(.02,8);
});
test('Report Beam adapter carries exact physical radii and world frame, no display enlargement',()=>{
 const p=fiberLensFiberProject(),g=solvePhysicalGaussian(p);expect(g.status).toBe('valid');if(g.status!=='valid')return;
 const samples=reportBeamSamples(g,null);expect(samples).toHaveLength(g.samples.length);expect(samples[0].radii).toEqual([g.samples[0].y.radius,g.samples[0].z.radius]);expect(diameterText(samples[0])).toContain('9.200');
 expect(norm(sub(samples[0].point,prescription(p).source.frame.origin))).toBeLessThan(1e-12);
});
test('Folded reference preserves transported ellipse axes and undefined fields do not gain a Beam',()=>{
 const p=routingExample('prism'),physical=solvePhysicalGaussian(p),folded=solveFoldedGaussian(p);expect(folded.status).toBe('valid');if(folded.status!=='valid')return;
 const samples=reportBeamSamples(physical,folded);expect(samples.at(-1)!.radii).toEqual(folded.samples.at(-1)!.beam.radii);expect(samples.at(-1)!.point).toEqual(folded.samples.at(-1)!.point);
 expect(reportBeamSamples({status:'invalid',id:'x',fingerprint:'x',reason:'undefined'},null)).toEqual([]);
});
test('nearby Lens components group, separated regions remain independently addressable, and absent bodies stay explicit',()=>{
 const p=fiberLensFiberProject();if(p.model.kind!=='surface')return;const d=p.model.prescription,original=d.assemblies.find(a=>a.kind==='lens')!,lensSurfaces=d.surfaces.filter(s=>s.assemblyId===original.id),b=p.bodies[0];
 for(const [i,delta] of [[1,.0011],[2,.005]] as const){const id='copy'+i;d.assemblies.push({...structuredClone(original),id,frame:{...structuredClone(original.frame),origin:{...original.frame.origin,x:original.frame.origin.x+delta}}});d.surfaces.splice(d.surfaces.length-1,0,...lensSurfaces.map(s=>({...structuredClone(s),id:s.id+id,assemblyId:id})));p.bodies.push({...structuredClone(b),assemblyId:id});}
 const r=regions(p);expect(r).toHaveLength(2);expect(r[0].ids).toHaveLength(2);expect(r[0].measurements).toHaveLength(4);expect(r[1].ids).toEqual(['copy2']);
 p.bodies=[];expect(regions(p).flatMap(r=>r.dimensions).join(' ')).toContain('Body undefined');
});
