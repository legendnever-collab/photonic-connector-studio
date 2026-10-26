// Independent test-only Maxwell boundary / vector angular-spectrum reference.
// Does not import production TIR, refraction, reflection, or overlap functions.
import type {Project} from '../src/project/model';
import {compile,frame} from '../src/surface/model';
import type {QTensor} from '../src/project/foldedGaussian';
type V=number[];type C=[number,number];type E=C[];
const dot=(a:V,b:V)=>a.reduce((s,v,i)=>s+v*b[i],0),scale=(a:V,k:number)=>a.map(v=>k*v),add=(a:V,b:V)=>a.map((v,i)=>v+b[i]);
const norm=(a:V)=>Math.sqrt(dot(a,a)),unit=(a:V)=>scale(a,1/norm(a));
const cross=(a:V,b:V)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const arr=(v:{x:number;y:number;z:number})=>[v.x,v.y,v.z];
const cmul=(a:C,b:C):C=>[a[0]*b[0]-a[1]*b[1],a[0]*b[1]+a[1]*b[0]];
function refractBack(k:V,n:V,nBefore:number,nAfter:number){
 const tangent=scale(add(k,scale(n,-dot(k,n))),nAfter/nBefore);
 return add(tangent,scale(n,Math.sign(dot(k,n))*Math.sqrt(1-dot(tangent,tangent))));
}
function boundary(n:number,ci:number,pol:'s'|'p'):C{
 // Solve continuity of tangential E/H: reflected admittance quotient.
 const beta=Math.sqrt(n*n*(1-ci*ci)-1),A=n*ci,B=pol==='s'?beta:n*n*beta,D=A*A+B*B;
 return [(A*A-B*B)/D,2*A*B/D];
}
function project(e:E,v:V):C{return [e.reduce((s,c,i)=>s+c[0]*v[i],0),e.reduce((s,c,i)=>s+c[1]*v[i],0)];}
function combine(s:V,p:V,a:C,b:C):E{return s.map((v,i)=>[v*a[0]+p[i]*b[0],v*a[1]+p[i]*b[1]]);}
export function oracle(p:Project,q:QTensor,N:number,window:number,h:[number,number]=[0,0]){
 if(p.model.kind!=='surface')throw Error('fixture');
 const d=p.model.prescription,ss=compile(d),out=ss.at(-1)!.world,axes=out.axes.map(arr),src=frame(d.source.frame),sourceAxis=arr(src.axes[p.model.sourceMode.polarization==='TE'?1:2]),targetAxis=axes[p.model.targetMode.polarization==='TE'?1:2];
 const k0=2*Math.PI/d.wavelength,wt=[p.model.targetMode.mfdX!/2,p.model.targetMode.mfdY!/2],t=wt.map(w=>Math.PI*w*w/d.wavelength),sigma=1/Math.sqrt(2*k0*Math.min(q[0].im,q[3].im,t[0],t[1])),step=2*window*sigma/N;
 let re=0,im=0,pi=0,pt=0;
 for(let i=0;i<N;i++)for(let j=0;j<N;j++){
  const a=-window*sigma+(i+.5)*step,b=-window*sigma+(j+.5)*step;
  let k=add(scale(axes[0],Math.sqrt(1-a*a-b*b)),add(scale(axes[1],a),scale(axes[2],b)));
  const dirs:V[]=[...Array(ss.length+1)];dirs[ss.length]=k;
  for(let s=ss.length-1;s>=0;s--){const v=ss[s],n=arr(v.world.axes[0]);
   if(v.interaction==='reflect'||v.interaction==='tir')k=add(k,scale(n,-2*dot(k,n)));
   else if(v.interaction==='refract')k=refractBack(k,n,v.nBefore!,v.nAfter!);
   dirs[s]=k;
  }
  const input=unit(add(sourceAxis,scale(dirs[0],-dot(sourceAxis,dirs[0]))));let e:E=input.map(v=>[v,0]);
  for(let s=0;s<ss.length;s++){
   const v=ss[s],n=arr(v.world.axes[0]),kin=dirs[s],kout=dirs[s+1];if(v.interaction==='probe')continue;
   let axis=cross(kin,n);if(norm(axis)<1e-14)continue;axis=unit(axis);
   const pin=cross(axis,kin),pout=cross(axis,kout),es=project(e,axis),ep=project(e,pin);
   if(v.interaction==='tir')e=combine(axis,pout,cmul(es,boundary(v.nBefore!,Math.abs(dot(kin,n)),'s')),cmul(ep,boundary(v.nBefore!,Math.abs(dot(kin,n)),'p')));
   else if(v.interaction==='reflect')e=combine(axis,pout,es,[-ep[0],-ep[1]]);
   else e=combine(axis,pout,es,ep); // phase-only, unit normalized transmission
  }
  const target=unit(add(targetAxis,scale(dirs.at(-1)!,-dot(targetAxis,dirs.at(-1)!)))),polar=project(e,target);
  const amp=Math.exp(-k0*(q[0].im*a*a+(q[1].im+q[2].im)*a*b+q[3].im*b*b)/2),tar=Math.exp(-k0*(t[0]*a*a+t[1]*b*b)/2),ph=k0*((q[0].re*a*a+(q[1].re+q[2].re)*a*b+q[3].re*b*b)/2+h[0]*a+h[1]*b);
  const z=cmul(polar,[Math.cos(ph),Math.sin(ph)]);re+=amp*tar*z[0];im+=amp*tar*z[1];pi+=amp*amp;pt+=tar*tar;
 }
 return (re*re+im*im)/(pi*pt);
}
