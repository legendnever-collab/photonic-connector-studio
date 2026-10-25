export type PaperPoint={x:number;y:number};
/** Screen annotations are sized in Report paper units, independently of local crop zoom.
 * They never change traced geometry, sampled bundle width, or Gaussian radii. */
export function directionGlyph(a:PaperPoint,b:PaperPoint,viewScale=1){
 const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);
 if(![a.x,a.y,b.x,b.y,viewScale,length].every(Number.isFinite)||viewScale<=0||length<1e-10)return null;
 const ux=dx/length,uy=dy/length,at=(t:number)=>({x:a.x+dx*t,y:a.y+dy*t}),tip=at(.68),from=at(.55);
 // Very short internal segments remain a thin traced path; don't cover interfaces with a head.
 const size=Math.min(5,length*viewScale*.1),head=size<2.5?[]:[tip,{x:tip.x-ux*size/viewScale-uy*size*.45/viewScale,y:tip.y-uy*size/viewScale+ux*size*.45/viewScale},{x:tip.x-ux*size/viewScale+uy*size*.45/viewScale,y:tip.y-uy*size/viewScale-ux*size*.45/viewScale}];
 return {from,tip,head,size:head.length?size:0};
}
