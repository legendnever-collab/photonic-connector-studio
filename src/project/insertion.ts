import { addComponent, DocumentSchema } from '../domain';
import { pose, compile, mul, add } from '../surface/model';
import type { Pose, Surface, Assembly } from '../surface/model';
import { markTemplates, rowCommand } from '../authoring/commands';
import { projectExample, ProjectSchema } from './model';
import type { Project } from './model';
export type BlockKind = 'lens' | 'mirror' | 'prism' | 'array' | 'probe' | 'gap' | 'reference-plane' | 'single-surface' | 'blank';
export function suggestedPose(p: Project, selected: string): Pose {
 const d=p.model.kind==='surface'?p.model.prescription:null;
 if(!d)return pose(.005);
 const ss=compile(d);
 if(selected==='@source'||ss.length===1)return {...pose(),origin:mul(add(d.source.frame.origin,ss[0].world.origin),.5)};
 const chosen=ss.find(s=>s.id===selected),end=chosen?Math.max(...ss.flatMap((s,i)=>s.assemblyId===chosen.assemblyId?[i]:[])):ss.length-2;
 const i=Math.min(Math.max(0,end),ss.length-2),a=ss[i],b=ss[i+1];
 return {...pose(),origin:mul(add(a.world.origin,b.world.origin),.5)};
}
/** One transaction in world coordinates. Templates supply explicitly synthetic local geometry. */
export function insertBlock(p:Project,kind:BlockKind,placement:Pose,token:string,selected:string):{project:Project;selection:string}{
 if(!/^[a-zA-Z0-9-]{1,36}$/.test(token))throw Error('Invalid insertion ID');
 if(p.model.kind==='ideal'){
  if(!['lens','gap','reference-plane'].includes(kind))throw Error('Physical Block requires a physical Project. Ideal Lens curvature and thickness are undefined.');
  const added=addComponent(p.model.design,kind as 'lens'|'gap'|'reference-plane',`Block-${token}`),c=added.components.find(c=>c.id===`Block-${token}`)!;
  const components=added.components.filter(x=>x.id!==c.id),chosen=components.findIndex(x=>x.id===selected);components.splice(chosen<0||chosen===components.length-1?components.length-1:chosen+1,0,c);
  const d={...added,components};
  return {project:ProjectSchema.parse({...p,model:{kind:'ideal',design:DocumentSchema.parse({...d,components:d.components.map(c=>c.id===`Block-${token}`?{...c,frame:placement}:c)})}}),selection:`Block-${token}`};
 }
 if(kind==='single-surface'||kind==='blank'){const anchor=p.model.prescription.surfaces.find(s=>s.id===selected)??p.model.prescription.surfaces.at(-1)!;const result=rowCommand(p,anchor.id,anchor===p.model.prescription.surfaces.at(-1)?'before':'after',token);const m=result.project.model;if(m.kind==='surface'){const sid=result.selection,aid=m.prescription.surfaces.find(s=>s.id===sid)!.assemblyId;m.prescription.assemblies=m.prescription.assemblies.map(a=>a.id===aid?{...a,frame:placement}:a);}return result;}
 if(kind==='gap'||kind==='reference-plane')kind='probe';
 const d=p.model.prescription;
 let assemblies:Assembly[],surfaces:Surface[],bodies:Project['bodies'];
 if(kind==='probe'){
  const id=`Probe-${token}`,aid=`Assembly-${token}`;
  const selectedSurface=d.surfaces.find(s=>s.id===selected),next=selectedSurface?d.surfaces.filter(s=>s.assemblyId===selectedSurface.assemblyId).at(-1)!:d.surfaces.at(-2)??d.surfaces[0];
  assemblies=[{id:aid,name:'Probe Assembly',kind:'group',parentId:null,frame:placement}];
  surfaces=[{id,name:'Probe',assemblyId:aid,frame:pose(),shape:'plane',radius:.005,aperture:next.aperture+(next.array?next.array.pitch*Math.hypot(next.array.rows-1,next.array.cols-1)/2:0),interaction:'probe',nBefore:next.nAfter,nAfter:next.nAfter,outsideIndex:1,array:null}];bodies=[];
 }else{
  const template=projectExample(kind),t=template.model.kind==='surface'?template.model.prescription:null;if(!t)throw Error('Missing physical template');
  const id=(v:string)=>`${v}-${token}`;
  assemblies=t.assemblies.filter(a=>a.kind!=='target').map(a=>({...a,id:id(a.id),parentId:a.parentId?id(a.parentId):null,frame:a.parentId?a.frame:placement}));
  surfaces=t.surfaces.filter(s=>t.assemblies.find(a=>a.id===s.assemblyId)?.kind!=='target').map(s=>({...s,id:id(s.id),assemblyId:id(s.assemblyId)}));
  bodies=template.bodies.map(b=>({...b,assemblyId:id(b.assemblyId)}));
 }
 const chosen=d.surfaces.find(s=>s.id===selected),indices=d.surfaces.flatMap((s,i)=>chosen&&s.assemblyId===chosen.assemblyId?[i]:[]);
 const index=selected==='@source'?0:chosen&&chosen!==d.surfaces.at(-1)?Math.min(Math.max(...indices)+1,d.surfaces.length-1):d.surfaces.length-1;
 const next=[...d.surfaces];next.splice(index,0,...surfaces);
 const result=ProjectSchema.parse({...p,model:{...p.model,prescription:{...d,assemblies:[...d.assemblies,...assemblies],surfaces:next}},bodies:[...p.bodies,...bodies]});
 return {project:markTemplates(p,result),selection:surfaces[0].id};
}
