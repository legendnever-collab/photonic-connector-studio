import {test,expect} from 'vitest';
import {isDeepStrictEqual} from 'node:util';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {benchmarkFixture,FIXTURE_VERSION,OFFSETS,fixedPorts} from './benchmark/fixture';
import {rayOracle,ORACLE_TOLERANCES} from './benchmark/rayOracle';
import {modeOracle} from './benchmark/modeOracle';
import {searchSynthesis,applySynthesis} from '../src/synthesis/engine';
import {checkLensMount,lensMountGoal} from '../src/synthesis/lensMount';
import {analyzeRouting} from '../src/routing/analysis';
import {screenClearance} from '../src/routing/clearance';
import {serializeProject,parseProject,prescription} from '../src/project/model';
import {tensorOverlap} from '../src/project/tensorOverlap';
import {solveFoldedGaussian} from '../src/project/foldedGaussian';
import {addLenses} from '../src/synthesis/construction';
import {prismFixture} from './prismFixtures';
import {defaultSynthesis} from '../src/synthesis/contract';
import {compile,frame} from '../src/surface/model';
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const same=isDeepStrictEqual;

// Assertions below qualify the harness and the stated model domain, never a
// production optical connector. A bounded not-found result is valid evidence.
test('Golden Benchmark 001: fixed Fiber–Fiber route, domain and negative controls',()=>{
 const checks:{name:string;status:'PASS'|'FAIL';detail?:unknown}[]=[];
 const check=(name:string,condition:boolean,detail?:unknown)=>checks.push({name,status:condition?'PASS':'FAIL',detail});
 const snapshots:unknown[]=[],cases:unknown[]=[];
 for(const offset of OFFSETS){
  const input=benchmarkFixture(offset),{project:p,problem,routing,options}=input,before=serializeProject(p),ports=fixedPorts(p);
  snapshots.push(input);
  const r=searchSynthesis(p,problem,routing,options);
  check(`${offset}: search leaves full input unchanged`,serializeProject(p)===before);
  check(`${offset}: input is supported`,!['invalid-input','unsupported','cancelled'].includes(r.status),r.reason);
  check(`${offset}: no free-Lens fallback`,r.alignmentEvaluated===0&&!r.candidates.some(c=>c.recipe.kind==='aligned-direct'));
  const candidates=r.candidates.map(c=>{
   const route=analyzeRouting(c.project),oracle=route.path?rayOracle(c.project,route.path):null;
   const clearance=route.path?screenClearance(c.project,[],route.path,problem.routes.clearance):'No path';
   let mount=true;try{checkLensMount(c.project,options);}catch{mount=false;}
   check(`${offset}/${c.id}: Preview ports and modes invariant`,same(fixedPorts(c.project),ports));
   check(`${offset}/${c.id}: independent ray conservation`,oracle?.status==='PASS',oracle);
   check(`${offset}/${c.id}: production clearance and coaxial gates`,clearance===null&&mount&&!!route.withinTolerance);
   const q=applySynthesis(p,r,c.id),v=tensorOverlap(q),replayed=parseProject(serializeProject(q));
   const independentMode=modeOracle(q,route.path!);
   check(`${offset}/${c.id}: independent scalar overlap`,v.status==='valid'&&Math.abs(v.eta-independentMode.eta)<1e-9,{independentMode,production:v});
   check(`${offset}/${c.id}: Apply and save/load invariant`,same(fixedPorts(q),ports)&&same(fixedPorts(replayed),ports));
   check(`${offset}/${c.id}: Apply repeats overlap`,v.status==='valid'&&c.eta!==null&&Math.abs(v.eta-c.eta)<1e-10,v);
   check(`${offset}/${c.id}: qualified preserves terminal mounts`,!c.qualified||lensMountGoal(q,options));
   const d=prescription(q),surfaces=compile(d);
   // Independent nominal Port–Lens axis test using compiled surface vertices.
   const src=frame(d.source.frame),target=surfaces.at(-1)!.world;
   const dot=(a:{x:number;y:number;z:number},b:{x:number;y:number;z:number})=>a.x*b.x+a.y*b.y+a.z*b.z;
   const counts=Object.fromEntries(['lens','mirror','prism'].map(kind=>[kind,d.assemblies.filter(a=>a.kind===kind).length]));
   check(`${offset}/${c.id}: independent part limits`,Object.entries(counts).every(([kind,count])=>count<=routing.parts[kind as keyof typeof routing.parts])&&Object.values(counts).reduce((a,b)=>a+b,0)<=problem.maxParts);
   const mounts=d.assemblies.filter(a=>a.kind==='lens').map(a=>{
    const faces=surfaces.filter(s=>s.assemblyId===a.id);
    const distances=[src,target].map(f=>Math.max(...faces.map(s=>{
     const dx=s.world.origin.x-f.origin.x,dy=s.world.origin.y-f.origin.y,dz=s.world.origin.z-f.origin.z;
     const projection=dx*f.axes[0].x+dy*f.axes[0].y+dz*f.axes[0].z;
     return Math.hypot(dx-projection*f.axes[0].x,dy-projection*f.axes[0].y,dz-projection*f.axes[0].z);
    })));
    const body=q.bodies.find(b=>b.assemblyId===a.id);
    if(body?.kind==='lens'&&faces.length===2){
     const r=body.outerRadius,sag=(R:number,r:number)=>R-Math.sign(R)*Math.sqrt(R*R-r*r);
     const spacing=Math.hypot(faces[1].world.origin.x-faces[0].world.origin.x,faces[1].world.origin.y-faces[0].world.origin.y,faces[1].world.origin.z-faces[0].world.origin.z);
     const edge=spacing+sag(faces[1].radius,r)-sag(faces[0].radius,r);
     check(`${offset}/${c.id}/${a.id}: independent finite Lens thickness`,Number.isFinite(edge)&&Math.min(spacing,edge)>0,{spacing,edge,outerRadius:r});
     if(c.recipe.kind==='generated'){const clear=c.recipe.clear;check(`${offset}/${c.id}/${a.id}: declared generated dimensions`,spacing>=options.thickness[0]-1e-12&&spacing<=options.thickness[1]+1e-12&&faces.every(s=>s.aperture===clear));}
    }
    const aligned=[src,target].some((f,i)=>distances[i]<=1e-9&&faces.every(s=>dot(s.world.axes[0],f.axes[0])>=1-1e-10));
    check(`${offset}/${c.id}/${a.id}: independent mount`,aligned);
    return {id:a.id,distances,aligned};
   });
   return {id:c.id,topology:c.topology,qualified:c.qualified,qualificationScope:'nominal conditional Gaussian goals only',
    recipe:c.recipe,values:c.values,project:q,projectSHA256:hash(q),mounts,rayOracle:oracle,clearance,
    conditionalOverlap:v,independentMode,throughput:{status:'Uncomputed'},totalCoupling:{status:'Uncomputed'},
    robustness:{oat:c.oat,joint:c.joint??{status:'Uncomputed'},assemblyYield:{status:'Uncomputed'}}};
  });
  if(offset===0||offset===500e-6)check(`${offset}: existing nominal regression has candidate`,r.candidates.some(c=>c.qualified));
  if(Math.abs(offset)===50e-6||offset===100e-6)check(`${offset}: result is candidate or explained bounded search`,r.candidates.length>0||Object.keys(r.rejected).length>0);
  const source=ports.sourceFrame,target=ports.targetFrame,delta=[target.origin.x-source.origin.x,target.origin.y-source.origin.y,target.origin.z-source.origin.z],axis=[source.axes[0].x,source.axes[0].y,source.axes[0].z];
  const axial=delta.reduce((sum:number,v:number,i:number)=>sum+v*axis[i],0),directResidualM=Math.hypot(...delta.map((v:number,i:number)=>v-axial*axis[i]));
  cases.push({offsetM:offset,inputSHA256:hash(input),input,
   directNoOptics:{status:directResidualM>routing.positionTolerance?'infeasible-under-stated-constraints':'geometric-route-only',positionResidualM:directResidualM,scope:'fixed straight chief ray in air; not a verdict on folded topologies'},
   status:r.candidates.some(c=>c.qualified)?'nominal-candidate-in-supported-model':r.candidates.length?'partial-candidate':'not-found-within-search-budget',
   searchStatus:r.status,reason:r.reason,evaluated:r.evaluated,alignmentEvaluated:r.alignmentEvaluated,geometryEvaluated:r.geometryEvaluated,
   toleranceEvaluated:r.toleranceEvaluated,rejected:r.rejected,families:r.families,diagnostics:r.diagnostics,allocationCoverage:r.allocationCoverage,candidates,
   undoRedo:{status:'Uncomputed',reason:'React Store lifecycle is exercised separately by browser E2E, not emulated in model harness.'}});
 }
 // Independent fixtures, no synthesis-generated negative-path geometry.
 const prism=prismFixture('two');prism.routing={...benchmarkFixture(0).routing,parts:{lens:2,mirror:2,prism:2}};const route=analyzeRouting(prism);
 check('independent two-Prism ray reference',!!route.path&&rayOracle(prism,route.path).status==='PASS');
 const bad=structuredClone(route.path!);bad.hits[0].point.y+=10e-6;bad.points[1].y=bad.hits[0].point.y;
 check('artificial free-space bend rejected by oracle',rayOracle(prism,bad).issues.includes('free-space-bend'),rayOracle(prism,bad));
 const noFold=structuredClone(prism);prescription(noFold).surfaces.find(s=>s.interaction==='tir')!.interaction='probe';
 const missing=analyzeRouting(noFold);check('missing fold cannot close physical ray',missing.withinTolerance!==true,missing);
 const small=structuredClone(prism);prescription(small).surfaces[0].aperture=1e-9;
 const offaxis=prescription(small);offaxis.source.frame.origin.y=10e-6;
 const clipping=analyzeRouting(small);check('finite aperture rejects off-axis ray',clipping.status==='blocked'&&/clipping/.test(clipping.reason),clipping.reason);
 const collision=structuredClone(prism);const cd=prescription(collision);
 // Identical finite prisms have a positive-volume overlap witness; this is
 // stronger than merely repeating the AABB routine's boolean classification.
 cd.assemblies.find(a=>a.id==='B')!.frame=structuredClone(cd.assemblies.find(a=>a.id==='A')!.frame);
 const collisionReason=screenClearance(collision,[],route.path!,1e-6);
 check('coincident finite bodies rejected',/clearance conflict/.test(collisionReason??''),collisionReason);
 const keepout=structuredClone(prism);keepout.routing={...benchmarkFixture(0).routing,parts:{lens:2,mirror:2,prism:2},keepOut:[{min:{x:.001,y:-.0001,z:-.0001},max:{x:.002,y:.0001,z:.0001}}]};
 const keepoutReason=screenClearance(keepout,[],route.path!,1e-6);
 check('straight source segment through keep-out rejected',/Keep-out/.test(keepoutReason??''),keepoutReason);
 const powered=addLenses(prism,1,.001,{...defaultSynthesis(),lensMount:'free'},'last');
 for(const s of prescription(powered).surfaces.filter(s=>prescription(powered).assemblies.some(a=>a.id===s.assemblyId&&a.kind==='lens')))s.radius=Math.sign(s.radius)*.02;
 const unsupported=tensorOverlap(powered);
 check('powered Lens after TIR remains Uncomputed',unsupported.status==='not-calculated'&&/powered.*after|oblique.*TIR/.test(unsupported.reason),unsupported);
 const beam=solveFoldedGaussian(powered);check('unsupported field negative control has valid Gaussian transport',beam.status==='valid');
 const mirror=prismFixture('mirrors');mirror.routing=prism.routing;const mirrorPath=analyzeRouting(mirror).path!;
 check('independent Mirror reflection reference',rayOracle(mirror,mirrorPath).status==='PASS');
 const wrongReflection=structuredClone(mirrorPath);wrongReflection.hits[0].direction={x:1,y:0,z:0};
 check('incorrect Mirror reflection rejected',rayOracle(mirror,wrongReflection).issues.includes('reflection-law'));
 const wrongSnell=structuredClone(route.path!);wrongSnell.hits[0].direction={x:Math.cos(.01),y:Math.sin(.01),z:0};
 check('incorrect Snell refraction rejected',rayOracle(prism,wrongSnell).issues.includes('Snell-law'));
 const signed=cases as {offsetM:number;status:string;rejected:unknown}[];const plus=signed.find(c=>c.offsetM===50e-6)!,minus=signed.find(c=>c.offsetM===-50e-6)!;
 check('signed 50 µm diagnosis symmetry',plus.status===minus.status&&same(plus.rejected,minus.rejected));
 const divergence=prismFixture();if(divergence.model.kind==='surface'){divergence.model.sourceMode.mfdX=divergence.model.sourceMode.mfdY=40e-6;}
 const outOfDomain=tensorOverlap(divergence);check('out-of-model is separate from zero coupling',outOfDomain.status==='not-calculated'&&/^Out of domain:/.test(outOfDomain.reason),outOfDomain);
 const negativeControls={outOfDomain:{status:'out-of-model',result:outOfDomain},wrongReflection:rayOracle(mirror,wrongReflection),wrongSnell:rayOracle(prism,wrongSnell),artificialBend:rayOracle(prism,bad),missingFold:missing,aperture:clipping,collisionReason,keepoutReason,
  poweredAfterPrism:{input:powered,transportStatus:beam.status,overlap:unsupported,status:'Uncomputed'}};
 const sourceFiles=['tests/goldenBenchmark.test.ts','tests/benchmark/fixture.ts','tests/benchmark/rayOracle.ts','tests/benchmark/modeOracle.ts','tests/prismFixtures.ts'];
 const gitSHA=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
 const report={schemaVersion:1,fixtureVersion:FIXTURE_VERSION,gitSHA,
  physicsBaseSHA:'d581717447dd4f6b0ce94c14e847b3361ab0f013',guidanceSHA:'5530329ed0b9c4d553c1e9385e0a429cffd012f0',
  trackedChanges:execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),
  harnessSHA256:hash(sourceFiles.map(path=>({path,content:readFileSync(path,'utf8')}))),fixtureSHA256:hash(snapshots),
  runtime:{node:process.version,platform:process.platform,arch:process.arch},command:'npm run benchmark:golden',
  ci:process.env.GITHUB_RUN_ID?{runID:process.env.GITHUB_RUN_ID,headSHA:process.env.GOLDEN_HEAD_SHA??null}:null,
  scope:{units:'SI',specification:'provisional synthetic reference; not production certification',na:{status:'Uncomputed',reason:'no measured/catalog NA in source fixture',gaussianDivergenceRad:1310e-9/(Math.PI*9.2e-6/2)},
   oracleTolerances:ORACLE_TOLERANCES,clearance:'Conservative AABB screening, not exact solid collision certification',
   initialGeometry:'basicRelayReference: retained initial 1 mm thick Lenses differ from generated 50–300 µm manufacturing range; both are recorded',
   unverified:['full-wave / complete diffraction','expanded-beam collimation criterion','total coupling / throughput / coating loss','exact 3D collision / manufacturing certification','assembly yield','joint tolerance sweep','browser Undo/Redo (see separate E2E)']},
  cases,negativeControls,checks,status:checks.every(c=>c.status==='PASS')?'PASS':'FAIL'};
 mkdirSync('test-results',{recursive:true});writeFileSync('test-results/golden-001.json',JSON.stringify(report,null,2)+'\n');
 expect(checks.filter(c=>c.status==='FAIL')).toEqual([]);
},120000);
