import {beforeAll,test,expect} from 'vitest';
import {fiberLensFiberProject} from '../src/authoring/starter';
import {withPortWorld} from '../src/routing/model';
import {pose,frame,compile} from '../src/surface/model';
import {norm,sub,mul,dot} from '../src/surface/model';
import {defaultProblem} from '../src/design/engine';
import {defaultSearchOptions} from '../src/routing/contract';
import {searchRouting,applyCandidate} from '../src/routing/search';
import {defaultSynthesis} from '../src/synthesis/contract';
import {searchSynthesis,applySynthesis} from '../src/synthesis/engine';
import type {SynthesisResult} from '../src/synthesis/engine';
import {prescription,serializeProject} from '../src/project/model';
import {reportFolds,reportDetailRegions} from '../src/surface/reportDetails';
import {bodyGeometry} from '../src/project/geometry';
import {projectTrace} from '../src/project/compute';
import {reportGeometry} from '../src/surface/reportGeometry';
const starter=withPortWorld(fiberLensFiberProject(),'target',pose(.01,0,.005));
const batch=searchRouting(starter,defaultSearchOptions()),candidate=batch.candidates.find(c=>c.topology==='mirror-prism')!;
const routed=applyCandidate(starter,batch,candidate.id),pb=defaultProblem(routed),before=serializeProject(routed);
let failed:SynthesisResult,repaired:SynthesisResult;
beforeAll(()=>{
 failed=searchSynthesis(routed,pb,routed.routing!,defaultSynthesis());
 repaired=searchSynthesis(routed,{...pb,maxParts:4,maxGenerated:4},routed.routing!,defaultSynthesis());
},120000);
test('bounded search preserves the inherited two-part replacement limit despite expanded manufacturing seeds',()=>{
 expect(pb.maxGenerated).toBe(2);expect(failed.geometryEvaluated).toBe(96);expect(failed.evaluated).toBeGreaterThan(0);expect(failed.evaluated).toBeLessThanOrEqual(defaultSynthesis().budget);expect(failed.candidates).toHaveLength(0);
 expect(Object.keys(failed.rejected)).toContain('New / replacement component limit excludes 2 Lens + 2 fold (mirror2): 4 > 2');
 expect(failed.problem.maxGenerated).toBe(2);expect(serializeProject(routed)).toBe(before);
});
test('explicitly allowing four replacement components finds a Mode-qualified physical train from the routed starter',()=>{
 const c=repaired.candidates.find(c=>c.qualified);expect(c).toBeDefined();expect(c!.eta).toBeGreaterThan(.9);
 const p=applySynthesis(routed,repaired,c!.id),d=prescription(p);expect(d.surfaces).toHaveLength(7);
 expect(d.source).toEqual(prescription(routed).source);expect(d.surfaces.at(-1)).toEqual(prescription(routed).surfaces.at(-1));expect(serializeProject(routed)).toBe(before);
});
test('every physical turn occurs on a real Mirror or TIR face and each air segment follows the preceding outgoing ray',()=>{
 const d=prescription(routed),ss=compile(d),path=candidate.analysis.path!,folds=reportFolds(d,path);
 expect(folds.map(f=>f.kind)).toEqual(['Mirror','TIR Prism']);
 for(const [i,hit] of path.hits.entries()){
  const incoming=i?path.hits[i-1].direction:frame(d.source.frame).axes[0],delta=sub(hit.point,path.points[i]);
  expect(norm(sub(delta,mul(incoming,dot(delta,incoming))))).toBeLessThan(1e-12);
  const s=ss.find(s=>s.id===hit.surfaceId)!;
  if(['reflect','tir'].includes(s.interaction)){
   const expected=sub(incoming,mul(hit.normal,2*dot(incoming,hit.normal)));expect(norm(sub(expected,hit.direction))).toBeLessThan(1e-12);
  }else expect(norm(sub(incoming,hit.direction))).toBeLessThan(1e-12);
 }
 expect(folds[0].point.x).toBeGreaterThan(ss[1].world.origin.x);expect(folds[0].point.z).toBe(0);expect(folds[1].point.z).toBeCloseTo(.005,12);
});
test('the tiny generated Mirror receives a true-geometry detail region and dimensions',()=>{
 const d=prescription(routed),t=projectTrace(routed),b=bodyGeometry(d,t.surfaces,routed.bodies),g=reportGeometry(d,t,false);
 const regions=reportDetailRegions(d,t,{faces:[...g.faces,...b.faces]},routed),mirror=regions.find(r=>r.ids.includes(candidate.generatedIds[0]));
 expect(mirror).toBeDefined();expect(mirror!.dimensions.join(' ')).toContain('Mirror Ø 0.04400 mm');expect(mirror!.surfaceIds).toContain('S2-mirror-1-front');
 expect(serializeProject(routed)).toBe(before);
});
