import {compile,frame,sub,mul,dot,norm} from '../surface/model';
import {prescription} from '../project/model';
import type {Project} from '../project/model';
import type {SynthesisOptions} from './contract';
/** Missing policy, including old saved projects, is conservative. An old
 * alignment bound alone is NOT consent to intentional off-axis assembly. */
export const portMounted=(o:SynthesisOptions)=>o.lensMount!=='free';
export const mountName=(o:SynthesisOptions)=>portMounted(o)?'Port–Lens 동축 조립':'편심 광학계 · 고급';
export function checkLensMount(p:Project,o:SynthesisOptions){
 if(!portMounted(o))return;
 const d=prescription(p),ss=compile(d),source=frame(d.source.frame),target=ss.at(-1)!.world;
 const lenses=[...new Set(ss.filter(s=>d.assemblies.find(a=>a.id===s.assemblyId)?.kind==='lens').map(s=>s.assemblyId))];

 for(const id of lenses){
  const indices=ss.flatMap((s,i)=>s.assemblyId===id?[i]:[]),a=indices[0],b=indices.at(-1)!;
  const ends=[...(a===0?[source]:[]),...(b===ss.length-2?[target]:[])];
  if(indices.length!==2||!ends.length)throw Error('Port–Lens mount: Lens must be on an exterior Port segment; interior Lens is disabled.');
  for(const end of ends)for(const i of indices){const f=ss[i].world,delta=sub(f.origin,end.origin),lateral=norm(sub(delta,mul(end.axes[0],dot(delta,end.axes[0]))));
   if(dot(f.axes[0],end.axes[0])<1-1e-10||lateral>1e-9)throw Error('Port–Lens coaxial mount: Port와 Lens의 중심축이 다릅니다. 동축 조립으로 재구성하거나, 편심 조립을 의도한 경우에만 고급 모드를 선택하세요.');
  }
 }
}

/** Geometry-only / incomplete terminal optics remain labelled references. */
export function lensMountGoal(p:Project,o:SynthesisOptions){
 if(!portMounted(o))return true;
 const d=prescription(p),fold=d.surfaces.some(s=>s.interaction==='reflect'||s.interaction==='tir');
 return !fold||new Set(d.surfaces.filter(s=>d.assemblies.find(a=>a.id===s.assemblyId)?.kind==='lens').map(s=>s.assemblyId)).size===2;
}
/** Requested policy and compliance of an already saved prescription are distinct. */
export function lensMountAssessment(p:Project,o:SynthesisOptions){
 if(!portMounted(o))return {state:'advanced',reason:'고급 자유 광학계 · Port 동축 조립을 요구하지 않습니다.'};
 try{checkLensMount(p,o);const d=prescription(p),hasLens=d.surfaces.some(s=>d.assemblies.find(a=>a.id===s.assemblyId)?.kind==='lens');
  if(!hasLens||!lensMountGoal(p,o))return {state:'incomplete',reason:'양 끝 Lens 조립이 완성되지 않은 참고 형상입니다.'};
  return {state:'coaxial',reason:'현재 Lens 형상의 Port 동축 조건을 확인했습니다. Collimation·실제 효율 인증은 별도입니다.'};
 }catch(e){return {state:'violated',reason:'현재 형상은 요청한 동축 조립 조건과 다릅니다. 기존 결과를 목표 통과로 해석하지 말고 다시 탐색하세요. '+(e instanceof Error?e.message:String(e))};}
}
