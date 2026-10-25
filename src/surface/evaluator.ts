import type {Surface,Vec} from './model';
export type Profile=Pick<Surface,'shape'|'radius'> & Partial<Pick<Surface,'conic'|'aspheric'>>;
export const ASPHERIC_ORDERS=[4,6,8] as const;
export type AsphericOrder=typeof ASPHERIC_ORDERS[number];
export const coefficientScale=(order:AsphericOrder)=>10**(3*(order-1)); // mm^(1-order) → SI m^(1-order)
export function coefficients(s:Profile):[number,number,number]{return s.shape==='even-asphere'?[s.aspheric?.a4??0,s.aspheric?.a6??0,s.aspheric?.a8??0]:[0,0,0];}
export const curvature=(s:Profile)=>s.shape==='plane'||s.radius===0?0:1/s.radius;
const k=(s:Profile)=>s.shape==='even-asphere'?(s.conic??0):0;
/** Single vertex-branch sag graph, axial local X and transverse local Y/Z, all in SI. */
export function evaluateSurface(s:Profile,y:number,z:number):{sag:number;dy:number;dz:number;normal:Vec}|null {
 const r2=y*y+z*z,c=curvature(s),disc=1-(1+k(s))*c*c*r2;
 if(!(disc>0)||![y,z,c,disc].every(Number.isFinite))return null;
 const root=Math.sqrt(disc),[a4,a6,a8]=coefficients(s),polynomial=r2*r2*(a4+r2*(a6+r2*a8));
 const sag=c*r2/(1+root)+polynomial,g=c/root+r2*(4*a4+r2*(6*a6+r2*8*a8)),dy=g*y,dz=g*z,n=Math.hypot(1,dy,dz);
 if(![sag,dy,dz,n].every(Number.isFinite))return null;
 return {sag,dy,dz,normal:{x:1/n,y:-dy/n||0,z:-dz/n||0}};
}
export function sag(s:Profile,y:number,z:number){return evaluateSurface(s,y,z)?.sag??NaN;}
export function surfaceGradient(s:Profile,y:number,z:number){const e=evaluateSurface(s,y,z);return e?{y:e.dy,z:e.dz}:null;}
export function surfaceNormal(s:Profile,y:number,z:number){return evaluateSurface(s,y,z)?.normal??null;}
/** Conservative interval enclosures. Each radial monomial is monotone; signed terms are bounded independently. */
export function radialBounds(s:Profile,r0:number,r1:number,quantity:'sag'|'gradient-factor'='sag'):[number,number] {
 const c=curvature(s),d=(r:number)=>1-(1+k(s))*c*c*r*r;
 if(r0<0||r1<r0||d(r0)<=0||d(r1)<=0)return [NaN,NaN];
 const base=(r:number)=>quantity==='sag'?c*r*r/(1+Math.sqrt(d(r))):c/Math.sqrt(d(r));
 const first=base(r0),last=base(r1);let lo=Math.min(first,last),hi=Math.max(first,last);
 coefficients(s).forEach((a,i)=>{const order=ASPHERIC_ORDERS[i],power=quantity==='sag'?order:order-2,factor=quantity==='sag'?a:order*a,A=factor*r0**power,B=factor*r1**power;lo+=Math.min(A,B);hi+=Math.max(A,B);});
 return [lo,hi];
}
export function profileDomainIssue(s:Profile,radius:number):string|null {
 if(s.shape==='sphere'&&Math.abs(s.radius)<=radius)return 'Sphere clear radius must be smaller than |R|';
 const bounds=radialBounds(s,0,radius);
 if(!bounds.every(Number.isFinite))return 'Conic domain requires 1 − (1 + K) r² / R² > 0 over the full radius';
 if(Math.max(...bounds.map(Math.abs))>1)return 'Surface sag bound exceeds the supported ±1 m extent';
 return null;
}
/** Certify positive thickness over the full radial aperture, not only at the vertex and rim. */
export function positiveThickness(front:Profile,rear:Profile,spacing:number,radius:number):boolean {
 const stack:[number,number,number][]=[[0,radius,0]];let count=0;
 while(stack.length){if(++count>8192)return false;const [a,b,depth]=stack.pop()!,f=radialBounds(front,a,b),r=radialBounds(rear,a,b);
  if(![...f,...r].every(Number.isFinite))return false;
  if(spacing+r[0]-f[1]>1e-12)continue;
  const mid=(a+b)/2;if([a,mid,b].some(x=>spacing+sag(rear,x,0)-sag(front,x,0)<=1e-12)||depth>=30)return false;
  stack.push([a,mid,depth+1],[mid,b,depth+1]);
 }
 return true;
}
