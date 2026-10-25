import {ProjectSchema,serializeProject} from '../project/model';
import type {Project} from '../project/model';
import {compile,frame,pose,add,sub,mul,dot,V,norm,pointToWorld,vectorToLocal,compose} from '../surface/model';
import type {Frame,Vec} from '../surface/model';
import {framePose} from '../authoring/commands';
import {analyzeRouting} from '../routing/analysis';
import {defaultRouting} from '../routing/contract';
import {materialIndex} from '../surface/materials';
import type {LensOptions,LensVariable} from './contract';
export type LensSlot={id:string;frontId:string;rearId:string;frontS:number;rearS:number;axis:Vec;parent:Frame;glass:number;outerRadius:number;legal:[number,number];cell:[number,number];values:[number,number,number,number]};
export type LensDomain={base:Project;slots:LensSlot[];addedIds:string[];total:number};
export function physical(p:Project){if(p.model.kind!=='surface')throw Error('Physical Project required.');return p.model.prescription;}
const curvature=(s:{shape:string;radius:number})=>s.shape==='plane'?0:1/s.radius;
export function lensDomain(input:Project,template:LensOptions['template']):LensDomain {
 const p=ProjectSchema.parse(structuredClone(input)),d=physical(p),initial=analyzeRouting(p);
 if(d.source.channels.rows!==1||d.source.channels.cols!==1||d.surfaces.some(s=>s.array))throw Error('Single-channel Lens design only.');
 if(initial.status!=='evaluated'||!initial.path||!initial.withinTolerance)throw Error('First establish a finite chief route within the Port / space / part tolerances. Use Find Solutions or edit the optical train.');
 const target=d.surfaces.at(-1)!,ports=p.authoring?.ports;
 if(!ports||ports.source.mediumIndex!==1||ports.target.mediumIndex!==1||d.source.n!==1||target.nBefore!==1)throw Error('Lens search requires defined air Input / Output reference planes.');
 const lensIds=()=>d.assemblies.filter(a=>a.kind==='lens'&&d.surfaces.some(s=>s.assemblyId===a.id)).map(a=>a.id),addedIds:string[]=[];
 let ids=lensIds();if(ids.length<1||ids.length>2)throw Error('Define one or two physical Lens components first.');
 if(template==='relay2'&&ids.length===1){
  const path=initial.path,ss=compile(d),previous=path.points.at(-2)!,last=path.hits.at(-2),direction=last?.direction??frame(d.source.frame).axes[0],end=path.points.at(-1)!,length=norm(sub(end,previous));
  if(length<.001)throw Error('2-Lens Relay needs at least 1 mm of final free-space segment.');
  if(Math.abs(dot(direction,ss.at(-1)!.world.axes[0])-1)>1e-10)throw Error('Relay Lens requires normal Output incidence.');
  const id='S32-Relay-Lens';if(d.assemblies.some(a=>a.id===id)||d.surfaces.some(s=>s.id==='S32-Relay-S1'||s.id==='S32-Relay-S2'))throw Error('Relay IDs already exist; select Existing Lenses.');
  const t=.0003,at=add(previous,mul(direction,Math.max(.0001,length*.65))),world={origin:at,axes:ss.at(-1)!.world.axes} as Frame,n=materialIndex('N-BK7',d.wavelength);
  const addedPose=framePose(world);addedPose.origin=V(addedPose.origin.x+0,addedPose.origin.y+0,addedPose.origin.z+0);addedPose.rotation={roll:addedPose.rotation.roll+0,pitch:addedPose.rotation.pitch+0,yaw:addedPose.rotation.yaw+0};
  d.assemblies.push({id,name:'Relay BK7 Lens',kind:'lens',parentId:null,frame:addedPose});
  const surface={...target,assemblyId:id,shape:'sphere' as const,interaction:'refract' as const,aperture:.0005,materialBefore:'air' as const,materialAfter:'N-BK7' as const,nBefore:1,nAfter:n,outsideIndex:1};
  d.surfaces.splice(d.surfaces.length-1,0,{...surface,id:'S32-Relay-S1',name:'Relay Front',frame:pose(),radius:.003},{...surface,id:'S32-Relay-S2',name:'Relay Rear',frame:pose(t),radius:-.003,materialBefore:'N-BK7',materialAfter:'air',nBefore:n,nAfter:1});
  p.bodies.push({assemblyId:id,kind:'lens',outerRadius:.0006});addedIds.push(id);ids=lensIds();
  if(d.name==='Fiber → BK7 Lens → Fiber')d.name='Fiber → 2 BK7 Lenses → Fiber';
  if(d.name==='Fiber → Lens → 2 Mirrors → PIC · Lens Design')d.name='Fiber → 2 Lenses → 2 Mirrors → PIC · Lens Design';
 }
 if(ids.length>(p.routing??defaultRouting()).parts.lens)throw Error('Lens count exceeds the configured part limit.');
 // A moving parent cannot move any fixed Port or optical element as a side effect.
 for(const a of d.assemblies)if(a.parentId&&ids.includes(a.parentId))throw Error('Lens must be a leaf Assembly; a moving Lens cannot parent another component.');
 const r=analyzeRouting(p);if(r.status!=='evaluated'||!r.path||!r.withinTolerance)throw Error(`Template route unavailable: ${r.reason} ${r.issues.join(' · ')}`);
 const ss=compile(d),path=r.path,distances:number[]=[];let s=0;for(let i=1;i<path.points.length;i++){s+=norm(sub(path.points[i],path.points[i-1]));distances.push(s);}
 function assemblyFrame(id:string):Frame{const a=d.assemblies.find(a=>a.id===id)!;return a.parentId?compose(assemblyFrame(a.parentId),frame(a.frame)):frame(a.frame);}
 const slots=ids.map(id=>{
  const pair=ss.map((s,i)=>({s,i})).filter(v=>v.s.assemblyId===id),body=p.bodies.find(b=>b.assemblyId===id);
  if(pair.length!==2||pair[1].i!==pair[0].i+1||body?.kind!=='lens'||pair.some(v=>v.s.interaction!=='refract'||!['sphere','plane'].includes(v.s.shape)))throw Error(`${id}: two adjacent Sphere / Plane refracting surfaces and a finite Lens Body are required.`);
  const [a,b]=pair,axis=a.s.world.axes[0],inc=a.i?path.hits[a.i-1].direction:frame(d.source.frame).axes[0];
  if(dot(axis,inc)<1-1e-10||[a,b].some(v=>Math.hypot(path.hits[v.i].local.y,path.hits[v.i].local.z)>1e-9)||dot(axis,b.s.world.axes[0])<1-1e-10)throw Error(`${id}: Lens chief must be centered and normal.`);
  if(a.s.nBefore!==1||b.s.nAfter!==1||a.s.nAfter===null||Math.abs(a.s.nAfter-b.s.nBefore!)>1e-10||a.s.nAfter<=1)throw Error(`${id}: an air–glass–air Lens with one defined glass is required.`);
  let prev=a.i-1,next=b.i+1;while(prev>=0&&ids.includes(ss[prev].assemblyId))prev--;while(next<ss.length-1&&ids.includes(ss[next].assemblyId))next++;
  const frontS=distances[a.i],rearS=distances[b.i],margin=1e-6,legal:[number,number]=[prev<0?margin:distances[prev]+margin,distances[next]-margin];
  const cell:[number,number]=[a.i>0&&ids.includes(ss[a.i-1].assemblyId)?(distances[a.i-1]+frontS)/2:legal[0],ids.includes(ss[b.i+1]?.assemblyId)?(rearS+distances[b.i+1])/2:legal[1]];
  const assembly=d.assemblies.find(a=>a.id===id)!,parent=assembly.parentId?assemblyFrame(assembly.parentId):frame(pose());
  return {id,frontId:a.s.id,rearId:b.s.id,frontS,rearS,axis,parent,glass:a.s.nAfter,outerRadius:body.outerRadius,legal,cell,values:[frontS,curvature(a.s),curvature(b.s),rearS-frontS] as LensSlot['values']};
 });
 return {base:p,slots,addedIds,total:s};
}
export function defaultLensOptions(p:Project,template:LensOptions['template']='existing'):LensOptions {
 const domain=lensDomain(p,template);
 const variables=domain.slots.map(s=>{const t=s.values[3],minT=Math.max(20e-6,t*.15),maxT=Math.min(.02,Math.max(t*1.5,minT*1.1)),maxC=1/(s.outerRadius*1.01);return {id:s.id,position:[s.cell[0],s.cell[1]-minT],front:[-maxC,maxC],rear:[-maxC,maxC],thickness:[minT,maxT]} as LensVariable;});
 return {template,budget:1536,variables,diameterTolerance:.05,phaseTolerance:.05,clearance:1e-6};
}
export function lensValues(domain:LensDomain):number[]{return domain.slots.flatMap(s=>s.values);}
export function buildLensProject(domain:LensDomain,values:number[]):Project {
 const p=structuredClone(domain.base),d=physical(p);
 domain.slots.forEach((slot,i)=>{
  const [position,front,rear,t]=values.slice(4*i,4*i+4);
  if(position<slot.legal[0]-1e-12||position+t>slot.legal[1]+1e-12||!(t>0))throw Error('Lens outside its fixed free-space segment.');
  // Preserve exact frozen prescriptions, including local-frame roundoff.
  if([position,front,rear,t].every((v,j)=>Object.is(v,slot.values[j])))return;
  const assembly=d.assemblies.find(a=>a.id===slot.id)!;assembly.frame.origin=add(assembly.frame.origin,vectorToLocal(slot.parent,mul(slot.axis,position-slot.frontS)));
  const a=d.surfaces.find(s=>s.id===slot.frontId)!,b=d.surfaces.find(s=>s.id===slot.rearId)!;b.frame.origin=pointToWorld(frame(a.frame),V(t));
  [a,b].forEach((s,j)=>{const c=[front,rear][j];s.shape=Math.abs(c)<1?'plane':'sphere';s.radius=Math.abs(c)<1?0:1/c;});
 });
 return ProjectSchema.parse(p);
}
export function frozenSignature(p:Project,domain:LensDomain):string {
 const q=structuredClone(p),d=physical(q),ids=new Set(domain.slots.map(s=>s.id)),surfaceIds=new Set(domain.slots.flatMap(s=>[s.frontId,s.rearId]));
 // Strip only authorized variables; all other design state must remain exact.
 d.assemblies=d.assemblies.map(a=>ids.has(a.id)?{...a,frame:{...a.frame,origin:V()}}:a);
 d.surfaces=d.surfaces.map(s=>surfaceIds.has(s.id)?{...s,shape:'plane',radius:0,...(domain.slots.some(l=>l.rearId===s.id)?{frame:{...s.frame,origin:V()}}:{})}:s);
 q.routing??=defaultRouting();delete q.routing.lensSolution;
 return serializeProject(q);
}
