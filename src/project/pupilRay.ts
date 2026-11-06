/** Independent finite-ray geometry for the pupil benchmark. No production
 * frame, intersection, Snell, ABCD or Q implementation is called here. */
export type V3=[number,number,number];
export type RF={o:V3;a:[V3,V3,V3]};
export type Face={id:string;frame:RF;radius:number;aperture:number;n1:number;n2:number};
export const plus=(a:V3,b:V3)=>a.map((v,i)=>v+b[i]) as V3;
export const times=(a:V3,t:number)=>a.map(v=>v*t) as V3;
export const dot3=(a:V3,b:V3)=>a.reduce((s,v,i)=>s+v*b[i],0);
export const worldVector=(f:RF,p:V3)=>plus(plus(times(f.a[0],p[0]),times(f.a[1],p[1])),times(f.a[2],p[2]));
export const localVector=(f:RF,p:V3)=>f.a.map(a=>dot3(a,p)) as V3;
export function rayFrame(p:{origin:{x:number;y:number;z:number};rotation:{roll:number;pitch:number;yaw:number}}):RF{
 const {roll:r,pitch:t,yaw:y}=p.rotation,c=Math.cos,s=Math.sin;
 const rotate=([x,v,w]:V3):V3=>{const b=v*c(r)-w*s(r),z=v*s(r)+w*c(r),a=x*c(t)+z*s(t);return [a*c(y)-b*s(y),a*s(y)+b*c(y),-x*s(t)+z*c(t)];};
 return {o:[p.origin.x,p.origin.y,p.origin.z],a:[rotate([1,0,0]),rotate([0,1,0]),rotate([0,0,1])]};
}
export const joinFrames=(a:RF,b:RF):RF=>({o:plus(a.o,worldVector(a,b.o)),a:b.a.map(v=>worldVector(a,v)) as RF['a']});
export const relativeFrame=(a:RF,b:RF):RF=>({o:localVector(a,plus(b.o,times(a.o,-1))),a:b.a.map(v=>localVector(a,v)) as RF['a']});
type Segment={start:V3;end:V3;direction:V3;n:number};
export type PupilRay={point:V3;direction:V3;opl:number;segments:Segment[];maxIncidence:number};
export function tracePupilRay(faces:Face[],origin:V3,direction:V3,exitX:number):PupilRay{
 let point=origin,n=1,opl=0,maxIncidence=0;const segments:Segment[]=[];
 const advance=(t:number)=>{if(!(t>0&&Number.isFinite(t)))throw Error('Non-forward intersection');const end=plus(point,times(direction,t));segments.push({start:point,end,direction,n});opl+=n*t;point=end;};
 for(const f of faces){
  if(Math.abs(n-f.n1)>1e-12)throw Error('Inconsistent medium');
  const p=localVector(f.frame,plus(point,times(f.frame.o,-1))),v=localVector(f.frame,direction),R=f.radius;
  let t=-p[0]/v[0];
  if(R){const oc=plus(p,[-R,0,0]),B=dot3(oc,v),D=B*B-dot3(oc,oc)+R*R;if(D<0)throw Error('Missed sphere');const roots=[-B-Math.sqrt(D),-B+Math.sqrt(D)].filter(x=>x>0&&Math.abs(p[0]+x*v[0])<=Math.abs(R)+1e-12);t=Math.min(...roots);}
  const hit=plus(p,times(v,t));if(Math.hypot(hit[1],hit[2])>f.aperture)throw Error('Clipped aperture');
  const normal:V3=R?times(plus([R,0,0],times(hit,-1)),1/R):[1,0,0],ci=dot3(v,normal),eta=n/f.n2,st2=eta*eta*(1-ci*ci);
  if(!(ci>0)||st2>=1)throw Error('Back face / TIR');maxIncidence=Math.max(maxIncidence,Math.acos(Math.min(1,ci)));
  advance(t);const out=plus(times(v,eta),times(normal,Math.sqrt(1-st2)-eta*ci));direction=worldVector(f.frame,out);direction=times(direction,1/Math.hypot(...direction));n=f.n2;
 }
 if(n!==1||direction[0]<Math.cos(.3))throw Error('Exit direction outside 0.3 rad benchmark domain');
 advance((exitX-point[0])/direction[0]);return {point,direction,opl,segments,maxIncidence};
}
const det=(a:number[])=>a[0]*a[3]-a[1]*a[2];
/** Position Jacobian on source-normal planes. Checking the quadratic determinant
 * minimum along every segment also detects two hidden caustic crossings. */
export function tubeJacobian(center:PupilRay,near:PupilRay[],h:number){
 const at=(seg:number,x:number)=>{const ps=near.map(r=>{const s=r.segments[seg];return plus(s.start,times(s.direction,(x-s.start[0])/s.direction[0]));});return [(ps[0][1]-ps[1][1])/(2*h),(ps[2][1]-ps[3][1])/(2*h),(ps[0][2]-ps[1][2])/(2*h),(ps[2][2]-ps[3][2])/(2*h)];};
 let minimum=Infinity;
 center.segments.forEach((s,i)=>{const a=at(i,s.start[0]),b=at(i,s.end[0]),d=b.map((v,k)=>v-a[k]),c0=det(a),c2=det(d),c1=det(b)-c0-c2;minimum=Math.min(minimum,c0,det(b));if(c2>0){const t=-c1/(2*c2);if(t>0&&t<1)minimum=Math.min(minimum,c0+c1*t+c2*t*t);}});
 const matrix=at(center.segments.length-1,center.point[0]);return {matrix,determinant:det(matrix),minimum};
}
