import {test,expect} from 'vitest';
import {basicRelayReference} from '../src/authoring/basicRelay';
import {mirrorArrayReference} from '../src/authoring/arrayReference';
import {prescription,serializeProject} from '../src/project/model';
import {framePose} from '../src/authoring/commands';
import {frame,pose,compose} from '../src/surface/model';
import {portWorld,withPortWorld} from '../src/routing/model';
import {defaultRouting} from '../src/routing/contract';
import {defaultProblem} from '../src/design/engine';
import {defaultSynthesis} from '../src/synthesis/contract';
import {checkLensMount,lensMountGoal,portMounted,lensMountAssessment} from '../src/synthesis/lensMount';
import {synthesisLensOptions} from '../src/synthesis/construction';
import {searchSynthesis,applySynthesis} from '../src/synthesis/engine';
test('new and old saved settings both require explicit opt-in for intentional decenter',()=>{
 const o=defaultSynthesis();expect(portMounted(o)).toBe(true);expect(o.lensAlignment).toBeUndefined();
 const legacy={...o,lensMount:undefined,lensAlignment:{decenter:.001,tilt:.02}},p=basicRelayReference();
 prescription(p).assemblies.find(a=>a.kind==='lens')!.frame.origin.z=25e-6;
 expect(lensMountAssessment(p,legacy).state).toBe('violated');expect(()=>checkLensMount(p,legacy)).toThrow('coaxial');expect(()=>synthesisLensOptions(p,defaultProblem(p),legacy,16)).toThrow('coaxial');
 expect(()=>checkLensMount(p,{...legacy,lensMount:'free'})).not.toThrow();
});
test('fixed Port axis, not the world axis or assembly origin, defines a coaxial mount',()=>{
 const p=basicRelayReference(),d=prescription(p),o=defaultSynthesis();expect(lensMountAssessment(p,o).state).toBe('coaxial');expect(()=>checkLensMount(p,o)).not.toThrow();
 const g=frame(pose(.02,-.03,.01,.4,-.3,.2));d.source.frame=framePose(compose(g,frame(d.source.frame)));d.assemblies.forEach(a=>{a.parentId='World';});d.assemblies.push({id:'World',name:'World',kind:'group',parentId:null,frame:framePose(g)});expect(()=>checkLensMount(p,o)).not.toThrow();
 d.assemblies.find(a=>a.kind==='lens')!.frame.rotation.pitch=.001;expect(()=>checkLensMount(p,o)).toThrow('coaxial');
});
test('folded geometry alone does not complete a two-ended connector',()=>{
 const p=mirrorArrayReference();expect(lensMountGoal(p,defaultSynthesis())).toBe(false);expect(lensMountGoal(p,{...defaultSynthesis(),lensMount:'free'})).toBe(true);
});
test.each([-100e-6,100e-6])('default %s m offset never substitutes an aligned-direct Lens solution',z=>{
 let p=basicRelayReference();const f=framePose(portWorld(p,'target'));f.origin.z=z;p=withPortWorld(p,'target',f);const before=serializeProject(p),o={...defaultSynthesis(),budget:512,geometryBudget:32,fitBudget:64},r=searchSynthesis(p,{...defaultProblem(p),maxParts:4,maxGenerated:4},defaultRouting(),o);
 expect(r.status).not.toBe('invalid-input');expect(r.candidates.some(c=>c.recipe.kind==='aligned-direct')).toBe(false);for(const c of r.candidates){expect(()=>checkLensMount(c.project,o)).not.toThrow();if(c.qualified)expect(lensMountGoal(c.project,o)).toBe(true);}
 expect(r.alignmentEvaluated).toBe(0);expect(r.reason).toContain('coaxial mount');expect(serializeProject(p)).toBe(before);
},30000);
test('500 µm connector retains both Port axes, two terminal Lenses and two Mirrors through Apply',()=>{
 let p=basicRelayReference();const f=framePose(portWorld(p,'target'));f.origin.z=500e-6;p=withPortWorld(p,'target',f);const before=serializeProject(p),o=defaultSynthesis(),r=searchSynthesis(p,{...defaultProblem(p),maxParts:4,maxGenerated:4},defaultRouting(),o),c=r.candidates.find(c=>c.qualified);
 expect(c).toBeDefined();expect(c!.topology).toBe('mirror2');expect(c!.recipe.kind).toBe('generated');expect(c!.eta).toBeGreaterThan(.99);expect(r.alignmentEvaluated).toBe(0);
 const q=applySynthesis(p,r,c!.id),d=prescription(q);expect(()=>checkLensMount(q,o)).not.toThrow();expect(lensMountGoal(q,o)).toBe(true);expect(portWorld(q,'source')).toEqual(portWorld(p,'source'));expect(portWorld(q,'target')).toEqual(portWorld(p,'target'));expect(q.model.kind==='surface'&&q.model.sourceMode).toEqual(p.model.kind==='surface'&&p.model.sourceMode);expect(q.synthesis!.lensMount).toBe('port-axis');expect(q.synthesis!.solution!.qualified).toBe(true);expect(d.surfaces.filter(s=>s.interaction==='refract')).toHaveLength(4);expect(d.surfaces.filter(s=>s.interaction==='reflect')).toHaveLength(2);expect(serializeProject(p)).toBe(before);
},30000);
