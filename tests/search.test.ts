import {expect,test} from 'vitest';
import {searchRouting,applyCandidate,searchRoutingAsync,solutionDesignFingerprint} from '../src/routing/search';
import {defaultSearchOptions} from '../src/routing/contract';
import {routingExample} from '../src/routing/examples';
import {withPortWorld,portWorld} from '../src/routing/model';
import {framePose} from '../src/authoring/commands';
import {V,pose,frame,compose,dot,compile} from '../src/surface/model';
import {serializeProject,parseProject,idealProject,withPrescription} from '../src/project/model';
import {fiberLensFiberProject} from '../src/authoring/starter';
import {lineBox} from '../src/routing/clearance';
import {materialIndex} from '../src/surface/materials';
import type {Project} from '../src/project/model';
const opts=defaultSearchOptions;
const doc=(p:Project)=>{if(p.model.kind!=='surface')throw Error('Physical required');return p.model.prescription;};
test('first bounded Mirror search preserves the baseline and closes a displaced Output',()=>{
 let p=routingExample('mirrors');p=withPortWorld(p,'target',{...framePose(portWorld(p,'target')),origin:V(.01,80e-6,50e-6)});
 const raw=serializeProject(p),r=searchRouting(p);
 expect(r.candidates.length).toBeGreaterThan(0);expect(serializeProject(p)).toBe(raw);expect(r.candidates.some(c=>c.topology==='mirror2')).toBe(true);
 const next=applyCandidate(p,r,r.candidates[0].id);expect(portWorld(next,'target')).toEqual(portWorld(p,'target'));expect(next.routing!.solution!.designFingerprint).toBe(solutionDesignFingerprint(next));
});
test('mixed Mirror / Prism candidates remain available for topology comparison',()=>{
 const r=searchRouting(routingExample('search'),{...opts(),templates:['mirror-prism']});expect(r.candidates.length).toBeGreaterThan(0);expect(r.candidates[0].topology).toBe('mirror-prism');
 const all=searchRouting(routingExample('search'));expect(all.candidates.some(c=>c.topology==='mirror-prism')).toBe(true);
});
test('Direct and single Mirror constructive solutions agree with independent path lengths',()=>{
 const p=fiberLensFiberProject(),r=searchRouting(p,{...opts(),templates:['direct']});expect(r.candidates).toHaveLength(1);expect(r.candidates[0].partCount).toBe(0);expect(r.candidates[0].length).toBeCloseTo(.01,13);
 const q=routingExample('prism'),m=searchRouting(q,{...opts(),templates:['mirror1']});expect(m.candidates.length).toBeGreaterThan(0);const c=m.candidates[0];expect(c.length).toBeCloseTo(.00404+60e-6,13);
 expect(c.analysis.path!.opl).toBeCloseTo(.00404+60e-6+(materialIndex('N-BK7',doc(q).wavelength)-1)*.0005,13);
});
test('3D skew Port position and roll/pitch/yaw remain fixed through a two-Mirror solution',()=>{
 let p=routingExample('search');p.routing!.bounds=null;p=withPortWorld(p,'target',pose(.008,.001,.0004,.3,-.2,.7));const r=searchRouting(p,{...opts(),templates:['mirror2']});expect(r.candidates.length).toBeGreaterThan(0);
 const q=applyCandidate(p,r,r.candidates[0].id);expect(portWorld(q,'source')).toEqual(portWorld(p,'source'));expect(portWorld(q,'target')).toEqual(portWorld(p,'target'));expect(r.candidates[0].analysis.positionError).toBeLessThan(1e-12);expect(r.candidates[0].analysis.angleError).toBeLessThan(1e-10);
});
test('single Mirror solution and its OPL are covariant under an arbitrary rigid rotation / translation',()=>{
 const p=routingExample('prism'),baseline=searchRouting(p,{...opts(),templates:['mirror1']}),d=doc(p),global=pose(.02,-.01,.03,.5,-.3,.4),g=frame(global);p.routing!.bounds=null;
 d.source.frame=framePose(compose(g,frame(d.source.frame)));d.assemblies.push({id:'Global',name:'Global',kind:'group',parentId:null,frame:global});d.assemblies=d.assemblies.map(a=>a.id!=='Global'&&!a.parentId?{...a,parentId:'Global'}:a);
 const r=searchRouting(p,{...opts(),templates:['mirror1']});expect(r.candidates.length).toBeGreaterThan(0);expect(r.candidates[0].analysis.path!.opl).toBeCloseTo(baseline.candidates[0].analysis.path!.opl,12);
 const q=applyCandidate(p,r,r.candidates[0].id);expect(portWorld(q,'target')).toEqual(portWorld(p,'target'));
});
test('generated Mirror backing faces away from the incoming ray and follows reflection law',()=>{
 const r=searchRouting(routingExample('search'),{...opts(),templates:['mirror2']}),c=r.candidates[0],d=doc(c.project),ss=compile(d),path=c.analysis.path!;
 path.hits.forEach((hit,i)=>{const s=ss.find(s=>s.id===hit.surfaceId)!;if(s.interaction!=='reflect')return;
  const incoming=i?path.hits[i-1].direction:frame(d.source.frame).axes[0],n=s.world.axes[0];expect(dot(incoming,n)).toBeLessThan(0);expect(dot(hit.direction,n)).toBeCloseTo(-dot(incoming,n),12);
 });
});
test('Prism entry / TIR / exit retain wavelength-linked BK7 and finite geometry',()=>{
 let p=routingExample('prism');p=withPrescription(p,{...doc(p),wavelength:1550e-9});const r=searchRouting(p,{...opts(),templates:['prism1']}),c=r.candidates[0],ss=doc(c.project).surfaces.filter(s=>c.generatedIds.includes(s.assemblyId));
 expect(ss.map(s=>s.interaction)).toEqual(['refract','tir','refract']);expect(ss[0].nAfter).toBe(materialIndex('N-BK7',1550e-9));expect(ss[1].nBefore).toBe(ss[0].nAfter);expect(ss[2].nAfter).toBe(1);expect(c.analysis.positionError).toBeLessThan(1e-12);
});
test('fixed Lens, Mode contracts, parent reference frames and fiber geometry survive Apply',()=>{
 let p=routingExample('search');const target=portWorld(p,'target');doc(p).assemblies.push({id:'Output-parent',name:'Output parent',kind:'group',parentId:null,frame:pose(.001,.002,.003,.2,.1,.3)});doc(p).assemblies.find(a=>a.id==='Output')!.parentId='Output-parent';p=withPortWorld(p,'target',framePose(target));
 const before=structuredClone(p),r=searchRouting(p,{...opts(),templates:['mirror2']}),q=applyCandidate(p,r,r.candidates[0].id);
 expect(doc(q).source).toEqual(doc(before).source);expect(doc(q).surfaces.slice(0,2)).toEqual(doc(before).surfaces.slice(0,2));expect(doc(q).surfaces.at(-1)).toEqual(doc(before).surfaces.at(-1));expect(q.authoring).toEqual(before.authoring);expect(q.sourceBody).toEqual(before.sourceBody);expect(q.targetBody).toEqual(before.targetBody);
 expect(doc(q).assemblies.find(a=>a.id==='Output-parent')).toEqual(doc(before).assemblies.find(a=>a.id==='Output-parent'));expect(portWorld(q,'target')).toEqual(portWorld(before,'target'));expect(parseProject(serializeProject(q))).toEqual(q);
});
test('Alignment reference to a replaced routing Assembly remains a saved, unapplied reference',()=>{
 const p=routingExample('search');p.authoring!.alignment.movingId='Fold-1';const r=searchRouting(p,{...opts(),templates:['mirror2']}),q=applyCandidate(p,r,r.candidates[0].id);expect(q.authoring!.alignment).toEqual(p.authoring!.alignment);expect(doc(q).assemblies.some(a=>a.id==='Fold-1')).toBe(true);expect(doc(q).surfaces.some(s=>s.id==='M1')).toBe(false);
});
test('exact baseline signature prevents stale Apply after a Port / tolerance / Mode change',()=>{
 const p=routingExample('search'),r=searchRouting(p,{...opts(),templates:['mirror2']}),q=structuredClone(p);q.routing!.positionTolerance*=2;expect(()=>applyCandidate(q,r,r.candidates[0].id)).toThrow('Stale candidates');expect(()=>applyCandidate(p,r,'missing')).toThrow('unavailable');
 const c=r.candidates[0];doc(c.project).source.frame.origin.z+=1e-6;expect(()=>applyCandidate(p,r,c.id)).toThrow('fixed Port / Lens');
});
test('saved provenance becomes stale after an optical edit without reusing it as a feasibility certificate',()=>{
 const p=routingExample('search'),r=searchRouting(p,{...opts(),templates:['mirror2']}),q=applyCandidate(p,r,r.candidates[0].id),fp=q.routing!.solution!.designFingerprint;expect(solutionDesignFingerprint(q)).toBe(fp);doc(q).surfaces[0].radius*=1.1;expect(solutionDesignFingerprint(q)).not.toBe(fp);
});
test('Keep-out checks include free-space reference segments, even when no body touches the obstacle',()=>{
 const p=routingExample('search');p.routing!.keepOut=[{min:V(.006,-.0002,-.0002),max:V(.007,.0002,.0002)}];const r=searchRouting(p);expect(r.candidates).toHaveLength(0);expect(r.rejected['Reference segment intersects Keep-out box']).toBeGreaterThan(0);expect(r.reason).toContain('not proof');
});
test('part limits and conservative component clearance exclude unusable bounded candidates',()=>{
 const p=routingExample('search');p.routing!.parts.mirror=0;p.routing!.parts.prism=0;const r=searchRouting(p);expect(r.candidates).toHaveLength(0);expect(r.status).toBe('completed');
 const q=searchRouting(routingExample('search'),{...opts(),templates:['mirror2'],clearance:.001});expect(q.candidates).toHaveLength(0);expect(Object.keys(q.rejected).some(k=>k.includes('clearance'))).toBe(true);
});
test('budget exhaustion reports partial search, never a global impossibility result',()=>{
 const r=searchRouting(routingExample('search'),{...opts(),budget:1});expect(r.evaluated).toBe(1);expect(r.status).toBe('budget-exhausted');expect(r.reason).toContain('only the evaluated');expect(r.candidates).toHaveLength(0);
});
test('ranking is deterministic and retains diverse topology representatives',()=>{
 const p=routingExample('prism');const a=searchRouting(p),b=searchRouting(p);expect(a.candidates.map(c=>c.id)).toEqual(b.candidates.map(c=>c.id));expect(a.candidates.length).toBeLessThanOrEqual(8);
 for(let i=1;i<a.candidates.length;i++)expect(a.candidates[i].partCount).toBeGreaterThanOrEqual(a.candidates[i-1].partCount);
 const c=searchRouting(p,{...opts(),ranking:'shortest-path'});for(let i=1;i<c.candidates.length;i++)expect(c.candidates[i].length+1e-15).toBeGreaterThanOrEqual(c.candidates[i-1].length);
});
test.each(['ideal','array','medium','missing-body','lens-after-fold'] as const)('unsupported setup %s gives an explicit domain reason',kind=>{
 let p=routingExample('search');if(kind==='ideal')p=idealProject();if(kind==='array')doc(p).source.channels.rows=3;if(kind==='medium')doc(p).source.n=null;if(kind==='missing-body')p.bodies=p.bodies.filter(b=>b.kind!=='lens');if(kind==='lens-after-fold'){const d=doc(p);d.surfaces=[d.surfaces[2],d.surfaces[0],d.surfaces[1],d.surfaces[3],d.surfaces[4]];}
 const r=searchRouting(p);expect(r.status).toBe('unsupported');expect(r.reason.length).toBeGreaterThan(10);expect(r.evaluated).toBe(0);
});
test('invalid search options do not replace old Project data or synthesize missing defaults',()=>{
 const p=routingExample('search'),raw=serializeProject(p);expect(searchRouting(p,{...opts(),templates:[]}).status).toBe('unsupported');expect(searchRouting(p,{...opts(),prismLeg:10e-6}).reason).toContain('4 × Clear Radius');expect(serializeProject(parseProject(raw))).toBe(raw);expect(parseProject(raw).routing!.search).toBeUndefined();
});
test('async completion matches the deterministic synchronous solver; pre-cancellation evaluates nothing',async()=>{
 const p=routingExample('prism'),o={...opts(),templates:['prism1'] as const};
 const a=searchRouting(p,{...o,templates:[...o.templates]}),b=await searchRoutingAsync(p,{...o,templates:[...o.templates]},{cancelled:()=>false,progress:()=>{},yieldTask:async()=>{}});expect(b).toEqual(a);
 const c=await searchRoutingAsync(p,opts(),{cancelled:()=>true,progress:()=>{throw Error('Unexpected progress');}});expect(c.status).toBe('cancelled');expect(c.evaluated).toBe(0);
});
test('segment slab intersection handles skew, parallel, grazing and reversed directions independently',()=>{
 const box={min:V(1,1,1),max:V(2,2,2)};expect(lineBox(V(),V(3,3,3),box,0,1)).toEqual([1/3,2/3]);expect(lineBox(V(3,1.5,1.5),V(-3),box,0,1)).toEqual([1/3,2/3]);expect(lineBox(V(0,2,2),V(3),box,0,1)).not.toBeNull();expect(lineBox(V(0,3,1.5),V(3),box,0,1)).toBeNull();
});
test('Prism-only constructive search produces a physical BK7 route with fixed Ports',()=>{
 const p=routingExample('prism'),r=searchRouting(p,{...defaultSearchOptions(),templates:['prism1']});expect(r.candidates).toHaveLength(1);expect(r.candidates[0].analysis.withinTolerance).toBe(true);
});
test('cooperative search can cancel without mutating the Project',async()=>{
 const p=routingExample('mirrors'),raw=serializeProject(p);let steps=0;
 const r=await searchRoutingAsync(p,defaultSearchOptions(),{cancelled:()=>steps>=3,progress:()=>steps++,yieldTask:async()=>{}});
 expect(r.status).toBe('cancelled');expect(r.evaluated).toBe(3);expect(serializeProject(p)).toBe(raw);
});
