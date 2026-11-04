import {isDeepStrictEqual} from 'node:util';
import {test,expect} from 'vitest';
import {angleFixture} from './benchmark/foldFixture';
import {fixedPorts,benchmarkFixture} from './benchmark/fixture';
import {rayOracle} from './benchmark/rayOracle';
import {checkLensMount} from '../src/synthesis/lensMount';
import {lensDomain,lensValues,lensBounds,buildLensProject} from '../src/lens/domain';
import {analyzeRouting} from '../src/routing/analysis';
import {screenClearance} from '../src/routing/clearance';
import {addLenses,synthesisLensOptions,emptyTrain} from '../src/synthesis/construction';
import {prescription,serializeProject} from '../src/project/model';
import {compile,V,frame,compose,pose} from '../src/surface/model';
import {framePose} from '../src/authoring/commands';
import {traceRay} from '../src/surface/trace';
import {tracePupilRay} from '../src/project/pupilRay';
import {solveFoldedGaussian} from '../src/project/foldedGaussian';
import {assessTrainPupil} from '../src/project/trainPupilBenchmark';
import {tensorOverlap} from '../src/project/tensorOverlap';
import {projectedMask,rayFlux,paraxialSections,launchInput,cylinderEntry,fluxConvergence,lensPrefixPhase} from './benchmark/finiteBeamReference';
import {segmentCylinderDistance} from './benchmark/clearanceOracle';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';

const relayFixture=(f:ReturnType<typeof angleFixture>)=>{const d=prescription(f.fixture.project);return addLenses(f.project,2,f.options.clearRadius,f.fixture.options,'first',[...d.assemblies.map(a=>a.id),...d.surfaces.map(s=>s.id)]);};

test('D2.8-A finite-beam feasibility: fixed 23-degree fold, controls and bounded Lens placement',async()=>{
 const checks:{name:string;status:'PASS'|'FAIL';detail?:unknown}[]=[];
 const check=(name:string,value:boolean,detail?:unknown)=>checks.push({name,status:value?'PASS':'FAIL',detail});
 const cases=[];
 for(const offset of [50e-6,-50e-6]){
  const f=angleFixture(offset,23),p=relayFixture(f),raw=serializeProject(p),ports=fixedPorts(f.fixture.project),route=analyzeRouting(p);
  checkLensMount(p,f.fixture.options);check(`${offset}: geometry and immutable ports`,route.withinTolerance===true&&screenClearance(p,[],route.path!,f.options.clearance)===null&&isDeepStrictEqual(fixedPorts(p),ports));
  check(`${offset}: independent chief Reflection / Snell`,rayOracle(p,route.path!).status==='PASS');
  const formal=paraxialSections(p),flux=[128,256,512].map(n=>rayFlux(p,n)),convergence=fluxConvergence(flux);
  const gaussian=solveFoldedGaussian(p,{sampleSegments:false}),mode=tensorOverlap(p),pupil=await assessTrainPupil(p),prefixPhase=[16,32,64].map(n=>lensPrefixPhase(p,n));
  check(`${offset}: first Lens phase reference refinement`,Math.max(...prefixPhase.slice(1).map((v,i)=>Math.abs(v.rmsOPD-prefixPhase[i].rmsOPD)))<2e-11&&prefixPhase.every(v=>v.minimumJacobian>1e-6&&v.blockedPower<1e-6),prefixPhase);
  check(`${offset}: legacy field gates remain intact`,gaussian.status==='out-of-domain'&&mode.status==='not-calculated'&&pupil.status==='unsupported');
  check(`${offset}: independent-source ray ledger`,flux.every(x=>Math.abs(x.passed+x.shadow+x.aperture+x.other+x.tailPower-1)<1e-9));
  check(`${offset}: numerical ray flux converged`,convergence.status==='converged',convergence);
  check(`${offset}: substantial geometrical obstruction`,flux.at(-1)!.shadow>.7&&flux.at(-1)!.passed<.25);
  check(`${offset}: full Project remains unchanged`,serializeProject(p)===raw);
  cases.push({offset,input:p,geometry:'PASS',gaussian,conditionalOverlap:{status:'Uncomputed',evaluation:mode},legacyPupil:pupil,
   prefixPhase,formalParaxial:{status:'out-of-model extrapolation; not a computed physical field',surfaces:formal},flux,convergence,
   classification:{clippingShadowing:'Computed only as geometrical ray flux',lensAberration:'Gaussian footprint gate fails; aberrated diffracted Mode uncomputed',search:'This is the fixed D2.7 Seed; global optimization is not attempted',uncomputed:['Post-launch diffraction / edge scattering','Transmitted field and Mode overlap','Coatings / Fresnel / multiple scattering / total coupling','Assembly Yield']}});
 }
 check('signed 50 um ray-flux symmetry',isDeepStrictEqual(cases[0].flux,cases[1].flux));
 const f=angleFixture(50e-6,23),local=[32,64,128,256,512].map(n=>rayFlux(f.project,n,{w:50e-6,origin:V(.004),direction:V(1),u:V(0,1),v:V(0,0,1)})),reference=[512,1024,2048,4096].map(steps=>({steps,...projectedMask(50e-6,50e-6,23,200e-6,220e-6,steps)}));
 const last=local.at(-1)!,ref=reference.at(-1)!;
 check('independent 1D mask agrees with 3D ray obstruction',Math.abs(last.passed-ref.clearTransmission)<2e-4&&Math.abs(last.sequentialReached-ref.apertureTransmission)<2e-4,{rays:last,reference:ref});
 check('projected-mask quadrature converges',Math.max(...reference.slice(1).map((v,i)=>Math.abs(v.clearTransmission-reference[i].clearTransmission)))<1e-6);
 check('fine ray mask converges, coarse mask remains unresolved',fluxConvergence(local).status==='converged'&&fluxConvergence(local.slice(0,3)).status==='unresolved');
 const masks=[21,23,25].flatMap(degrees=>[5,10,20,50,100].map(w=>({degrees,w:w*1e-6,rayleighRange:Math.PI*(w*1e-6)**2/1310e-9,foldLength:50e-6/Math.sin(degrees*Math.PI/180),...projectedMask(w*1e-6,50e-6,degrees)})));
 const bounded=[];
 for(const degrees of [21,23,25])for(const positionFactor of [.8,1,1.2]){
  const f=angleFixture(50e-6,degrees),base=relayFixture(f),domain=lensDomain(base,'existing',false),values=lensValues(domain),options=synthesisLensOptions(base,f.fixture.problem,f.fixture.options,1),bounds=lensBounds(options);
  const shift=values[0]*(positionFactor-1);values[0]+=shift;values[4]-=shift;
  check(`${degrees}/${positionFactor}: declared manufacturing bounds`,values.every((x,i)=>x>=bounds[i][0]-1e-12&&x<=bounds[i][1]+1e-12));
  const p=buildLensProject(domain,values),r=analyzeRouting(p),geometry=r.withinTolerance===true&&screenClearance(p,[],r.path!,f.options.clearance)===null;
  checkLensMount(p,f.fixture.options);check(`${degrees}/${positionFactor}: geometry and Port/Mode invariance`,geometry&&isDeepStrictEqual(fixedPorts(p),fixedPorts(f.fixture.project)));
  const gaussian=solveFoldedGaussian(p,{sampleSegments:false}),mode=tensorOverlap(p),formal=paraxialSections(p),flux=geometry?rayFlux(p,64):null;
  bounded.push({degrees,positionFactor,values,bounds,input:p,geometry:geometry?'PASS':'FAIL',gaussian,mode,formal,coarseFlux:flux,convergence:'Unresolved: one grid; diagnostic only, not optimization or qualification'});
 }
 const sourceFiles=['tests/finiteBeamBenchmark.test.ts','tests/benchmark/finiteBeamReference.ts','tests/benchmark/foldFixture.ts','tests/benchmark/clearanceOracle.ts','src/project/pupilRay.ts','src/project/trainPupilBenchmark.ts','src/project/foldedGaussian.ts','src/project/tensorOverlap.ts','src/surface/trace.ts'];
 const report={schemaVersion:1,statusMeaning:'Benchmark assertions, not connector qualification',opticalFeasibility:{status:'Uncomputed',reason:'No validated end-to-end diffracted Field / Mode evaluator for this clipped and shadowed fold'},status:checks.every(x=>x.status==='PASS')?'PASS':'FAIL',command:'npm run benchmark:finite-beam',baselineSHA:'aaccdf9504d1a0362467bb6253099f282a6cbe96',
  gitSHA:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),headSHA:process.env.GOLDEN_HEAD_SHA??null,trackedChanges:execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),runtime:{node:process.version,platform:process.platform},
  sourceSHA256:Object.fromEntries(sourceFiles.map(f=>[f,createHash('sha256').update(readFileSync(f)).digest('hex')])),units:'SI',checks,cases,
  independentMask:{local,reference,convergence:fluxConvergence(local),scope:'Counterfactual local plane-front Gaussian mask; fixed Port source is NOT replaced with this beam'},
  bounded:{lensPlacements:bounded,localBeamRadiusStudy:masks,scope:'3 angles x 3 symmetric Lens positions at fixed seed curvatures; 3 angles x 5 hypothetical local beam radii. No completeness or free Beam-Radius variable claim.'},
  totalCoupling:{status:'Uncomputed'},physicalEtaErrorBound:null};
 mkdirSync('benchmark-results',{recursive:true});writeFileSync('benchmark-results/d28a-finite-beam.json',JSON.stringify(report,null,2));
 expect(checks.filter(x=>x.status==='FAIL')).toEqual([]);
},120000);

test('finite cylinder intersections agree with D2.7 independent distance minimization',()=>{
 const c={front:V(),normal:V(1),radius:220e-6,thickness:20e-6};
 for(const z of [0,200e-6,220e-6,221e-6])for(const y of [-.001,0,.001]){
  const a=V(-.001,y,z),b=V(.001,-y,z),distance=segmentCylinderDistance(a,b,c),hit=cylinderEntry(a,b,c);
  if(distance>1e-10)expect(hit).toBeNull();if(distance<1e-13)expect(hit).not.toBeNull();
 }
});
test('finite input Lens rays reuse D2.6 independent pupil Snell geometry',()=>{
 const f=angleFixture(50e-6,23),p=relayFixture(f),s=launchInput(p),ss=compile(prescription(p)).slice(0,2);
 for(const y of [0,10e-6,30e-6,60e-6,100e-6]){
  const dy=s.inputC[0]*y,origin=V(s.launch,y),direction=V(Math.sqrt(1-dy*dy),dy),r=traceRay({origin,direction,n:1,channel:'reference'},ss),a=tracePupilRay(s.faces,[origin.x,origin.y,origin.z],[direction.x,direction.y,direction.z],s.exit);
  expect(r.status).toBe('reached');const last=r.hits.at(-1)!,t=(s.exit-last.point.x)/last.direction.x;
  expect(a.point[1]).toBeCloseTo(last.point.y+t*last.direction.y,12);expect(a.opl).toBeCloseTo(last.opl+t,12);expect(a.direction[1]).toBeCloseTo(last.direction.y,12);
 }
});

test('analytical controls: circular pupil flux, projected ellipse and free Gaussian curvature',()=>{
 const f=benchmarkFixture(0),p=emptyTrain(f.project,f.problem),d=prescription(p),w=40e-6;
 d.surfaces.at(-1)!.aperture=3.5*w/4;
 const flux=rayFlux(p,64,{w,origin:V(),direction:V(1),u:V(0,1),v:V(0,0,1)}),expected=1-Math.exp(-2*(3.5/4)**2);
 expect(flux.passed).toBeCloseTo(expected,12);expect(flux.shadow).toBe(0);expect(flux.passed+flux.aperture+flux.tailPower).toBeCloseTo(1,12);
 const row=paraxialSections(p).at(-1)!,zr=Math.PI*(9.2e-6/2)**2/d.wavelength;
 expect(row.w).toBeCloseTo(4.6e-6*Math.sqrt(1+(.01/zr)**2),12);expect(row.curvature).toBeCloseTo(.01/(.01**2+zr**2),10);
 for(const degrees of [21,23,25]){
  const s=Math.sin(degrees*Math.PI/360),a=200e-6,N=8192;let integral=0;
  for(let i=0;i<N;i++){const phi=2*Math.PI*(i+.5)/N,limit2=a*a/(Math.cos(phi)**2+Math.sin(phi)**2/(s*s));integral+=(1-Math.exp(-2*limit2/(w*w)))/N;}
  expect(projectedMask(w,.001,degrees).apertureTransmission).toBeCloseTo(integral,10);
 }
});

test('finite-ray flux is covariant under a common rigid transform; invalid reference domains fail closed',()=>{
 const f=angleFixture(50e-6,23),p=relayFixture(f),a=rayFlux(p,32),d=prescription(p),g=frame(pose(.02,-.01,.03,.4,-.3,.2));
 d.source.frame=framePose(compose(g,frame(d.source.frame)));
 d.assemblies.forEach(x=>{if(!x.parentId)x.parentId='Reference-world';});
 d.assemblies.push({id:'Reference-world',name:'Reference world',kind:'group',parentId:null,frame:framePose(g)});
 const b=rayFlux(p,32);for(const k of ['passed','aperture','shadow','other','sequentialReached'] as const)expect(b[k]).toBeCloseTo(a[k],11);
 expect(()=>rayFlux(p,0)).toThrow('Grid');expect(()=>projectedMask(0,50e-6,23)).toThrow('domain');expect(()=>projectedMask(50e-6,50e-6,90)).toThrow('domain');
 expect(fluxConvergence([a])).toMatchObject({status:'unresolved',maxChange:null,physicalErrorBound:null});
});
