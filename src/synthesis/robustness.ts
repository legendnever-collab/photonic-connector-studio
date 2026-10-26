import {jointCoverage,jointAssessmentSteps} from '../design/joint';
import type {JointResult} from '../design/joint';
import type {JointTolerance} from '../design/jointContract';
import {serializeProject,prescription} from '../project/model';
import type {Project} from '../project/model';
import {portWorld} from '../routing/model';
import type {SynthesisCandidate} from './engine';

export type JointScreen={coverage:string;group:string;rank:number|null;result:JointResult|null;reason:string};
export type JointFeedback={enabled:boolean;budget:number;evaluated:number;cacheHits:number;complete:number;limited:boolean;continuousTrials:number;
 routeSelections:{topology:string;coverage:string;lowestEta:number}[];
 improvements:{kind:'lens'|'route';topology:string;coverage:string;before:number;after:number}[];
 groups:{id:string;coverage:string;ranked:number;unranked:number}[]};
export const emptyJointFeedback=(enabled=false,budget=2048):JointFeedback=>({enabled,budget,evaluated:0,cacheHits:0,complete:0,limited:false,continuousTrials:0,routeSelections:[],improvements:[],groups:[]});
export function jointEligible(c:SynthesisCandidate){const r=c.joint?.result;return !!(c.qualified&&r&&r.status==='assessed'&&r.nominal.geometryPassed&&r.geometryPassed===r.planned&&r.planned>0&&r.lowestEta!==null);}
export function jointContext(p:Project){const r=p.routing;return JSON.stringify({wavelength:prescription(p).wavelength,model:p.model.kind==='surface'?[p.model.sourceMode,p.model.targetMode]:null,ports:p.authoring?.ports,source:portWorld(p,'source'),target:portWorld(p,'target'),routing:r?[r.positionTolerance,r.angleTolerance,r.bounds,r.keepOut,r.parts]:null,maxParts:p.designProblem?.maxParts,clearance:p.designProblem?.strategy==='lens'?p.designProblem.lens?.clearance??0:p.designProblem?.routes.clearance??0});}
export function jointKey(c:SynthesisCandidate){return c.joint?.coverage?JSON.stringify([c.comparisonClass,c.evaluator,c.etaResolution,c.comparisonContext,c.joint.coverage]):'';}
/** Strict total ordering: groups are never compared by eta. Only complete feasible
 * members of the SAME group receive a robustness rank. Partial results cannot win. */
export function compareJoint(a:SynthesisCandidate,b:SynthesisCandidate){
 const ka=jointKey(a),kb=jointKey(b);
 return Number(b.qualified)-Number(a.qualified)||(ka||'~unassessed').localeCompare(kb||'~unassessed')||Number(jointEligible(b))-Number(jointEligible(a))||
  (jointEligible(a)&&jointEligible(b)?b.joint!.result!.lowestEta!-a.joint!.result!.lowestEta!:0)||
  (a.merit?.score??Infinity)-(b.merit?.score??Infinity)||a.id.localeCompare(b.id);
}
export function betterJoint(a:SynthesisCandidate,b:SynthesisCandidate){return jointEligible(a)&&jointEligible(b)&&jointKey(a)===jointKey(b)&&a.joint!.result!.lowestEta!>b.joint!.result!.lowestEta!+2*Math.max(a.etaResolution,b.etaResolution);}
/** Round robin across cohorts; no shared scalar objective across incompatible coverage. */
export function jointPriority<T>(items:T[],candidate:(v:T)=>SynthesisCandidate|undefined):T[]{
 const groups=new Map<string,T[]>(),rest:T[]=[];
 for(const item of items){const c=candidate(item);if(!c||!jointEligible(c)){rest.push(item);continue;}const k=jointKey(c);groups.set(k,[...(groups.get(k)??[]),item]);}
 const lists=[...groups.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([,g])=>g.sort((a,b)=>compareJoint(candidate(a)!,candidate(b)!))),result:T[]=[];
 for(let i=0;lists.some(g=>i<g.length);i++)for(const g of lists)if(g[i])result.push(g[i]);
 return [...result,...rest];
}
export function assignJointGroups(candidates:SynthesisCandidate[],ledger:JointFeedback){
 const keys=[...new Set(candidates.map(jointKey).filter(Boolean))].sort();ledger.groups=[];
 keys.forEach((key,i)=>{const all=candidates.filter(c=>jointKey(c)===key).sort(compareJoint),id=`Group ${i+1}`;let rank=0,ranked=0,anchor=Infinity;
  for(const c of all){c.joint!.group=id;if(jointEligible(c)){const eta=c.joint!.result!.lowestEta!;if(anchor-eta>2*c.etaResolution){rank++;anchor=eta;}c.joint!.rank=rank;ranked++;}else c.joint!.rank=null;}
  ledger.groups.push({id,coverage:all[0].joint!.coverage,ranked,unranked:all.length-ranked});
 });
}
export function createJointScreen(o:JointTolerance,ledger:JointFeedback,limit=()=>ledger.budget){
 const cache=new Map<string,JointScreen>();
 return function*(p:Project,qualified:boolean):Generator<string,JointScreen>{
  const screen:JointScreen={coverage:'',group:'Unassessed',rank:null,result:null,reason:''};
  try{screen.coverage=jointCoverage(p,o);}catch(e){screen.reason=e instanceof Error?e.message:String(e);return screen;}
  if(!qualified){screen.reason='Nominal Mode goals not met; no robustness ranking.';return screen;}
  const key=serializeProject(p),cached=cache.get(key);if(cached){ledger.cacheHits++;return structuredClone(cached);}
  const needed=1+Math.min(o.samples,o.maxCases);
  if(ledger.evaluated+needed>limit()){ledger.limited=true;screen.reason='Joint phase budget exhausted; no complete batch reserved and no robustness rank.';return screen;}
  const it=jointAssessmentSteps(p,o);let step=it.next();ledger.evaluated++;
  while(!step.done){yield `Joint ${step.value.tested}/${step.value.planned} · total ${ledger.evaluated}/${ledger.budget}`;step=it.next();ledger.evaluated++;}
  screen.result=step.value;screen.reason=step.value.issues.join(' · ');if(step.value.status==='assessed')ledger.complete++;
  cache.set(key,structuredClone(screen));return screen;
 };
}
