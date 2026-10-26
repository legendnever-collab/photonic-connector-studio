import {JointToleranceSchema} from './jointContract';
import type {JointTolerance} from './jointContract';
import {ProjectSchema,prescription,serializeProject} from '../project/model';
import type {Project} from '../project/model';
import {framePose} from '../authoring/commands';
import {portWorld,withPortWorld} from '../routing/model';
import {V,add,sub,frame,pose,compose,pointToLocal,vectorToLocal,vectorToWorld} from '../surface/model';
import type {Frame} from '../surface/model';
import {tensorOverlap,TENSOR_OVERLAP_ID} from '../project/tensorOverlap';
import {analyzeRouting} from '../routing/analysis';
import {screenClearance} from '../routing/clearance';

export const JOINT_ENGINE='joint-rigid-scenarios/1.0.0';
const nonzero=(a:number[])=>a.some(v=>v!==0);
export function defaultJointTolerance(p:Project):JointTolerance{
 const v=portWorld(p,'target').origin;
 return {version:1,seed:231,samples:32,maxCases:32,mating:{ports:['target'],components:[],pivot:[v.x,v.y,v.z],position:[0,1e-6,1e-6],angle:[0,0,0]},assembly:{position:[0,0,0],angle:[0,0,0]},minimumOverlap:.6};
}
export function jointComponents(p:Project){const d=prescription(p);return [...new Set(d.surfaces.slice(0,-1).map(s=>s.assemblyId))].sort();}
function worldFrames(p:Project){
 const d=prescription(p),m=new Map<string,Frame>();
 function world(id:string):Frame{const cached=m.get(id);if(cached)return cached;const a=d.assemblies.find(a=>a.id===id)!;const w=a.parentId?compose(world(a.parentId),frame(a.frame)):frame(a.frame);m.set(id,w);return w;}
 d.assemblies.forEach(a=>world(a.id));return m;
}
type Axis={key:string;bound:number;component:string|null;kind:'position'|'angle';axis:number};
export function jointAxes(p:Project,raw:JointTolerance):Axis[]{
 const o=JointToleranceSchema.parse(raw);if(p.model.kind!=='surface')throw Error('Joint assessment requires a Physical Project.');
 const d=prescription(p),ids=jointComponents(p),local=nonzero([...o.assembly.position,...o.assembly.angle]);
 for(const id of o.mating.components)if(!ids.includes(id))throw Error(`Mating component ${id} is missing from this Project. Select its membership again.`);
 for(const id of ids)if((local||o.mating.components.includes(id))&&d.assemblies.some(a=>a.parentId===id))throw Error(`Joint component ${id} must be a leaf optical Assembly; nested component movement is not supported.`);
 const axes:Axis[]=[];
 const append=(component:string|null,range:JointTolerance['assembly'])=>{for(const kind of ['position','angle'] as const)range[kind].forEach((bound,axis)=>{if(bound)axes.push({key:JSON.stringify([component,kind,axis]),bound,component,kind,axis});});};
 if(o.mating.ports.length||o.mating.components.length)append(null,o.mating);
 else if(nonzero([...o.mating.position,...o.mating.angle]))throw Error('Select at least one mating Port / component, or set common bounds to zero.');
 ids.forEach(id=>append(id,o.assembly));return axes;
}
function random(key:string,seed:number){let s=(2166136261^seed)>>>0;for(const ch of key)s=Math.imul(s^ch.charCodeAt(0),16777619)>>>0;if(!s)s=1;return ()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return (s>>>0)/4294967296;};}
/** Two opposite corners, then independently permuted midpoint strata per named DOF.
 * A reproducible test design, not Monte Carlo or a complete corner enumeration. */
export function jointSamples(p:Project,raw:JointTolerance){
 const o=JointToleranceSchema.parse(raw),axes=jointAxes(p,o);if(!axes.length)return [];
 const n=o.samples-2,columns=axes.map(a=>{const rng=random(a.key,o.seed),v=Array.from({length:n},(_,i)=>-1+2*(i+.5)/n);for(let j=n-1;j>0;j--){const k=Math.floor(rng()*(j+1));[v[j],v[k]]=[v[k],v[j]];}return [-1,1,...v];});
 return Array.from({length:o.samples},(_,i)=>({id:`joint-${i+1}`,values:axes.map((a,j)=>({key:a.key,value:columns[j][i]*a.bound})),normalized:columns.map(c=>c[i])}));
}
export type JointSample=ReturnType<typeof jointSamples>[number];
/** Local component error first, then the same world Rz Ry Rx about the explicit pivot
 * for every mating member. Transform frames; never add world Euler angles. */
export function perturbJoint(p:Project,raw:JointTolerance,sample:JointSample):Project{
 const o=JointToleranceSchema.parse(raw),axes=jointAxes(p,o);
 if(sample.values.length!==axes.length||sample.values.some((v,i)=>v.key!==axes[i].key||!Number.isFinite(v.value)||Math.abs(v.value)>axes[i].bound+1e-16))throw Error('Joint sample does not match the declared degrees of freedom / bounds.');
 if(!sample.values.some(v=>v.value!==0))return structuredClone(p);
 const errors=new Map<string|null,{position:[number,number,number];angle:[number,number,number]}>();
 axes.forEach((a,i)=>{const e=errors.get(a.component)??{position:[0,0,0],angle:[0,0,0]};e[a.kind][a.axis]=sample.values[i].value;errors.set(a.component,e);});
 const common=errors.get(null),R=frame(pose(0,0,0,common?.angle[2]??0,common?.angle[1]??0,common?.angle[0]??0)),pivot=V(...o.mating.pivot),translation=V(...(common?.position??[0,0,0] as [number,number,number]));
 const move=(w:Frame):Frame=>({origin:add(add(pivot,translation),vectorToWorld(R,sub(w.origin,pivot))),axes:w.axes.map(v=>vectorToWorld(R,v)) as Frame['axes']});
 let q=structuredClone(p);const d=prescription(q),worlds=worldFrames(p);
 for(const id of jointComponents(p)){
  const e=errors.get(id),member=o.mating.components.includes(id);if(!e&&!(member&&common))continue;
  const a=d.assemblies.find(a=>a.id===id)!,w=worlds.get(id)!;
  let next=e?compose(w,frame(pose(...e.position,e.angle[2],e.angle[1],e.angle[0]))):w;
  if(member&&common)next=move(next);
  const parent=a.parentId?worlds.get(a.parentId)!:frame(pose());
  a.frame=framePose({origin:pointToLocal(parent,next.origin),axes:next.axes.map(v=>vectorToLocal(parent,v)) as Frame['axes']});
 }
 // Output may share a leaf optical Assembly. Preserve its declared world Pose unless
 // explicitly selected, preventing accidental parent-based double movement.
 for(const which of ['source','target'] as const){const w=portWorld(p,which),next=common&&o.mating.ports.includes(which)?move(w):w;
  if(JSON.stringify(portWorld(q,which))!==JSON.stringify(next))q=withPortWorld(q,which,framePose(next));
 }
 return ProjectSchema.parse(q);
}
export type JointObservation={id:string;eta:number|null;comparisonClass:string|null;evaluator:string|null;modelEtaTolerance:number|null;fieldAssumptions?:string;geometryPassed:boolean;reasons:string[]};
export type JointResult={engine:string;inputSignature:string;settings:string;coverage:string;status:'assessed'|'partial'|'not-assessed'|'cancelled';dimensions:number;planned:number;tested:number;fieldAssessed:number;geometryPassed:number;nominal:JointObservation;observations:JointObservation[];lowestEta:number|null;lowestCase:string|null;meetsSampleGoals:boolean;issues:string[]};
function observe(p:Project,id:string):JointObservation{
 const reasons:string[]=[],mode=tensorOverlap(p),route=analyzeRouting(p),clearance=p.designProblem?.strategy==='lens'?p.designProblem.lens?.clearance??0:p.designProblem?.routes.clearance??0;
 const routeOK=route.status==='evaluated'&&!!route.path&&!!route.withinTolerance;
 const clearanceIssue=routeOK?screenClearance(p,[],route.path!,clearance):null;
 const partLimit=p.designProblem!==undefined&&jointComponents(p).length>p.designProblem.maxParts;
 if(!routeOK)reasons.push(`Geometry: ${route.issues.join(' · ')||(route.status==='evaluated'?'Port position / angle exceeds declared tolerance.':route.reason)}`);if(clearanceIssue)reasons.push(`Geometry: ${clearanceIssue}`);
 if(partLimit)reasons.push('Geometry: total optical component limit exceeded.');
 if(mode.status!=='valid')reasons.push(mode.reason);
 return {id,eta:mode.status==='valid'?mode.eta:null,comparisonClass:mode.status==='valid'?mode.comparisonClass??null:null,evaluator:mode.status==='valid'?mode.domain?.evaluator??TENSOR_OVERLAP_ID:null,modelEtaTolerance:mode.status==='valid'?mode.domain?.modelEtaTolerance??1e-10:null,...(mode.status==='valid'&&mode.gaussianReference?{fieldAssumptions:mode.gaussianReference.assumptions}:{}),geometryPassed:routeOK&&!clearanceIssue&&!partLimit,reasons};
}
export function jointCoverage(p:Project,raw:JointTolerance){const o=JointToleranceSchema.parse(raw);return JSON.stringify({engine:JOINT_ENGINE,evaluator:TENSOR_OVERLAP_ID,settings:o,axes:jointAxes(p,o)});}
/** Yields before each sample solve, so synthesis shares the exact assessment and can cancel. */
export function* jointAssessmentSteps(p:Project,raw:JointTolerance):Generator<JointResult,JointResult>{
 const o=JointToleranceSchema.parse(raw),axes=jointAxes(p,o),samples=jointSamples(p,o),nominal=observe(p,'Nominal');
 const coverage=jointCoverage(p,o);
 const r:JointResult={engine:JOINT_ENGINE,inputSignature:serializeProject(p),settings:JSON.stringify(o),coverage,status:'not-assessed',dimensions:axes.length,planned:samples.length,tested:0,fieldAssessed:0,geometryPassed:0,nominal,observations:[],lowestEta:nominal.eta,lowestCase:nominal.eta===null?null:'Nominal',meetsSampleGoals:false,issues:[...nominal.reasons]};
 if(!samples.length){r.issues.push('No active nonzero error: joint tolerance is not assessed.');return r;}
 for(const sample of samples.slice(0,o.maxCases)){
  yield r;
  let v:JointObservation;try{v=observe(perturbJoint(p,o,sample),sample.id);}catch(e){v={id:sample.id,eta:null,comparisonClass:null,evaluator:null,modelEtaTolerance:null,geometryPassed:false,reasons:[e instanceof Error?e.message:String(e)]};}
  r.observations.push(v);r.tested++;if(v.geometryPassed)r.geometryPassed++;if(v.eta!==null){r.fieldAssessed++;if(r.lowestEta===null||v.eta<r.lowestEta){r.lowestEta=v.eta;r.lowestCase=v.id;}}
  for(const reason of v.reasons)if(!r.issues.includes(reason))r.issues.push(reason);
 }
 const sameClass=nominal.comparisonClass!==null&&r.observations.every(v=>v.comparisonClass===nominal.comparisonClass&&v.evaluator===nominal.evaluator&&v.modelEtaTolerance===nominal.modelEtaTolerance);
 r.status=r.tested===r.planned&&r.fieldAssessed===r.planned&&nominal.eta!==null&&sameClass?'assessed':'partial';
 r.meetsSampleGoals=r.status==='assessed'&&nominal.geometryPassed&&r.geometryPassed===r.planned&&r.lowestEta!==null&&r.lowestEta>=o.minimumOverlap;
 if(r.tested<r.planned)r.issues.push('Case cap reached; requested joint samples are incomplete.');
 if(!sameClass)r.issues.push('Nominal / sample field domains are missing or not comparable.');
 return r;
}
export async function assessJoint(p:Project,raw:JointTolerance,hooks:{cancelled?:()=>boolean;progress?:(tested:number,total:number)=>void}={}):Promise<JointResult>{
 const it=jointAssessmentSteps(p,raw);let step=it.next();
 while(!step.done){await new Promise(resolve=>setTimeout(resolve,0));if(hooks.cancelled?.()){const r=step.value;r.status='cancelled';r.issues.push('Cancelled; incomplete joint samples.');it.return(r);return r;}step=it.next();hooks.progress?.(step.value.tested,step.value.planned);}
 return step.value;
}
