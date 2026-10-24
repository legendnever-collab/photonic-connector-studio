import { test, expect } from 'vitest';
import { insertBlock } from '../src/project/insertion';
import { idealProject, projectExample, parseProject, serializeProject } from '../src/project/model';
import { pose, compile } from '../src/surface/model';
import { projectTrace } from '../src/project/compute';
for(const kind of ['lens','mirror','prism','array','probe'] as const)test(`insert ${kind} retains input, body, world placement and target`,()=>{
 const original=projectExample('mirror');if(original.model.kind!=='surface')throw Error();
 const saved=structuredClone(original),placement=pose(.0012,.0023,-.0004,.2,-.1,.3);
 const result=insertBlock(original,kind,placement,'unit-test','M1'),p=result.project;
 expect(original).toEqual(saved);expect(p.bodies.slice(0,original.bodies.length)).toEqual(original.bodies);
 if(p.model.kind!=='surface')throw Error();
 expect(p.model.prescription.surfaces.at(-1)).toEqual(original.model.prescription.surfaces.at(-1));
 expect(p.model.prescription.assemblies.at(-1)?.frame).toEqual(placement);
 expect(compile(p.model.prescription).find(s=>s.id===result.selection)?.world.origin).toEqual(placement.origin);
 expect(parseProject(serializeProject(p))).toEqual(p);expect(projectTrace(p).surfaces).toHaveLength(p.model.prescription.surfaces.length);
});
test('prism insertion is one contiguous sequence after selected block with unique IDs',()=>{
 const original=projectExample('prism'),first=insertBlock(original,'prism',pose(.001),'one','P-entry');
 const second=insertBlock(first.project,'prism',pose(.002),'two',first.selection);
 if(second.project.model.kind!=='surface')throw Error();
 const ss=second.project.model.prescription.surfaces;expect(ss.slice(3,6).map(s=>s.id)).toEqual(['P-entry-one','P-TIR-one','P-exit-one']);
 expect(new Set(ss.map(s=>s.id)).size).toBe(ss.length);expect(ss.at(-1)?.id).toBe('Target');
});
test('ideal insertion retains validated model class and exact focal length semantics',()=>{
 const original=idealProject(),p=insertBlock(original,'lens',pose(.005),'ideal','lens-f').project;
 expect(p.model.kind).toBe('ideal');if(p.model.kind!=='ideal')throw Error();
 const c=p.model.design.components.find(c=>c.id==='Block-ideal');expect(c?.frame.origin.x).toBe(.005);expect(c?.kind).toBe('lens');expect(p.bodies).toEqual([]);
 expect(()=>insertBlock(original,'prism',pose(.005),'physical','lens-f')).toThrow('Physical Block');
});
test('invalid insertion is rejected transactionally without mutating original document',()=>{
 const original=projectExample('lens'),copy=serializeProject(original);
 expect(()=>insertBlock(original,'mirror',pose(2),'bad','L1-back')).toThrow();expect(serializeProject(original)).toBe(copy);
});
