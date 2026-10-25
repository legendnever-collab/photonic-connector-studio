import {evaluateSurface,radialBounds} from './evaluator';
import type {Profile} from './evaluator';
import type {Vec} from './model';
export const ROOT_RESIDUAL=2e-13;
export const ROOT_DISTANCE=2e-12;
const EPS=1e-11;
export class IntersectionFailure extends Error {}
/** Nearest positive intersection with the finite sag disk. Interval bounds prune empty intervals;
 * derivative enclosures certify a unique root before safeguarded refinement. Unresolved early
 * intervals fail explicitly, rather than jumping to a later root. Grazing roots are unsupported. */
export function asphereRoot(p:Vec,d:Vec,s:Profile,aperture:number):number|null {
 const A=d.y*d.y+d.z*d.z,B=p.y*d.y+p.z*d.z,C=p.y*p.y+p.z*p.z-aperture*aperture;
 let lo=EPS,hi=Infinity;
 if(A<1e-28){if(C>1e-20)return null;}
 else {const cross=p.y*d.z-p.z*d.y,disc=A*aperture*aperture-cross*cross;if(disc<0)return null;const root=Math.sqrt(Math.max(0,disc));lo=Math.max(lo,(-B-root)/A);hi=(-B+root)/A;}
 const [smin,smax]=radialBounds(s,0,aperture);
 if(![smin,smax].every(Number.isFinite))throw new IntersectionFailure('Invalid sag domain');
 if(Math.abs(d.x)>1e-15){const a=(smin-p.x)/d.x,b=(smax-p.x)/d.x;lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));}
 else if(p.x<smin||p.x>smax)return null;
 if(!Number.isFinite(lo+hi)||hi<lo||hi<=EPS)return null;
 const at=(t:number)=>{const e=evaluateSurface(s,p.y+t*d.y,p.z+t*d.z);if(!e)throw new IntersectionFailure('Sag domain at candidate root');return {f:p.x+t*d.x-e.sag,derivative:d.x-e.dy*d.y-e.dz*d.z};};
 const checked=(t:number)=>{const e=at(t);if(t<=EPS)return null;if(Math.abs(e.derivative)<1e-10)throw new IntersectionFailure('Grazing intersection is unresolved');if(Math.abs(e.f)>ROOT_RESIDUAL)throw new IntersectionFailure('Root residual did not converge');return t;};
 if(hi-lo<=1e-15){return Math.abs(at(lo).f)<=ROOT_RESIDUAL?checked(lo):null;}
 const stack:[number,number,number][]=[[lo,hi,0]];let visited=0;
 while(stack.length){
  if(++visited>8192)throw new IntersectionFailure('Intersection interval budget exceeded');
  let [a,b,depth]=stack.pop()!;
  const radial=(t:number)=>Math.hypot(p.y+d.y*t,p.z+d.z*t),closest=A>0?Math.max(a,Math.min(b,-B/A)):a,r0=radial(closest),r1=Math.min(aperture,Math.max(radial(a),radial(b)));
  const [gmin,gmax]=radialBounds(s,Math.min(r0,r1),r1),x0=p.x+a*d.x,x1=p.x+b*d.x;
  if(Math.min(x0,x1)-gmax>ROOT_RESIDUAL||Math.max(x0,x1)-gmin< -ROOT_RESIDUAL)continue;
  const [v0,v1]=radialBounds(s,Math.min(r0,r1),r1,'gradient-factor'),w0=B+A*a,w1=B+A*b,products=[v0*w0,v0*w1,v1*w0,v1*w1],derivativeMin=d.x-Math.max(...products),derivativeMax=d.x-Math.min(...products);
  let fa=at(a).f,fb=at(b).f;
  if(derivativeMin>1e-10||derivativeMax< -1e-10){
   if(fa===0)return checked(a);if(fb===0)return checked(b);if(Math.sign(fa)===Math.sign(fb))continue;
   const derivativeBound=Math.min(Math.abs(derivativeMin),Math.abs(derivativeMax));
   const converged=(f:number)=>Math.abs(f)<=ROOT_RESIDUAL&&(f===0||Math.abs(f)/derivativeBound<=ROOT_DISTANCE);
   for(let i=0;i<80;i++){
    const mid=(a+b)/2,e=at(mid);
    if(converged(e.f))return checked(mid);
    const next=mid-e.f/e.derivative,t=next>a+(b-a)*.05&&next<b-(b-a)*.05?next:mid,f=at(t).f;
    if(converged(f))return checked(t);
    if(Math.sign(f)===Math.sign(fa)){a=t;fa=f;}else{b=t;fb=f;}
   }
   throw new IntersectionFailure('Bracketed root did not converge');
  }
  if(depth>=46||b-a<1e-15)throw new IntersectionFailure('Unresolved grazing / multiple-root interval');
  const mid=(a+b)/2;stack.push([mid,b,depth+1],[a,mid,depth+1]);
 }
 return null;
}
