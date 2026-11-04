/** Independent finite-cylinder reference. No production clearance predicates.
 * Parallel solid distance is closed form; segment distance minimizes the convex
 * squared point-to-solid distance in one dimension (160 ternary iterations).
 */
export type XYZ={x:number;y:number;z:number};
export type Cylinder={front:XYZ;normal:XYZ;radius:number;thickness:number};
const dot=(a:XYZ,b:XYZ)=>a.x*b.x+a.y*b.y+a.z*b.z;
const sub=(a:XYZ,b:XYZ)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const length=(a:XYZ)=>Math.hypot(a.x,a.y,a.z);
export function parallelCylinderDistance(a:Cylinder,b:Cylinder):number|null {
 if(Math.abs(Math.abs(dot(a.normal,b.normal))-1)>1e-10)return null;
 const center=(c:Cylinder)=>({x:c.front.x-c.normal.x*c.thickness/2,y:c.front.y-c.normal.y*c.thickness/2,z:c.front.z-c.normal.z*c.thickness/2});
 const d=sub(center(b),center(a)),axial=dot(d,a.normal);
 const radial=length({x:d.x-axial*a.normal.x,y:d.y-axial*a.normal.y,z:d.z-axial*a.normal.z});
 return Math.hypot(Math.max(0,Math.abs(axial)-(a.thickness+b.thickness)/2),Math.max(0,radial-a.radius-b.radius));
}
export function segmentCylinderDistance(start:XYZ,end:XYZ,c:Cylinder):number {
 const d=sub(end,start);
 const squared=(t:number)=>{const p=sub({x:start.x+t*d.x,y:start.y+t*d.y,z:start.z+t*d.z},c.front),axial=dot(p,c.normal);
  const radial=length({x:p.x-axial*c.normal.x,y:p.y-axial*c.normal.y,z:p.z-axial*c.normal.z});
  return Math.max(0,axial,-c.thickness-axial)**2+Math.max(0,radial-c.radius)**2;};
 let lo=0,hi=1;for(let i=0;i<160;i++){const a=lo+(hi-lo)/3,b=hi-(hi-lo)/3;if(squared(a)<squared(b))hi=b;else lo=a;}
 return Math.sqrt(Math.min(squared(0),squared(1),squared((lo+hi)/2)));
}
