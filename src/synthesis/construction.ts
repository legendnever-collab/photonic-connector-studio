import {ProjectSchema,prescription} from '../project/model';
import type {Project} from '../project/model';
import {compile,frame,pose,add,mul,sub,norm,V,dot,unit} from '../surface/model';
import {cross} from '../surface/reportGeometry';
import type {Frame} from '../surface/model';
import {framePose} from '../authoring/commands';
import {materialIndex} from '../surface/materials';
import {analyzeRouting} from '../routing/analysis';
import {lensDomain,defaultLensOptions} from '../lens/domain';
import type {LensOptions} from '../lens/contract';
import {rayleigh} from '../physics';
import type {DesignProblem} from '../design/contract';
import type {SynthesisOptions} from './contract';
export function lockedIds(p:Project,o:DesignProblem){
 const d=prescription(p),ids=new Set<string>();
 for(const sid of o.fixedSurfaces){const s=d.surfaces.find(s=>s.id===sid);if(!s)throw Error(`Unknown fixed Surface ${sid}`);ids.add(s.assemblyId);}
 for(const v of o.lens?.variables??[])if((['position','front','rear','thickness'] as const).some(k=>v[k][0]===v[k][1]))ids.add(v.id);
 return ids;
}
/** Only recognized leaf physical components may be replaced; keep all nonoptical ancestry/metadata. */
export function emptyTrain(p:Project,o:DesignProblem):Project{
 const q=structuredClone(p),d=prescription(q),ss=compile(d),optical=new Set(d.surfaces.slice(0,-1).map(s=>s.assemblyId));
 if(p.model.kind!=='surface'||d.source.channels.rows!==1||d.source.channels.cols!==1||ss.some(s=>s.array))throw Error('Single-channel Physical Project required.');
 const locks=lockedIds(p,o);let cut=0;
 for(let i=0;i<d.surfaces.length-1;i++)if(locks.has(d.surfaces[i].assemblyId))cut=i+1;
 // Retain complete blocks through the last anchor, including any unlocked prefix.
 while(cut<d.surfaces.length-1&&cut>0&&d.surfaces[cut].assemblyId===d.surfaces[cut-1].assemblyId)cut++;
 const retained=new Set(d.surfaces.slice(0,cut).map(s=>s.assemblyId));
 for(const aid of optical){const a=d.assemblies.find(a=>a.id===aid)!,surfaces=d.surfaces.filter(s=>s.assemblyId===aid);
  if(d.assemblies.some(x=>x.parentId===aid)||!['lens','mirror','prism'].includes(a.kind))throw Error('Unsupported initial Component / hierarchy; no optics were removed.');
  if(a.kind==='lens'){if(surfaces.length!==2||surfaces.some(s=>s.interaction!=='refract'||!['sphere','plane'].includes(s.shape))||!p.bodies.some(b=>b.assemblyId===aid&&b.kind==='lens'))throw Error('Initial Lens must be a finite Sphere/Plane pair.');}
  else if(surfaces.some(s=>s.shape!=='plane')||!p.bodies.some(b=>b.assemblyId===aid&&b.kind===a.kind))throw Error('Initial fold requires finite planar optics.');
 }
 d.surfaces=[...d.surfaces.slice(0,cut),d.surfaces.at(-1)!];q.bodies=q.bodies.filter(b=>retained.has(b.assemblyId));
 // Keep baseline reference anchors here; final constructors reserve all original IDs.
 return ProjectSchema.parse(q);
}
export function addLenses(route:Project,count:0|1|2,clear:number,o:SynthesisOptions,side:'first'|'last'='first',reservedIds:string[]=[],segments?:number[]):Project{
 if(segments)return addSegmentLenses(route,count,clear,o,segments,reservedIds);
 const p=structuredClone(route),d=prescription(p),r=analyzeRouting(p);if(!r.withinTolerance||!r.path)throw Error('Construct Lens only on a closed finite route.');
 if(count===0)return p;
 const path=r.path,ss=compile(d),source=frame(d.source.frame),target=ss.at(-1)!.world,first=norm(sub(path.points[1],path.points[0])),last=norm(sub(path.points.at(-1)!,path.points.at(-2)!)),direct=d.surfaces.length===1;
 const t=o.thickness[1];if(t>=Math.min(first,last)*.6)throw Error('Insufficient free-space segment for a Lens within thickness bounds.');
 const used=new Set([...reservedIds,...d.assemblies.map(a=>a.id),...d.surfaces.map(s=>s.id)]),id=(s:string)=>{let v=s,n=0;while(used.has(v))v=`${s}-${++n}`;used.add(v);return v;},n=materialIndex(o.material,d.wavelength);
 const additions:{index:number;surfaces:typeof d.surfaces}[]=[];
 const sourceMFD=p.model.kind==='surface'?p.model.sourceMode.mfdX:null,divergence=sourceMFD?d.wavelength/(Math.PI*sourceMFD/2):.1;
 const a=Math.min(Math.min(first,last)*(direct?.25:.45),clear*.28/divergence),total=r.path.points.slice(1).reduce((sum,v,i)=>sum+norm(sub(v,r.path!.points[i])),0);
 let seededRadius:number|null=null;
 if(count===2&&!d.surfaces.some(s=>s.interaction==='tir')&&p.model.kind==='surface'&&p.model.sourceMode.mfdX===p.model.targetMode.mfdX&&p.model.sourceMode.mfdX===p.model.sourceMode.mfdY&&p.model.targetMode.mfdX===p.model.targetMode.mfdY&&p.model.sourceMode.mfdX){
  // Symmetric real thick-Lens Gaussian relay seed. The seed is still fully traced,
  // aperture/body checked, and continuously fitted. It is not an inserted example.
  const z=rayleigh(p.model.sourceMode.mfdX/2,d.wavelength),b=t/n,D=total-2*a-2*t;
  const product=(A:number[],B:number[])=>[A[0]*B[0]+A[1]*B[2],A[0]*B[1]+A[1]*B[3],A[2]*B[0]+A[3]*B[2],A[2]*B[1]+A[3]*B[3]];
  const residual=(power:number)=>{const L=[1-power*b,b,-2*power+power*power*b,1-power*b],T=[1,a,0,1],M=product(T,product(L,product([1,D,0,1],product(L,T))));return M[1]+M[2]*z*z;};
  const max=(n-1)/(clear*1.2*1.01);let previous=0,old=residual(0);
  for(let j=1;j<=256;j++){const x=max*j/256,y=residual(x);if(y*old<=0){let lo=previous,hi=x,flo=old;for(let k=0;k<64;k++){const mid=(lo+hi)/2,ym=residual(mid);if(flo*ym<=0)hi=mid;else{lo=mid;flo=ym;}}seededRadius=(n-1)/((lo+hi)/2);break;}previous=x;old=y;}
 }

 for(let i=0;i<count;i++){
  const before=count===1?side==='first':i===0,axis=before?source.axes:target.axes,length=before?first:last;
  const at=before?add(source.origin,mul(axis[0],count===2?a:length*.45)):sub(target.origin,mul(axis[0],count===2?a+t:length*.45));
  const aid=id(`D21-Lens-${i+1}`),front=id(`${aid}-S1`),rear=id(`${aid}-S2`),R=seededRadius??Math.max(clear*2,.002),f=framePose({origin:at,axes:axis});
  f.origin=V(f.origin.x+0,f.origin.y+0,f.origin.z+0);f.rotation={roll:f.rotation.roll+0,pitch:f.rotation.pitch+0,yaw:f.rotation.yaw+0};
  d.assemblies.push({id:aid,name:`Auto BK7 Lens ${i+1}`,kind:'lens',parentId:null,frame:f});
  const s={...d.surfaces.at(-1)!,assemblyId:aid,shape:'sphere' as const,interaction:'refract' as const,aperture:clear,outsideIndex:1,array:null};delete s.conic;delete s.aspheric;
  additions.push({index:before?0:d.surfaces.length-1,surfaces:[{...s,id:front,name:'Auto Lens Front',frame:pose(),radius:R,nBefore:1,nAfter:n,materialBefore:'air',materialAfter:'N-BK7'},{...s,id:rear,name:'Auto Lens Rear',frame:pose(t),radius:-R,nBefore:n,nAfter:1,materialBefore:'N-BK7',materialAfter:'air'}]});
  p.bodies.push({assemblyId:aid,kind:'lens',outerRadius:clear*1.2});
 }
 for(const x of additions.reverse())d.surfaces.splice(x.index,0,...x.surfaces);
 return ProjectSchema.parse(p);
}
/** Exterior air only: segment i runs from path point i to Surface i.
 * Never put a Lens inside a Prism, backing or glass. Sorted allocations form
 * deterministic replayable recipes; continuous fitting stays in each segment. */
export function airLensSegments(p:Project):number[]{
 const d=prescription(p),r=analyzeRouting(p),ss=compile(d);
 if(!r.withinTolerance||!r.path)throw Error('Lens allocation requires a finite closed route.');
 return ss.flatMap((s,i)=>{
  const previous=i?ss[i-1]:null;
  return s.nBefore===1&&(!previous||previous.nAfter===1)&&(!previous||previous.assemblyId!==s.assemblyId)&&norm(sub(r.path!.points[i+1],r.path!.points[i]))>2e-6?[i]:[];
 });
}
function addSegmentLenses(route:Project,count:0|1|2,clear:number,o:SynthesisOptions,segments:number[],reservedIds:string[]):Project{
 if(segments.length!==count||segments.some((v,i)=>!Number.isInteger(v)||!airLensSegments(route).includes(v)||i>0&&v<segments[i-1]))throw Error('Lens segment allocation is outside the exterior air domain.');
 if(!count)return structuredClone(route);
 const p=structuredClone(route),d=prescription(p),r=analyzeRouting(p),path=r.path!,ss=compile(d),used=new Set([...reservedIds,...d.assemblies.map(a=>a.id),...d.surfaces.map(s=>s.id)]);
 const id=(name:string)=>{let v=name,k=0;while(used.has(v))v=`${name}-${++k}`;used.add(v);return v;},n=materialIndex(o.material,d.wavelength),t=o.thickness[0],additions:{index:number;surfaces:typeof d.surfaces}[]=[];
 for(const [j,index]of segments.entries()){
  const start=path.points[index],end=path.points[index+1],axis=unit(sub(end,start)),length=norm(sub(end,start)),same=segments.filter(v=>v===index).length,order=segments.slice(0,j).filter(v=>v===index).length;
  if(length<same*t+2e-6)throw Error('Insufficient air segment for Lens thickness bounds.');
  const at=add(start,mul(axis,(length-t)*(order+1)/(same+1))),hint=ss[index].world.axes[1],projection=sub(hint,mul(axis,dot(hint,axis))),y=norm(projection)>1e-10?unit(projection):unit(cross(Math.abs(axis.z)<.9?V(0,0,1):V(0,1,0),axis)),axes:Frame['axes']=[axis,y,unit(cross(axis,y))];
  const aid=id(`D222-Lens-${j+1}`),R=Math.max(clear*2,.002,2*(clear*1.2)**2/t),s={...d.surfaces.at(-1)!,assemblyId:aid,shape:'sphere' as const,interaction:'refract' as const,aperture:clear,outsideIndex:1,array:null};delete s.conic;delete s.aspheric;
  d.assemblies.push({id:aid,name:`Auto BK7 Lens ${j+1} · air segment ${index+1}`,kind:'lens',parentId:null,frame:framePose({origin:at,axes})});
  additions.push({index,surfaces:[{...s,id:id(`${aid}-S1`),name:'Auto Lens Front',frame:pose(),radius:R,nBefore:1,nAfter:n,materialBefore:'air',materialAfter:'N-BK7'},{...s,id:id(`${aid}-S2`),name:'Auto Lens Rear',frame:pose(t),radius:-R,nBefore:n,nAfter:1,materialBefore:'N-BK7',materialAfter:'air'}]});
  p.bodies.push({assemblyId:aid,kind:'lens',outerRadius:clear*1.2});
 }
 for(const a of additions.reverse())d.surfaces.splice(a.index,0,...a.surfaces);
 return ProjectSchema.parse(p);
}
export function synthesisLensOptions(p:Project,problem:DesignProblem,o:SynthesisOptions,budget:number):LensOptions{
 const options=defaultLensOptions(p,'existing'),domain=lensDomain(p,'existing');options.budget=budget;options.diameterTolerance=o.diameterTolerance;options.phaseTolerance=o.phaseTolerance;options.clearance=problem.routes.clearance;
 for(let i=0;i<domain.slots.length;i++){
  const slot=domain.slots[i],prior=problem.lens?.variables.find(v=>v.id===slot.id),v=options.variables[i];
  if(prior)Object.assign(v,structuredClone(prior));else{v.thickness=[...o.thickness];v.position[1]=Math.min(v.position[1],slot.legal[1]-o.thickness[0]);}
  if(problem.fixedSurfaces.includes(slot.frontId)||problem.fixedSurfaces.includes(slot.rearId))for(const [j,k]of (['position','front','rear','thickness'] as const).entries())v[k]=[slot.values[j],slot.values[j]];
 }
 return options;
}
export function checkFrozen(base:Project,next:Project,o:DesignProblem){
 const a=prescription(base),b=prescription(next),eq=(x:unknown,y:unknown)=>JSON.stringify(x)===JSON.stringify(y);
 if(base.model.kind!=='surface'||next.model.kind!=='surface'||!eq(a.source,b.source)||!eq(a.surfaces.at(-1),b.surfaces.at(-1))||!eq(base.model.sourceMode,next.model.sourceMode)||!eq(base.model.targetMode,next.model.targetMode)||a.wavelength!==b.wavelength||!eq(base.authoring,next.authoring)||!eq(base.sourceBody,next.sourceBody)||!eq(base.targetBody,next.targetBody))throw Error('Fixed Port / Mode / metadata changed.');
 const target=a.surfaces.at(-1)!.assemblyId,ids=lockedIds(base,o);ids.add(target);
 // A full row lock freezes the complete paired component and ancestry. Interval freezes
 // preserve component identity; the authorized Lens builder verifies individual values.
 for(const sid of o.fixedSurfaces){let aid:string|null=a.surfaces.find(s=>s.id===sid)!.assemblyId;while(aid){
  if(!eq(a.assemblies.find(x=>x.id===aid),b.assemblies.find(x=>x.id===aid))||!eq(a.surfaces.filter(x=>x.assemblyId===aid),b.surfaces.filter(x=>x.assemblyId===aid))||!eq(base.bodies.find(x=>x.assemblyId===aid),next.bodies.find(x=>x.assemblyId===aid)))throw Error(`Fixed Surface ${sid} changed.`);aid=a.assemblies.find(x=>x.id===aid)!.parentId;
 }}
 for(const aid of ids){if(!b.assemblies.some(x=>x.id===aid)||!a.surfaces.filter(x=>x.assemblyId===aid).every(x=>b.surfaces.some(y=>y.id===x.id)))throw Error('Frozen component identity changed.');}
 let aid:string|null=target;while(aid){if(!eq(a.assemblies.find(x=>x.id===aid),b.assemblies.find(x=>x.id===aid)))throw Error('Output ancestry changed.');aid=a.assemblies.find(x=>x.id===aid)!.parentId;}
}
