import {curvature,coefficients} from '../surface/evaluator';
import { abcd, axisLogOverlap, beam, fingerprint, MAX_SLOPE, rayleigh } from '../physics';
import type { Beam, Complex, Matrix } from '../physics';
import { compile, frame, pointToLocal, vectorToLocal } from '../surface/model';
import type { Frame } from '../surface/model';
import { bodyGeometry } from './geometry';
import type { Project } from './model';
import type { PortContract } from '../authoring/contract';

export const PHYSICAL_GAUSSIAN_ID = 'coaxial-surface-gaussian/1.1.0';
export const APERTURE_TAIL_LIMIT = 1e-3;
export type PhysicalSample = { x:number; n:number; y:Beam; z:Beam; heightY:number; heightZ:number; slopeY:number; slopeZ:number; side:'before'|'after'; surfaceId?:string };
export type Overlap = {status:'valid';eta:number;logEta:number;lossDB:number;underflow:boolean;targetY:number;targetZ:number;offsetY:number;offsetZ:number;angleY:number;angleZ:number}
 | {status:'not-calculated';reason:string};
export type PhysicalGaussian = {status:'valid';id:string;fingerprint:string;wavelength:number;warnings:string[];frame:Frame;samples:PhysicalSample[];incident:PhysicalSample;overlap:Overlap;surfaces:{id:string;x:number;nBefore:number;nAfter:number;aperture:number}[];targetCenter:{y:number;z:number};targetSlope:{y:number;z:number};matrix:Matrix;higherOrder:boolean;referenceMode:{y:number;z:number}|null}
 | {status:'invalid'|'out-of-domain';id:string;fingerprint:string;reason:string};

/** Only physics inputs: diagnostic ray radius/sampling/n and mechanical Fiber shells do not enter the field. */
export function physicalGaussianInput(p:Project) {
 if(p.model.kind!=='surface')return {kind:p.model.kind};
 const d=p.model.prescription;
 return {wavelength:d.wavelength,sourceFrame:d.source.frame,surfaces:d.surfaces,assemblies:d.assemblies,bodies:p.bodies,sourceMode:p.model.sourceMode,targetMode:p.model.targetMode,ports:p.authoring?.ports};
}
function contractIssue(port:PortContract|undefined) {
 if(!port)return 'Port phase / medium / normalization / adapter are undefined. Select a Fiber template or define the Mode Contract.';
 if(port.device==='pic-edge'||port.device==='pic-grating')return 'PIC receiving Field / device response is not defined. The stored Gaussian is a user reference, not a Coupler efficiency model.';
 if(port.fieldModel!=='gaussian'||port.imported)return 'Imported complex fields require the F2 field adapter.';
 if(port.adapter!=='homogeneous-paraxial')return 'A homogeneous paraxial Port adapter is required; confined near fields require an EM solver.';
 if(port.phase!=='waist-plane')return 'Port phase is undefined. This solver requires a waist (flat phase) at the Port plane.';
 if(port.mediumIndex===null)return 'Port medium index is undefined.';
 if(port.normalization==='unspecified'||port.normalization==='absolute-power'&&port.powerW===null)return 'Port normalization / absolute input power is undefined.';
 return null;
}
function localPort(reference:Frame, port:Frame) {
 const direction=vectorToLocal(reference,port.axes[0]),y=vectorToLocal(reference,port.axes[1]);
 if(direction.x<=0||Math.hypot(direction.y,direction.z)/direction.x>MAX_SLOPE+1e-12)return null;
 // A separable Y/Z field cannot silently acquire cross-axis rotation.
 if(Math.abs(y.z)>1e-8||y.y<=0)return null;
 return {position:pointToLocal(reference,port.origin),slopeY:direction.y/direction.x,slopeZ:direction.z/direction.x};
}
function physicalBeam(q:Complex,lambda:number,x:number,n:number):Beam {
 const b=beam(q,lambda,x);
 return {...b,curvature:b.curvature/n,waistX:x-n*q.re,rayleigh:n*q.im};
}
function product(a:Matrix,b:Matrix):Matrix{return [a[0]*b[0]+a[1]*b[2],a[0]*b[1]+a[1]*b[3],a[2]*b[0]+a[3]*b[2],a[2]*b[1]+a[3]*b[3]];}

/** Reduced Q=q/n, [height,n*slope], lambda in vacuum. No Fresnel, clipping propagation, aberration or delivered-power estimate. */
export function solvePhysicalGaussian(p:Project):PhysicalGaussian {
 const input=physicalGaussianInput(p),fp=fingerprint(JSON.stringify(input));
 const fail=(reason:string,status:'invalid'|'out-of-domain'='out-of-domain'):PhysicalGaussian=>({status,id:PHYSICAL_GAUSSIAN_ID,fingerprint:fp,reason});
 if(p.model.kind!=='surface')return fail('Use the Ideal Gaussian solver for this Project.');
 const d=p.model.prescription,lambda=d.wavelength,ss=compile(d),sm=p.model.sourceMode,tm=p.model.targetMode,ports=p.authoring?.ports;
 const issue=contractIssue(ports?.source);if(issue)return fail(`Input: ${issue}`);
 if(sm.mfdX===null||sm.mfdY===null)return fail('Input MFD X / Y is undefined.','invalid');
 if(ss.some(s=>s.array))return fail('Lenslet arrays are outside the single-mode coaxial bridge.');
 if(ss.some(s=>!['refract','probe'].includes(s.interaction)))return fail('Folded paths / reflection / TIR are outside the straight refracting bridge.');
 if(ss.some(s=>s.interaction==='probe'&&s.shape!=='plane'))return fail('Reference probe planes must be planar.');
 const geometry=bodyGeometry(d,ss,p.bodies);if(geometry.issues.length)return fail(geometry.issues.join(' · '),'invalid');
 const reference=ss.find(s=>s.interaction==='refract')?.world??frame(d.source.frame),source=localPort(reference,frame(d.source.frame)),target=localPort(reference,ss.at(-1)!.world);
 if(!source||!target)return fail('Port tilt must be ≤50 mrad with aligned transverse axes (roll / cross-axis rotation unsupported).');
 for(const s of ss.slice(0,-1)) {
  const pos=pointToLocal(reference,s.world.origin),normal=vectorToLocal(reference,s.world.axes[0]),y=vectorToLocal(reference,s.world.axes[1]);
  if(Math.hypot(pos.y,pos.z)>1e-10||Math.hypot(normal.y,normal.z)>1e-10||normal.x<0||Math.abs(y.z)>1e-10||y.y<0)return fail(`${s.id}: optical surfaces must share one centered, coaxial frame. Tilt / decenter requires a broader field solver.`);
 }
 let n=ports!.source.mediumIndex!,x=source.position.x,qY:Complex={re:0,im:rayleigh(sm.mfdX/2,lambda)},qZ:Complex={re:0,im:rayleigh(sm.mfdY/2,lambda)};
 let hY=source.position.y,hZ=source.position.z,pY=n*source.slopeY,pZ=n*source.slopeZ,matrix:Matrix=[1,0,0,1];
 let apertureTailBudget=0;
 const samples:PhysicalSample[]=[],surfaces:Extract<PhysicalGaussian,{status:'valid'}>['surfaces']=[];
 const snapshot=(side:'before'|'after',surfaceId?:string):PhysicalSample=>({x,n,y:physicalBeam(qY,lambda,x,n),z:physicalBeam(qZ,lambda,x,n),heightY:hY,heightZ:hZ,slopeY:pY/n,slopeZ:pZ/n,side,surfaceId});
 const paraxial=()=>[qY,qZ].every(q=>lambda/(Math.PI*n*Math.sqrt(lambda*q.im/Math.PI))<=.1+1e-12)&&Math.hypot(pY,pZ)/n<=MAX_SLOPE+1e-12;
 if(!paraxial())return fail('Paraxial gate: waist divergence >0.1 rad or beam-axis slope >50 mrad.');
 const startX=x,endX=target.position.x;
 if(endX<=startX)return fail('Output must follow Input in the common local +X direction.','invalid');
 try {
  samples.push(snapshot('after'));
  for(const s of ss) {
   const next=pointToLocal(reference,s.world.origin).x,dist=next-x;
   if(dist< -1e-12)return fail(`${s.id}: Surface order goes backwards along the common local +X axis.`,'invalid');
   if(s.nBefore===null||s.nAfter===null||Math.abs(s.nBefore-n)>1e-10)return fail(`${s.id}: missing or discontinuous medium index. Port medium and consecutive Surface indices must agree.`,'invalid');
   const count=Math.max(1,Math.ceil(Math.max(0,dist)/(endX-startX)*240)),begin=x,oldY=qY,oldZ=qZ,oldHY=hY,oldHZ=hZ;
   for(let i=1;i<=count;i++) {
    const distance=Math.max(0,dist)*i/count;x=begin+distance;
    qY={re:oldY.re+distance/n,im:oldY.im};qZ={re:oldZ.re+distance/n,im:oldZ.im};hY=oldHY+distance*pY/n;hZ=oldHZ+distance*pZ/n;
    samples.push(snapshot('before',i===count?s.id:undefined));
   }
   matrix=product([1,Math.max(0,dist)/n,0,1],matrix);
   const b=snapshot('before'),offset=Math.hypot(hY,hZ),w=Math.max(b.y.radius,b.z.radius);
   // Circular tail bound using the larger elliptical radius. Probe aperture is only a reference marker.
   if(s.interaction==='refract') {
    const margin=s.aperture-offset,tail=margin<=0?1:Math.exp(-2*(margin/w)**2);
    apertureTailBudget+=tail;
    if(apertureTailBudget>APERTURE_TAIL_LIMIT)return fail(`${s.id}: cumulative aperture tail bound exceeds 0.1%. Clipped fields require diffraction propagation.`);
    if(s.shape!=='plane'&&s.radius!==0&&(offset+2*w)/Math.abs(s.radius)>.2)return fail(`${s.id}: 2w footprint / |R| exceeds 0.2; spherical aberration is outside the paraxial bridge.`);
   }
   surfaces.push({id:s.id,x,nBefore:n,nAfter:s.nAfter,aperture:s.aperture});
   const power=s.interaction==='refract'?(s.nAfter-n)*curvature(s):0,m:Matrix=[1,0,-power,1];
   qY=abcd(qY,m);qZ=abcd(qZ,m);pY-=power*hY;pZ-=power*hZ;n=s.nAfter;matrix=product(m,matrix);
   if(!paraxial())return fail(`${s.id}: post-surface divergence >0.1 rad or beam-axis slope >50 mrad.`);
   samples.push(snapshot('after',s.id));
  }
  const higherOrder=ss.some(s=>s.shape==='even-asphere'&&((s.conic??0)!==0||coefficients(s).some(a=>a!==0)));
  const incident=snapshot('after'),warnings=['One analytic Port field; diagnostic ray channels do not define additional Gaussian sources.','Normalized scalar field; Fresnel / coatings / absorption / aberration and aperture diffraction are not modeled. Transmission and total coupling are not calculated.','Port tilt uses a first-order phase ramp; O(tilt²) plane and projection corrections are omitted. Waist locations are local homogeneous-segment extrapolations.'];
  let overlap:Overlap={status:'not-calculated',reason:'Output reference is undefined.'};
  if(higherOrder)warnings.push('Conic / Even Asphere: beam is a vertex-curvature ABCD reference. Higher-order phase and aberration are not propagated.');
  const targetIssue=contractIssue(ports?.target);
  if(higherOrder)overlap={status:'not-calculated',reason:'Aspheric higher-order phase is outside ABCD. Beam is a vertex-curvature reference; physical mode overlap requires Field propagation.'};
  else if(targetIssue)overlap={status:'not-calculated',reason:`Output: ${targetIssue}`};
  else if(tm.mfdX===null||tm.mfdY===null)overlap={status:'not-calculated',reason:'Output MFD X / Y is undefined.'};
  else if(Math.abs(ports!.target.mediumIndex!-n)>1e-10)overlap={status:'not-calculated',reason:'Output reference medium does not match the incident field medium.'};
  else if(sm.polarization!=='unspecified'&&tm.polarization!=='unspecified'&&sm.polarization!==tm.polarization)overlap={status:'not-calculated',reason:'TE/TM mismatch: vector polarization coupling is outside the scalar bridge.'};
  else if([tm.mfdX,tm.mfdY].some(m=>lambda/(Math.PI*n*m/2)>.1+1e-12))overlap={status:'not-calculated',reason:'Output reference divergence exceeds 0.1 rad.'};
  else {
   const offsetY=target.position.y-hY,offsetZ=target.position.z-hZ,angleY=pY/n-target.slopeY,angleZ=pZ/n-target.slopeZ;
   const logEta=axisLogOverlap(incident.y.radius,tm.mfdX/2,n*incident.y.curvature,offsetY,lambda,n*angleY)+axisLogOverlap(incident.z.radius,tm.mfdY/2,n*incident.z.curvature,offsetZ,lambda,n*angleZ),eta=Math.exp(logEta);
   overlap={status:'valid',eta,logEta,lossDB:-10*logEta/Math.LN10,underflow:eta===0,targetY:tm.mfdX/2,targetZ:tm.mfdY/2,offsetY,offsetZ,angleY,angleZ};
   if(sm.polarization==='unspecified'||tm.polarization==='unspecified')warnings.push('Polarization unspecified: mode overlap assumes co-polarized scalar fields.');
  }
  return {status:'valid',id:PHYSICAL_GAUSSIAN_ID,fingerprint:fp,wavelength:lambda,warnings,frame:reference,samples,incident,overlap,surfaces,targetCenter:{y:target.position.y,z:target.position.z},targetSlope:{y:target.slopeY,z:target.slopeZ},matrix,higherOrder,referenceMode:!targetIssue&&tm.mfdX!==null&&tm.mfdY!==null&&Math.abs(ports!.target.mediumIndex!-n)<1e-10?{y:tm.mfdX/2,z:tm.mfdY/2}:null};
 }catch(e){return fail(e instanceof Error?e.message:String(e),'invalid');}
}

/** Unit-integral scalar amplitude, in Output transverse coordinates to first order, with target tilt removed as a common phase gauge. No absolute EM amplitude or global piston. */
export function normalizedIncidentField(r:Extract<PhysicalGaussian,{status:'valid'}>,y:number,z:number):Complex {
 const b=r.incident,dy=y-(b.heightY-r.targetCenter.y),dz=z-(b.heightZ-r.targetCenter.z);
 const amplitude=Math.sqrt(2/(Math.PI*b.y.radius*b.z.radius))*Math.exp(-((dy/b.y.radius)**2+(dz/b.z.radius)**2));
 const phase=-2*Math.PI/r.wavelength*b.n*(b.y.curvature*dy*dy/2+b.z.curvature*dz*dz/2+(b.slopeY-r.targetSlope.y)*dy+(b.slopeZ-r.targetSlope.z)*dz);
 return {re:amplitude*Math.cos(phase),im:amplitude*Math.sin(phase)};
}
