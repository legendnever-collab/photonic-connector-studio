import { compile, pose, frame, pointToLocal, pointToWorld, add, mul } from '../surface/model';
import type { Frame, Surface } from '../surface/model';
import { physicalProject, prescription, ProjectSchema, projectFingerprint } from '../project/model';
import type { Project } from '../project/model';
import { unknownAuthoring } from './contract';
import { fingerprint } from '../physics';
export function newPhysicalProject():Project {
 const target:Surface={id:'Output-Port',name:'Output Reference Plane',assemblyId:'Output',frame:pose(),shape:'plane',radius:.005,aperture:.001,interaction:'probe',nBefore:null,nAfter:null,outsideIndex:null,array:null};
 return {...physicalProject({kind:'surface-prescription',schemaVersion:1,units:'SI',name:'Untitled Mode Matching',wavelength:1310e-9,provenance:'synthetic-assumptions',source:{frame:pose(),radius:.00025,samples:5,n:null,channels:{rows:1,cols:1,pitch:.0006}},assemblies:[{id:'Output',name:'Output Port',kind:'target',parentId:null,frame:pose(.01)}],surfaces:[target]}),authoring:unknownAuthoring()};
}
export function templateSignature(p:Project,aid:string){const d=prescription(p);return fingerprint(JSON.stringify({surfaces:d.surfaces.filter(s=>s.assemblyId===aid),body:p.bodies.find(b=>b.assemblyId===aid)}));}
export function markTemplates(old:Project,next:Project):Project {
 const authoring=next.authoring??unknownAuthoring(),oldIds=new Set(prescription(old).assemblies.map(a=>a.id));
 return {...next,authoring:{...authoring,templates:{...authoring.templates,...Object.fromEntries(prescription(next).assemblies.filter(a=>!oldIds.has(a.id)).map(a=>[a.id,templateSignature(next,a.id)]))}}};
}
export function modelClass(p:Project,s:Surface){return p.model.kind==='ideal'?'Ideal reference':s.nBefore===null||s.nAfter===null?'Draft':'Physical';}
function physical(p:Project){if(p.model.kind!=='surface')throw Error('Surface authoring requires a Physical Project. New Physical Project creates explicit Mode Ports.');return p.model;}
export type RowCommand='before'|'after'|'duplicate'|'delete';
export function rowCommand(p:Project,id:string,action:RowCommand,token:string){
 const model=physical(p),d=model.prescription,i=d.surfaces.findIndex(s=>s.id===id),s=d.surfaces[i];if(!s)throw Error('Surface not found');
 const terminal=i===d.surfaces.length-1;
 if(terminal&&action!=='before')throw Error('Output Port is protected; insert before the Reference Plane.');
 if(action==='delete'){
  const surfaces=d.surfaces.filter(x=>x.id!==id);
  return {project:ProjectSchema.parse({...p,model:{...model,prescription:{...d,surfaces}},bodies:p.bodies.filter(b=>b.assemblyId!==s.assemblyId)}),selection:surfaces[Math.min(i,surfaces.length-1)].id};
 }
 let surfaces=[...d.surfaces],assemblies=[...d.assemblies],next:Surface;
 if(action==='duplicate')next={...structuredClone(s),id:`Surface-${token}`,name:s.name+' copy'};
 else {
  const aid=`Manual-${token}`,w=compile(d)[i].world,previous=i?compile(d)[i-1].world.origin:d.source.frame.origin;
  const origin=action==='before'?mul(add(previous,w.origin),.5):mul(add(w.origin,compile(d)[i+1]?.world.origin??w.origin),.5);
  assemblies.push({id:aid,name:'Blank Component',kind:'group',parentId:null,frame:{...pose(),origin}});
  next={...s,id:`Surface-${token}`,name:'Single Surface',assemblyId:aid,frame:pose(),shape:'plane',interaction:'refract',nBefore:null,nAfter:null,outsideIndex:null,array:null};
 }
 surfaces.splice(action==='before'?i:i+1,0,next);
 return {project:ProjectSchema.parse({...p,model:{...model,prescription:{...d,assemblies,surfaces}}}),selection:next.id};
}
export function framePose(f:Frame){
 const pitch=Math.asin(Math.max(-1,Math.min(1,-f.axes[0].z))),gimbal=Math.abs(Math.cos(pitch))<1e-10;
 return {origin:f.origin,rotation:{pitch,yaw:gimbal?Math.atan2(-f.axes[1].x,f.axes[1].y):Math.atan2(f.axes[0].y,f.axes[0].x),roll:gimbal?0:Math.atan2(f.axes[1].z,f.axes[2].z)}};
}
export function groupSurfaces(p:Project,ids:string[],kind:'lens'|'group',token:string):Project {
 const model=physical(p),d=model.prescription,w=compile(d),selected=d.surfaces.filter(s=>ids.includes(s.id));
 if(selected.length<2||selected.includes(d.surfaces.at(-1)!))throw Error('Select at least two non-Port Surfaces.');
 const indices=selected.map(s=>d.surfaces.indexOf(s));if(Math.max(...indices)-Math.min(...indices)+1!==selected.length)throw Error('Group requires consecutive Surfaces; propagation order is preserved.');
 const aid=`Group-${token}`,oldIds=new Set(selected.map(s=>s.assemblyId));
 // A world-aligned group preserves every Surface world frame including folded orientations.
 return ProjectSchema.parse({...p,model:{...model,prescription:{...d,assemblies:[...d.assemblies,{id:aid,name:kind==='lens'?'Custom Lens':'Custom Assembly',kind,parentId:null,frame:pose()}],surfaces:d.surfaces.map(s=>ids.includes(s.id)?{...s,assemblyId:aid,frame:framePose(w.find(x=>x.id===s.id)!.world)}:s)}},bodies:p.bodies.filter(b=>!oldIds.has(b.assemblyId))});
}
export function spacing(p:Project,id:string){const d=prescription(p),w=compile(d),i=w.findIndex(s=>s.id===id),a=w[i],b=w[i+1];if(!a||!b)return null;
 const local=pointToLocal(a.world,b.world.origin),dot=(u:{x:number;y:number;z:number},v:{x:number;y:number;z:number})=>u.x*v.x+u.y*v.y+u.z*v.z;
 const paired=a.assemblyId===b.assemblyId&&d.assemblies.find(x=>x.id===a.assemblyId)?.kind==='lens'&&d.surfaces.filter(x=>x.assemblyId===a.assemblyId).length===2;
 const editable=paired&&Math.hypot(local.y,local.z)<1e-10&&dot(a.world.axes[0],b.world.axes[0])>1-1e-10;
 return {distance:Math.hypot(local.x,local.y,local.z),editable,axial:local.x,nextId:b.id};}
export function withThickness(p:Project,id:string,value:number):Project {const model=physical(p),d=model.prescription,info=spacing(p,id);if(!info?.editable||value<=0)throw Error('Spacing is Derived; a paired coaxial Lens is required.');const a=d.surfaces.find(s=>s.id===id)!;return ProjectSchema.parse({...p,model:{...model,prescription:{...d,surfaces:d.surfaces.map(s=>s.id===info.nextId?{...s,frame:{...s.frame,origin:pointToWorld(frame(a.frame),{x:value,y:0,z:0})}}:s)}}});}
export function modeResultState(p:Project){const a=p.authoring,hash=projectFingerprint(p);return {hash,status:'not-calculated' as const,reason:p.model.kind==='surface'?'Physical Mode Bridge B1에서 Incident Field 전파를 연결합니다.':a?'U1 Port 계약은 저장됩니다. 아래 기존 Gaussian 결과는 Legacy Scalar 근사입니다.':'Legacy Gaussian: 기존 Scalar / Paraxial 계산 범위입니다.'};}

/** Save a leaf component as a reusable per-project template, not another active design. */
export function saveBuildingBlock(p:Project,selected:string,token:string):Project {
 const model=physical(p),d=model.prescription,s=d.surfaces.find(s=>s.id===selected),a=d.assemblies.find(a=>a.id===s?.assemblyId);
 if(!a||a.kind==='target')throw Error('Select a non-Port Component first.');
 if(d.assemblies.some(x=>x.parentId===a.id))throw Error('Save a leaf Component; nested Assemblies retain their explicit Project hierarchy.');
 const block={id:`User-${token}`,name:a.name,kind:a.kind,surfaces:structuredClone(d.surfaces.filter(x=>x.assemblyId===a.id)),body:structuredClone(p.bodies.find(b=>b.assemblyId===a.id)??null)};
 return ProjectSchema.parse({...p,buildingBlocks:[...(p.buildingBlocks??[]),block]});
}
export function insertBuildingBlock(p:Project,blockId:string,placement:ReturnType<typeof pose>,selected:string,token:string){
 const model=physical(p),d=model.prescription,block=p.buildingBlocks?.find(b=>b.id===blockId);if(!block)throw Error('User Building Block not found');
 const aid=`UserAssembly-${token}`,surfaces=block.surfaces.map((s,i)=>({...structuredClone(s),id:`UserSurface-${i}-${token}`,assemblyId:aid}));
 const chosen=d.surfaces.find(s=>s.id===selected),indices=d.surfaces.flatMap((s,i)=>chosen&&s.assemblyId===chosen.assemblyId?[i]:[]),index=selected==='@source'?0:chosen&&chosen!==d.surfaces.at(-1)?Math.min(Math.max(...indices)+1,d.surfaces.length-1):d.surfaces.length-1;
 const next=[...d.surfaces];next.splice(index,0,...surfaces);
 const project=ProjectSchema.parse({...p,model:{...model,prescription:{...d,assemblies:[...d.assemblies,{id:aid,name:block.name,kind:block.kind,parentId:null,frame:placement}],surfaces:next}},bodies:block.body?[...p.bodies,{...block.body,assemblyId:aid}]:p.bodies});
 return {project:markTemplates(p,project),selection:surfaces[0].id};
}
