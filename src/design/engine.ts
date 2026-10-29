import {ProjectSchema,serializeProject,prescription} from '../project/model';
import type {Project} from '../project/model';
import {ProblemSchema} from './contract';
import type {DesignProblem} from './contract';
import {defaultSearchOptions,RoutingSchema} from '../routing/contract';
import type {Routing} from '../routing/contract';
import {defaultLensOptions,lensDomain} from '../lens/domain';
import {searchLensesAsync,applyLensCandidate,beamMerit} from '../lens/search';
import type {LensResult} from '../lens/search';
import {searchRoutingAsync,applyCandidate,TOPOLOGY_NAMES} from '../routing/search';
import type {SearchResult} from '../routing/search';
import {analyzeRouting} from '../routing/analysis';
import {screenClearance} from '../routing/clearance';
import {solvePhysicalGaussian} from '../project/physicalGaussian';
import {solveFoldedGaussian} from '../project/foldedGaussian';
import {portWorld,withPortWorld} from '../routing/model';
import {framePose} from '../authoring/commands';
import {frame,pose,compose,vectorToLocal,V,add} from '../surface/model';
import type {Frame} from '../surface/model';

export const PROBLEM_ENGINE='current-project-design/1.0.0';
export function defaultProblem(p:Project):DesignProblem{
 let lens:DesignProblem['lens']=null;try{lens=defaultLensOptions(p,prescription(p).assemblies.filter(a=>a.kind==='lens').length===1?'relay2':'existing');}catch{/* Domain is described by preflight. */}
 return {version:1,strategy:lens?'lens':'route',objective:'robustness',maxParts:8,maxGenerated:2,fixedSurfaces:[],lens,routes:p.routing?.search??defaultSearchOptions(),tolerance:{portPosition:[.5e-6,1e-6,1e-6],portAngle:[0,.0002,.0002],componentPosition:[.5e-6,0,0],componentAngle:[0,0,0],minimumOverlap:.6,maxCases:128}};
}
export function componentIds(p:Project){const d=prescription(p),target=d.surfaces.at(-1)!.id;return [...new Set(d.surfaces.filter(s=>s.id!==target).map(s=>s.assemblyId))];}
export function problemProject(p:Project,o:DesignProblem,r:Routing){return ProjectSchema.parse({...p,designProblem:ProblemSchema.parse(o),routing:RoutingSchema.parse(r)});}
function fixedCheck(before:Project,after:Project,ids:string[]){
 const a=prescription(before),b=prescription(after);
 for(const id of ids){const s=a.surfaces.find(s=>s.id===id),t=b.surfaces.find(s=>s.id===id);if(!s||!t||JSON.stringify(s)!==JSON.stringify(t))throw Error(`Fixed Surface ${id} changed / removed. Clear its lock before changing the structure.`);
  let aid:string|null=s.assemblyId;while(aid){const old=a.assemblies.find(a=>a.id===aid)!,next=b.assemblies.find(a=>a.id===aid);if(JSON.stringify(old)!==JSON.stringify(next))throw Error(`Fixed Surface ${id}: Assembly / ancestor changed.`);aid=old.parentId;}
 }
}
export function problemLimits(base:Project,p:Project,o:DesignProblem){
 fixedCheck(base,p,o.fixedSurfaces);const ids=componentIds(p),old=new Set(componentIds(base));
 if(ids.length>o.maxParts)throw Error('Total optical component limit exceeded.');
 if(ids.filter(id=>!old.has(id)).length>o.maxGenerated)throw Error('New / replacement component limit exceeded.');
 const route=analyzeRouting(p);if(route.status!=='evaluated'||!route.path||!route.withinTolerance)throw Error(`Nominal route / constraints: ${route.issues.join(' · ')||route.reason}`);
 const error=screenClearance(p,[],route.path,p.designProblem?.strategy==='lens'?o.lens?.clearance??0:o.routes.clearance);if(error)throw Error(error);
}
export type Nominal={routeOK:boolean;referenceGoals:boolean;score:number|null;eta:number|null;reason:string};
export function nominal(p:Project,o:DesignProblem):Nominal{
 const route=analyzeRouting(p),g=solvePhysicalGaussian(p),fold=solveFoldedGaussian(p,{sampleSegments:false});let score:number|null=null,referenceGoals=false;
 try{if(fold.status==='valid'&&!fold.apertureLimited){const m=beamMerit(fold,p,o.lens??{diameterTolerance:.05,phaseTolerance:.05});score=m.score;referenceGoals=m.goalsMet;}}catch{/* Undefined Output reference. */}
 const eta=g.status==='valid'&&g.overlap.status==='valid'?g.overlap.eta:null;
 return {routeOK:route.status==='evaluated'&&!!route.withinTolerance&&componentIds(p).length<=o.maxParts&&!screenClearance(p,[],route.path!,o.strategy==='lens'?o.lens?.clearance??0:o.routes.clearance),referenceGoals,score,eta,reason:eta===null?(g.status==='valid'?g.overlap.status==='not-calculated'?g.overlap.reason:'':g.reason):'Normalized scalar Gaussian Mode overlap; no transmission / delivered-power model.'};
}
type Stress={label:string;project:Project};
export function* stressCases(p:Project,o:DesignProblem):Generator<Stress>{
 const d=prescription(p),t=o.tolerance,rot=['roll','pitch','yaw'] as const,axes=['x','y','z'] as const;
 for(const which of ['source','target'] as const)for(const kind of ['Position','Angle'] as const)for(let i=0;i<3;i++)for(const sign of [-1,1]){
  const delta=(kind==='Position'?t.portPosition:t.portAngle)[i];if(!delta)continue;
  const f=framePose(portWorld(p,which));if(kind==='Position')f.origin[axes[i]]+=sign*delta;else f.rotation[rot[i]]+=sign*delta;
  yield {label:`${which} ${kind} ${kind==='Position'?axes[i]:rot[i]} ${sign>0?'+':'−'}`,project:withPortWorld(p,which,f)};
 }
 const ids=componentIds(p).filter(id=>!d.assemblies.some(a=>a.parentId===id));
 function world(id:string):Frame{const a=d.assemblies.find(a=>a.id===id)!;return a.parentId?compose(world(a.parentId),frame(a.frame)):frame(a.frame);}
 for(const id of ids)for(const kind of ['Position','Angle'] as const)for(let i=0;i<3;i++)for(const sign of [-1,1]){
  const delta=(kind==='Position'?t.componentPosition:t.componentAngle)[i];if(!delta)continue;
  const q=structuredClone(p),a=prescription(q).assemblies.find(a=>a.id===id)!;
  if(kind==='Position'){const v=V();v[axes[i]]=sign*delta;a.frame.origin=add(a.frame.origin,vectorToLocal(a.parentId?world(a.parentId):frame(pose()),v));}else a.frame.rotation[rot[i]]+=sign*delta;
  yield {label:`${id} ${kind} ${kind==='Position'?axes[i]:rot[i]} ${sign>0?'+':'−'}`,project:q};
 }
}
export type StressResult={status:'assessed'|'partial'|'not-assessed';tested:number;planned:number;fieldAssessed:number;geometryPassed:number;worstEta:number|null;worstCase:string;nominal:Nominal;qualified:boolean;issues:string[]};
export async function assessDesign(p:Project,o:DesignProblem,hooks:{cancelled?:()=>boolean}={}):Promise<StressResult>{
 const n=nominal(p,o),cases=[...stressCases(p,o)],r:StressResult={status:'not-assessed',tested:0,planned:cases.length,fieldAssessed:0,geometryPassed:0,worstEta:n.eta,worstCase:'Nominal',nominal:n,qualified:false,issues:[]};
 if(!cases.length){r.issues.push('No nonzero tolerance: robustness is not assessed.');return r;}
 for(const c of cases.slice(0,o.tolerance.maxCases)){
  if(hooks.cancelled?.())throw Error('Cancelled');
  const route=analyzeRouting(c.project);r.tested++;if(route.status==='evaluated'&&route.withinTolerance&&!screenClearance(c.project,[],route.path!,o.strategy==='lens'?o.lens?.clearance??0:o.routes.clearance))r.geometryPassed++;
  const g=solvePhysicalGaussian(c.project);
  if(g.status==='valid'&&g.overlap.status==='valid'){r.fieldAssessed++;if(r.worstEta===null||g.overlap.eta<r.worstEta){r.worstEta=g.overlap.eta;r.worstCase=c.label;}}
  else {const reason=g.status==='valid'?(g.overlap.status==='not-calculated'?g.overlap.reason:''):g.reason;if(!r.issues.includes(reason))r.issues.push(reason);}
  await new Promise(resolve=>setTimeout(resolve,0));
 }
 r.status=r.tested===r.planned&&r.fieldAssessed===r.planned&&n.eta!==null?'assessed':'partial';
 r.qualified=r.status==='assessed'&&n.routeOK&&n.referenceGoals&&r.geometryPassed===r.planned&&(r.worstEta??-1)>=o.tolerance.minimumOverlap;
 if(r.tested<r.planned)r.issues.push('Case cap reached; requested OAT coverage is incomplete.');
 return r;
}

function lensProblemOptions(p:Project,o:DesignProblem){
 if(!o.lens)throw Error('Define supported Lens bounds first.');
 const options=structuredClone(o.lens),domain=lensDomain(p,options.template,!!options.alignment);
 domain.slots.forEach((s,i)=>{if(o.fixedSurfaces.includes(s.frontId)||o.fixedSurfaces.includes(s.rearId)){if(options.alignment&&!options.alignment.fixed.includes(s.id))options.alignment.fixed.push(s.id);for(const [j,k]of (['position','front','rear','thickness'] as const).entries())options.variables[i][k]=[s.values[j],s.values[j]];}});
 return options;
}
export type ProblemCandidate={id:string;name:string;project:Project;rawId:string;stress:StressResult};
export type ProblemResult={engine:string;inputSignature:string;workingSignature:string;settings:string;options:DesignProblem;routing:Routing;status:string;reason:string;candidates:ProblemCandidate[];lensBatch?:LensResult;routeBatch?:SearchResult;rejected:string[];mode:'search'|'assessment'};
export async function runProblem(input:Project,raw:DesignProblem,routing:Routing,mode:'search'|'assessment',hooks:{cancelled?:()=>boolean;progress?:(s:string)=>void}={}):Promise<ProblemResult>{
 const o=ProblemSchema.parse(raw),working=problemProject(input,o,routing),out:ProblemResult={engine:PROBLEM_ENGINE,inputSignature:serializeProject(input),workingSignature:serializeProject(working),settings:JSON.stringify(o),options:o,routing:structuredClone(routing),status:'completed',reason:'',candidates:[],rejected:[],mode};
 try{
  if(input.model.kind!=='surface')throw Error('Physical Surface Project required.');
  fixedCheck(input,input,o.fixedSurfaces);
  let proposals:{id:string;name:string;project:Project}[]=[];
  if(mode==='assessment')proposals=[{id:'current',name:'Current Project',project:working}];
  else if(o.strategy==='lens'){
   if(!o.lens)throw Error('Define supported Lens bounds first.');
   // Whole-Surface locks freeze its paired Lens Assembly. Individual bounds can also be Min=Max.
   const options=lensProblemOptions(working,o);
   const batch=await searchLensesAsync(working,options,{cancelled:()=>!!hooks.cancelled?.(),progress:p=>hooks.progress?.(`Lens trials ${p.evaluated} · ${p.retained} retained`)});out.lensBatch=batch;out.status=batch.status;out.reason=batch.reason;
   if(batch.status==='cancelled')return out;
   proposals=batch.candidates.map(c=>({id:c.id,name:c.merit.goalsMet?'Lens · reference goals met':'Lens · nominal goals not met',project:c.project}));
  }else{
   const batch=await searchRoutingAsync(working,o.routes,{cancelled:()=>!!hooks.cancelled?.(),progress:p=>hooks.progress?.(`Route trials ${p.evaluated} · ${p.accepted} retained`)});out.routeBatch=batch;out.status=batch.status;out.reason=batch.reason;
   if(batch.status==='cancelled')return out;
   proposals=batch.candidates.map(c=>({id:c.id,name:TOPOLOGY_NAMES[c.topology],project:c.project}));
  }
  for(const c of proposals){if(hooks.cancelled?.())throw Error('Cancelled');
   try{if(mode==='search')problemLimits(input,c.project,o);hooks.progress?.(`Tolerance screen ${out.candidates.length+1} / ${proposals.length}`);const stress=await assessDesign(c.project,o,hooks);out.candidates.push({id:c.id,rawId:c.id,name:c.name,project:c.project,stress});}catch(e){if(hooks.cancelled?.())throw e;out.rejected.push(e instanceof Error?e.message:String(e));}
  }
  out.candidates.sort((a,b)=>Number(b.stress.qualified)-Number(a.stress.qualified)||Number(b.stress.nominal.referenceGoals&&b.stress.nominal.routeOK)-Number(a.stress.nominal.referenceGoals&&a.stress.nominal.routeOK)||Number(b.stress.status==='assessed')-Number(a.stress.status==='assessed')||(a.stress.status==='assessed'&&b.stress.status==='assessed'?(b.stress.worstEta??-1)-(a.stress.worstEta??-1):0)||(a.stress.nominal.score??Infinity)-(b.stress.nominal.score??Infinity));
  if(mode==='assessment')out.reason='Current Project assessed without changing geometry. OAT boundary samples are not a joint worst-case bound or a production yield estimate.';
 }catch(e){out.status=hooks.cancelled?.()?'cancelled':'unsupported';out.reason=e instanceof Error?e.message:String(e);out.candidates=[];}
 return out;
}
export function applyProblemCandidate(current:Project,result:ProblemResult,id:string):Project{
 if(result.mode!=='search'||['cancelled','unsupported'].includes(result.status)||serializeProject(current)!==result.inputSignature)throw Error('Stale / unavailable design result. Run from the current Project again.');
 const o=ProblemSchema.parse(result.options),working=problemProject(current,o,result.routing);
 if(JSON.stringify(o)!==result.settings||serializeProject(working)!==result.workingSignature)throw Error('Design Problem settings changed.');
 const c=result.candidates.find(c=>c.id===id);if(!c)throw Error('Candidate unavailable.');
 if(result.lensBatch&&JSON.stringify(result.lensBatch.options)!==JSON.stringify(lensProblemOptions(working,o))||result.routeBatch&&JSON.stringify(result.routeBatch.options)!==JSON.stringify(o.routes))throw Error('Search bounds / locks changed.');
 const next=result.lensBatch?applyLensCandidate(working,result.lensBatch,c.rawId):result.routeBatch?applyCandidate(working,result.routeBatch,c.rawId):null;
 if(!next)throw Error('No supported candidate.');
 const rawProject=result.lensBatch?.candidates.find(v=>v.id===c.rawId)?.project??result.routeBatch?.candidates.find(v=>v.id===c.rawId)?.project;
 if(!rawProject||serializeProject(c.project)!==serializeProject(rawProject))throw Error('Candidate changed.');
 problemLimits(current,next,o);return next;
}
