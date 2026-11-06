import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {expect,test} from 'vitest';
import {assessJoint,defaultJointTolerance,jointAxes,jointComponents,jointSamples,perturbJoint} from '../src/design/joint';
import type {JointSample} from '../src/design/joint';
import type {JointTolerance} from '../src/design/jointContract';
import {solveFoldedGaussian} from '../src/project/foldedGaussian';
import {ProjectSchema,prescription,serializeProject} from '../src/project/model';
import type {Project} from '../src/project/model';
import {TENSOR_OVERLAP_ID,tensorOverlap} from '../src/project/tensorOverlap';
import {assessTrainPupil} from '../src/project/trainPupilBenchmark';
import {analyzeRouting} from '../src/routing/analysis';
import {screenClearance} from '../src/routing/clearance';
import {compile} from '../src/surface/model';
import type {Vec} from '../src/surface/model';
import {benchmarkFixture,fixedPorts} from './benchmark/fixture';
import fixture from './benchmark/s2-free-lens-fixture.json';
import {checkRigidMotion,RIGID_CHECK_TOLERANCE} from './benchmark/s2RigidOracle';
import type {LensMotion,RigidError,XYZ} from './benchmark/s2RigidOracle';

const SHA256=(value:string)=>createHash('sha256').update(value).digest('hex');
const zero=():RigidError=>({position:[0,0,0],angle:[0,0,0]});
const xyz=({x,y,z}:Vec):XYZ=>[x,y,z];
const abs=(v:XYZ)=>v.map(Math.abs) as XYZ;
const front=(p:Project,id:string)=>compile(prescription(p)).find(s=>s.assemblyId===id)!.world;
const midpoint:Vec={x:.005,y:0,z:0}; // Rail datum on the source axis, halfway in X.
const localProbes=[
  {name:'axial-x',kind:'position',axis:0,amplitude:10e-6},
  {name:'decenter-y',kind:'position',axis:1,amplitude:1e-6},
  {name:'decenter-z',kind:'position',axis:2,amplitude:1e-6},
  {name:'tilt-y',kind:'angle',axis:1,amplitude:1e-3},
  {name:'tilt-z',kind:'angle',axis:2,amplitude:1e-3},
] as const;
const groupProbe:RigidError={position:[0,.5e-6,.5e-6],angle:[0,.2e-3,.2e-3]};
const fingerprints=[
  '5785fa9714e893d94d824745e055de6387a4dfc3e1cc74ae662245a239ffefe4',
  '70cdbb12b660f09438d407f1dfbb9e07e4998fc782d97e0d582f3b29c0b9e682',
];

function mirror(error:RigidError,offset:number):RigidError{
  if(offset>0)return error;
  const {position:[x,y,z],angle:[rx,ry,rz]}=error;
  // For S=diag(1,1,-1), translation is S d and rotation is S R S.
  return {position:[x,y,-z],angle:[-rx,-ry,rz]};
}
function signed(error:RigidError,sign:number):RigidError{
  return {position:error.position.map(v=>sign*v) as XYZ,angle:error.angle.map(v=>sign*v) as XYZ};
}
function settings(p:Project,components:string[],pivot:Vec,common:RigidError,local:RigidError=zero()):JointTolerance{
  return {
    ...defaultJointTolerance(p),samples:16,maxCases:16,
    mating:{ports:[],components,pivot:xyz(pivot),position:abs(common.position),angle:abs(common.angle)},
    assembly:{position:abs(local.position),angle:abs(local.angle)},
  };
}
function explicitSample(p:Project,o:JointTolerance,id:string,common:RigidError,local:Record<string,RigidError>={}):JointSample{
  const axes=jointAxes(p,o);
  const values=axes.map(a=>({key:a.key,value:(a.component===null?common:local[a.component])?.[a.kind][a.axis]??0}));
  return {id,values,normalized:values.map((v,i)=>v.value/axes[i].bound)};
}

function evaluate(p:Project,nominalEta:number){
  const route=analyzeRouting(p);
  const clearanceM=p.designProblem!.routes.clearance;
  const clearanceIssue=route.path?screenClearance(p,[],route.path,clearanceM):null;
  const surfaces=prescription(p).surfaces.slice(0,-1);
  const apertureHits=route.path?.hits.filter(h=>surfaces.some(s=>s.id===h.surfaceId)).map(h=>{
    const surface=surfaces.find(s=>s.id===h.surfaceId)!;
    return {surfaceId:surface.id,radialMarginM:surface.aperture-Math.hypot(h.local.y,h.local.z)};
  })??[];
  const reached=route.path?.status==='reached';
  const geometryStatus=route.withinTolerance&&!clearanceIssue?'pass':route.path?'fail':'uncomputed';
  const folded=solveFoldedGaussian(p,{sampleSegments:false});
  const mode=tensorOverlap(p,folded);
  const eta=mode.status==='valid'?mode.eta:null;
  const fieldStatus=mode.status==='valid'?'valid'
    :folded.status==='out-of-domain'||(folded.status==='valid'&&
      (folded.apertureLimited||mode.reason.startsWith('Out of domain:')))?'out-of-domain':'uncomputed';
  return {
    geometry:{
      status:geometryStatus,routingEvaluator:route.id,raySolver:route.solver,chiefStatus:route.status,
      reason:route.status==='evaluated'&&!route.withinTolerance?'Fixed Output Port position / angle tolerance exceeded or routing constraint failed.':route.reason,
      issues:route.issues,positionErrorM:route.positionError,angleErrorRad:route.angleError,
      outputOffsetM:route.offset,outputDirection:route.direction,
      positionToleranceM:p.routing!.positionTolerance,angleToleranceRad:p.routing!.angleTolerance,
      aperture:{status:reached?'pass':route.reason.includes('aperture / cell clipping')?'fail':'uncomputed',hits:apertureHits},
      clearance:{status:clearanceIssue?'fail':reached?'pass':route.path?'partial':'uncomputed',gapM:clearanceM,issue:clearanceIssue},
    },
    field:{
      status:fieldStatus,evaluator:TENSOR_OVERLAP_ID,propagator:folded.id,propagatorStatus:folded.status,
      reason:mode.status==='valid'?null:mode.reason,conditionalOverlap:eta,deltaFromNominal:eta===null?null:eta-nominalEta,
      comparisonClass:mode.status==='valid'?mode.comparisonClass??null:null,
      refractions:folded.status==='valid'?folded.refractions:null,warnings:folded.status==='valid'?folded.warnings:[],
    },
  };
}

function record(nominal:Project,p:Project,nominalEta:number,id:string,motions:LensMotion[]){
  expect(fixedPorts(p),id).toEqual(fixedPorts(nominal));
  return {
    id,fixedPortsPreserved:true,errors:motions,
    transformCheck:checkRigidMotion(nominal,p,motions),
    appliedLensFrontFrames:jointComponents(p).map(lensId=>({id:lensId,...front(p,lensId)})),
    ...evaluate(p,nominalEta),
    pupil:{status:'uncomputed',reason:'Ray-Pupil is evaluated separately at the fixed nominal Prescription only.'},
  };
}
type Scenario=ReturnType<typeof record>;

function localCase(p:Project,eta:number,id:string,lens:string,error:RigidError){
  const o=settings(p,[],midpoint,zero(),error);
  const sample=explicitSample(p,o,id,zero(),{[lens]:error});
  return record(p,perturbJoint(p,o,sample),eta,id,[{id:lens,frame:'local',pivot:front(p,lens).origin,...error}]);
}
function worldCase(p:Project,eta:number,id:string,commands:{lenses:string[];pivot:Vec;error:RigidError}[]){
  let moved=p;
  const motions:LensMotion[]=[];
  for(const {lenses,pivot,error} of commands){
    const o=settings(moved,lenses,pivot,error);
    moved=perturbJoint(moved,o,explicitSample(moved,o,id,error));
    motions.push(...lenses.map(lens=>({id:lens,frame:'world' as const,pivot,...error})));
  }
  return record(p,moved,eta,id,motions);
}

function coverage(planned:number,cases:Scenario[],status?:'assessed'|'partial'){
  const count=(predicate:(c:Scenario)=>boolean)=>cases.filter(predicate).length;
  const minima=(rows:Scenario[])=>rows.reduce<{id:string;conditionalOverlap:number}|null>((best,c)=>{
    const eta=c.field.conditionalOverlap;
    return eta!==null&&(best===null||eta<best.conditionalOverlap)?{id:c.id,conditionalOverlap:eta}:best;
  },null);
  const fieldValid=cases.filter(c=>c.field.status==='valid'),valid=fieldValid.filter(c=>c.geometry.status==='pass');
  return {
    status:status??(planned===cases.length&&fieldValid.length===planned?'assessed':'partial'),
    planned,executed:cases.length,notExecuted:planned-cases.length,
    valid:valid.length,geometryPassed:count(c=>c.geometry.status==='pass'),geometryFailed:count(c=>c.geometry.status==='fail'),
    geometryUncomputed:count(c=>c.geometry.status==='uncomputed'),
    fieldValid:fieldValid.length,fieldOutOfDomain:count(c=>c.field.status==='out-of-domain'),
    fieldUncomputed:count(c=>c.field.status==='uncomputed'),
    minima:{
      fieldValid:{ids:fieldValid.map(c=>c.id),minimum:minima(fieldValid)},
      geometryAndFieldValid:{ids:valid.map(c=>c.id),minimum:minima(valid)},
    },
  };
}

async function jointCase(p:Project,eta:number,o:JointTolerance){
  const result=await assessJoint(p,o),axes=jointAxes(p,o);
  const cases=jointSamples(p,o).slice(0,result.tested).map(sample=>{
    const errorFor=(component:string|null)=>{
      const error=zero();
      axes.forEach((axis,i)=>{
        if(axis.component===component)error[axis.kind][axis.axis]=sample.values[i].value;
      });
      return error;
    };
    // The independent oracle checks the ordered composition on each body and
    // surface by checking local motion, then common motion from that state.
    const local={...o,mating:{...o.mating,position:[0,0,0] as XYZ,angle:[0,0,0] as XYZ}};
    const localErrors=Object.fromEntries(o.mating.components.map(lens=>[lens,errorFor(lens)]));
    const localMotions=o.mating.components.map(lens=>({id:lens,frame:'local' as const,pivot:front(p,lens).origin,...localErrors[lens]}));
    const localProject=perturbJoint(p,local,explicitSample(p,local,sample.id,zero(),localErrors));
    const commonMotions=o.mating.components.map(lens=>({id:lens,frame:'world' as const,pivot:midpoint,...errorFor(null)}));
    const composed=perturbJoint(p,o,sample);
    expect(fixedPorts(localProject)).toEqual(fixedPorts(p));
    const localTransformCheck=checkRigidMotion(p,localProject,localMotions);
    const observed=record(localProject,composed,eta,sample.id,commonMotions);
    const original=result.observations.find(r=>r.id===sample.id)!;
    expect(observed.field.conditionalOverlap).toBe(original.eta);
    expect(observed.geometry.status==='pass').toBe(original.geometryPassed);
    return {...observed,errors:[...localMotions,...commonMotions],localTransformCheck,sample};
  });
  const {inputSignature,settings:encodedSettings,coverage:encodedCoverage,...outcome}=result;
  expect(inputSignature).toBe(serializeProject(p));
  expect(JSON.parse(encodedSettings)).toEqual(o);
  expect(result.nominal.eta).toBe(eta);
  return {settings:o,sampler:JSON.parse(encodedCoverage),outcome,cases,
    coverage:coverage(result.planned,cases,result.status==='assessed'?'assessed':'partial')};
}

function checkMirror(plus:Scenario,minus:Scenario){
  expect(minus.id).toBe(plus.id);
  expect(minus.geometry.status).toBe(plus.geometry.status);
  expect(minus.geometry.aperture.status).toBe(plus.geometry.aperture.status);
  expect(minus.geometry.clearance.status).toBe(plus.geometry.clearance.status);
  expect(minus.field.status).toBe(plus.field.status);
  if(plus.field.conditionalOverlap!==null){
    expect(Math.abs(minus.field.conditionalOverlap!-plus.field.conditionalOverlap)).toBeLessThan(1e-10);
  }
  for(const key of ['positionErrorM','angleErrorRad'] as const){
    if(plus.geometry[key]===null)expect(minus.geometry[key]).toBeNull();
    else expect(Math.abs(minus.geometry[key]!-plus.geometry[key])).toBeLessThan(RIGID_CHECK_TOLERANCE);
  }
  for(const key of ['outputOffsetM','outputDirection'] as const){
    const a=plus.geometry[key],b=minus.geometry[key];
    if(!a){expect(b).toBeNull();continue;}
    expect(Math.hypot(a.x-b!.x,a.y-b!.y,a.z+b!.z)).toBeLessThan(RIGID_CHECK_TOLERANCE);
  }
}

test('S2 fixed ±50 µm free-Lens assembly tolerance checkpoints A and B',async()=>{
  const results=[];
  for(const [i,input] of fixture.cases.entries()){
    const fingerprint=SHA256(JSON.stringify(input.project));
    expect(fingerprint).toBe(fingerprints[i]);
    const {offsetM,conditionalGaussianOverlap:eta}=input;
    const p=ProjectSchema.parse(input.project),start=serializeProject(p),d=prescription(p);
    expect(fixedPorts(p)).toEqual(fixedPorts(benchmarkFixture(offsetM).project));
    const lensIds=jointComponents(p);
    expect(lensIds).toHaveLength(2);
    for(const id of lensIds){
      const a=d.assemblies.find(a=>a.id===id)!;
      expect(a.kind).toBe('lens');
      expect(a.parentId).toBeNull();
      expect(d.surfaces.filter(s=>s.assemblyId===id)).toHaveLength(2);
      expect(front(p,id).origin).toEqual(a.frame.origin);
      expect(a.frame.rotation).toEqual({roll:0,pitch:0,yaw:0});
    }
    const nominal=localCase(p,eta,'zero-error',lensIds[0],zero());
    expect(nominal.geometry.status).toBe('pass');
    expect(nominal.geometry.positionErrorM).toBeCloseTo(input.geometry.positionErrorM,12);
    expect(nominal.geometry.angleErrorRad).toBeCloseTo(input.geometry.angleErrorRad,12);
    expect(nominal.field.conditionalOverlap).toBeCloseTo(eta,10);
    const pupil=await assessTrainPupil(p);
    expect(pupil.status).toBe('unresolved');
    expect(pupil.status).toBe(input.pupil.status);
    expect(pupil.totalCoupling).toBeNull();
    const pupilGrids=pupil.metrics!.history.map(s=>({
      grid:s.grid,targetCoverage:s.targetCoverage,rejectedPower:s.rejectedPower,blockedPower:s.blockedPower,
    }));
    const finalPupil=pupilGrids.at(-1)!;
    expect(finalPupil.targetCoverage).toBeLessThan(.999);
    expect(finalPupil.targetCoverage).toBeCloseTo(input.pupil.targetCoverage,9);
    expect(finalPupil.rejectedPower['Intermediate caustic / singular tube']).toBeGreaterThan(0);
    expect(finalPupil.rejectedPower['Intermediate caustic / singular tube']).toBeCloseTo(input.pupil.rejectedPower['Intermediate caustic / singular tube'],9);

    const singles=lensIds.flatMap((lens,j)=>localProbes.flatMap(probe=>[-1,1].map(sign=>{
      const error=zero();
      error[probe.kind][probe.axis]=sign*probe.amplitude;
      return localCase(p,eta,`lens-${j+1}/${probe.name}/${sign}`,lens,mirror(error,offsetM));
    })));
    const common=[-1,1].map(sign=>worldCase(p,eta,`common/${sign}`,[
      {lenses:lensIds,pivot:midpoint,error:mirror(signed(groupProbe,sign),offsetM)},
    ]));
    const differential=[-1,1].map(sign=>worldCase(p,eta,`differential/${sign}`,lensIds.map((lens,j)=>({
      lenses:[lens],pivot:front(p,lens).origin,error:mirror(signed(groupProbe,j===0?sign:-sign),offsetM),
    }))));
    const geometryFailure=localCase(p,eta,'chief-closure-failure',lensIds[0],mirror({position:[0,.5e-6,0],angle:[0,0,0]},offsetM));
    const domainFailure=localCase(p,eta,'gaussian-domain-failure',lensIds[0],mirror({position:[-5e-6,0,0],angle:[0,0,0]},offsetM));
    const blocked=localCase(p,eta,'chief-aperture-blocked',lensIds[0],mirror({position:[0,0,350e-6],angle:[0,0,0]},offsetM));
    expect(geometryFailure.geometry.status).toBe('fail');
    expect(geometryFailure.field.status).toBe('valid');
    expect(domainFailure.geometry.status).toBe('pass');
    expect(domainFailure.field.status).toBe('out-of-domain');
    expect(domainFailure.field.conditionalOverlap).toBeNull();
    expect(blocked.geometry.aperture.status).toBe('fail');
    expect(blocked.field.status).toBe('uncomputed');

    const o=settings(p,lensIds,midpoint,groupProbe,{position:[.5e-6,.35e-6,.35e-6],angle:[0,.15e-3,.15e-3]});
    const joint=await jointCase(p,eta,o);
    const capped=await jointCase(p,eta,{...o,maxCases:2});
    expect(joint.coverage.executed).toBe(16);
    expect(joint.coverage.valid).toBe(1);
    expect(joint.coverage.fieldOutOfDomain).toBe(i===0?4:5);
    expect(joint.coverage.minima.geometryAndFieldValid.minimum?.id).toBe('joint-11');
    expect(capped.coverage.status).toBe('partial');
    expect(capped.coverage.executed).toBe(2);
    expect(capped.coverage.notExecuted).toBe(14);
    expect(capped.outcome.issues).toContain('Case cap reached; requested joint samples are incomplete.');
    expect(capped.cases).toEqual(joint.cases.slice(0,2));

    // Artificially tilted basis to prove that identical local/world inputs
    // move a tilted assembly differently. The recovered Prescription is separate.
    const lens=lensIds[0],pivot=front(p,lens).origin;
    const tilt=mirror({position:[0,0,0],angle:[0,.02,0]},offsetM);
    const tiltSettings=settings(p,[lens],pivot,tilt);
    const tilted=perturbJoint(p,tiltSettings,explicitSample(p,tiltSettings,'tilt-control',tilt));
    const tiltedBase=record(p,tilted,eta,'tilted-basis',[{id:lens,frame:'world',pivot,...tilt}]);
    const shift={position:[10e-6,0,0],angle:[0,0,0]} satisfies RigidError;
    const local=localCase(tilted,eta,'tilted-local-x',lens,shift);
    const world=worldCase(tilted,eta,'tilted-world-x',[{lenses:[lens],pivot,error:shift}]);
    expect(Math.abs(local.appliedLensFrontFrames[0].origin.z-world.appliedLensFrontFrames[0].origin.z)).toBeCloseTo(10e-6*Math.sin(.02),12);

    expect(serializeProject(p)).toBe(start);
    results.push({
      offsetM,fingerprint,candidateId:input.candidateId,recipe:input.recipe,searchOptions:input.options,
      fixedPorts:fixedPorts(p),nominalLensDecenterM:lensIds.map((id,j)=>({
        id,y:front(p,id).origin.y,z:front(p,id).origin.z-(j===0?0:offsetM),
      })),
      checkpointA:{nominal:{...nominal,pupil:{engine:pupil.engine,status:pupil.status,reason:pupil.reason,scope:pupil.scope,grids:pupilGrids}},
        singles,coverage:coverage(1+lensIds.length*localProbes.length*2,[nominal,...singles])},
      checkpointB:{common:{cases:common,coverage:coverage(2,common)},differential:{cases:differential,coverage:coverage(2,differential)},
        joint,capped,negativeControls:{cases:[geometryFailure,domainFailure,blocked],coverage:coverage(3,[geometryFailure,domainFailure,blocked])},
        frameControl:{tiltedBase,local,world}},
    });
  }
  for(const r of results){
    expect(r.checkpointA.coverage.valid).toBe(12);
    expect(r.checkpointA.coverage.fieldOutOfDomain).toBe(2);
  }
  const [plus,minus]=results;
  const mirrorCases=(r:typeof plus)=>[r.checkpointA.nominal,...r.checkpointA.singles,...r.checkpointB.common.cases,
    ...r.checkpointB.differential.cases,...r.checkpointB.negativeControls.cases,
    r.checkpointB.frameControl.tiltedBase,r.checkpointB.frameControl.local,r.checkpointB.frameControl.world];
  const positive=mirrorCases(plus),negative=mirrorCases(minus);
  positive.forEach((c,i)=>checkMirror(c,negative[i]));
  const physical={totalCoupling:'uncomputed',manufacturingAssemblyYield:'uncomputed',globalWorstCase:'uncomputed'};
  const git=(...args:string[])=>execFileSync('git',args,{encoding:'utf8'}).trim();
  const report={
    schemaVersion:1,status:'pass',units:{position:'m',angle:'rad'},
    gitSHA:git('rev-parse','HEAD'),headSHA:process.env.GOLDEN_HEAD_SHA??null,trackedChanges:git('status','--porcelain'),
    fixtureSource:fixture.source,fixtureSHA256:SHA256(JSON.stringify(fixture)),
    runtime:{node:process.version},
    frameConvention:{
      local:'Nominal Lens assembly +X/+Y/+Z. Pivot at nominal front vertex. xWorld = pivot + R_L [d + R_delta R_L^T (xWorld_nominal - pivot)].',
      common:'World mechanical frame +X/+Y/+Z. Same R_delta and d for both lenses about the midpoint rail datum.',
      differential:'Equal and opposite signed Euler parameters and translations in world axes about the individual nominal front vertices.',
      order:'R_delta = Rz Ry Rx. Joint local motion precedes common motion. Mirror uses S = diag(1,1,-1), d -> S d and R -> S R S.',
    },
    diagnosticAmplitudes:{localProbes,groupProbe},mirrorPairsChecked:positive.length,physical,cases:results,
  };
  mkdirSync('benchmark-results',{recursive:true});
  writeFileSync('benchmark-results/s2-free-lens-tolerance.json',JSON.stringify(report,null,2)+'\n');
},120000);
