import { expect, test } from 'vitest';
import { frame, pose, compile, pointToWorld, vectorToWorld, norm, sub } from '../src/surface/model';
import { parseProject, serializeProject, projectExample, prescription, withMode, modes, projectFingerprint, idealProject, ProjectSchema, withPrescription } from '../src/project/model';
import { newPhysicalProject, rowCommand, groupSurfaces, spacing, withThickness, templateSignature, framePose } from '../src/authoring/commands';
import { insertBlock } from '../src/project/insertion';
import { projectTrace } from '../src/project/compute';
import { unknownAuthoring } from '../src/authoring/contract';
test('new physical document uses the requested nominal SMF input and keeps the output mode undefined and labels the air diagnostic separately',()=>{
 const p=newPhysicalProject(),d=prescription(p);expect(d.surfaces).toHaveLength(1);expect(d.source.n).toBe(1);expect(d.surfaces[0].nBefore).toBeNull();expect(modes(p).source.mfdX).toBe(9.2e-6);expect(modes(p).source.mfdY).toBe(9.2e-6);expect(p.authoring?.ports.source.phase).toBe('waist-plane');expect(p.authoring?.ports.source.normalization).toBe('unit-power');expect(p.authoring?.ports.target.powerW).toBeNull();expect(projectTrace(p).paths).toEqual([]);expect(projectTrace(p).reason).toContain('Draft');expect(parseProject(serializeProject(p))).toEqual(p);
});
test.each(['lens','mirror','prism','array','single-surface','blank'] as const)('component path %s preserves port world poses and mode data in one document',kind=>{
 let p=newPhysicalProject();p=withMode(p,'source',{...modes(p).source,mfdX:10e-6,mfdY:11e-6});const before=prescription(p),target=compile(before).at(-1)!.world,copy=serializeProject(p),r=insertBlock(p,kind,pose(.002,.001,-.001,.3,.2,.1),'u1-test',before.surfaces.at(-1)!.id);
 expect(prescription(r.project).source).toEqual(before.source);expect(compile(prescription(r.project)).at(-1)!.world).toEqual(target);expect(modes(r.project)).toEqual(modes(p));expect(serializeProject(p)).toEqual(copy);expect(parseProject(serializeProject(r.project))).toEqual(r.project);
});
test('draft rows support insert duplicate delete while retaining output and explicit unresolved media',()=>{
 const p=projectExample('lens'),a=rowCommand(p,'L1-front','before','a'),b=rowCommand(a.project,a.selection,'duplicate','b'),c=rowCommand(b.project,b.selection,'delete','c');
 expect(prescription(c.project)).toEqual(prescription(a.project));expect(projectTrace(a.project).paths).toEqual([]);expect(projectTrace(a.project).reason).toContain('Draft');expect(()=>rowCommand(p,'Target','after','bad')).toThrow('protected');expect(()=>rowCommand(p,'Target','delete','bad')).toThrow('protected');
});
test('paired thickness changes rear along the rotated front frame and leaves ports and downstream fixed',()=>{
 const p=projectExample('lens'),d=prescription(p);d.assemblies[0].frame=pose(.002,.003,.004,.7,-.2,.4);const before=compile(d),next=withThickness(p,'L1-front',.0015),after=compile(prescription(next));
 expect(after[0].world).toEqual(before[0].world);expect(after[2].world).toEqual(before[2].world);expect(norm(sub(after[1].world.origin,pointToWorld(before[0].world,{x:.0015,y:0,z:0})))).toBeLessThan(1e-14);expect(spacing(next,'L1-front')?.axial).toBeCloseTo(.0015,14);expect(spacing(p,'L1-back')?.editable).toBe(false);expect(()=>withThickness(p,'L1-back',.001)).toThrow('Derived');
});
test('grouping a nested folded train preserves every world position and orientation without X sorting',()=>{
 const p=projectExample('compound'),d=prescription(p);d.assemblies.find(a=>a.id==='Module')!.frame=pose(.02,.01,-.03,.4,-.7,.2);const before=compile(d),ids=['P-entry','P-TIR','P-exit','M1'],next=groupSurfaces(p,ids,'group','folded'),after=compile(prescription(next));expect(after.map(s=>s.id)).toEqual(before.map(s=>s.id));for(let i=0;i<before.length;i++){expect(norm(sub(after[i].world.origin,before[i].world.origin))).toBeLessThan(1e-14);for(let a=0;a<3;a++)expect(norm(sub(after[i].world.axes[a],before[i].world.axes[a]))).toBeLessThan(1e-14);}expect(()=>groupSurfaces(p,['P-entry','M1'],'lens','bad')).toThrow('consecutive');
});
test.each([pose(0,0,0,.7,.5,-.8),pose(0,0,0,.8,Math.PI/2,.3),pose(0,0,0,-.2,-Math.PI/2,.6)])('Euler extraction preserves gimbal frames',p=>{const a=frame(p),b=frame(framePose(a));for(let i=0;i<3;i++)expect(norm(sub(a.axes[i],b.axes[i]))).toBeLessThan(1e-12);expect(norm(sub(vectorToWorld(a,{x:1,y:2,z:3}),vectorToWorld(b,{x:1,y:2,z:3})))).toBeLessThan(1e-12);});
test('catalog geometry becomes Custom after shape edits; port pose and view state are not template geometry',()=>{
 const p=projectExample('lens'),r=insertBlock(p,'lens',pose(.004),'custom','L1-back').project,d=prescription(r),aid=d.surfaces.find(s=>s.id==='L1-front-custom')!.assemblyId;expect(r.authoring?.templates[aid]).toBe(templateSignature(r,aid));const n=withPrescription(r,{...d,surfaces:d.surfaces.map(s=>s.id==='L1-front-custom'?{...s,radius:.006}:s)});expect(n.authoring?.templates[aid]).not.toBe(templateSignature(n,aid));
});
test('legacy files roundtrip without silently adding port physics and new contract hashes track changes',()=>{
 const p=projectExample('lens');expect(parseProject(serializeProject(p))).toEqual(p);expect(parseProject(serializeProject(p)).authoring).toBeUndefined();const a={...p,authoring:unknownAuthoring()},b=structuredClone(a);b.authoring.ports.source.phase='waist-plane';expect(projectFingerprint(a)).not.toBe(projectFingerprint(b));b.authoring.ports.target.fieldModel='imported-complex';expect(b.authoring.ports.target.imported).toBeNull();expect(ProjectSchema.safeParse(b).success).toBe(true);
});
test('ideal insertion is after selected component and cannot automatically migrate physical elements',()=>{const p=idealProject(),r=insertBlock(p,'lens',pose(.005),'position','lens-f');if(r.project.model.kind!=='ideal')throw Error();expect(r.project.model.design.components[2].id).toBe(r.selection);expect(()=>insertBlock(p,'prism',pose(.005),'bad','lens-f')).toThrow('Physical');});
test('user Building Block preserves edited surfaces and body through save/load, insertion and Port poses',async()=>{
 const {saveBuildingBlock,insertBuildingBlock}=await import('../src/authoring/commands');const p=projectExample('lens'),d=prescription(p);d.surfaces[0].radius=.006;const stored=saveBuildingBlock(p,'L1-front','saved'),round= parseProject(serializeProject(stored));expect(round.buildingBlocks?.[0].surfaces[0].radius).toBe(.006);
 const result=insertBuildingBlock(round,round.buildingBlocks![0].id,pose(.004,.001,0,.3),'L1-back','reuse'),next=prescription(result.project);expect(next.surfaces).toHaveLength(5);expect(next.surfaces[2].radius).toBe(.006);expect(compile(next).at(-1)?.world).toEqual(compile(d).at(-1)?.world);expect(result.project.bodies.at(-1)?.assemblyId).toBe(next.surfaces[2].assemblyId);expect(serializeProject(round)).toBe(serializeProject(stored));
});
test('unsupported imported or confined Port contract suppresses legacy Gaussian coupling instead of reusing its MFD',async()=>{const {gaussianForProject}=await import('../src/project/model');const p=idealProject();p.authoring=unknownAuthoring();p.authoring.ports.source.fieldModel='imported-complex';expect(gaussianForProject(p).status).toBe('out-of-domain');});
test('SMF reference is explicit, editable and leaves Output Mode and Port poses unchanged',async()=>{
 const {applySmfReference,isNominalSmf}=await import('../src/authoring/smf');const p=projectExample('mirror'),d=prescription(p),next=applySmfReference(p);
 expect(isNominalSmf(next)).toBe(true);expect(modes(next).target).toEqual(modes(p).target);expect(prescription(next).source).toEqual(d.source);expect(compile(prescription(next)).at(-1)?.world).toEqual(compile(d).at(-1)?.world);expect(next.authoring?.ports.source.powerW).toBeNull();expect(modes(p).source.mfdX).toBeNull();expect(parseProject(serializeProject(next))).toEqual(next);expect(isNominalSmf(withMode(next,'source',{...modes(next).source,mfdX:10e-6}))).toBe(false);
 const changed=withPrescription(next,{...prescription(next),wavelength:1550e-9});expect(modes(changed).source.mfdX).toBe(9.2e-6);expect(isNominalSmf(changed)).toBe(false);
});
