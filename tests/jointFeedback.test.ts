import {test,expect} from 'vitest';
import {fiberLensFiberProject} from '../src/authoring/starter';
import {defaultProblem} from '../src/design/engine';
import {defaultJointTolerance,assessJoint,jointCoverage} from '../src/design/joint';
import {searchLenses} from '../src/lens/search';
import {defaultRouting} from '../src/routing/contract';
import {defaultSynthesis,SynthesisSchema} from '../src/synthesis/contract';
import {searchSynthesis,searchSynthesisAsync,applySynthesis,synthesisSteps} from '../src/synthesis/engine';
import {jointEligible,jointKey,jointContext,compareJoint,betterJoint,assignJointGroups,emptyJointFeedback,jointPriority} from '../src/synthesis/robustness';
import {routingExample} from '../src/routing/examples';
import {prescription,serializeProject,parseProject} from '../src/project/model';
import {analyzeRouting} from '../src/routing/analysis';
import {norm,sub,pose} from '../src/surface/model';
import {withPortWorld} from '../src/routing/model';
import {solvePhysicalGaussian} from '../src/project/physicalGaussian';

function task(){const p=routingExample('prism-synthesis'),problem=defaultProblem(p);problem.maxParts=2;problem.maxGenerated=2;problem.jointTolerance={...defaultJointTolerance(p),samples:8,maxCases:8};problem.jointTolerance.mating.position=[0,.0008,0];
 const routing={...p.routing!,positionTolerance:.001,parts:{lens:0,mirror:2,prism:2}},options={...p.synthesis!,families:['mirror2','prism2'] as ['mirror2','prism2'],budget:256,geometryBudget:32,toleranceMode:'joint' as const,jointBudget:2048};return {p,problem,routing,options};}

test('joint topology feedback uses complete common-Port coverage across Mirror and Prism families',()=>{
 const {p,problem,routing,options}=task(),before=serializeProject(p);
 const r=searchSynthesis(p,problem,routing,options);
 expect(r.candidates.some(jointEligible)).toBe(true);expect(r.jointFeedback.routeSelections.length).toBeGreaterThan(0);
 expect(r.jointFeedback.groups).toHaveLength(2);expect(new Set(r.candidates.filter(c=>c.topology==='prism2').map(c=>c.joint!.rank))).toEqual(new Set([1]));
 const mirrors=r.candidates.filter(c=>c.topology==='mirror2'),best=mirrors[0],nominal=[...mirrors].sort((a,b)=>b.eta!-a.eta!)[0];
 expect(best.eta!).toBeLessThan(nominal.eta!);expect(best.joint!.result!.lowestEta!).toBeGreaterThan(nominal.joint!.result!.lowestEta!);
 expect(r.jointFeedback.improvements.some(v=>v.kind==='route'&&v.after-v.before>1e-6)).toBe(true);
 // Independent unfolded free-space Gaussian integral: every flat Mirror preserves scalar q.
 for(const c of mirrors){const path=analyzeRouting(c.project).path!,L=path.points.slice(1).reduce((n,v,i)=>n+norm(sub(v,path.points[i])),0),w=.0005,z=Math.PI*w*w/prescription(p).wavelength,a=1+(L/(2*z))**2;
  expect(c.eta).toBeCloseTo(1/a,11);expect(c.joint!.result!.lowestEta).toBeCloseTo(Math.exp(-((.0008/w)**2)/a)/a,11);
 }
 expect(r.jointFeedback.evaluated).toBeLessThanOrEqual(options.jointBudget);expect(r.evaluated).toBeLessThanOrEqual(options.budget);expect(r.geometryEvaluated).toBeLessThanOrEqual(options.geometryBudget);expect(r.placementFeedback).toEqual([]);expect(r.toleranceEvaluated).toBe(0);expect(serializeProject(p)).toBe(before);
},30000);

test('joint Lens refinement improves observed minimum overlap while preserving nominal goals',()=>{
 const starter=fiberLensFiberProject(),p=searchLenses(starter,defaultProblem(starter).lens!).candidates[0].project,problem=defaultProblem(p);
 problem.maxGenerated=0;problem.jointTolerance={...defaultJointTolerance(p),samples:8,maxCases:8};problem.jointTolerance.mating.position=[0,3e-6,2e-6];
 const routing={...defaultRouting(),positionTolerance:10e-6,angleTolerance:.01},options={...defaultSynthesis(),families:['direct'] as ['direct'],budget:512,fitBudget:128,geometryBudget:8,toleranceMode:'joint' as const,jointBudget:2048};
 const r=searchSynthesis(p,problem,routing,options);
 expect(r.candidates.some(jointEligible)).toBe(true);expect(r.jointFeedback.continuousTrials).toBeGreaterThan(0);expect(r.jointFeedback.improvements.some(v=>v.kind==='lens')).toBe(true);
 expect(()=>applySynthesis(p,r,r.candidates.find(jointEligible)!.id)).not.toThrow();
 const best=r.candidates.find(jointEligible)!,gains=r.jointFeedback.improvements.filter(v=>v.kind==='lens');expect(best.joint!.result!.lowestEta!-gains[0].before).toBeGreaterThan(1e-4);
 expect(best.merit!.sizeError).toBeLessThanOrEqual(options.diameterTolerance);expect(best.merit!.phaseError).toBeLessThanOrEqual(options.phaseTolerance);expect(best.eta!).toBeGreaterThan(options.minimumOverlap);
 const shifted=withPortWorld(best.project,'target',pose(.01,-3e-6,-2e-6)),independent=solvePhysicalGaussian(shifted);expect(independent.status).toBe('valid');if(independent.status==='valid'&&independent.overlap.status==='valid')expect(best.joint!.result!.lowestEta).toBeCloseTo(independent.overlap.eta,10);
},30000);

test('joint settings are opt-in, strict, persistent and deterministic',()=>{
 expect(defaultSynthesis().toleranceMode).toBeUndefined();expect(SynthesisSchema.safeParse({...defaultSynthesis(),jointBudget:0}).success).toBe(false);expect(SynthesisSchema.safeParse({...defaultSynthesis(),toleranceMode:'yield'}).success).toBe(false);
 const {p,problem,routing,options}=task(),a=searchSynthesis(p,problem,routing,options),b=searchSynthesis(p,problem,routing,options);expect(a).toEqual(b);
 const saved=applySynthesis(p,a,a.candidates.find(jointEligible)!.id);expect(serializeProject(parseProject(serializeProject(saved)))).toBe(serializeProject(saved));expect(saved.synthesis!.toleranceMode).toBe('joint');expect(saved.designProblem!.jointTolerance).toEqual(problem.jointTolerance);
 const changed=structuredClone(a);changed.options.jointBudget=options.jointBudget-1;expect(()=>applySynthesis(p,changed,changed.candidates[0].id)).toThrow('settings');
 const tamper=structuredClone(a);tamper.candidates[0].project.bodies=[];expect(()=>applySynthesis(p,tamper,tamper.candidates[0].id)).toThrow('changed');
});

test('partial, geometry-failed and missing batches cannot beat complete feasible members of their cohort',()=>{
 const {p,problem,routing,options}=task(),r=searchSynthesis(p,problem,routing,options),a=structuredClone(r.candidates.find(jointEligible)!);
 const partial=structuredClone(a);partial.id='partial';partial.eta=1;partial.merit!.score=0;partial.joint!.result!.status='partial';partial.joint!.result!.lowestEta=1;
 const failed=structuredClone(partial);failed.id='geometry-failed';failed.joint!.result!.status='assessed';failed.joint!.result!.geometryPassed=0;
 const missing=structuredClone(partial);missing.id='missing';missing.joint!.result=null;
 for(const x of [partial,failed,missing]){expect(jointEligible(x)).toBe(false);expect(compareJoint(a,x)).toBeLessThan(0);expect(betterJoint(x,a)).toBe(false);}
 const other=structuredClone(a);other.id='different-seed';other.joint!.coverage+='changed';expect(betterJoint(other,a)).toBe(false);
 const list=[a,partial,failed,missing,other,...r.candidates],ledger=emptyJointFeedback(true);assignJointGroups(list,ledger);
 expect([partial,failed,missing].every(c=>c.joint!.rank===null)).toBe(true);
 for(const x of list)for(const y of list)for(const z of list)if(compareJoint(x,y)<=0&&compareJoint(y,z)<=0)expect(compareJoint(x,z)).toBeLessThanOrEqual(0);
 expect(jointPriority([partial,a],x=>x)[0]).toBe(a);
});

test('cohort identity includes shared scenarios, evaluator, Mode / Port and geometry criteria',()=>{
 const {p,problem,routing,options}=task(),r=searchSynthesis(p,problem,routing,options),a=r.candidates.find(jointEligible)!,b=structuredClone(a);
 expect(a.joint!.coverage).toBe(jointCoverage(a.project,problem.jointTolerance!));
 const local={...problem.jointTolerance!,assembly:{position:[1e-6,0,0] as [number,number,number],angle:[0,0,0] as [number,number,number]}};
 const renamed=structuredClone(a.project),d=prescription(renamed),id=d.surfaces[0].assemblyId;d.assemblies.find(v=>v.id===id)!.id='renamed';d.surfaces.forEach(v=>{if(v.assemblyId===id)v.assemblyId='renamed';});renamed.bodies.forEach(v=>{if(v.assemblyId===id)v.assemblyId='renamed';});
 expect(jointCoverage(a.project,local)).not.toBe(jointCoverage(renamed,local));expect(jointCoverage(a.project,problem.jointTolerance!)).toBe(jointCoverage(renamed,problem.jointTolerance!));
 b.evaluator='different-domain';expect(jointKey(a)).not.toBe(jointKey(b));b.evaluator=a.evaluator;b.project.routing!.positionTolerance*=.5;b.comparisonContext=jointContext(b.project);expect(jointKey(a)).not.toBe(jointKey(b));
 if(b.project.model.kind==='surface')b.project.model.targetMode.mfdX=1e-4;expect(jointContext(b.project)).not.toBe(a.comparisonContext);
});

test('Prism gains below the declared model tolerance are unresolved',()=>{
 const {p,problem,routing,options}=task(),r=searchSynthesis(p,problem,routing,options),a=r.candidates.find(c=>c.topology==='prism2'&&jointEligible(c))!,b=structuredClone(a);
 expect(a.etaResolution).toBe(2e-4);b.joint!.result!.lowestEta!+=1e-4;expect(betterJoint(b,a)).toBe(false);b.joint!.result!.lowestEta!+=5e-4;expect(betterJoint(b,a)).toBe(true);
});

test('budget exhaustion, cap truncation and undefined common settings are explicit and unranked',()=>{
 const {p,problem,routing,options}=task(),tiny=searchSynthesis(p,problem,routing,{...options,jointBudget:1});expect(tiny.jointFeedback.evaluated).toBe(0);expect(tiny.jointFeedback.limited).toBe(true);expect(tiny.candidates.every(c=>c.joint!.rank===null)).toBe(true);
 problem.jointTolerance!.maxCases=1;const cap=searchSynthesis(p,problem,routing,options);expect(cap.candidates.some(c=>c.joint?.result?.status==='partial')).toBe(true);expect(cap.candidates.some(jointEligible)).toBe(false);expect(cap.jointFeedback.improvements).toEqual([]);
 delete problem.jointTolerance;expect(searchSynthesis(p,problem,routing,options).status).toBe('invalid-input');problem.jointTolerance=defaultJointTolerance(p);problem.jointTolerance.mating.position=[0,0,0];expect(searchSynthesis(p,problem,routing,options).status).toBe('invalid-input');
});

test('unsupported field samples stay partial under shared assembly errors',async()=>{
 const {p,problem,routing,options}=task();problem.jointTolerance!.mating.position=[0,0,0];problem.jointTolerance!.assembly.angle=[0,.001,0];
 const r=searchSynthesis(p,problem,routing,options),prisms=r.candidates.filter(c=>c.topology==='prism2');expect(prisms.length).toBeGreaterThan(0);expect(prisms.every(c=>!jointEligible(c))).toBe(true);
 for(const c of prisms){if(c.joint?.result){const manual=await assessJoint(c.project,problem.jointTolerance!);expect(c.joint.result).toEqual(manual);}}
});

test('cancellation at joint samples discards previews and leaves the Project unchanged',async()=>{
 const {p,problem,routing,options}=task(),before=serializeProject(p);let checks=0,prefix=0;const it=synthesisSteps(p,problem,routing,options);let step=it.next();while(!step.done&&!step.value.startsWith('Joint ')){prefix++;step=it.next();}expect(step.done).toBe(false);
 // The async path checks cancellation after progress yields and shares the same generator.
 const r=await searchSynthesisAsync(p,problem,routing,options,{progress:()=>{},cancelled:()=>++checks>prefix+2});expect(r.status).toBe('cancelled');expect(r.candidates).toEqual([]);expect(serializeProject(p)).toBe(before);
});
