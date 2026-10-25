import {ProjectSchema,prescription,serializeProject,projectFingerprint} from '../project/model';
import type {Project} from '../project/model';
import {problemProject,problemLimits,componentIds,stressCases} from '../design/engine';
import {ProblemSchema} from '../design/contract';
import type {DesignProblem} from '../design/contract';
import {RoutingSchema} from '../routing/contract';
import type {Routing,SearchOptions,Topology} from '../routing/contract';
import {prepareRoutingDomain,routeProposals,buildRouteProposal,validateRouteProposal,refineRouteProposal} from '../routing/search';
import type {RouteDomain,RouteProposal} from '../routing/search';
import {solveFoldedGaussian} from '../project/foldedGaussian';
import type {FoldedResult} from '../project/foldedGaussian';
import {tensorOverlap} from '../project/tensorOverlap';
import {analyzeRouting} from '../routing/analysis';
import {screenClearance} from '../routing/clearance';
import {lensSearch,beamMerit} from '../lens/search';
import type {BeamMerit} from '../lens/search';
import {lensDomain,buildLensProject} from '../lens/domain';
import {emptyTrain,addLenses,lockedIds,synthesisLensOptions,checkFrozen} from './construction';
import {SynthesisSchema,SYNTHESIS_ID} from './contract';
import type {SynthesisOptions} from './contract';
export type Recipe={kind:'existing'}|{kind:'generated';route:RouteProposal;clear:number;count:0|1|2;side:'first'|'last'};
export type OAT={status:'assessed'|'partial'|'not-assessed';planned:number;tested:number;fieldAssessed:number;geometryPassed:number;worstEta:number|null;issues:string[];coverage:string};
export type SynthesisCandidate={id:string;topology:string;project:Project;recipe:Recipe;values:number[];seal:string;merit:BeamMerit|null;eta:number|null;reason:string;qualified:boolean;oat:OAT};
export type SynthesisResult={engine:typeof SYNTHESIS_ID;inputSignature:string;settings:string;problem:DesignProblem;routing:Routing;options:SynthesisOptions;status:'completed'|'budget-exhausted'|'unsupported'|'invalid-input'|'cancelled';reason:string;evaluated:number;geometryEvaluated:number;toleranceEvaluated:number;refinements:number;placementFeedback:{topology:string;tested:number;supported:number;worstEta:number|null}[];rejected:Record<string,number>;families:Record<string,number>;candidates:SynthesisCandidate[]};
const message=(e:unknown)=>e instanceof Error?e.message:String(e),eq=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const emptyOAT=():OAT=>({status:'not-assessed',planned:0,tested:0,fieldAssessed:0,geometryPassed:0,worstEta:null,issues:[],coverage:''});
export function synthesisFingerprint(p:Project){const q=structuredClone(p);if(q.synthesis)delete q.synthesis.solution;return projectFingerprint(q);}
export function synthesisProject(p:Project,problem:DesignProblem,routing:Routing,options:SynthesisOptions){const o=SynthesisSchema.parse(options);delete o.solution;return ProjectSchema.parse({...problemProject(p,problem,routing),synthesis:o});}
function routeOptions(problem:DesignProblem,o:SynthesisOptions,clear:number):SearchOptions{return {...problem.routes,templates:o.families,budget:o.geometryBudget,clearRadius:clear,prismLeg:Math.max(problem.routes.prismLeg,4*clear),mirrorThickness:Math.max(problem.routes.mirrorThickness,20e-6)};}
function construct(p:Project,problem:DesignProblem,o:SynthesisOptions,recipe:Recipe):Project{
 if(recipe.kind==='existing')return structuredClone(p);
 const base=emptyTrain(p,problem),opts=routeOptions(problem,o,recipe.clear),domain=prepareRoutingDomain(base,opts);
 if(!o.families.includes(recipe.route.topology)||![o.clearRadius[0],o.clearRadius[1]].includes(recipe.clear))throw Error('Recipe family / size is outside the declared finite set.');
 const shapes:Record<Topology,string[]>={direct:[],mirror1:['mirror'],mirror2:['mirror','mirror'],prism1:['prism'],'mirror-prism':['mirror','prism']};
 if(!eq(recipe.route.blocks.map(b=>b.kind),shapes[recipe.route.topology]))throw Error('Recipe topology changed.');
 const reserved=[...prescription(p).assemblies.map(a=>a.id),...prescription(p).surfaces.map(s=>s.id)],route=buildRouteProposal(domain,opts,recipe.route,reserved).project;prescription(route).name=prescription(p).name;
 return addLenses(route,recipe.count,recipe.clear,o,recipe.side,reserved);
}
function preflight(p:Project,problem:DesignProblem){
 if(p.model.kind!=='surface')throw Error('Physical Project required.');
 lockedIds(p,problem);const d=prescription(p),ports=p.authoring?.ports;
 for(const which of ['source','target'] as const){const v=ports?.[which],m=which==='source'?p.model.sourceMode:p.model.targetMode;
  if(!v||v.fieldModel!=='gaussian'||v.imported||v.adapter!=='homogeneous-paraxial'||v.phase!=='waist-plane'||v.normalization==='unspecified'||v.normalization==='absolute-power'&&v.powerW===null||!m.mfdX||!m.mfdY)throw Error(`${which}: Gaussian Mode / phase / normalization is undefined or unsupported. Select the SMF reference explicitly.`);
  if(v.mediumIndex!==1)throw Error(`${which}: this synthesis requires an air Port (n=1).`);
  if([m.mfdX,m.mfdY].some(v=>d.wavelength/(Math.PI*v/2)>.1+1e-12))throw Error(`${which}: paraxial divergence exceeds 0.1 rad.`);
 }
 if(d.source.channels.rows!==1||d.source.channels.cols!==1||d.surfaces.some(s=>s.array))throw Error('Single-channel, non-array synthesis only.');
 if(d.source.n!==1||d.surfaces.at(-1)!.nBefore!==1)throw Error('Port and Surface air media must agree. Apply an explicit air SMF reference.');
}
function compare(a:SynthesisCandidate,b:SynthesisCandidate){
 const robust=(c:SynthesisCandidate)=>c.oat.status==='assessed'&&c.oat.geometryPassed===c.oat.planned;
 return Number(b.qualified)-Number(a.qualified)||Number(b.eta!==null)-Number(a.eta!==null)||
  (a.qualified&&b.qualified&&robust(a)&&robust(b)&&a.oat.coverage===b.oat.coverage?(b.oat.worstEta??-1)-(a.oat.worstEta??-1):0)||
  (a.merit?.score??Infinity)-(b.merit?.score??Infinity)||componentIds(a.project).length-componentIds(b.project).length||a.id.localeCompare(b.id);
}
function overlap(p:Project,r:FoldedResult){
 return tensorOverlap(p,r);
}
function geometry(base:Project,p:Project,problem:DesignProblem){checkFrozen(base,p,problem);problemLimits(base,p,problem);const r=analyzeRouting(p);const reason=r.path?screenClearance(p,[],r.path,problem.routes.clearance):'No finite chief path';if(reason)throw Error(reason);}
/** Shared budget covers every nominal transported forward solve, including Lens preflight and final candidate metrics. */
export function* synthesisSteps(input:Project,rawProblem:DesignProblem,rawRouting:Routing,rawOptions:SynthesisOptions):Generator<string,SynthesisResult>{
 const out:SynthesisResult={engine:SYNTHESIS_ID,inputSignature:serializeProject(input),settings:JSON.stringify([rawProblem,rawRouting,rawOptions]),problem:structuredClone(rawProblem),routing:structuredClone(rawRouting),options:structuredClone(rawOptions),status:'completed',reason:'',evaluated:0,geometryEvaluated:0,toleranceEvaluated:0,refinements:0,placementFeedback:[],rejected:{},families:{},candidates:[]};
 const reject=(s:string)=>{out.rejected[s]=(out.rejected[s]??0)+1;};
 let p:Project,o:SynthesisOptions,problem:DesignProblem;
 try{problem=ProblemSchema.parse(rawProblem);const routing=RoutingSchema.parse(rawRouting);o=SynthesisSchema.parse(rawOptions);p=synthesisProject(input,problem,routing,o);preflight(p,problem);}catch(e){out.status='invalid-input';out.reason=message(e);return out;}
 const forward:typeof solveFoldedGaussian=(q,settings)=>{if(out.evaluated>=o.budget)throw Error('Global optical evaluation budget exhausted');out.evaluated++;return solveFoldedGaussian(q,settings);};
 const seen=new Set<string>();let limited=false;
 const retain=(project:Project,recipe:Recipe,values:number[],topology:string)=>{
  geometry(p,project,problem);const r=forward(project,{sampleSegments:false});if(r.status!=='valid')throw Error(r.reason);if(r.apertureLimited)throw Error('Aperture tail bound exceeds 0.1%; untruncated reference only.');
  const m=beamMerit(r,project,o),v=overlap(project,r),eta=v.status==='valid'?v.eta:null;
  const c:SynthesisCandidate={id:`synthesis-${out.evaluated}-${out.geometryEvaluated}`,project,recipe:structuredClone(recipe),values:[...values],seal:JSON.stringify([recipe,values]),topology,merit:m,eta,reason:v.status==='valid'?'Conditional co-polarized scalar Gaussian Mode shape overlap; ideal planar reflection. Transmission / total coupling not calculated.':v.reason,qualified:m.goalsMet&&eta!==null&&eta>=o.minimumOverlap,oat:emptyOAT()};
  const fp=serializeProject(project);if(out.candidates.some(c=>serializeProject(c.project)===fp))return;
  out.candidates.push(c);out.candidates.sort(compare);
  // Keep diversity by optical family and Lens count before filling with merit-ranked alternatives.
  const diverse=new Map<string,SynthesisCandidate>();for(const x of out.candidates){const key=x.topology+'-'+prescription(x.project).assemblies.filter(a=>a.kind==='lens'&&componentIds(x.project).includes(a.id)).length;if(!diverse.has(key))diverse.set(key,x);}
  const chosen=[...diverse.values()].sort(compare).slice(0,6);for(const x of out.candidates)if(chosen.length<8&&!chosen.includes(x))chosen.push(x);out.candidates=chosen.sort(compare);
 };
 function* fit(recipe:Recipe,topology:string,allowance:number):Generator<string,number>{
  const start=out.evaluated;let cost=Infinity;
  try{
   const base=construct(p,problem,o,recipe),hasLens=prescription(base).surfaces.some(s=>prescription(base).assemblies.find(a=>a.id===s.assemblyId)?.kind==='lens');
   if(!hasLens){retain(base,recipe,[],topology);return out.candidates.find(c=>eq(c.recipe,recipe))?.merit?.score??Infinity;}
   try{const initialDomain=lensDomain(base,'existing');retain(base,recipe,initialDomain.slots.flatMap(s=>s.values),topology);const first=out.candidates.find(c=>eq(c.recipe,recipe));if(first)cost=(first.merit?.score??Infinity)+(first.eta===null?1e4:-Math.log(Math.max(first.eta,1e-300)));}catch{/* An invalid seed may still be repaired by bounded fitting. */}
   const prior=out.candidates.filter(c=>eq(c.recipe,recipe)&&c.values.length).sort(compare)[0],options=synthesisLensOptions(base,problem,o,Math.max(1,Math.min(prior?.qualified?64:o.fitBudget,allowance-3))),domain=lensDomain(base,'existing'),warm=prior?buildLensProject(domain,prior.values):base,it=lensSearch(warm,options,forward);let v=it.next();
   while(!v.done){yield `${topology} · optical ${out.evaluated}/${o.budget}`;if(out.evaluated>=o.budget-1||out.evaluated-start>=allowance){v=it.return({engine:'bounded-lens-reference/1.0.0',status:'budget-exhausted',reason:'Global allocation exhausted',inputSignature:'',inputFingerprint:'',options,evaluated:0,rejected:{},candidates:[],baseline:null});break;}v=it.next();}
   if(!v.done)return cost;
   if(v.value.candidates.length===0)for(const [s,n]of Object.entries(v.value.rejected))out.rejected[s]=(out.rejected[s]??0)+n;
   for(const c of v.value.candidates.slice(0,2)){
    if(out.evaluated>=o.budget)break;
    try{retain(buildLensProject(domain,c.values),recipe,c.values,topology);const found=out.candidates.find(x=>eq(x.recipe,recipe));if(found){const modePenalty=found.eta===null?1e4:-Math.log(Math.max(found.eta,1e-300));let penalty=0;
     if(found.qualified){const selected=[...stressCases(found.project,problem)].filter(t=>t.label.startsWith('target Position')).slice(0,2);let worst=found.eta!,supported=0;
      for(const t of selected){if(out.toleranceEvaluated>=1024)break;out.toleranceEvaluated++;const beam=solveFoldedGaussian(t.project,{sampleSegments:false}),v=overlap(t.project,beam);if(v.status==='valid'){supported++;worst=Math.min(worst,v.eta);}}
      out.placementFeedback.push({topology,tested:selected.length,supported,worstEta:supported===selected.length&&selected.length?worst:null});
      if(supported===selected.length&&selected.length)penalty=-Math.log(Math.max(worst,1e-300));
     }
     cost=Math.min(cost,c.merit.score+modePenalty+penalty);}}catch(e){reject(message(e));}
   }
  }catch(e){reject(message(e));}
  return cost;
 }
 const tasks:{recipe:Recipe;topology:string;domain?:RouteDomain;proposal?:RouteProposal}[]=[];
 if(componentIds(p).length)tasks.push({recipe:{kind:'existing'},topology:'Retained initial train'});
 let base:Project|null=null;try{base=emptyTrain(p,problem);}catch(e){reject(message(e));if(!lockedIds(p,problem).size){out.status='unsupported';out.reason=message(e);return out;}}
 const seeds:{q:RouteProposal;domain:RouteDomain;clear:number}[]=[];
 if(base)for(const clear of [...new Set(o.clearRadius)]){
  try{const opts=routeOptions(problem,o,clear),domain=prepareRoutingDomain(base,opts),all=routeProposals(domain,opts);
   // Round-robin family opportunities; do not consume the geometry pool in one topology.
   const groups=o.families.map(f=>all.filter(q=>q.topology===f));let i=0;while(groups.some(g=>i<g.length)){for(const g of groups)if(g[i])seeds.push({q:g[i],domain,clear});i++;}
  }catch(e){reject(message(e));}
 }
 const feasible:{recipe:Extract<Recipe,{kind:'generated'}>;domain:RouteDomain;proposal:RouteProposal}[]=[];
 for(const seed of seeds){if(out.geometryEvaluated>=Math.max(1,Math.floor(o.geometryBudget*.75))){limited=true;break;}const {q,domain,clear}=seed,key=JSON.stringify([q,clear]);if(seen.has(key))continue;seen.add(key);out.geometryEvaluated++;out.families[q.topology]=(out.families[q.topology]??0)+1;
  try{const opts=routeOptions(problem,o,clear),built=buildRouteProposal(domain,opts,q);validateRouteProposal(built.project,built.ids,opts,domain.box);
   for(const count of [2,1,0] as const){
    const parts=q.blocks.length+count,structure=`${count} Lens + ${q.blocks.length} fold (${q.topology})`;
    if(count>p.routing!.parts.lens){reject(`Lens limit excludes ${structure}: ${count} > ${p.routing!.parts.lens}`);continue;}
    if(parts>problem.maxParts){reject(`Total component limit excludes ${structure}: ${parts} > ${problem.maxParts}`);continue;}
    if(parts>problem.maxGenerated){reject(`New / replacement component limit excludes ${structure}: ${parts} > ${problem.maxGenerated}`);continue;}
    for(const side of count===1?['first','last'] as const:['first'] as const){const recipe:Extract<Recipe,{kind:'generated'}>={kind:'generated',route:q,clear,count,side};feasible.push({recipe,domain,proposal:q});}
   }
  }catch(e){reject(message(e));}yield `Geometry ${out.geometryEvaluated}/${o.geometryBudget}`;
 }
 // Fit representatives first, then use optical merit to revisit placement rather than geometry rank.
 const groups=new Map<string,typeof feasible>();for(const t of feasible){const key=t.proposal.topology+'-'+t.recipe.count+'-'+t.recipe.side+'-'+t.recipe.clear;const a=groups.get(key)??[];a.push(t);groups.set(key,a);}
 const initial=[...groups.values()].flatMap(g=>g.slice(0,3));
 for(const t of initial)tasks.push({recipe:t.recipe,topology:t.proposal.topology,domain:t.domain,proposal:t.proposal});
 const scored:{cost:number;task:typeof tasks[number]}[]=[];
 for(const task of tasks){if(out.evaluated>=o.budget-4)break;const allowance=Math.min(o.fitBudget,Math.max(1,Math.floor((o.budget-out.evaluated)*.6/Math.max(1,tasks.length-scored.length))));const cost=yield* fit(task.recipe,task.topology,allowance);scored.push({cost,task});}
 for(const {task} of scored.filter(s=>Number.isFinite(s.cost)).sort((a,b)=>a.cost-b.cost).slice(0,2)){
  if(!task.domain||!task.proposal||task.recipe.kind!=='generated')continue;
  const step=(task.domain.rangeA[1]-task.domain.rangeA[0])/16;
  for(const q of refineRouteProposal(task.domain,task.proposal,step)){
   if(out.geometryEvaluated>=o.geometryBudget||out.evaluated>=o.budget-4)break;out.geometryEvaluated++;out.refinements++;
   yield* fit({...task.recipe,route:q},q.topology,Math.min(o.fitBudget,o.budget-out.evaluated-2));
  }
 }
 // Spend remaining optical budget on best full-mode / reference trajectories, with family diversity retained.
 for(const {task} of scored.filter(s=>Number.isFinite(s.cost)&&(!out.candidates.some(c=>c.qualified)||out.candidates.some(c=>c.qualified&&eq(c.recipe,s.task.recipe)))).sort((a,b)=>a.cost-b.cost).slice(0,3)){
  if(out.evaluated>=o.budget-4)break;yield* fit(task.recipe,task.topology,Math.min(2048,o.budget-out.evaluated-2));
 }
 // OAT uses the same declarations as D1, never silently treats unsupported fields as passing.
 for(const c of out.candidates){const all=[...stressCases(c.project,problem)],a=c.oat;a.planned=all.length;a.worstEta=c.eta;a.coverage=JSON.stringify([problem.tolerance,all.map(v=>v.label)]);
  for(const t of all.slice(0,problem.tolerance.maxCases)){if(out.toleranceEvaluated>=1024)break;out.toleranceEvaluated++;a.tested++;const g=analyzeRouting(t.project);if(g.withinTolerance&&g.path&&!screenClearance(t.project,[],g.path,problem.routes.clearance))a.geometryPassed++;
   const r=solveFoldedGaussian(t.project,{sampleSegments:false}),v=overlap(t.project,r);if(v.status==='valid'){a.fieldAssessed++;a.worstEta=a.worstEta===null?v.eta:Math.min(a.worstEta,v.eta);}else if(!a.issues.includes(v.reason))a.issues.push(v.reason);
   yield `OAT ${a.tested}/${a.planned} · ${c.topology}`;
  }
  a.status=!a.planned?'not-assessed':a.tested===a.planned&&a.fieldAssessed===a.planned&&c.eta!==null?'assessed':'partial';if(a.tested<a.planned)a.issues.push('OAT cap reached; coverage is incomplete.');
 }
 out.candidates.sort(compare);out.status=limited||out.evaluated>=o.budget-4||out.geometryEvaluated>=o.geometryBudget?'budget-exhausted':'completed';
 out.reason=out.candidates.some(c=>c.qualified)?'Nominal Mode goals met in the tested Lens / ideal planar Mirror domain. No global optimum, combined-error or Yield claim.':out.candidates.length?'Best tested partial / model-limited candidates; nominal Mode goals are not met.':'No feasible candidate found in this bounded family / space / budget; not proof of impossibility.';
 if(out.status==='budget-exhausted')out.reason+=' Search coverage is partial; untested placements / refinements may remain.';
 return out;
}
export function searchSynthesis(p:Project,problem:DesignProblem,r:Routing,o:SynthesisOptions){const it=synthesisSteps(p,problem,r,o);let v=it.next();while(!v.done)v=it.next();return v.value;}
export async function searchSynthesisAsync(p:Project,problem:DesignProblem,r:Routing,o:SynthesisOptions,hooks:{cancelled:()=>boolean;progress:(s:string)=>void}){
 const it=synthesisSteps(structuredClone(p),structuredClone(problem),structuredClone(r),structuredClone(o));let v=it.next(),last=performance.now();
 while(!v.done){if(hooks.cancelled()){const empty:SynthesisResult={engine:SYNTHESIS_ID,inputSignature:serializeProject(p),settings:JSON.stringify([problem,r,o]),problem,routing:r,options:o,status:'cancelled',reason:'Cancelled; Preview discarded, Project unchanged.',evaluated:0,geometryEvaluated:0,toleranceEvaluated:0,refinements:0,placementFeedback:[],rejected:{},families:{},candidates:[]};it.return(empty);return empty;}
  if(performance.now()-last>8){hooks.progress(v.value);await new Promise(resolve=>setTimeout(resolve,0));last=performance.now();}v=it.next();
 }return v.value;
}
export function applySynthesis(current:Project,result:SynthesisResult,id:string):Project{
 if(result.engine!==SYNTHESIS_ID||result.status==='cancelled'||result.status==='unsupported'||result.status==='invalid-input'||serializeProject(current)!==result.inputSignature||JSON.stringify([result.problem,result.routing,result.options])!==result.settings)throw Error('Stale / unavailable synthesis result or changed settings.');
 const c=result.candidates.find(c=>c.id===id);if(!c||c.seal!==JSON.stringify([c.recipe,c.values]))throw Error('Candidate parameters changed.');
 const problem=ProblemSchema.parse(result.problem),o=SynthesisSchema.parse(result.options),working=synthesisProject(current,problem,result.routing,o),base=construct(working,problem,o,c.recipe);
 let rebuilt=base;if(c.values.length){const opts=synthesisLensOptions(base,problem,o,1),limits=opts.variables.flatMap(v=>[v.position,v.front,v.rear,v.thickness]);if(c.values.length!==limits.length||limits.some(([a,b],i)=>!Number.isFinite(c.values[i])||c.values[i]<a-1e-12||c.values[i]>b+1e-12))throw Error('Lens variables exceed bounds.');rebuilt=buildLensProject(lensDomain(base,'existing'),c.values);}
 if(serializeProject(rebuilt)!==serializeProject(c.project))throw Error('Candidate Project was changed.');geometry(working,rebuilt,problem);
 const r=solveFoldedGaussian(rebuilt,{sampleSegments:false});if(r.status!=='valid'||r.apertureLimited)throw Error('Candidate failed current forward validation.');const m=beamMerit(r,rebuilt,o),eta=tensorOverlap(rebuilt,r);
 rebuilt.synthesis!.solution={engine:SYNTHESIS_ID,baselineFingerprint:projectFingerprint(current),designFingerprint:synthesisFingerprint(rebuilt),evaluated:result.evaluated,geometryEvaluated:result.geometryEvaluated,topology:c.topology,qualified:m.goalsMet&&eta.status==='valid'&&eta.eta>=o.minimumOverlap};return ProjectSchema.parse(rebuilt);
}
