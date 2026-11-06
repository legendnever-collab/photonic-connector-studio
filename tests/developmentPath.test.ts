import {test,expect} from 'vitest';
import {isDeepStrictEqual} from 'node:util';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {benchmarkFixture,fixedPorts} from './benchmark/fixture';
import {rayOracle} from './benchmark/rayOracle';
import {rayFlux,fluxConvergence} from './benchmark/finiteBeamReference';
import {searchSynthesis} from '../src/synthesis/engine';
import {emptyTrain} from '../src/synthesis/construction';
import {checkLensMount} from '../src/synthesis/lensMount';
import {searchRouting} from '../src/routing/search';
import {analyzeRouting} from '../src/routing/analysis';
import {screenClearance} from '../src/routing/clearance';
import {prescription,serializeProject} from '../src/project/model';
import {assessTrainPupil} from '../src/project/trainPupilBenchmark';

// Screening only: production's `qualified` denotes its nominal Gaussian goals,
// not a validated physical connector. No default mount policy is changed.
test('D2.8-D explicit free-Lens and existing Prism screening at fixed Ports',async()=>{
 const checks:{name:string;status:'PASS'|'FAIL'}[]=[];
 const check=(name:string,ok:boolean)=>checks.push({name,status:ok?'PASS':'FAIL'});
 const cases=[];
 for(const offset of [50e-6,-50e-6,500e-6]){
  const f=benchmarkFixture(offset),before=serializeProject(f.project),ports=fixedPorts(f.project);
  const options={...f.options,lensMount:'free' as const,lensAlignment:{decenter:.001,tilt:.02},families:['direct' as const],budget:512,fitBudget:64,geometryBudget:8};
  const result=searchSynthesis(f.project,f.problem,f.routing,options);
  const generated=result.candidates.filter(c=>c.recipe.kind==='aligned-direct');
  for(const c of result.candidates){
   check(`${offset}/${c.id}: Port position/orientation/Mode invariant`,isDeepStrictEqual(fixedPorts(c.project),ports));
   checkLensMount(c.project,options);
  }
  const best=[...generated].sort((a,b)=>(b.eta??-1)-(a.eta??-1))[0];
  let selected=null;
  if(best){
   const route=analyzeRouting(best.project),clearance=route.path?screenClearance(best.project,[],route.path,f.problem.routes.clearance):'No path';
   check(`${offset}: independent Snell geometry`,!!route.path&&rayOracle(best.project,route.path).status==='PASS');
   check(`${offset}: chief closure and body clearance`,route.withinTolerance===true&&clearance===null);
   const flux=[32,64,128].map(n=>rayFlux(best.project,n)),convergence=fluxConvergence(flux);
   check(`${offset}: geometric flux ledger`,flux.every(x=>Math.abs(x.passed+x.aperture+x.shadow+x.other+x.tailPower-1)<1e-9));
   // The existing ray-pupil reference may reject a valid tilted Gaussian train.
   // Record that boundary explicitly; do not coerce it into a physical pass.
   const pupil=await assessTrainPupil(best.project);
   check(`${offset}: no physical efficiency from pupil`,pupil.totalCoupling===null&&pupil.physicalEtaErrorBound===null);
   const d=prescription(best.project);
   const lenses=d.assemblies.filter(a=>a.kind==='lens'&&d.surfaces.some(s=>s.assemblyId===a.id));
   check(`${offset}: generated two-Lens count`,lenses.length===2);
   selected={id:best.id,recipe:best.recipe,input:best.project,values:best.values,
    nominalGaussianGoalsMet:best.qualified,conditionalGaussianOverlap:best.eta,
    comparisonClass:best.comparisonClass,evaluator:best.evaluator,merit:best.merit,oat:best.oat,
    geometry:{positionErrorM:route.positionError,angleErrorRad:route.angleError,clearance,oracle:rayOracle(best.project,route.path!)},
    lenses,flux,fluxConvergence:convergence,pupil,
    physicalConnectorQualified:false,totalCoupling:null,assemblyYield:null};
  }
  if(Math.abs(offset)===50e-6)check(`${offset}: existing explicit free-Lens positive control`,!!best?.qualified&&(best.eta??0)>.99);
  const base=emptyTrain(f.project,f.problem);base.routing=f.routing;
  const prismOptions={...f.problem.routes,templates:['prism1','mirror-prism','prism2'] as const,
   clearRadius:f.options.clearRadius[0],prismLeg:4*f.options.clearRadius[0],mirrorThickness:20e-6};
  const prisms=searchRouting(base,{...prismOptions,templates:[...prismOptions.templates]});
  check(`${offset}: no undeclared two-Prism cap change`,base.routing.parts.prism===1&&prisms.candidates.every(c=>c.topology!=='prism2'));
  check(`${offset}: pure 90-degree Prism cannot connect parallel axes`,prisms.candidates.every(c=>c.topology!=='prism1'));
  check(`${offset}: all inputs unchanged`,serializeProject(f.project)===before);
  cases.push({offsetM:offset,fixedPorts:ports,freeLens:{options,status:result.status,reason:result.reason,
   evaluated:result.evaluated,alignmentEvaluated:result.alignmentEvaluated,rejected:result.rejected,
   generatedCandidateCount:generated.length,selected,
   absentMeaning:'not-found-within-stated-budget, never impossibility'},
   existingPrisms:{options:prismOptions,partCaps:f.routing.parts,status:prisms.status,evaluated:prisms.evaluated,rejected:prisms.rejected,
    candidates:prisms.candidates.map(c=>({topology:c.topology,input:c.project,geometry:c.analysis})),
    twoRightAnglePrismMinimumLateralM:prismOptions.prismLeg+prismOptions.clearance,
    scope:'Existing normal-entry right-angle families only; no new Prism shape, cap or manufacturing policy'}});
 }
 const sourceFiles=['tests/developmentPath.test.ts','tests/benchmark/fixture.ts','tests/benchmark/rayOracle.ts','tests/benchmark/finiteBeamReference.ts',
  'src/synthesis/engine.ts','src/synthesis/contract.ts','src/synthesis/construction.ts','src/synthesis/lensMount.ts','src/lens/alignment.ts','src/routing/search.ts','src/project/trainPupilBenchmark.ts'];
 const report={schemaVersion:1,baselineSHA:'f39c24ca1fb3ea07e55332ecbb6113ac80d4a89a',
  gitSHA:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),headSHA:process.env.GOLDEN_HEAD_SHA??null,
  trackedChanges:execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),runtime:{node:process.version},
  sourceSHA256:Object.fromEntries(sourceFiles.map(f=>[f,createHash('sha256').update(readFileSync(f)).digest('hex')])),
  units:'SI',status:checks.every(c=>c.status==='PASS')?'PASS':'FAIL',checks,cases,
  scope:'Bounded screening using unchanged engines; optical throughput and joint assembly Yield remain Uncomputed',
  physicalConnectorQualified:false,totalCoupling:null};
 mkdirSync('benchmark-results',{recursive:true});writeFileSync('benchmark-results/d28d-topology.json',JSON.stringify(report,null,2)+'\n');
 expect(checks.filter(c=>c.status==='FAIL')).toEqual([]);
},120000);
