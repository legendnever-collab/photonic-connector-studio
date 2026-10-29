import {test,expect} from 'vitest';
import {assessLensBenchmark,integratePhaseScreen,sphericalExcess,lensBenchmarkInput,lensBenchmarkReport} from '../src/project/lensFieldBenchmark';
import type {ScreenInput} from '../src/project/lensFieldBenchmark';
import {fiberLensFiberProject} from '../src/authoring/starter';
import {prescription,serializeProject,parseProject} from '../src/project/model';
import {powerQ} from '../src/project/foldedGaussian';
import type {QTensor} from '../src/project/foldedGaussian';
import {tensorOverlap} from '../src/project/tensorOverlap';
import {framePose} from '../src/authoring/commands';
import {frame,pose,compose} from '../src/surface/model';
const lambda=1310e-9;
function waist(w:number):QTensor{return [{re:0,im:Math.PI*w*w/lambda},{re:0,im:0},{re:0,im:0},{re:0,im:Math.PI*w*w/lambda}];}
function screen(w=100e-6):ScreenInput{return {wavelength:lambda,indexDelta:.5,frontRadius:.005,rearRadius:-.005,aperture:4*w,inputQ:waist(w),targetQ:powerQ(waist(w),200),inputCenter:[0,0],targetCenter:[0,0]};}
test('plane / index matching has analytic circular pupil energy and exact conditional normalization',()=>{
 const w=100e-6,s=screen(w);s.indexDelta=0;s.targetQ=s.inputQ;s.aperture=1.2*w;const r=integratePhaseScreen(s,64),T=1-Math.exp(-2*1.2**2);
 expect(r.pupilFraction).toBeCloseTo(T,12);expect(r.exactEta).toBeCloseTo(T,12);expect(r.quadraticPupilEta).toBeCloseTo(T,12);expect(r.phaseFidelity).toBeCloseTo(1,12);expect(r.referenceFidelity).toBeCloseTo(T,12);expect(r.rmsPhase).toBe(0);
 s.indexDelta=.5;s.frontRadius=s.rearRadius=0;expect(integratePhaseScreen(s,64)).toEqual(r);
});
test('stable sag residual matches independent sphere geometry, signed radii and quartic limit',()=>{
 for(const R of [.005,-.005])for(const rho of [.02,.1,.4]){const r=R*rho,direct=R-Math.sign(R)*Math.sqrt(R*R-r*r)-r*r/(2*R);expect(sphericalExcess(R,r*r)).toBeCloseTo(direct,15);}
 const R=.005,r=1e-7;expect(sphericalExcess(R,r*r)/(r**4/(8*R**3))).toBeCloseTo(1,8);expect(()=>sphericalExcess(R,R*R)).toThrow('cap');
});
// Independent composite Simpson oracle in radius, with direct sphere sag and
// explicit normalized circular irradiance; no production quadrature or Q algebra.
function radialOracle(s:ScreenInput,w:number){
 const N=16384,h=s.aperture/N,k=2*Math.PI/s.wavelength,P=s.indexDelta*(1/s.frontRadius-1/s.rearRadius);let T=0,re=0,im=0,m1=0,m2=0;
 const sag=(R:number,r:number)=>R-Math.sign(R)*Math.sqrt(R*R-r*r);
 for(let j=0;j<=N;j++){const r=j*h,weight=(j===0||j===N?1:j%2?4:2)*h/3*4*r/(w*w)*Math.exp(-2*r*r/(w*w)),phase=-k*s.indexDelta*(sag(s.rearRadius,r)-sag(s.frontRadius,r))-k*P*r*r/2;T+=weight;re+=weight*Math.cos(phase);im+=weight*Math.sin(phase);m1+=weight*phase;m2+=weight*phase*phase;}
 return {T,F:(re*re+im*im)/T,rms:Math.sqrt(m2/T-(m1/T)**2)};
}
test('finite-beam aberration and pupil diffraction overlap converge against independent radial integration',()=>{
 for(const sign of [1,-1]){const w=.00035,s=screen(w);s.aperture=.001;s.frontRadius*=sign;s.rearRadius*=sign;s.targetQ=powerQ(s.inputQ,sign*200);const expected=radialOracle(s,w);
  for(const n of [64,128,256]){const r=integratePhaseScreen(s,n);expect(r.pupilFraction).toBeCloseTo(expected.T,10);expect(r.exactEta).toBeCloseTo(expected.F,9);expect(r.referenceFidelity).toBeCloseTo(expected.F,9);expect(r.rmsPhase).toBeCloseTo(expected.rms,8);expect(r.quadraticPupilEta).toBeCloseTo(expected.T,10);}
 }
});
test('phase RMS scales with wavelength and the fourth power of beam radius in the small-footprint limit',()=>{
 const a=integratePhaseScreen(screen(80e-6),128),s=screen(160e-6),b=integratePhaseScreen(s,128);expect(b.rmsPhase/a.rmsPhase).toBeGreaterThan(15.9);expect(b.rmsPhase/a.rmsPhase).toBeLessThan(16.2);
 s.wavelength*=2;s.inputQ=s.inputQ.map(z=>({re:z.re/2,im:z.im/2})) as QTensor;s.targetQ=powerQ(s.inputQ,200);expect(integratePhaseScreen(s,128).rmsPhase).toBeCloseTo(b.rmsPhase/2,10);
});
test('adjoint Fresnel integral matches independent analytic thin Gaussian for offsets and rolled ellipses',()=>{
 const p=fiberLensFiberProject();if(p.model.kind!=='surface')throw Error('surface');p.model.sourceMode.mfdX=100e-6;p.model.sourceMode.mfdY=140e-6;p.model.targetMode.mfdX=120e-6;p.model.targetMode.mfdY=180e-6;
 const d=prescription(p);d.source.frame.origin.y=12e-6;d.source.frame.rotation.roll=.4;d.assemblies.at(-1)!.frame.origin.z=-7e-6;d.assemblies.at(-1)!.frame.rotation.roll=-.3;
 const input=lensBenchmarkInput(p),r=integratePhaseScreen(input.screen,256);expect(r.pupilFraction).toBeCloseTo(1,10);expect(r.quadraticPupilEta).toBeCloseTo(input.analyticEta,10);expect(Math.abs(r.exactEta-input.analyticEta)).toBeLessThan(Math.sqrt(Math.max(0,1-r.referenceFidelity))+1e-10);
});
test('reference gate distinguishes small and larger phase departure without certifying the physical train',async()=>{
 const p=fiberLensFiberProject(),before=serializeProject(p),mode=tensorOverlap(p),large=await assessLensBenchmark(p);
 expect(large.status).toBe('converged');expect(large.metrics!.referenceGate).toBe('exceeds-threshold');expect(large.physicalEtaErrorBound).toBeNull();expect(large.totalCoupling).toBeNull();expect(serializeProject(p)).toBe(before);expect(tensorOverlap(p)).toEqual(mode);
 if(p.model.kind==='surface'){p.model.sourceMode.mfdX=100e-6;p.model.sourceMode.mfdY=100e-6;p.model.targetMode.mfdX=100e-6;p.model.targetMode.mfdY=100e-6;}
 const small=await assessLensBenchmark(p);expect(small.status).toBe('converged');expect(small.metrics!.referenceGate).toBe('within-threshold');expect(await assessLensBenchmark(parseProject(serializeProject(p)))).toEqual(small);
});
test('unsupported fields / shape / tilt / topology never produce a physical or screen accuracy pass',async()=>{
 const mutations=[(p:ReturnType<typeof fiberLensFiberProject>)=>{prescription(p).assemblies[0].frame.rotation.yaw=.001;},(p:ReturnType<typeof fiberLensFiberProject>)=>{prescription(p).surfaces[0].shape='even-asphere';prescription(p).surfaces[0].conic=-1;},(p:ReturnType<typeof fiberLensFiberProject>)=>{p.authoring!.ports.source.phase='unspecified';},(p:ReturnType<typeof fiberLensFiberProject>)=>{const d=prescription(p);d.surfaces.push({...d.surfaces.at(-1)!,id:'ExtraOutput'});}];
 for(const mutate of mutations){const p=fiberLensFiberProject();mutate(p);const r=await assessLensBenchmark(p);expect(r.status).toBe('unsupported');expect(r.metrics).toBeNull();expect(r.physicalEtaErrorBound).toBeNull();}
});
test('cancellation and exact-input report invalidation suppress metrics and preserve Undo semantics',async()=>{
 const p=fiberLensFiberProject(),r=await assessLensBenchmark(p);expect(lensBenchmarkReport(p,r).state).toBe('current');expect(lensBenchmarkReport(p,null).state).toBe('not-calculated');expect(lensBenchmarkReport(p,r,true).result).toBeNull();expect(lensBenchmarkReport(p,{...r,engine:'old'}).result).toBeNull();
 const changed=structuredClone(p);prescription(changed).assemblies[0].frame.origin.y=1e-6;expect(lensBenchmarkReport(changed,r)).toMatchObject({state:'stale',result:null});expect(lensBenchmarkReport(p,r).result).toEqual(r);
 let calls=0;const cancelled=await assessLensBenchmark(p,{cancelled:()=>calls++>0});expect(cancelled.status).toBe('cancelled');expect(cancelled.metrics).toBeNull();
});
test('insufficient grid budget rejects aliased overlap even when the phase-fidelity integral appears stable',async()=>{
 const r=await assessLensBenchmark(fiberLensFiberProject(),{maxRadialNodes:128});expect(r.status).toBe('unresolved');expect(r.metrics!.referenceGate).toBe('unresolved');expect(r.metrics!.sample.maxPhaseStep).toBeGreaterThan(Math.PI);expect(r.metrics!.numericalErrorEstimate).toBeGreaterThan(2e-6);
});
test('a narrow field missed by a coarse pupil grid is refined or unresolved, never classified as unsupported physics',async()=>{
 const p=fiberLensFiberProject();prescription(p).assemblies[0].frame.origin.x=10e-6;if(p.model.kind==='surface'){p.model.sourceMode.mfdX=20e-6;p.model.sourceMode.mfdY=20e-6;}
 const r=await assessLensBenchmark(p);expect(r.status).not.toBe('unsupported');expect(['converged','unresolved']).toContain(r.status);if(r.status==='converged')expect(r.metrics!.sample.pupilFraction).toBeCloseTo(1,6);
});
test('screen geometry and integral are covariant under a full rigid transform',async()=>{
 const p=fiberLensFiberProject(),r=await assessLensBenchmark(p),d=prescription(p),g=frame(pose(.02,-.01,.03,.4,-.2,.3));d.source.frame=framePose(compose(g,frame(d.source.frame)));d.assemblies=d.assemblies.map(a=>({...a,parentId:'Global'}));d.assemblies.push({id:'Global',name:'Global',kind:'group',parentId:null,frame:framePose(g)});
 const transformed=await assessLensBenchmark(p);expect(transformed.status).toBe('converged');expect(transformed.metrics!.sample.exactEta).toBeCloseTo(r.metrics!.sample.exactEta,11);expect(transformed.metrics!.sample.referenceFidelity).toBeCloseTo(r.metrics!.sample.referenceFidelity,10);
});
test('thickness collapse is explicit: changing glass length changes physical Mode but not this screen surrogate',async()=>{
 const p=fiberLensFiberProject(),a=await assessLensBenchmark(p),physicalA=tensorOverlap(p);prescription(p).surfaces[1].frame.origin.x=.0015;
 const b=await assessLensBenchmark(p),physicalB=tensorOverlap(p);expect(b.status).toBe('converged');expect(b.metrics).toEqual(a.metrics);expect(b.thickness).not.toBe(a.thickness);expect(b.physicalEtaErrorBound).toBeNull();expect(physicalA.status).toBe('valid');expect(physicalB.status).toBe('valid');if(physicalA.status==='valid'&&physicalB.status==='valid')expect(physicalB.eta).not.toBe(physicalA.eta);
});
