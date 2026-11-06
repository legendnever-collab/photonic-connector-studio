// Independent scalar ABCD control for centered circular Gaussian beams, unfolded
// planar Mirrors and normal spherical interfaces. No production Q/ABCD/overlap.
import type {Project} from '../../src/project/model';
import type {RayPath} from '../../src/surface/trace';
import {prescription,modes} from '../../src/project/model';
export function modeOracle(p:Project,path:RayPath){
 const d=prescription(p),m=modes(p),zs=Math.PI*(m.source.mfdX!/2)**2/d.wavelength,zt=Math.PI*(m.target.mfdX!/2)**2/d.wavelength;
 if(m.source.mfdX!==m.source.mfdY||m.target.mfdX!==m.target.mfdY||d.surfaces.some(s=>s.interaction==='tir'||s.shape==='even-asphere'))throw Error('Oracle domain: circular centered non-TIR train only');
 let matrix=[1,0,0,1],n=d.source.n!;
 const prepend=(a:number[])=>{const b=matrix;matrix=[a[0]*b[0]+a[1]*b[2],a[0]*b[1]+a[1]*b[3],a[2]*b[0]+a[3]*b[2],a[2]*b[1]+a[3]*b[3]];};
 for(let i=0;i<path.hits.length;i++){
  const a=path.points[i],b=path.points[i+1],s=d.surfaces[i];
  prepend([1,Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z)/n,0,1]);
  if(s.interaction==='refract'){prepend([1,0,s.shape==='sphere'?-(s.nAfter!-n)/s.radius:0,1]);n=s.nAfter!;}
 }
 const [A,B,C,D]=matrix,den=D*D+C*C*zs*zs,re=(B*D+A*C*zs*zs)/den,im=zs*(A*D-B*C)/den;
 // Circular 2D normalized overlap with receiving waist Q=i zt, zero offset/slope.
 return {matrix,re,im,eta:4*im*zt/(re*re+(im+zt)**2),domain:'centered circular scalar Gaussian; no throughput / complete diffraction'};
}
