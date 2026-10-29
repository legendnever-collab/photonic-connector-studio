import {test,expect} from 'vitest';
import {basicRelayReference} from '../src/authoring/basicRelay';
import {sharedRelayReference} from '../src/authoring/arrayReference';
import {fiberLensFiberProject} from '../src/authoring/starter';
import {prescription,serializeProject} from '../src/project/model';
import {pose,frame,compose} from '../src/surface/model';
import {framePose} from '../src/authoring/commands';
import {assessTrainPupil,trainPupilInput,integrateTrainPupil,quadraticPhaseFit,trainPupilReport} from '../src/project/trainPupilBenchmark';
import type {PupilInput} from '../src/project/trainPupilBenchmark';
import {tracePupilRay,rayFrame,tubeJacobian} from '../src/project/pupilRay';
import type {PupilRay} from '../src/project/pupilRay';
const integrate=(s:PupilInput,n=64)=>{const g=integrateTrainPupil(s,n);let r=g.next();while(!r.done)r=g.next();return r.value;};
test('normalized Gaussian pupil and unequal elliptical overlap agree with analytic integration',()=>{
 const s:PupilInput={wavelength:1.31e-6,faces:[],launch:0,exit:.001,inputW:[100e-6,130e-6],inputC:[0,0],targetW:[120e-6,160e-6],targetC:[0,0],targetCenter:[0,0],targetAxes:[1,0,0,1],lensIds:[],glassLengths:[]},r=integrate(s);
 const eta=s.inputW.reduce((v,w,i)=>v*2*w*s.targetW[i]/(w*w+s.targetW[i]**2),1);expect(r.inputPower).toBeCloseTo(1-Math.exp(-24.5),10);expect(Math.abs(r.eta-eta)).toBeLessThan(1e-8);expect(r.rmsOPD).toBeLessThan(1e-16);expect(r.linearEta).toBeCloseTo(r.eta,9);
});
test('glass slab preserves exact Snell angle, lateral displacement and n-weighted internal OPL',()=>{
 const a=.04,n=1.5,t=.001,x1=.002,x2=x1+t,exit=.006,r=tracePupilRay([{id:'a',frame:rayFrame(pose(x1)),radius:0,aperture:.01,n1:1,n2:n},{id:'b',frame:rayFrame(pose(x2)),radius:0,aperture:.01,n1:n,n2:1}],[0,0,0],[Math.cos(a),Math.sin(a),0],exit),b=Math.asin(Math.sin(a)/n);
 expect(r.direction[1]).toBeCloseTo(Math.sin(a),14);expect(r.point[1]).toBeCloseTo((exit-t)*Math.tan(a)+t*Math.tan(b),14);expect(r.opl).toBeCloseTo((exit-t)/Math.cos(a)+n*t/Math.cos(b),14);expect(r.segments[1].n).toBe(n);
});
test('tube test detects two intermediate caustics despite positive endpoint determinants',()=>{
 const r=(y:number,z:number):PupilRay=>{const direction:[number,number,number]=[1,-3*y,-1.5*z],start:[number,number,number]=[0,y,z],end:[number,number,number]=[1,-2*y,-.5*z];return {point:end,direction,opl:1,segments:[{start,end,direction,n:1}],maxIncidence:0};};
 const j=tubeJacobian(r(0,0),[r(1e-6,0),r(-1e-6,0),r(0,1e-6),r(0,-1e-6)],1e-6);expect(j.determinant).toBeCloseTo(1,10);expect(j.minimum).toBeLessThan(0);
});
test('weighted fit removes all quadratic phase terms, including cross astigmatism',()=>{
 const phase=(y:number,z:number)=>2e-6+3*y-2*z+500*y*y+700*y*z-200*z*z,points=Array.from({length:81},(_,i)=>{const y=(i%9-4)*1e-5,z=(Math.floor(i/9)-4)*2e-5;return {y,z,weight:Math.exp(-(y*y+z*z)/1e-8),opd:phase(y,z)};}),fit=quadraticPhaseFit(points);expect(Math.max(...points.map(p=>Math.abs(fit.at(p.y,p.z)-p.opd)))).toBeLessThan(1e-17);
});
/** Independent meridional oracle: scalar Snell angles, radial Simpson rule,
 * radial ray-map derivative and radial normal equations. No benchmark trace,
 * Jacobian, quadrature, phase-fit or production Gaussian routines used. */
function radialOracle(s:PupilInput){
 const trace=(r:number)=>{let x=s.launch,y=r,angle=Math.asin(s.inputC[0]*r),opl=0,n=1;
  for(const f of s.faces){const R=f.radius,xv=f.frame.o[0],dx=x-xv,cs=Math.cos(angle),sn=Math.sin(angle);let length=-dx/cs;
   if(R){const B=(dx-R)*cs+y*sn,D=B*B-(dx-R)**2-y*y+R*R;length=[-B-Math.sqrt(D),-B+Math.sqrt(D)].filter(t=>t>0&&Math.abs(dx+t*cs)<Math.abs(R)).sort((a,b)=>a-b)[0];}
   x+=length*cs;y+=length*sn;if(!Number.isFinite(length)||Math.abs(y)>f.aperture)throw Error('ray missed');opl+=n*length;const normal=R?Math.asin(-y/R):0;angle=normal+Math.asin(n/f.n2*Math.sin(angle-normal));n=f.n2;
  }const length=(s.exit-x)/Math.cos(angle);return {y:y+length*Math.sin(angle),opl:opl+length};
 };
 const chief=trace(0),w=s.inputW[0],N=8192,dr=3.5*w/N,items:{u:number;opd:number;weight:number}[]=[];let er=0,ei=0,power=0,a0=0,a1=0,a2=0,b0=0,b1=0;
 for(let i=1;i<=N;i++){const r=i*dr;try{const a=trace(r),step=1e-9,derivative=(trace(r+step).y-trace(r-step).y)/(2*step),J=a.y/r*derivative;if(J<=0)continue;const weightSimpson=(i===N?1:i%2?4:2)*dr/3,area=2*Math.PI*r*weightSimpson,I=2/(Math.PI*w*w)*Math.exp(-2*(r/w)**2),target=Math.sqrt(2/(Math.PI*s.targetW[0]**2))*Math.exp(-((a.y/s.targetW[0])**2)),opd=.5*s.inputC[0]*r*r+a.opl-chief.opl,phase=2*Math.PI/s.wavelength*(-opd+.5*s.targetC[0]*a.y*a.y),amp=Math.sqrt(I*J)*target*area,weight=I*area,u=(a.y/w)**2;
 er+=amp*Math.cos(phase);ei+=amp*Math.sin(phase);power+=weight;a0+=weight;a1+=weight*u;a2+=weight*u*u;b0+=weight*opd;b1+=weight*u*opd;items.push({u,opd,weight});}catch{/* negligible outer tail; separately gated in benchmark */}}
 const det=a0*a2-a1*a1,c0=(b0*a2-b1*a1)/det,c1=(a0*b1-a1*b0)/det;return {eta:(er*er+ei*ei)/power,rms:Math.sqrt(items.reduce((sum,p)=>sum+p.weight*(p.opd-c0-c1*p.u)**2,0)/power)};
}
test('actual two-Lens pupil agrees with independent radial Snell/Simpson oracle',async()=>{
 const p=basicRelayReference(),before=serializeProject(p),result=await assessTrainPupil(p);expect(result.status,result.reason).toBe('converged');const s=result.metrics!.sample,oracle=radialOracle(trainPupilInput(p));expect(s.eta).toBeCloseTo(oracle.eta,6);expect(Math.abs(s.rmsOPD-oracle.rms)).toBeLessThan(3e-12);expect(s.eta).toBeGreaterThan(.8);expect(s.eta).toBeLessThan(.95);expect(s.linearEta).toBeGreaterThan(.999);expect(result.gaussianEta).toBeCloseTo(1,7);expect(result.glassLengths).toEqual([.001,.001]);expect(result.physicalEtaErrorBound).toBeNull();expect(result.totalCoupling).toBeNull();expect(serializeProject(p)).toBe(before);
});
test.each([-1,1])('small signed decenter/tilt and elliptical modes: %s',async sign=>{
 const p=basicRelayReference(),d=prescription(p);if(p.model.kind!=='surface')throw Error();p.model.sourceMode.mfdX=p.model.targetMode.mfdX=14e-6;p.model.sourceMode.mfdY=p.model.targetMode.mfdY=20e-6;d.source.frame.rotation.roll=.3;d.assemblies.filter(a=>a.kind==='lens').forEach((a,i)=>{a.frame.origin.y=sign*(i+1)*.3e-6;a.frame.origin.z=-sign*(i+1)*.5e-6;a.frame.rotation.yaw=sign*(i+1)*.001;a.frame.rotation.pitch=sign*(i?-.0006:.0008);});const r=await assessTrainPupil(p);expect(r.status,r.reason).toBe('converged');expect(r.metrics!.sample.eta).toBeGreaterThan(.8);
});
test('nested global rigid transform does not change pupil observables',()=>{
 const p=basicRelayReference(),a=integrate(trainPupilInput(p),32),d=prescription(p),g=frame(pose(.02,-.01,.03,.4,-.3,.2));d.source.frame=framePose(compose(g,frame(d.source.frame)));d.assemblies.forEach(x=>{if(!x.parentId)x.parentId='World';});d.assemblies.push({id:'World',name:'World',kind:'group',parentId:null,frame:framePose(g)});const b=integrate(trainPupilInput(p),32);expect(b.eta).toBeCloseTo(a.eta,8);expect(b.rmsOPD).toBeCloseTo(a.rmsOPD,12);
});
test('real glass thickness changes the finite pupil, not only a collapsed phase screen',()=>{
 const p=basicRelayReference(),a=integrate(trainPupilInput(p),32);prescription(p).surfaces[1].frame.origin.x*=1.1;const b=integrate(trainPupilInput(p),32);expect(Math.abs(a.eta-b.eta)).toBeGreaterThan(.001);expect(Math.abs(a.rmsOPD-b.rmsOPD)).toBeGreaterThan(1e-10);
});
test('grid cap, clipping/phase aliasing and missed target cannot acquire convergence',async()=>{
 expect((await assessTrainPupil(basicRelayReference(),{maxGrid:32})).status).toBe('unresolved');expect((await assessTrainPupil(fiberLensFiberProject())).status).toBe('unresolved');const p=basicRelayReference();if(p.model.kind!=='surface')throw Error();p.model.targetMode.mfdX=p.model.targetMode.mfdY=.01;const r=await assessTrainPupil(p);expect(r.status).toBe('unresolved');expect(r.metrics!.sample.targetCoverage).toBeLessThan(.999);
},15000);
test('unsupported contracts, cancellation, stale export and exact input restoration',async()=>{
 expect((await assessTrainPupil(sharedRelayReference())).status).toBe('unsupported');const ev=sharedRelayReference();ev.portArrays!.source.cols=ev.portArrays!.target.cols=1;ev.portArrays!.source.referenceCol=ev.portArrays!.target.referenceCol=0;ev.portArrays!.interface='evanescent';expect((await assessTrainPupil(ev)).reason).toContain('Evanescent');const p=basicRelayReference();if(p.model.kind!=='surface')throw Error();p.model.sourceMode.mfdX=null;expect((await assessTrainPupil(p)).status).toBe('unsupported');const a=basicRelayReference(),r=await assessTrainPupil(a);expect(trainPupilReport(a,r).state).toBe('current');prescription(a).assemblies[1].frame.origin.y=1e-6;expect(trainPupilReport(a,r).result).toBeNull();prescription(a).assemblies[1].frame.origin.y=0;expect(trainPupilReport(a,r).result).toEqual(r);expect(trainPupilReport(a,r,true).result).toBeNull();const c=await assessTrainPupil(a,{cancelled:()=>true});expect(c.status).toBe('cancelled');expect(c.metrics).toBeNull();
});
