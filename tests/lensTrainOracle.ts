import type {Project} from '../src/project/model';

// Test-only finite-ray oracle. No application frame/intersection/Snell/ABCD/Q
// routines are used. This validates a LOCAL differential, not aberrated fields.
type V=[number,number,number];
type F={o:V;a:[V,V,V]};
type C={re:number;im:number};
type Ray={p:V;d:V;n:number};
const add=(a:V,b:V)=>a.map((v,i)=>v+b[i]) as V;
const scale=(a:V,t:number)=>a.map(v=>v*t) as V;
export const dot=(a:V,b:V)=>a.reduce((s,v,i)=>s+v*b[i],0);
const unit=(a:V)=>scale(a,1/Math.hypot(...a));
const cross=(a:V,b:V):V=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const vector=(f:F,p:V)=>add(add(scale(f.a[0],p[0]),scale(f.a[1],p[1])),scale(f.a[2],p[2]));
const local=(f:F,p:V)=>f.a.map(a=>dot(a,p)) as V;
export const vec=(p:{x:number;y:number;z:number}):V=>[p.x,p.y,p.z];
function frame(p:{origin:{x:number;y:number;z:number};rotation:{roll:number;pitch:number;yaw:number}}):F{
 const {roll:r,pitch:t,yaw:y}=p.rotation,c=Math.cos,s=Math.sin;
 const rotate=([x,v,w]:V):V=>{const b=v*c(r)-w*s(r),z=v*s(r)+w*c(r),a=x*c(t)+z*s(t);return [a*c(y)-b*s(y),a*s(y)+b*c(y),-x*s(t)+z*c(t)];};
 return {o:vec(p.origin),a:[rotate([1,0,0]),rotate([0,1,0]),rotate([0,0,1])]};
}
const compose=(a:F,b:F):F=>({o:add(a.o,vector(a,b.o)),a:b.a.map(v=>vector(a,v)) as F['a']});

export function trainOracle(project:Project){
 if(project.model.kind!=='surface')throw Error('Physical project required');
 const d=project.model.prescription,source=frame(d.source.frame);
 const assembly=(id:string):F=>{const a=d.assemblies.find(a=>a.id===id)!;return a.parentId?compose(assembly(a.parentId),frame(a.frame)):frame(a.frame);};
 const surfaces=d.surfaces.map(s=>({s,f:compose(assembly(s.assemblyId),frame(s.frame))}));
 const trace=(x:number[]):Ray=>{
  let point=add(source.o,add(scale(source.a[1],x[0]),scale(source.a[2],x[1]))),n=d.source.n!;
  let direction=unit(add(source.a[0],add(scale(source.a[1],x[2]/n),scale(source.a[2],x[3]/n))));
  for(const {s,f}of surfaces){
   const p=local(f,add(point,scale(f.o,-1))),v=local(f,direction);let distance=-p[0]/v[0];
   if(s.shape==='sphere'){
    const oc=add(p,[-s.radius,0,0]),B=dot(oc,v),C=dot(oc,oc)-s.radius*s.radius,root=Math.sqrt(B*B-C);
    const roots=[-B-root,-B+root].filter(t=>t>0).sort((a,b)=>Math.abs(p[0]+a*v[0])-Math.abs(p[0]+b*v[0]));distance=roots[0];
   }else if(s.shape!=='plane')throw Error('Oracle supports Sphere / Plane only');
   const hit=add(p,scale(v,distance));if(!Number.isFinite(distance)||distance<=0||Math.hypot(hit[1],hit[2])>s.aperture)throw Error('Oracle ray missed finite surface');
   point=add(f.o,vector(f,hit));
   if(s.interaction==='refract'){
    const normal=s.shape==='plane'?[1,0,0] as V:scale(add([s.radius,0,0],scale(hit,-1)),1/s.radius),ci=dot(v,normal),eta=n/s.nAfter!;
    if(ci<=0)throw Error('Oracle requires forward refraction');
    const transmitted=add(scale(v,eta),scale(normal,Math.sqrt(1-eta*eta*(1-ci*ci))-eta*ci));direction=unit(vector(f,transmitted));n=s.nAfter!;
   }else if(s.interaction!=='probe')throw Error('Oracle supports refractive train only');
  }
  return {p:point,d:direction,n};
 };
 const chief=trace([0,0,0,0]),reference=source.a[1],u=unit(add(reference,scale(chief.d,-dot(reference,chief.d)))),v=cross(chief.d,u);
 const map=(x:number[])=>{const ray=trace(x),p=add(ray.p,scale(ray.d,dot(add(chief.p,scale(ray.p,-1)),chief.d)/dot(ray.d,chief.d))),delta=add(p,scale(chief.p,-1));return [dot(delta,u),dot(delta,v),ray.n*dot(ray.d,u)/dot(ray.d,chief.d),ray.n*dot(ray.d,v)/dot(ray.d,chief.d)];};
 const jacobian=(h:number)=>Array.from({length:4},(_,row)=>Array.from({length:4},(_,col)=>{const step=col<2?h:h/.01,x=[0,0,0,0];x[col]=step;const plus=map(x);x[col]=-step;return (plus[row]-map(x)[row])/(2*step);}));
 return {chief,u,v,jacobian};
}

const sum=(a:C,b:C):C=>({re:a.re+b.re,im:a.im+b.im});
const times=(a:C,b:C):C=>({re:a.re*b.re-a.im*b.im,im:a.re*b.im+a.im*b.re});
const mul=(a:C,t:number):C=>({re:a.re*t,im:a.im*t});
const divide=(a:C,b:C):C=>{const d=b.re*b.re+b.im*b.im;return {re:(a.re*b.re+a.im*b.im)/d,im:(a.im*b.re-a.re*b.im)/d};};
const product=(a:C[],b:C[])=>Array.from({length:4},(_,i)=>sum(times(a[2*Math.floor(i/2)],b[i%2]),times(a[2*Math.floor(i/2)+1],b[2+i%2])));
export function mappedQ(j:number[][],q:C[]){
 const block=(r:number,c:number)=>[j[r][c],j[r][c+1],j[r+1][c],j[r+1][c+1]].map(re=>({re,im:0}));
 const numerator=product(block(0,0),q).map((v,i)=>sum(v,block(0,2)[i])),denominator=product(block(2,0),q).map((v,i)=>sum(v,block(2,2)[i]));
 const det=sum(times(denominator[0],denominator[3]),mul(times(denominator[1],denominator[2]),-1));
 return product(numerator,[denominator[3],mul(denominator[1],-1),mul(denominator[2],-1),denominator[0]].map(v=>divide(v,det)));
}
export function rotatedQ(q:C[],a:number[]){return Array.from({length:4},(_,i)=>{let z:C={re:0,im:0};for(let k=0;k<2;k++)for(let l=0;l<2;l++)z=sum(z,mul(q[2*k+l],a[2*Math.floor(i/2)+k]*a[2*(i%2)+l]));return z;});}
export function canonicalResidual(j:number[][]){
 // Scale positions by 10 mm before comparing mixed-unit blocks.
 const s=[.01,.01,1,1],m=j.map((row,i)=>row.map((v,k)=>v*s[k]/s[i]));let error=0;
 for(let i=0;i<4;i++)for(let k=0;k<4;k++){
  let value=0;for(let a=0;a<2;a++)value+=m[a][i]*m[a+2][k]-m[a+2][i]*m[a][k];
  const target=k===i+2?1:i===k+2?-1:0;error=Math.max(error,Math.abs(value-target));
 }return error;
}
