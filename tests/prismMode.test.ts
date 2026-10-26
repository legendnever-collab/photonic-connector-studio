import {test,expect} from 'vitest';
import {prismFixture} from './prismFixtures';
import {tensorOverlap,gaussianTensorOverlap} from '../src/project/tensorOverlap';
import {solveFoldedGaussian} from '../src/project/foldedGaussian';
import {tirPhase,spectralOverlap} from '../src/project/prismMode';
import {frame,pose,compose} from '../src/surface/model';
import {framePose} from '../src/authoring/commands';
import {serializeProject,parseProject} from '../src/project/model';
test.each(['one','two','mixed','mirrors'] as const)('%s independent finite collimated train has a normalized result',kind=>{
 for(const polarization of ['TE','TM'] as const){
 const p=prismFixture(kind,polarization),before=serializeProject(p),r=tensorOverlap(p);
 expect(r.status,JSON.stringify(r)).toBe('valid');if(r.status!=='valid')return;
 expect(r.eta).toBeGreaterThan(.98);expect(r.eta).toBeLessThanOrEqual(1);
 expect(r.comparisonClass).toBe('explicit-copolarized-phase-only');
 expect(serializeProject(p)).toBe(before);expect(tensorOverlap(parseProject(before))).toEqual(r);
 }
});
test('Fresnel phase independently satisfies complex boundary admittance equations',()=>{
 // e^(+iωt): evanescent transmitted normal wavevector = -i sqrt(n1² sin²θ-n2²).
 // r=(Yi-Yt)/(Yi+Yt). For p use magnetic admittance; an overall π is irrelevant.
 for(const n of [1.45,1.5,1.6])for(const delta of [.001,.01,.1,.3])for(const pol of ['s','p'] as const){
  const theta=Math.asin(1/n)+delta,c=Math.cos(theta),decay=Math.sqrt(n*n*Math.sin(theta)**2-1);
  const real=n*c,imag=pol==='s'?decay:n*n*decay;
  const denominator=real*real+imag*imag;
  const rr=(real*real-imag*imag)/denominator,ri=2*real*imag/denominator,phase=tirPhase(c,1/n,pol);
  expect(Math.cos(phase)).toBeCloseTo(rr,12);expect(Math.sin(phase)).toBeCloseTo(ri,12);expect(rr*rr+ri*ri).toBeCloseTo(1,14);
 }
});
test('spectral integration recovers exact normalized tensor integral without TIR',()=>{
 const p=prismFixture('mirrors'),r=solveFoldedGaussian(p);if(r.status!=='valid')throw Error(r.reason);
 const q=r.incident.q,mfd:[number,number]=[.0004,.0005],h:[number,number]=[20e-6,-30e-6];
 const exact=gaussianTensorOverlap(q,r.wavelength,1,mfd,h).eta;
 expect(spectralOverlap(q,r.wavelength,mfd,h,()=>0,32,7)).toBeCloseTo(exact,10);
 expect(spectralOverlap(q,r.wavelength,mfd,h,()=>0,64,8)).toBeCloseTo(exact,12);
});
test('rigid transform, target roll / polarization and undefined cases are explicit',()=>{
 const p=prismFixture('two'),original=tensorOverlap(p);if(p.model.kind!=='surface'||original.status!=='valid')throw Error('fixture');
 const d=p.model.prescription,g=frame(pose(.02,-.03,.01,.7,-.4,.3));
 d.source.frame=framePose(compose(g,frame(d.source.frame)));d.assemblies=d.assemblies.map(a=>({...a,parentId:'Global'}));d.assemblies.push({id:'Global',name:'Global',kind:'group',parentId:null,frame:framePose(g)});
 const rotated=tensorOverlap(p);expect(rotated.status).toBe('valid');if(rotated.status==='valid')expect(rotated.eta).toBeCloseTo(original.eta,12);
 p.model.sourceMode.polarization='unspecified';expect(tensorOverlap(p)).toMatchObject({status:'not-calculated',reason:expect.stringContaining('Input undefined')});
 p.model.sourceMode.polarization='TE';p.model.targetMode.polarization='TM';expect(tensorOverlap(p)).toMatchObject({status:'not-calculated',reason:expect.stringContaining('polarization')});
 p.authoring!.ports.target.device='pic-edge';expect(tensorOverlap(p)).toMatchObject({status:'not-calculated',reason:expect.stringContaining('PIC receiving field')});
});

import {oracle} from './prismOracle';
import {transformQ} from '../src/project/foldedGaussian';
import {dot} from '../src/surface/model';
import {writeFileSync,mkdirSync} from 'node:fs';
test('independent vector Fresnel + 2D spectrum: window/grid convergence and phase-shift sensitivity',()=>{
 const evidence:unknown[]=[];
 for(const kind of ['one','two','mixed'] as const)for(const pol of ['TE','TM'] as const){
  const p=prismFixture(kind,pol);if(p.model.kind!=='surface')throw Error('fixture');
  // A deliberate offset makes phase sign / GH displacement measurable.
  p.model.prescription.assemblies.at(-1)!.frame.origin.y+=20e-6;
  if(kind==='one')p.model.prescription.assemblies.at(-1)!.frame.origin.x+=35e-6;
  else p.model.prescription.assemblies.at(-1)!.frame.origin.z+=35e-6;
  const r=solveFoldedGaussian(p),v=tensorOverlap(p,r);if(r.status!=='valid'||v.status!=='valid')throw Error(JSON.stringify(v));
  const a:[number,number,number,number]=[dot(r.outputAxes[0],r.incident.u),dot(r.outputAxes[0],r.incident.v),dot(r.outputAxes[1],r.incident.u),dot(r.outputAxes[1],r.incident.v)],q=transformQ(r.incident.q,a),h:[number,number]=[r.outputOffset.y,r.outputOffset.z];
  const coarse=oracle(p,q,48,5,h),fine=oracle(p,q,96,7,h),wide=oracle(p,q,160,9,h);
  expect(Math.abs(fine-wide)).toBeLessThan(1e-9);expect(Math.abs(coarse-wide)).toBeLessThan(2e-6);
  expect(Math.abs(v.eta-wide)).toBeLessThan(2e-4);
  const flat=gaussianTensorOverlap(q,r.wavelength,1,[.0004,.0005],h).eta;
  expect(Math.abs(v.eta-flat)).toBeGreaterThan(1e-4); // not a chief-only / constant-phase result
  evidence.push({kind,pol,production:v.eta,coarse,fine,wide,modelError:Math.abs(v.eta-wide),constantPhase:flat,domain:v.domain});
 }
 mkdirSync('test-results',{recursive:true});writeFileSync('test-results/D221-physics-convergence.json',JSON.stringify(evidence,null,2));
},30000);
test('divergence, aperture, unsupported material and undefined output gates never substitute zero',()=>{
 const p=prismFixture();if(p.model.kind!=='surface')throw Error('fixture');
 p.model.sourceMode.mfdX=40e-6;p.model.sourceMode.mfdY=40e-6;
 expect(tensorOverlap(p)).toMatchObject({status:'not-calculated',reason:expect.stringMatching(/critical-angle|divergence/)});
 const aperture=prismFixture();aperture.bodies[0].kind==='prism'&&(aperture.bodies[0].depth=20e-6);
 expect(tensorOverlap(aperture)).toMatchObject({status:'not-calculated',reason:expect.stringMatching(/Aperture/)});
 const missing=prismFixture();if(missing.model.kind==='surface')missing.model.targetMode.mfdX=null;
 expect(tensorOverlap(missing)).toMatchObject({status:'not-calculated',reason:expect.stringContaining('Input undefined')});
 const material=prismFixture();if(material.model.kind==='surface')material.model.prescription.surfaces[1].outsideIndex=1.01;
 expect(tensorOverlap(material)).toMatchObject({status:'not-calculated',reason:expect.stringContaining('BK7 / air')});
});

import {routingExample} from '../src/routing/examples';
test('built-in manual Prism example evaluates without synthesis settings',()=>{
 const p=routingExample('prism-mode');expect(p.synthesis).toBeUndefined();const r=tensorOverlap(p);
 expect(r.status,JSON.stringify(r)).toBe('valid');if(r.status==='valid')expect(r.eta).toBeGreaterThan(.99);
});
test('near-domain collimation and wavelength edges retain independent vector accuracy',()=>{
 for(const lambda of [1260e-9,1550e-9,1625e-9])for(const pol of ['TE','TM'] as const){
  const p=prismFixture('two',pol);if(p.model.kind!=='surface')throw Error('fixture');
  p.model.prescription.wavelength=lambda;
  // Geometric media use catalog dispersion; ensure stored numeric indices match it.
  const n=materialIndex('N-BK7',lambda);for(const s of p.model.prescription.surfaces){if(s.nBefore!>1)s.nBefore=n;if(s.nAfter!>1)s.nAfter=n;}
  const mfd=lambda/(Math.PI*n*.00195)*2;p.model.sourceMode.mfdX=mfd;p.model.sourceMode.mfdY=mfd*1.2;p.model.targetMode={...p.model.sourceMode};
  const r=solveFoldedGaussian(p),v=tensorOverlap(p,r);if(r.status!=='valid'||v.status!=='valid')throw Error(JSON.stringify(v));
  expect(Math.abs(v.eta-oracle(p,r.incident.q,96,8))).toBeLessThan(2e-4);
 }
},30000);
import {materialIndex} from '../src/surface/materials';

import {defaultProblem} from '../src/design/engine';
import {defaultRouting} from '../src/routing/contract';
import {defaultSynthesis} from '../src/synthesis/contract';
import {searchSynthesis,applySynthesis} from '../src/synthesis/engine';
test.each(['one','two','mixed'] as const)('existing %s Prism synthesis uses the same evaluator; Apply is revalidated',kind=>{
 const p=prismFixture(kind),before=serializeProject(p),problem={...defaultProblem(p),maxGenerated:0};
 problem.tolerance={...problem.tolerance,portPosition:[0,0,0],portAngle:[0,0,0],componentPosition:[0,0,0],componentAngle:[0,0,0]};
 const routing={...defaultRouting(),parts:{lens:2,mirror:2,prism:2}},o={...defaultSynthesis(),budget:32,geometryBudget:4,fitBudget:4,phaseTolerance:.15};
 const batch=searchSynthesis(p,problem,routing,o),c=batch.candidates.find(c=>c.recipe.kind==='existing');
 expect(c,JSON.stringify(batch.rejected)).toBeDefined();expect(c!.qualified).toBe(true);
 const v=tensorOverlap(p);if(v.status!=='valid')throw Error(v.reason);expect(c!.eta).toBeCloseTo(v.eta,12);
 expect(c!.comparisonClass).toBe(v.comparisonClass);expect(serializeProject(p)).toBe(before);
 const applied=applySynthesis(p,batch,c!.id);expect(applied.synthesis?.solution?.qualified).toBe(true);
 expect(tensorOverlap(applied)).toEqual(v);
 const stale=structuredClone(p);if(stale.model.kind==='surface')stale.model.sourceMode.polarization='TM';
 expect(()=>applySynthesis(stale,batch,c!.id)).toThrow(/Stale/);
 const tampered=structuredClone(batch);tampered.candidates.find(x=>x.id===c!.id)!.values.push(1);expect(()=>applySynthesis(p,tampered,c!.id)).toThrow(/changed/);
});
test('Port roll requires physical axis agreement; relabeling alone never changes the input',()=>{
 const p=prismFixture('one'),old=tensorOverlap(p);if(p.model.kind!=='surface'||old.status!=='valid')throw Error('fixture');
 p.model.prescription.assemblies.at(-1)!.frame.rotation.roll=Math.PI/2;
 expect(tensorOverlap(p)).toMatchObject({status:'not-calculated',reason:expect.stringContaining('polarization')});
 p.model.targetMode.polarization='TM';[p.model.targetMode.mfdX,p.model.targetMode.mfdY]=[p.model.targetMode.mfdY,p.model.targetMode.mfdX];
 const next=tensorOverlap(p);expect(next.status).toBe('valid');if(next.status==='valid')expect(next.eta).toBeCloseTo(old.eta,12);
});
test('calculation reasons distinguish undefined input, unsupported model, and exceeded domain',()=>{
 const p=prismFixture();p.authoring!.ports.source.adapter='near-field-em-required';
 expect(tensorOverlap(p)).toMatchObject({status:'not-calculated',reason:expect.stringMatching(/^Model unsupported:/)});
 p.authoring!.ports.source.adapter='unspecified';expect(tensorOverlap(p)).toMatchObject({status:'not-calculated',reason:expect.stringMatching(/^Input undefined:/)});
 const q=prismFixture();if(q.model.kind==='surface'){q.model.sourceMode.mfdX=100e-6;q.model.sourceMode.mfdY=100e-6;}
 expect(tensorOverlap(q)).toMatchObject({status:'not-calculated',reason:expect.stringMatching(/^Out of domain:/)});
});
