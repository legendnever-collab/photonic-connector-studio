/** Export exact repository fixtures and the existing D2.6 Lens ray-pupil boundary.
 * Test-only data bridge; no production Solver or candidate qualification changes. */
import {test,expect} from 'vitest';
import {isDeepStrictEqual} from 'node:util';
import {writeFileSync,mkdirSync,readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {angleFixture} from './benchmark/foldFixture';
import {fixedPorts} from './benchmark/fixture';
import {launchInput,projectedMask,mirrorBodies} from './benchmark/finiteBeamReference';
import {addLenses,synthesisLensOptions} from '../src/synthesis/construction';
import {lensDomain,lensValues,lensBounds,buildLensProject} from '../src/lens/domain';
import {prescription,serializeProject} from '../src/project/model';
import {compile,frame,sub,dot,norm,V} from '../src/surface/model';
import {analyzeRouting} from '../src/routing/analysis';
import {screenClearance} from '../src/routing/clearance';
import {checkLensMount} from '../src/synthesis/lensMount';
import {solveFoldedGaussian} from '../src/project/foldedGaussian';
import {tracePupilRay,tubeJacobian} from '../src/project/pupilRay';
import type {PupilInput} from '../src/project/trainPupilBenchmark';

const relay=(f:ReturnType<typeof angleFixture>)=>{const d=prescription(f.fixture.project);return addLenses(f.project,2,f.options.clearRadius,f.fixture.options,'first',[...d.assemblies.map(a=>a.id),...d.surfaces.map(s=>s.id)]);};
function radialBoundary(s:PupilInput,count=4096){
 const w=s.inputW[0],C=s.inputC[0],h=w*1e-4;
 expect(s.inputW[1]).toBeCloseTo(w,14);expect(s.inputC[1]).toBeCloseTo(C,10);
 const ray=(y:number,z=0)=>{const dy=C*y,dz=C*z;if(Math.hypot(dy,dz)>Math.sin(.3))throw Error('Launch outside existing pupil domain');return tracePupilRay(s.faces,[s.launch,y,z],[Math.sqrt(1-dy*dy-dz*dz),dy,dz],s.exit);};
 const chief=ray(0),rows:number[][]=[];let maxJacobianError=0,minimumJacobian=Infinity,terminationReason="3.5w tail truncation";
 for(let i=0;i<=count;i++){
  const r=3.5*w*i/count;
  try{
   const c=ray(r),near=(h:number)=>[ray(r+h),ray(r-h),ray(r,h),ray(r,-h)],a=tubeJacobian(c,near(h),h),b=tubeJacobian(c,near(h/2),h/2);
   if(b.minimum<1e-6)throw Error('Caustic in Lens boundary');
   maxJacobianError=Math.max(maxJacobianError,Math.abs(a.determinant/b.determinant-1));minimumJacobian=Math.min(minimumJacobian,b.minimum);
   rows.push([r,c.point[1],Math.sqrt(2/(Math.PI*w*w)/b.determinant)*Math.exp(-((r/w)**2)),.5*C*r*r+c.opl-chief.opl]);
  }catch(e){if(!(e instanceof Error)||!['Clipped aperture','Launch outside existing pupil domain'].includes(e.message))throw e;terminationReason=e.message;break;}
 }
 expect(rows.length).toBeGreaterThan(count/2);expect(maxJacobianError).toBeLessThan(2e-5);
 expect(rows.every((v,i)=>i===0||v[1]>rows[i-1][1])).toBe(true);
 expect(Math.exp(-2*(rows.at(-1)![0]/w)**2)).toBeLessThan(1e-6);
 return {terminationReason,columns:['launchRadiusM','exitRadiusM','amplitudePerM','opdM'],rows,exit:s.exit,launch:s.launch,inputW:s.inputW,inputC:s.inputC,minimumJacobian,maxJacobianError,
  omittedSourcePower:Math.exp(-2*(rows.at(-1)![0]/w)**2),scope:'Existing D2.6 geometric OPL and projected ray-tube Jacobian. No diffraction within Lens, no coating; this boundary has no independent physical field error bound.'};
}

test('D2.8-B exports fixed Lens boundaries, immutable Ports, and unfolded reflection frames',()=>{
 const fixedR=prescription(relay(angleFixture(50e-6,23))).surfaces.filter(s=>s.interaction==='refract').map(s=>s.radius);
 const cases=[];
 for(const offset of [50e-6,-50e-6])for(const degrees of (offset<0?[23]:[21,23,25]))for(const factor of (offset<0?[1]:[.8,1,1.2])){
  const f=angleFixture(offset,degrees),base=relay(f),bd=prescription(base);
  bd.surfaces.filter(s=>s.interaction==='refract').forEach((s,i)=>s.radius=fixedR[i]);
  const domain=lensDomain(base,'existing',false),values=lensValues(domain),bounds=lensBounds(synthesisLensOptions(base,f.fixture.problem,f.fixture.options,1)),shift=values[0]*(factor-1);values[0]+=shift;values[4]-=shift;
  expect(values.every((v,i)=>v>=bounds[i][0]-1e-12&&v<=bounds[i][1]+1e-12)).toBe(true);
  const p=buildLensProject(domain,values),raw=serializeProject(p),d=prescription(p),ss=compile(d),r=analyzeRouting(p),lenses=ss.filter(s=>s.interaction==='refract'),mirrors=ss.filter(s=>s.interaction==='reflect');
  checkLensMount(p,f.fixture.options);expect(r.withinTolerance).toBe(true);expect(screenClearance(p,[],r.path!,f.options.clearance)).toBeNull();expect(isDeepStrictEqual(fixedPorts(p),fixedPorts(f.fixture.project))).toBe(true);
  // Reciprocity reuse is restricted to this symmetric circular, identical reversed Lens pair.
  for(let i=0;i<2;i++){expect(lenses[i].radius).toBeCloseTo(-lenses[3-i].radius,14);expect(lenses[i].aperture).toBe(lenses[3-i].aperture);expect(lenses[i].nBefore).toBe(lenses[3-i].nAfter);}
  expect(lenses[1].world.origin.x-lenses[0].world.origin.x).toBeCloseTo(lenses[3].world.origin.x-lenses[2].world.origin.x,14);
  expect(lenses[0].world.origin.x).toBeCloseTo(.01-lenses[3].world.origin.x,14);
  expect(d.wavelength).toBe(1310e-9);expect(p.model.kind==='surface'&&isDeepStrictEqual(p.model.sourceMode,p.model.targetMode)).toBe(true);
  const reflected=(v:ReturnType<typeof V>,n:ReturnType<typeof V>)=>{const c=2*dot(v,n);return V(v.x-c*n.x,v.y-c*n.y,v.z-c*n.z);};
  const source=frame(d.source.frame),basis=[source.axes],directions=[source.axes[0]];
  for(const m of mirrors){basis.push(basis.at(-1)!.map(v=>reflected(v,m.world.axes[0])) as typeof source.axes);directions.push(basis.at(-1)![0]);}
  const middle=sub(mirrors[1].world.origin,mirrors[0].world.origin);expect(dot(directions[1],middle)/norm(middle)).toBeCloseTo(1,12);
  basis[2].forEach((v,i)=>expect(norm(sub(v,basis[0][i]))).toBeLessThan(1e-12));
  const prefix=launchInput(p),boundary=radialBoundary(prefix),bodies=mirrorBodies(p);
  expect(serializeProject(p)).toBe(raw);
  cases.push({id:`${offset<0?'minus':'plus'}-${degrees}-${factor}`,offset,degrees,positionFactor:factor,project:p,values,bounds,geometry:'PASS',fixedPorts:fixedPorts(p),gaussian:solveFoldedGaussian(p,{sampleSegments:false}),boundary,
   fold:{mirrorCenters:mirrors.map(s=>s.world.origin),mirrorNormals:mirrors.map(s=>s.world.axes[0]),basis,bodies,clearRadius:mirrors[0].aperture,middleLength:norm(middle),before:mirrors[0].world.origin.x-prefix.exit,after:.01-prefix.exit-mirrors[1].world.origin.x},
   localMask:projectedMask(50e-6,Math.abs(offset),degrees)});
 }
 const sourceFiles=['tests/coherentFieldInput.test.ts','tests/benchmark/finiteBeamReference.ts','tests/benchmark/foldFixture.ts','src/project/pupilRay.ts','src/project/trainPupilBenchmark.ts','src/synthesis/construction.ts','src/routing/clearance.ts'];
 const out={schemaVersion:1,baseSHA:'aedf81046819efcd19ff54ae3444282a3d159bd4',gitSHA:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),headSHA:process.env.GOLDEN_HEAD_SHA??null,trackedChanges:execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),sourceSHA256:Object.fromEntries(sourceFiles.map(f=>[f,createHash('sha256').update(readFileSync(f)).digest('hex')])),units:'SI',cases};
 mkdirSync('benchmark-results',{recursive:true});writeFileSync('benchmark-results/d28b-input.json',JSON.stringify(out));
},120000);
