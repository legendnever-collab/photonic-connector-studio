import type {Topology,Routing,SearchOptions} from '../routing/contract';
import type {SynthesisOptions} from './contract';
import type {DesignProblem} from '../design/contract';
import type {RouteDomain,RouteProposal} from '../routing/search';
import {dot} from '../surface/model';

export const FAMILY_IDS:Topology[]=['direct','mirror1','mirror2','prism1','mirror-prism','prism2'];
export const EXISTING_FAMILY='Retained initial train';
export type DiagnosticStage='setup'|'geometry'|'fit'|'mode';
export type IssueKind='settings'|'parts'|'geometry'|'unsupported'|'domain'|'budget'|'other';
export type DiagnosticIssue={stage:DiagnosticStage;kind:IssueKind;reason:string;count:number};
export type FamilyEvidence={proposals:number;geometryTested:number;geometryPassed:number;fitPlanned:number;fitStarted:number;fitTested:number;accepted:number;limited:boolean;issues:DiagnosticIssue[]};
export type SynthesisDiagnostics={families:Record<string,FamilyEvidence>;global:DiagnosticIssue[]};
export const emptyEvidence=():FamilyEvidence=>({proposals:0,geometryTested:0,geometryPassed:0,fitPlanned:0,fitStarted:0,fitTested:0,accepted:0,limited:false,issues:[]});
export const emptyDiagnostics=():SynthesisDiagnostics=>({families:Object.fromEntries([...FAMILY_IDS,EXISTING_FAMILY].map(t=>[t,emptyEvidence()])),global:[]});

// Known evaluator prefixes are classified conservatively. Unknown errors retain
// their original text and are never presented as an unsupported physical model.
export function issueKind(reason:string,stage:DiagnosticStage):IssueKind{
 if(/^Model unsupported:|^Unsupported |Single-channel, non-array|Physical Project required|Gaussian Mode \/ phase \/ normalization is undefined/.test(reason))return 'unsupported';
 if(/^Out of domain:|outside Gaussian reference|divergence exceeds|tail bound exceeds|Aperture \/ body tail bound/.test(reason))return 'domain';
 if(/^(Lens limit|Total component limit|New \/ replacement component limit)/.test(reason))return 'parts';
 if(/^Position \/ direction tolerance not met|^No finite chief path|^First establish a finite chief route|^Lens alignment seed|^Lens decenter \/ tilt bounds|^Potential .* (crossing|conflict)|^Lens outside its fixed free-space segment|^Mirror bend below|Lens edge thickness or interior thickness is nonpositive/.test(reason))return 'geometry';
 if(/budget exhausted|allocation exhausted/i.test(reason))return 'budget';
 return stage==='geometry'?'geometry':'other';
}
export function noteIssue(d:SynthesisDiagnostics,family:string|null,stage:DiagnosticStage,reason:string,count=1,kind=issueKind(reason,stage)){
 const issues=family?d.families[family].issues:d.global,prior=issues.find(v=>v.stage===stage&&v.kind===kind&&v.reason===reason);
 if(prior)prior.count+=count;else issues.push({stage,kind,reason,count});
}
export function requiredParts(t:Topology){return {mirror:t==='mirror2'?2:t==='mirror1'||t==='mirror-prism'?1:0,prism:t==='prism2'?2:t==='prism1'||t==='mirror-prism'?1:0};}
export function configurationIssues(t:Topology,o:SynthesisOptions,r:Routing,problem:DesignProblem):string[]{
 const n=requiredParts(t),issues:string[]=[];
 if(!o.families.includes(t))issues.push('Family / Manufacturing assumptions에서 이 구조가 선택되지 않았습니다.');
 if(r.parts.mirror<n.mirror)issues.push(`Mirror 상한 ${r.parts.mirror}개 · 이 구조에는 최소 ${n.mirror}개가 필요합니다.`);
 if(r.parts.prism<n.prism)issues.push(`Prism 상한 ${r.parts.prism}개 · 이 구조에는 최소 ${n.prism}개가 필요합니다.`);
 if(problem.maxParts<n.mirror+n.prism)issues.push(`전체 부품 상한 ${problem.maxParts}개가 필요한 Fold ${n.mirror+n.prism}개보다 작습니다.`);
 if(problem.maxGenerated<n.mirror+n.prism)issues.push(`새 구성 부품 상한 ${problem.maxGenerated}개가 필요한 Fold ${n.mirror+n.prism}개보다 작습니다.`);
 return issues;
}
export function observeProposals(d:SynthesisDiagnostics,domain:RouteDomain,options:SynthesisOptions,routing:Routing,proposals:RouteProposal[],routeOptions:SearchOptions){
 for(const t of FAMILY_IDS){
  const row=d.families[t],n=proposals.filter(p=>p.topology===t).length;row.proposals+=n;
  const required=requiredParts(t);
  if(!n&&options.families.includes(t)&&routing.parts.mirror>=required.mirror&&routing.parts.prism>=required.prism){
   const reason=!routeOptions.templates.includes(t)?'Prism leg가 Clear Radius의 4배보다 작아 이 치수 seed에서 Prism 구조가 제외됐습니다. Prism leg와 Clear Radius 범위를 확인하세요.'
    :t==='prism1'&&Math.abs(dot(domain.incoming,domain.outgoing))>=1e-9
    ?'현재 단일 TIR Prism 생성기는 90° 방향 전환만 지원합니다. 고정 구간 이후 광축과 Output 광축이 90°가 아닙니다.'
    :'현재 Port·고정 구간·치수 범위에서 이 구조의 유한 경로 seed가 생성되지 않았습니다. 가능한 모든 배치를 검사한 결과는 아닙니다.';
   noteIssue(d,t,'geometry',reason);
  }
 }
}
