import {test,expect} from 'vitest';
import {basicRelayReference} from '../src/authoring/basicRelay';
import {prescription} from '../src/project/model';
import {solveFoldedGaussian} from '../src/project/foldedGaussian';
import {framePose} from '../src/authoring/commands';
import {compose,frame,pose} from '../src/surface/model';
import {trainOracle,mappedQ,rotatedQ,canonicalResidual,vec,dot} from './lensTrainOracle';

test.each([[-1,14,20,false],[0,14,20,false],[1,14,20,false],[-1,40,60,false],[1,14,20,true]] as const)('whole-train differential: sign %s, MFD %s / %s µm, plane %s',(sign,mfdX,mfdY,plane)=>{
 const p=basicRelayReference(),d=prescription(p);if(p.model.kind!=='surface')throw Error();
 p.model.sourceMode.mfdX=mfdX*1e-6;p.model.sourceMode.mfdY=mfdY*1e-6;d.source.frame.rotation.roll=.37;
 if(plane){d.surfaces[0].shape='plane';d.surfaces[0].radius=0;}
 d.assemblies.filter(a=>a.kind==='lens').forEach((a,i)=>{a.frame.origin.y=sign*(i+1)*.3e-6;a.frame.origin.z=-sign*(i+1)*.5e-6;a.frame.rotation.yaw=sign*(i+1)*.001;a.frame.rotation.pitch=sign*(i?-.0006:.0008);});
 // Exercise independently composed nested frames as well as noncoplanar tilts.
 const g=frame(pose(.02,-.01,.03,.4,-.3,.2));d.source.frame=framePose(compose(g,frame(d.source.frame)));d.assemblies.forEach(a=>{if(!a.parentId)a.parentId='World';});d.assemblies.push({id:'World',name:'World',kind:'group',parentId:null,frame:framePose(g)});
 const r=solveFoldedGaussian(p,{sampleSegments:false});expect(r.status,JSON.stringify(r)).toBe('valid');if(r.status!=='valid')return;
 const oracle=trainOracle(p),actual=r.incident;expect(Math.hypot(...oracle.chief.p.map((v,i)=>v-vec(actual.point)[i]))).toBeLessThan(2e-14);expect(dot(oracle.chief.d,vec(actual.direction))).toBeCloseTo(1,13);
 const input=[{re:0,im:Math.PI*(mfdX*1e-6/2)**2/d.wavelength},{re:0,im:0},{re:0,im:0},{re:0,im:Math.PI*(mfdY*1e-6/2)**2/d.wavelength}];
 const expected=rotatedQ(actual.q,[dot(oracle.u,vec(actual.u)),dot(oracle.u,vec(actual.v)),dot(oracle.v,vec(actual.u)),dot(oracle.v,vec(actual.v))]);
 const errors:number[]=[];
 for(const h of [8e-8,4e-8,2e-8]){
  const j=oracle.jacobian(h),q=mappedQ(j,input);expect(canonicalResidual(j)).toBeLessThan(2e-6);
  const scale=Math.hypot(...expected.flatMap(v=>[v.re,v.im]));errors.push(Math.hypot(...q.flatMap((v,i)=>[v.re-expected[i].re,v.im-expected[i].im]))/scale);
  expect(q[1].re).toBeCloseTo(q[2].re,10);expect(q[1].im).toBeCloseTo(q[2].im,10);
 }
 expect(errors[2]).toBeLessThan(2e-6);expect(errors[2]).toBeLessThan(errors[0]*.3+1e-8);
 if(sign){expect(Math.abs(actual.q[1].im)).toBeGreaterThan(1e-8);expect(Math.abs(actual.q[1].re)).toBeGreaterThan(1e-10);}
});
