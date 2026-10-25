import {test,expect} from 'vitest';
import {gaussianTensorOverlap,tensorOverlap} from '../src/project/tensorOverlap';
import {transformQ,inverseQ} from '../src/project/foldedGaussian';
import {axisLogOverlap,rayleigh} from '../src/physics';
import type {QTensor} from '../src/project/foldedGaussian';
import {fiberLensFiberProject} from '../src/authoring/starter';
import {solvePhysicalGaussian} from '../src/project/physicalGaussian';
const lambda=1310e-9,w=4.6e-6,z=rayleigh(w,lambda),q:QTensor=[{re:0,im:z},{re:0,im:0},{re:0,im:0},{re:0,im:z}];
test('normalized tensor overlap matches identity, B1 and independent offset/tilt limits',()=>{
 expect(gaussianTensorOverlap(q,lambda,1,[2*w,2*w]).eta).toBeCloseTo(1,13);
 const d=1.2e-6,t=.012,r=gaussianTensorOverlap(q,lambda,1,[2*w,2*w],[d,0],[t,0]);
 expect(r.logEta).toBeCloseTo(-((d/w)**2)-(Math.PI*w*t/lambda)**2,12);
 const p=fiberLensFiberProject(),b=solvePhysicalGaussian(p),a=tensorOverlap(p);expect(b.status).toBe('valid');expect(a.status).toBe('valid');if(b.status==='valid'&&b.overlap.status==='valid'&&a.status==='valid')expect(a.logEta).toBeCloseTo(b.overlap.logEta,10);
 const q2:QTensor=[{re:3*z,im:2*z},{re:0,im:0},{re:0,im:0},{re:-z,im:.7*z}];
 const r2=gaussianTensorOverlap(q2,lambda,1,[2*w,3*w],[d,-d],[t,-t]);
 const radius=(re:number,im:number)=>Math.sqrt(lambda*(re*re+im*im)/(Math.PI*im)),curv=(re:number,im:number)=>re/(re*re+im*im);
 expect(r2.logEta).toBeCloseTo(axisLogOverlap(radius(3*z,2*z),w,curv(3*z,2*z),-d,lambda,t)+axisLogOverlap(radius(-z,.7*z),1.5*w,curv(-z,.7*z),d,lambda,-t),10);
});
// Independent midpoint quadrature of explicit complex fields, including normalization.
function quadrature(Q:QTensor,N:number,window:number){
 const k=inverseQ(Q),h=[.8*w,-.5*w],sl=[.01,-.008],wt=[w,1.3*w],step=2*window/N;let re=0,im=0,pi=0,pt=0;
 for(let i=0;i<N;i++)for(let j=0;j<N;j++){
  const x=-window+(i+.5)*step,y=-window+(j+.5)*step,u=x-h[0],v=y-h[1],power=(k[0].im*u*u+(k[1].im+k[2].im)*u*v+k[3].im*v*v)*Math.PI/lambda;
  const amp=Math.exp(power),phase=-(k[0].re*u*u+(k[1].re+k[2].re)*u*v+k[3].re*v*v+2*(sl[0]*u+sl[1]*v))*Math.PI/lambda,tar=Math.exp(-((x/wt[0])**2)-(y/wt[1])**2);
  re+=amp*tar*Math.cos(phase);im+=amp*tar*Math.sin(phase);pi+=amp*amp;pt+=tar*tar;
 }
 return (re*re+im*im)/(pi*pt);
}
test('rotated elliptical cross-phase overlap converges against independent complex field quadrature',()=>{
 const a=.61,co=Math.cos(a),si=Math.sin(a),Q=transformQ([{re:.4*z,im:1.8*z},{re:0,im:0},{re:0,im:0},{re:-.8*z,im:.8*z}],[co,-si,si,co]);
 const exact=gaussianTensorOverlap(Q,lambda,1,[2*w,2.6*w],[.8*w,-.5*w],[.01,-.008]).eta;
 expect(quadrature(Q,160,5*w)).toBeCloseTo(exact,8);expect(quadrature(Q,320,7*w)).toBeCloseTo(exact,11);
 const reversed=transformQ(Q,[1,0,0,-1]);expect(gaussianTensorOverlap(reversed,lambda,1,[2*w,2.6*w],[.8*w,.5*w],[.01,.008]).eta).toBeCloseTo(exact,12);
});
test('undefined target, TIR, clipping and polarization are not a zero-efficiency substitute',()=>{
 const p=fiberLensFiberProject();p.model.kind==='surface'&&(p.model.targetMode.mfdX=null);expect(tensorOverlap(p).status).toBe('not-calculated');
 expect(()=>gaussianTensorOverlap(q,lambda,1,[-1,2*w])).toThrow();
});
