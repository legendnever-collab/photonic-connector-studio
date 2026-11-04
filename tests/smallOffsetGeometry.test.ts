import {test,expect} from 'vitest';
import {benchmarkFixture,fixedPorts} from './benchmark/fixture';
import {parallelCylinderDistance,segmentCylinderDistance,type Cylinder} from './benchmark/clearanceOracle';
import {checkLensMount} from '../src/synthesis/lensMount';
import {tensorOverlap} from '../src/project/tensorOverlap';
import {emptyTrain,addLenses} from '../src/synthesis/construction';
import {prepareRoutingDomain,buildRouteProposal,routeProposals,searchRouting,applyCandidate,type RouteProposal} from '../src/routing/search';
import {analyzeRouting} from '../src/routing/analysis';
import {separatedMirrors,segmentMissesMirror} from '../src/routing/mirrorClearance';
import {screenClearance} from '../src/routing/clearance';
import {compile,V} from '../src/surface/model';
import {prescription,serializeProject,parseProject} from '../src/project/model';
import {rayOracle} from './benchmark/rayOracle';
import {createHash} from 'node:crypto';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';

export function angleFixture(offset:number,degrees:number,clear=200e-6){
 const f=benchmarkFixture(offset),base=emptyTrain(f.project,f.problem);base.routing=f.routing;
 const options={...f.problem.routes,clearRadius:clear,prismLeg:4*clear,mirrorThickness:20e-6};
 const domain=prepareRoutingDomain(base,options,0),theta=degrees*Math.PI/180,dx=Math.abs(offset)/Math.tan(theta),a=V(.005-dx/2),b=V(.005+dx/2,0,offset),middle=V(Math.cos(theta),0,Math.sign(offset)*Math.sin(theta));
 const proposal:RouteProposal={topology:'mirror2',blocks:[{kind:'mirror',at:a,incoming:V(1),outgoing:middle},{kind:'mirror',at:b,incoming:middle,outgoing:V(1)}]};
 return {...buildRouteProposal(domain,options,proposal),options,domain,fixture:f};
}
function reference(q:ReturnType<typeof angleFixture>){
 const ss=compile(prescription(q.project)),route=analyzeRouting(q.project),path=route.path!;
 const cylinders=q.project.bodies.flatMap(b=>b.kind==='mirror'?[{id:b.assemblyId,front:ss.find(s=>s.assemblyId===b.assemblyId)!.world.origin,normal:ss.find(s=>s.assemblyId===b.assemblyId)!.world.axes[0],radius:b.width/2,thickness:b.thickness}]:[]);
 const distances:number[]=[];for(let i=0;i<path.points.length-1;i++)for(const c of cylinders){
  const start=i?ss.find(s=>s.id===path.hits[i-1]?.surfaceId)?.assemblyId:'@source',end=ss.find(s=>s.id===path.hits[i]?.surfaceId)?.assemblyId;
  if(c.id!==start&&c.id!==end)distances.push(segmentCylinderDistance(path.points[i],path.points[i+1],c));
 }
 return {route,cylinders,pairDistance:parallelCylinderDistance(cylinders[0],cylinders[1])!,segmentDistance:Math.min(...distances)};
}
test('independent cylinder reference has analytic separation, overlap, tangent and endpoint controls',()=>{
 const a:Cylinder={front:V(),normal:V(1),radius:2,thickness:1};
 expect(parallelCylinderDistance(a,{...a,front:V(3)})).toBeCloseTo(2,12);
 expect(parallelCylinderDistance(a,{...a,front:V(4,8)})).toBeCloseTo(5,12);
 expect(parallelCylinderDistance(a,a)).toBe(0);
 expect(segmentCylinderDistance(V(-.5,-3),V(-.5,3),a)).toBeCloseTo(0,12);
 expect(segmentCylinderDistance(V(-.5,-3,2),V(-.5,3,2),a)).toBeCloseTo(0,12);
 expect(segmentCylinderDistance(V(3),V(4),a)).toBeCloseTo(3,12);
 expect(segmentCylinderDistance(V(3,6),V(4,6),a)).toBeCloseTo(5,12);
});
test('small Offset independent geometry and ray evidence',()=>{
 const cases=[];
 for(const offset of [50e-6,-50e-6,100e-6])for(const degrees of [21,23,25,30,45,90]){
  const q=angleFixture(offset,degrees),r=reference(q),issue=screenClearance(q.project,q.ids,r.route.path!,q.options.clearance,q.domain.box);
  expect(r.route.withinTolerance).toBe(true);expect(rayOracle(q.project,r.route.path!).status).toBe('PASS');
  expect(fixedPorts(q.project)).toEqual(fixedPorts(q.fixture.project));
  expect(r.pairDistance).toBeCloseTo(Math.abs(offset)/(2*Math.cos(degrees*Math.PI/360)),12);
  if(degrees===90)expect(r.segmentDistance).toBeLessThan(1e-12);
  if(degrees===21){expect(r.segmentDistance).toBeGreaterThan(q.options.clearance);expect(issue).toBeNull();}
  if(r.segmentDistance<1e-12)expect(issue).not.toBeNull();
  if(issue===null){expect(r.pairDistance).toBeGreaterThan(q.options.clearance);expect(r.segmentDistance).toBeGreaterThan(q.options.clearance);}
  const relay=addLenses(q.project,2,q.options.clearRadius,q.fixture.options),relayRoute=analyzeRouting(relay);
  let relayGeometry:string|null='No closed chief route';
  if(degrees===23){checkLensMount(relay,q.fixture.options);expect(fixedPorts(relay)).toEqual(fixedPorts(q.fixture.project));expect(relayRoute.withinTolerance).toBe(true);expect(rayOracle(relay,relayRoute.path!).status).toBe('PASS');
   relayGeometry=screenClearance(relay,[],relayRoute.path!,q.options.clearance);expect(relayGeometry).toBeNull();expect(tensorOverlap(relay).status).toBe('not-calculated');}
  cases.push({offset,degrees,relay:degrees===23?{input:relay,geometry:relayGeometry===null?'PASS':'FAIL',mode:{status:'Uncomputed',evaluation:tensorOverlap(relay)},totalCoupling:{status:'Uncomputed'}}:undefined,clearRadius:q.options.clearRadius,bodyRadius:r.cylinders[0].radius,thickness:q.options.mirrorThickness,gap:q.options.clearance,referenceClearance:r.pairDistance>q.options.clearance&&r.segmentDistance>q.options.clearance?'PASS':'FAIL',screeningClearance:issue===null?'PASS':'FAIL',pairDistance:r.pairDistance,segmentDistance:r.segmentDistance,legacyScreening:screenClearance(q.project,q.ids,r.route.path!,q.options.clearance,q.domain.box,false),screening:issue,ray:'PASS',ports:'PASS'});
 }
 mkdirSync('benchmark-results',{recursive:true});writeFileSync('benchmark-results/d27-geometry.json',JSON.stringify({schemaVersion:1,status:'PASS',gitSHA:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),headSHA:process.env.GOLDEN_HEAD_SHA??null,
  trackedChanges:execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),baselineSHA:'66feb0c684ec3114a8ff09aa74400e5b761154b0',
  input:benchmarkFixture(50e-6),units:'SI',reference:'closed-form parallel finite-cylinder distance; convex point-to-solid segment minimization (160 iterations)',
  sourceSHA256:Object.fromEntries(['src/routing/clearance.ts','src/routing/mirrorClearance.ts','src/routing/search.ts','src/synthesis/engine.ts','tests/benchmark/clearanceOracle.ts','tests/smallOffsetGeometry.test.ts'].map(f=>[f,createHash('sha256').update(readFileSync(f)).digest('hex')])),
  uncomputed:['Full finite-beam diffraction / stray-body shadowing','Total Coupling / coating losses','General nonparallel solid minimum distance','Global topology feasibility / manufacturing Yield'],cases},null,2));

});

test('Mirror certificates conservatively agree with an independent distance reference under rigid transforms',()=>{
 // Explicit rotation independent of the production frame compiler.
 const rotate=(p:{x:number;y:number;z:number})=>({x:.36*p.x-.8*p.y+.48*p.z,y:.48*p.x+.6*p.y+.64*p.z,z:-.8*p.x+.6*p.z});
 const point=(p:{x:number;y:number;z:number})=>{const r=rotate(p);return {x:r.x+.01,y:r.y-.02,z:r.z+.03};};
 let state=73;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/2**32;};
 let accepted=0,rejected=0;
 for(let i=0;i<400;i++){
  const a:Cylinder={front:V(),normal:V(1),radius:220e-6,thickness:20e-6};
  const start=V((random()-.5)*.001,(random()-.5)*.001,(random()-.5)*.001),end=V((random()-.5)*.001,(random()-.5)*.001,(random()-.5)*.001);
  for(const transformed of [false,true]){
   const c=transformed?{...a,front:point(a.front),normal:rotate(a.normal)}:a,s=transformed?point(start):start,e=transformed?point(end):end;
   const distance=segmentCylinderDistance(s,e,c),safe=segmentMissesMirror(s,e,c,1e-6);
   if(safe){accepted++;expect(distance).toBeGreaterThan(1e-6);}else rejected++;
   expect(segmentMissesMirror(e,s,c,1e-6)).toBe(safe);
  }
 }
 expect(accepted).toBeGreaterThan(100);expect(rejected).toBeGreaterThan(100);
 const a:Cylinder={front:V(),normal:V(1),radius:220e-6,thickness:20e-6};
 for(const sign of [-1,1])for(const dx of [0,20e-6,21e-6-1e-10,21e-6,21e-6+1e-10,50e-6])for(const y of [0,440e-6,450e-6]){
  const b={...a,front:V(dx,y),normal:V(sign)},distance=parallelCylinderDistance(a,b)!;
  const safe=separatedMirrors(a,b,1e-6);if(safe)expect(distance).toBeGreaterThan(1e-6);
  if(distance<1e-6)expect(safe).toBe(false);
  const ta={...a,front:point(a.front),normal:rotate(a.normal)},tb={...b,front:point(b.front),normal:rotate(b.normal)};
  expect(separatedMirrors(ta,tb,1e-6)).toBe(safe);
 }
 // Intersecting, nonparallel discs must not gain a separation certificate.
 expect(separatedMirrors(a,{...a,normal:V(0,1)},1e-6)).toBe(false);
 // Surface tangency and clearance boundary are rejected, including axial rays.
 for(const z of [a.radius,a.radius+1e-6-1e-10,a.radius+1e-6])expect(segmentMissesMirror(V(-.001,0,z),V(.001,0,z),a,1e-6)).toBe(false);
});

test('small-Offset seeds reach physical ray evaluation without altering bounds or fixed Ports',()=>{
 for(const offset of [50e-6,-50e-6,100e-6,500e-6]){
  const seed=angleFixture(offset,23),proposals=routeProposals(seed.domain,seed.options);let accepted=0,small=0;
  for(const proposal of proposals.filter(p=>p.topology==='mirror2')){
   let built;try{built=buildRouteProposal(seed.domain,seed.options,proposal);}catch{continue;}
   const q={...seed,...built},r=reference(q);if(!r.route.withinTolerance)continue;
   const issue=screenClearance(q.project,q.ids,r.route.path!,q.options.clearance,q.domain.box);if(issue)continue;
   accepted++;expect(r.pairDistance).toBeGreaterThan(q.options.clearance);expect(r.segmentDistance).toBeGreaterThan(q.options.clearance);
   expect(rayOracle(q.project,r.route.path!).status).toBe('PASS');expect(fixedPorts(q.project)).toEqual(fixedPorts(q.fixture.project));
   const bend=Math.acos(proposal.blocks[0].outgoing.x)*180/Math.PI;if(bend>20&&bend<27)small++;
  }
  expect(accepted).toBeGreaterThan(0);if(Math.abs(offset)===50e-6)expect(small).toBeGreaterThan(0);
 }
});

test('normal-entry Prism templates cannot bridge 50 µm with the declared leg and part limits',()=>{
 for(const clear of [200e-6,500e-6,Math.sqrt(200e-6*500e-6)])for(const offset of [50e-6,-50e-6,100e-6]){
  const q=angleFixture(offset,23,clear),all=routeProposals(q.domain,q.options);
  expect(all.some(p=>p.topology.includes('prism'))).toBe(false);
  // Mirror + Prism: reference Mirror-to-entry length is h - leg/2 < 0.
  expect(Math.abs(offset)-q.options.prismLeg/2).toBeLessThan(0);
  // Two normal-entry Prisms: middle free-space length h - leg < 0;
  // additionally excluded by the unchanged one-Prism assembly policy.
  expect(Math.abs(offset)-q.options.prismLeg).toBeLessThan(0);expect(q.fixture.routing.parts.prism).toBe(1);
  const forced:RouteProposal={topology:'mirror-prism',blocks:[{kind:'mirror',at:V(.005),incoming:V(1),outgoing:V(0,0,Math.sign(offset))},{kind:'prism',at:V(.005,0,offset),incoming:V(0,0,Math.sign(offset)),outgoing:V(1)}]};
  const built=buildRouteProposal(q.domain,q.options,forced);expect(analyzeRouting(built.project).withinTolerance).not.toBe(true);
 }
});

test('50 µm geometric Search / Apply is deterministic and preserves both fixed Port / Mode contracts',()=>{
 for(const offset of [50e-6,-50e-6]){
  const seed=angleFixture(offset,23),base=seed.domain.base,before=serializeProject(base),a=searchRouting(base,seed.options),b=searchRouting(base,seed.options);
  expect(a.candidates.length).toBeGreaterThan(0);expect(b.candidates.map(c=>c.id)).toEqual(a.candidates.map(c=>c.id));expect(serializeProject(base)).toBe(before);
  const applied=applyCandidate(base,a,a.candidates[0].id);expect(fixedPorts(applied)).toEqual(fixedPorts(seed.fixture.project));
  expect(serializeProject(parseProject(serializeProject(applied)))).toBe(serializeProject(applied));expect(analyzeRouting(applied).withinTolerance).toBe(true);
  expect(rayOracle(applied,analyzeRouting(applied).path!).status).toBe('PASS');
 }
});
