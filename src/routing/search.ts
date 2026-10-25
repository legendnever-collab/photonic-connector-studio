import {ProjectSchema,prescription,serializeProject,projectFingerprint} from '../project/model';
import type {Project} from '../project/model';
import {bodyGeometry,insideBody} from '../project/geometry';
import {compile,frame,V,add,sub,mul,dot,norm,unit} from '../surface/model';
import type {Vec,Frame,Surface} from '../surface/model';
import {traceRay} from '../surface/trace';
import {materialIndex} from '../surface/materials';
import {cross} from '../surface/reportGeometry';
import {framePose} from '../authoring/commands';
import {analyzeRouting} from './analysis';
import type {RoutingResult} from './analysis';
import {defaultRouting,defaultSearchOptions,SearchOptionsSchema} from './contract';
import type {SearchOptions,Topology,Box} from './contract';
import {lineBox,screenClearance} from './clearance';

export const SEARCH_ID='bounded-port-routing/1.0.0' as const;
export const TOPOLOGY_NAMES:Record<Topology,string>={direct:'Direct',mirror1:'1 Mirror',mirror2:'2 Mirrors',prism1:'TIR Prism','mirror-prism':'Mirror + TIR Prism'};
export type Candidate={id:string;topology:Topology;project:Project;generatedIds:string[];analysis:RoutingResult;length:number;partCount:number;footprint:number};
export type SearchResult={engine:typeof SEARCH_ID;status:'completed'|'budget-exhausted'|'cancelled'|'unsupported';reason:string;inputSignature:string;inputFingerprint:string;options:SearchOptions;evaluated:number;rejected:Record<string,number>;candidates:Candidate[]};
export type SearchProgress={evaluated:number;accepted:number;budget:number};
type Block={kind:'mirror';at:Vec;incoming:Vec;outgoing:Vec}|{kind:'prism';at:Vec;incoming:Vec;outgoing:Vec};
type Proposal={topology:Topology;blocks:Block[];parameters?:[number,number];refine?:number};
type Prepared={base:Project;start:Vec;incoming:Vec;target:Vec;outgoing:Vec;box:Box;rangeA:[number,number];rangeB:[number,number]};
const axes=['x','y','z'] as const;
const fractions=[.5,.25,.75,.125,.375,.625,.875];
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const fingerprint=(p:Project)=>projectFingerprint(p);
/** Exclude result provenance from its own design identity. Always revalidate before applying. */
export function solutionDesignFingerprint(p:Project){const q=structuredClone(p);if(q.routing)delete q.routing.solution;return fingerprint(ProjectSchema.parse(q));}
function generatedPose(f:Frame){const p=framePose(f);return {origin:V(p.origin.x+0,p.origin.y+0,p.origin.z+0),rotation:{roll:p.rotation.roll+0,pitch:p.rotation.pitch+0,yaw:p.rotation.yaw+0}};}
function normalFrame(origin:Vec,x:Vec):Frame {
 const n=unit(x),helper=Math.abs(n.z)<.9?V(0,0,1):V(0,1,0),y=unit(cross(helper,n));return {origin,axes:[n,y,unit(cross(n,y))]};
}
function prepare(p:Project,o:SearchOptions):Prepared {
 if(p.model.kind!=='surface')throw Error('Physical Project required.');
 const d=p.model.prescription,ss=compile(d),target=ss.at(-1)!,r=p.routing??defaultRouting();
 if(d.source.channels.rows!==1||d.source.channels.cols!==1||ss.some(s=>s.array))throw Error('Single-channel, non-array routing only.');
 if(target.shape!=='plane')throw Error('Output must be one planar Port.');
 const firstFold=d.surfaces.slice(0,-1).findIndex(s=>['mirror','prism'].includes(d.assemblies.find(a=>a.id===s.assemblyId)!.kind)),cut=firstFold<0?d.surfaces.length-1:firstFold;
 const fixed=d.surfaces.slice(0,cut),suffix=d.surfaces.slice(cut,-1);
 if(suffix.some(s=>!['mirror','prism'].includes(d.assemblies.find(a=>a.id===s.assemblyId)!.kind)))throw Error('Only a trailing Mirror / Prism section can be replaced. Lens after a fold requires another search domain.');
 if(fixed.some(s=>d.assemblies.find(a=>a.id===s.assemblyId)!.kind!=='lens'||s.interaction!=='refract'))throw Error('Fixed prefix supports physical Lens blocks only. Remove draft / array / auxiliary surfaces before searching.');
 const fixedIds=new Set(fixed.map(s=>s.assemblyId));
 if([...fixedIds].some(id=>!p.bodies.some(b=>b.assemblyId===id&&b.kind==='lens')))throw Error('Define the fixed Lens Body before clearance screening.');
 if(fixedIds.size>r.parts.lens)throw Error('Fixed Lens count exceeds the configured limit.');
 if(r.parts.prism>=1&&o.prismLeg<4*o.clearRadius&&o.templates.some(t=>t==='prism1'||t==='mirror-prism'))throw Error('Prism leg must be at least 4 × Clear Radius.');
 const keep=new Set([...fixedIds,target.assemblyId]);
 // Keep explicit reference / alignment ancestry, but remove obsolete optical route blocks.
 if(p.authoring?.alignment.movingId&&p.authoring.alignment.movingId!=='@source')keep.add(p.authoring.alignment.movingId);
 for(const id of [...keep]){let a=d.assemblies.find(a=>a.id===id);while(a?.parentId){keep.add(a.parentId);a=d.assemblies.find(x=>x.id===a!.parentId);}}
 const base:Project={...p,model:{...p.model,prescription:{...d,assemblies:d.assemblies.filter(a=>keep.has(a.id)),surfaces:[...fixed,d.surfaces.at(-1)!]}},bodies:p.bodies.filter(b=>fixedIds.has(b.assemblyId))};
 const bd=prescription(base),g=bodyGeometry(bd,compile(bd),base.bodies);if(g.issues.length)throw Error(g.issues.join(' · '));
 const source=frame(d.source.frame);
 if(d.source.n===null||Math.abs(d.source.n-1)>1e-10||p.authoring?.ports.source.mediumIndex!=null&&Math.abs(p.authoring.ports.source.mediumIndex-1)>1e-10)throw Error('This search uses air Ports (n=1). Input medium is missing or unsupported.');
 if(target.nBefore===null||Math.abs(target.nBefore-1)>1e-10||p.authoring?.ports.target.mediumIndex!=null&&Math.abs(p.authoring.ports.target.mediumIndex-1)>1e-10)throw Error('This search uses an air Output reference (n=1).');
 const path=traceRay({origin:source.origin,direction:source.axes[0],n:d.source.n,channel:'reference'},ss.slice(0,cut),(v,s)=>insideBody(v,s,g));
 if(path.status!=='reached')throw Error(`Fixed prefix blocked: ${path.reason}`);
 const last=path.hits.at(-1),start=last?.point??source.origin,incoming=last?.direction??source.axes[0],outgoing=target.world.axes[0];
 if(last&&Math.abs(ss[cut-1].nAfter!-1)>1e-10)throw Error('Fixed prefix must exit into air.');
 const end=target.world.origin,D=norm(sub(end,start));if(D<1e-8)throw Error('Port separation after the fixed Lens is too small.');
 const pad=Math.max(D*.25,2*o.prismLeg,4*o.clearRadius),box=r.bounds??{min:V(...axes.map(k=>Math.max(-1,Math.min(start[k],end[k])-pad)) as [number,number,number]),max:V(...axes.map(k=>Math.min(1,Math.max(start[k],end[k])+pad)) as [number,number,number])};
 const min=Math.max(o.clearance+o.mirrorThickness,1e-7),ra=lineBox(start,incoming,box,min,2),rb=lineBox(end,mul(outgoing,-1),box,min,2);
 // An empty ray interval is a bounded search failure, not a claim about all optical topologies.
 return {base,start,incoming,target:end,outgoing,box,rangeA:ra??[min,min],rangeB:rb??[min,min]};
}
function mirror(at:Vec,incoming:Vec,outgoing:Vec):Block{return {kind:'mirror',at,incoming,outgoing};}
function twoMirrors(p:Prepared,t:number,u:number,refine=0):Proposal|null {
 const a=add(p.start,mul(p.incoming,t)),b=sub(p.target,mul(p.outgoing,u));if(norm(sub(b,a))<1e-8)return null;
 const middle=unit(sub(b,a));return {topology:'mirror2',blocks:[mirror(a,p.incoming,middle),mirror(b,middle,p.outgoing)],parameters:[t,u],refine};
}
function proposals(p:Prepared,o:SearchOptions):Proposal[] {
 const q:Proposal[]=[],allowed=new Set(o.templates),r=p.base.routing??defaultRouting(),ts=fractions.map(f=>p.rangeA[0]+f*(p.rangeA[1]-p.rangeA[0])),us=fractions.map(f=>p.rangeB[0]+f*(p.rangeB[1]-p.rangeB[0])),w=sub(p.target,p.start),c=dot(p.incoming,p.outgoing),den=1-c*c;
 if(allowed.has('direct'))q.push({topology:'direct',blocks:[]});
 const t=den>1e-12?(dot(w,p.incoming)-c*dot(w,p.outgoing))/den:null,u=den>1e-12?(dot(w,p.outgoing)-c*dot(w,p.incoming))/den:null;
 if(allowed.has('mirror1')&&r.parts.mirror>=1){
  for(const v of [...(t!==null&&t>0&&u!==null&&u>0?[t]:[]),...ts]){
   const a=add(p.start,mul(p.incoming,v)),delta=sub(p.target,a);if(norm(delta)>1e-8)q.push({topology:'mirror1',blocks:[mirror(a,p.incoming,unit(delta))]});
  }
 }
 if(allowed.has('prism1')&&r.parts.prism>=1&&Math.abs(c)<1e-9&&t!==null&&u!==null&&t>o.prismLeg/2&&u>o.prismLeg/2){
  q.push({topology:'prism1',blocks:[{kind:'prism',at:add(p.start,mul(p.incoming,t)),incoming:p.incoming,outgoing:p.outgoing}]});
 }
 if(allowed.has('mirror2')&&r.parts.mirror>=2){
  // Projection seeds cover parallel displaced axes; a Cartesian grid covers skew 3D routes.
  for(const t of ts){const a=add(p.start,mul(p.incoming,t)),u=dot(sub(p.target,a),p.outgoing);if(u>0){const x=twoMirrors(p,t,u);if(x)q.push(x);}}
  for(const t of ts)for(const u of us){const x=twoMirrors(p,t,u);if(x)q.push(x);}
 }
 if(allowed.has('mirror-prism')&&r.parts.mirror>=1&&r.parts.prism>=1){
  for(const t of ts){const a=add(p.start,mul(p.incoming,t)),v=dot(sub(p.target,a),p.outgoing),center=sub(p.target,mul(p.outgoing,v)),delta=sub(center,a);
   if(v>o.prismLeg/2&&norm(delta)>o.prismLeg/2+Math.max(o.clearance,1e-7)){const toward=unit(delta);q.push({topology:'mirror-prism',blocks:[mirror(a,p.incoming,toward),{kind:'prism',at:center,incoming:toward,outgoing:p.outgoing}]});}
  }
 }
 return q;
}
function build(p:Prepared,o:SearchOptions,q:Proposal):{project:Project;ids:string[];footprint:number} {
 const base=p.base;if(base.model.kind!=='surface')throw Error('Physical model required');
 const d=base.model.prescription,target=d.surfaces.at(-1)!,surfaces=[...d.surfaces.slice(0,-1)],assemblies=[...d.assemblies],bodies=[...base.bodies],ids:string[]=[];
 const existing=new Set([...d.assemblies.map(a=>a.id),...d.surfaces.map(s=>s.id)]);
 function id(name:string){let n=0,v=name;while(existing.has(v))v=`${name}-${++n}`;existing.add(v);return v;}
 const blank=(sid:string,aid:string):Surface=>({id:sid,name:sid,assemblyId:aid,frame:generatedPose(normalFrame(V(),V(1))),shape:'plane',radius:.005,aperture:o.clearRadius,interaction:'reflect',nBefore:1,nAfter:1,outsideIndex:1,materialBefore:'air',materialAfter:'air',array:null});
 let footprint=0;
 for(const [i,b]of q.blocks.entries()){
  const aid=id(`S2-${b.kind}-${i+1}`);ids.push(aid);
  if(b.kind==='mirror'){
   const bend=Math.acos(clamp(dot(b.incoming,b.outgoing),-1,1));if(bend<20*Math.PI/180)throw Error('Mirror bend below 20 degrees (grazing route excluded)');
   const normal=unit(sub(b.outgoing,b.incoming)); // Faces the incoming ray; physical backing is behind the front.
   assemblies.push({id:aid,name:`Auto Mirror ${i+1}`,kind:'mirror',parentId:null,frame:generatedPose(normalFrame(b.at,normal))});
   surfaces.push(blank(id(`${aid}-front`),aid));bodies.push({assemblyId:aid,kind:'mirror',outline:'disc',width:2.2*o.clearRadius,height:2.2*o.clearRadius,thickness:o.mirrorThickness});
   footprint+=Math.PI*(1.1*o.clearRadius)**2*o.mirrorThickness;
  }else{
   if(Math.abs(dot(b.incoming,b.outgoing))>1e-9)throw Error('Prism requires a 90-degree normal-entry / exit fold');
   const h=o.prismLeg/2,origin=sub(b.at,mul(b.incoming,h)),f:Frame={origin,axes:[b.incoming,b.outgoing,unit(cross(b.incoming,b.outgoing))]},n=materialIndex('N-BK7',d.wavelength);
   assemblies.push({id:aid,name:'Auto BK7 TIR Prism',kind:'prism',parentId:null,frame:generatedPose(f)});
   const entry={...blank(id(`${aid}-entry`),aid),interaction:'refract' as const,nAfter:n,materialAfter:'N-BK7' as const};
   const tir={...blank(id(`${aid}-TIR`),aid),frame:generatedPose(normalFrame(V(h),unit(V(1,-1)))),interaction:'tir' as const,nBefore:n,nAfter:n,materialBefore:'N-BK7' as const,materialAfter:'N-BK7' as const};
   // Use local XY normals while keeping the common extrusion axis on all three faces.
   tir.frame={origin:V(h),rotation:{roll:0,pitch:0,yaw:-Math.PI/4}};
   const exit={...blank(id(`${aid}-exit`),aid),frame:{origin:V(h,h),rotation:{roll:0,pitch:0,yaw:Math.PI/2}},interaction:'refract' as const,nBefore:n,materialBefore:'N-BK7' as const};
   surfaces.push(entry,tir,exit);bodies.push({assemblyId:aid,kind:'prism',depth:2.4*o.clearRadius});footprint+=.5*o.prismLeg**2*2.4*o.clearRadius;
  }
 }
 surfaces.push(target);
 const project:Project={...base,model:{...base.model,prescription:{...d,name:`${d.name.slice(0,80)} · S2 ${TOPOLOGY_NAMES[q.topology]}`,surfaces,assemblies}},bodies};
 return {project:ProjectSchema.parse(project),ids,footprint};
}
function compare(a:Candidate,b:Candidate,o:SearchOptions){return (o.ranking==='fewest-parts'?a.partCount-b.partCount||a.length-b.length:a.length-b.length||a.partCount-b.partCount)||a.footprint-b.footprint||a.id.localeCompare(b.id);}
function signature(q:Proposal){return JSON.stringify([q.topology,q.blocks.map(b=>[b.kind,...axes.map(k=>Math.round(b.at[k]*1e10)),...axes.map(k=>Math.round(b.outgoing[k]*1e10))])]);}
function check(project:Project,ids:string[],o:SearchOptions,box:Box){const a=analyzeRouting(project);if(a.status!=='evaluated'||!a.withinTolerance)throw Error(a.reason&&a.status!=='evaluated'?a.reason:a.issues[0]??'Position / direction tolerance not met');
 const issue=screenClearance(project,ids,a.path!,o.clearance,box);if(issue)throw Error(issue);return a;
}
/** Deterministic bounded template enumeration with analytic optical closure and local pose refinement. */
export function* searchSteps(input:Project,options:SearchOptions=defaultSearchOptions()):Generator<SearchProgress,SearchResult> {
 const result:SearchResult={engine:SEARCH_ID,status:'completed',reason:'',inputSignature:serializeProject(input),inputFingerprint:fingerprint(input),options,evaluated:0,rejected:{},candidates:[]};
 let p:Prepared;try{SearchOptionsSchema.parse(options);p=prepare(input,options);}catch(e){return {...result,status:'unsupported',reason:e instanceof Error?e.message:String(e)};}
 const queue=proposals(p,options),seen=new Set<string>();let i=0;
 while(i<queue.length&&result.evaluated<options.budget){const q=queue[i++],key=signature(q);if(seen.has(key))continue;seen.add(key);result.evaluated++;
  try{
   const {project,ids,footprint}=build(p,options,q),analysis=check(project,ids,options,p.box),path=analysis.path!,length=path.points.slice(1).reduce((n,v,j)=>n+norm(sub(v,path.points[j])),0);
   const candidate:Candidate={id:`${q.topology}-${fingerprint(project)}`,topology:q.topology,project,generatedIds:ids,analysis,length,partCount:q.blocks.length,footprint};
   result.candidates.push(candidate);result.candidates.sort((a,b)=>compare(a,b,options));const diverse=new Map<Topology,Candidate>();for(const c of result.candidates)if(!diverse.has(c.topology))diverse.set(c.topology,c);const keep=[...diverse.values()];for(const c of result.candidates)if(keep.length<8&&!keep.includes(c))keep.push(c);result.candidates=keep.sort((a,b)=>compare(a,b,options));
   // Refine only promising two-mirror seeds, with a hard two-level, four-neighbor limit.
   if(q.parameters&&(q.refine??0)<2&&result.candidates[0]===candidate){
    const [t,u]=q.parameters,step=Math.max(options.clearance*2,(p.rangeA[1]-p.rangeA[0])/(16*2**(q.refine??0)));
    for(const [dt,du]of [[step,0],[-step,0],[0,step],[0,-step]]){const a=clamp(t+dt,...p.rangeA),b=clamp(u+du,...p.rangeB),next=twoMirrors(p,a,b,(q.refine??0)+1);if(next)queue.push(next);}
   }
  }catch(e){const reason=e instanceof Error?e.message:String(e);result.rejected[reason]=(result.rejected[reason]??0)+1;}
  yield {evaluated:result.evaluated,accepted:result.candidates.length,budget:options.budget};
 }
 if(i<queue.length){result.status='budget-exhausted';result.reason='Search budget exhausted. Results cover only the evaluated placements.';}
 else result.reason=result.candidates.length?'Bounded template search complete. Candidates are geometric references, not Mode-matched solutions.':'No candidate found in the tested templates / bounds. This is not proof that no optical solution exists.';
 return result;
}
export function searchRouting(input:Project,options=defaultSearchOptions()):SearchResult {const iterator=searchSteps(input,options);let step=iterator.next();while(!step.done)step=iterator.next();return step.value;}
/** Cooperative scheduler keeps the offline single-file UI cancellable; no network or AI service. */
export async function searchRoutingAsync(input:Project,options:SearchOptions,control:{cancelled:()=>boolean;progress:(v:SearchProgress)=>void;yieldTask?:()=>Promise<void>}):Promise<SearchResult>{
 if(control.cancelled())return {engine:SEARCH_ID,status:'cancelled',reason:'Search cancelled.',inputSignature:serializeProject(input),inputFingerprint:fingerprint(input),options,evaluated:0,rejected:{},candidates:[]};
 const iterator=searchSteps(input,options);let step=iterator.next(),last:SearchProgress={evaluated:0,accepted:0,budget:options.budget};
 while(!step.done){last=step.value;control.progress(last);
  await (control.yieldTask??(()=>new Promise<void>(resolve=>setTimeout(resolve,0))))();
  if(control.cancelled()){
   // Close the suspended generator without evaluating another placement; cancellation discards candidates.
   const partial:SearchResult={engine:SEARCH_ID,status:'cancelled',reason:'Search cancelled; rerun to obtain a complete bounded search.',inputSignature:serializeProject(input),inputFingerprint:fingerprint(input),options,evaluated:last.evaluated,rejected:{},candidates:[]};iterator.return(partial);return partial;
  }
  step=iterator.next();
 }return step.value;
}
export function applyCandidate(current:Project,batch:SearchResult,id:string):Project {
 if(serializeProject(current)!==batch.inputSignature)throw Error('Stale candidates: Project changed. Run Search again.');
 const c=batch.candidates.find(c=>c.id===id);if(!c)throw Error('Candidate unavailable.');
 const prepared=prepare(current,batch.options),fixed=ProjectSchema.parse(prepared.base),candidate=ProjectSchema.parse(c.project);
 if(fixed.model.kind!=='surface'||candidate.model.kind!=='surface')throw Error('Physical candidate required.');
 const a=fixed.model,b=candidate.model,eq=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
 if(!eq(a.sourceMode,b.sourceMode)||!eq(a.targetMode,b.targetMode)||!eq(a.prescription.source,b.prescription.source)||!eq(a.prescription.surfaces.at(-1),b.prescription.surfaces.at(-1))||
  !eq(fixed.authoring,candidate.authoring)||!eq(fixed.sourceBody,candidate.sourceBody)||!eq(fixed.targetBody,candidate.targetBody)||
  !a.prescription.assemblies.every(a=>eq(a,b.prescription.assemblies.find(x=>x.id===a.id)))||!a.prescription.surfaces.slice(0,-1).every(s=>eq(s,b.prescription.surfaces.find(x=>x.id===s.id)))||!fixed.bodies.every(body=>eq(body,candidate.bodies.find(x=>x.assemblyId===body.assemblyId))))throw Error('Candidate altered a fixed Port / Lens condition. Run Search again.');
 check(c.project,c.generatedIds,batch.options,prepared.box);
 const r=c.project.routing??defaultRouting(),next:Project={...c.project,routing:{...r,search:batch.options}};
 if(next.routing)delete next.routing.solution;
 next.routing!.solution={engine:SEARCH_ID,topology:c.topology,baselineFingerprint:batch.inputFingerprint,designFingerprint:solutionDesignFingerprint(next),evaluated:batch.evaluated};
 return ProjectSchema.parse(next);
}
