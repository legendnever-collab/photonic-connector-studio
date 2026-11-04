import {add,sub,mul,dot,norm,unit} from '../surface/model';
import type {Vec} from '../surface/model';
/** Exact finite disc backing; normal points out of its optical front. */
export type MirrorCylinder={front:Vec;normal:Vec;radius:number;thickness:number};
const guard=1e-12; // Absolute conservative numerical margin, metres.
/** A separating projection is a sufficient certificate, never a complete SAT.
 * No separation found means retain the broad-phase rejection. */
export function separatedMirrors(a:MirrorCylinder,b:MirrorCylinder,gap:number):boolean {
 const ca=add(a.front,mul(a.normal,-a.thickness/2)),cb=add(b.front,mul(b.normal,-b.thickness/2)),delta=sub(cb,ca);
 const extent=(c:MirrorCylinder,v:Vec)=>c.radius*Math.sqrt(Math.max(0,1-dot(c.normal,v)**2))+c.thickness/2*Math.abs(dot(c.normal,v));
 return [a.normal,b.normal,...(norm(delta)>guard?[unit(delta)]:[])].some(v=>Math.abs(dot(delta,v))-extent(a,v)-extent(b,v)>gap+guard);
}
/** Certify a closed segment outside a cylinder enlarged axially AND radially
 * by gap. This encloses the Euclidean gap neighbourhood, including its corners.
 * Slab restriction followed by the analytic radial minimum includes tangency. */
export function segmentMissesMirror(start:Vec,end:Vec,c:MirrorCylinder,gap:number):boolean {
 const p=sub(start,c.front),d=sub(end,start),x=dot(p,c.normal),dx=dot(d,c.normal),g=gap+guard;
 let lo=0,hi=1;
 if(Math.abs(dx)<1e-15){if(Math.min(x,x+dx)>g||Math.max(x,x+dx)<-c.thickness-g)return true;}
 else {const a=(-c.thickness-g-x)/dx,b=(g-x)/dx;lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));if(lo>hi)return true;}
 const radial=sub(p,mul(c.normal,x)),slope=sub(d,mul(c.normal,dx)),speed=dot(slope,slope);
 if(speed<1e-30)return false; // Numerically uncertain: keep broad-phase rejection.
 const t=Math.max(lo,Math.min(hi,-dot(radial,slope)/speed)),closest=add(radial,mul(slope,t));
 return norm(closest)>c.radius+g;
}
