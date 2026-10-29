import {ArrayStudySchema,defaultArrayStudy} from './arrayStudyContract';
import type {ArrayStudySettings} from './arrayStudyContract';
export {ArrayStudySchema,defaultArrayStudy} from './arrayStudyContract';
export type {ArrayStudySettings} from './arrayStudyContract';
import {ProjectSchema,projectFingerprint} from './model';
import type {Project} from './model';
import {portArrayPoints} from './portArrays';
import {portWorld,withPortWorld} from '../routing/model';
import {framePose} from '../authoring/commands';
import {frame,pose,compose} from '../surface/model';
import {solveFoldedGaussian} from './foldedGaussian';
import {tensorOverlap,TENSOR_OVERLAP_ID} from './tensorOverlap';
import type {Overlap} from './physicalGaussian';

export const ARRAY_STUDY_ID='shared-optics-channel-study/1.0.0';
export const ARRAY_STUDY_SCOPE='Conditional Gaussian overlap, independent launches through the SAME existing sequential optical surfaces. Identical declared mode at every port. Output errors act about its selected reference channel in its local frame. No replicated lenslets, inter-channel coupling, coherent sum, clipping diffraction, total throughput, tolerance envelope or yield.';

/** Sampling copies only Port poses; optical elements remain fixed in world space.
 * Pitch delta is signed systematic error per interval, not random channel jitter.
 * Intrinsic Euler order follows frame(pose): Rz(tiltZ) Ry(tiltY) Rx(roll).
 */
export function arrayChannelProject(p:Project,index:number,settings=defaultArrayStudy()):Project{
 const a=p.portArrays,s=ArrayStudySchema.parse(settings);
 if(p.model.kind!=='surface'||!a||a.mapping!=='row-major')throw Error('Explicit row-major product Array mapping required.');
 if(!Number.isInteger(index)||index<0||index>=a.source.rows*a.source.cols)throw Error('Channel index outside Array.');
 const grid={...a.target,pitchY:a.target.pitchY+s.outputPitchY,pitchZ:a.target.pitchZ+s.outputPitchZ};
 if(grid.pitchY<=0||grid.pitchZ<=0)throw Error('Perturbed Output pitch must remain positive.');
 const source=portWorld(p,'source'),target=compose(portWorld(p,'target'),frame(pose(0,s.outputShiftY,s.outputShiftZ,s.outputTiltZ,s.outputTiltY,s.outputRoll)));
 const input=portArrayPoints(a.source,source)[index],output=portArrayPoints(grid,target)[index];
 return withPortWorld(withPortWorld(p,'source',framePose({...source,origin:input.point})),'target',framePose({...target,origin:output.point}));
}
export type ChannelEvaluation={overlap:Overlap;positionErrorM:number|null;angleErrorRad:number|null;sourcePoint:ReturnType<typeof portWorld>['origin'];targetPoint:ReturnType<typeof portWorld>['origin']};
export type ChannelStudyRow={index:number;input:string;output:string;nominal:ChannelEvaluation;perturbed:ChannelEvaluation};
export type ArrayStudyResult={id:string;evaluator:string;fingerprint:string;settings:ArrayStudySettings;scope:string;status:'complete'|'partial'|'not-calculated';reason:string;total:number;nominalValid:number;perturbedValid:number;rows:ChannelStudyRow[];nominalSummary:ReturnType<typeof summarize>;perturbedSummary:ReturnType<typeof summarize>;totalCoupling:null;crosstalk:null;yield:null};
function summarize(rows:ChannelEvaluation[],expected:number){
 const valid=rows.flatMap(r=>r.overlap.status==='valid'?[r.overlap]:[]);
 if(!expected||valid.length!==expected)return null;
 return {meanConditionalOverlap:valid.reduce((s,r)=>s+r.eta,0)/expected,worstConditionalOverlap:Math.min(...valid.map(r=>r.eta)),worstChannel:valid.reduce((w,r,i)=>r.logEta<valid[w].logEta?i:w,0)+1};
}
function evaluate(p:Project):ChannelEvaluation{
 const beam=solveFoldedGaussian(p,{sampleSegments:false});
 return {overlap:tensorOverlap(p,beam),positionErrorM:beam.status==='valid'?beam.positionError:null,angleErrorRad:beam.status==='valid'?beam.angleError:null,sourcePoint:portWorld(p,'source').origin,targetPoint:portWorld(p,'target').origin};
}
export function evaluateArrayStudy(p:Project):ArrayStudyResult{
 ProjectSchema.parse(p);
 const settings=ArrayStudySchema.parse(p.arrayStudy??defaultArrayStudy()),a=p.portArrays,total=a?a.source.rows*a.source.cols:0;
 const base={id:ARRAY_STUDY_ID,evaluator:TENSOR_OVERLAP_ID,fingerprint:projectFingerprint(p),settings,scope:ARRAY_STUDY_SCOPE,total,totalCoupling:null,crosstalk:null,yield:null};
 const fail=(reason:string):ArrayStudyResult=>({...base,status:'not-calculated',reason,nominalValid:0,perturbedValid:0,rows:[],nominalSummary:null,perturbedSummary:null});
 if(p.model.kind!=='surface'||!a)return fail('Physical Project와 명시적인 Port Array가 필요합니다.');
 if(a.mapping!=='row-major')return fail('Input / Output의 Row-major 1:1 Mapping을 먼저 지정하세요.');
 if(a.target.pitchY+settings.outputPitchY<=0||a.target.pitchZ+settings.outputPitchZ<=0)return fail('오차를 적용한 Output Pitch는 양수여야 합니다.');
 if(a.interface==='evanescent')return fail('Evanescent Coupling은 전용 field adapter가 필요합니다.');
 const rows=Array.from({length:total},(_,index)=>({index,input:`${Math.floor(index/a.source.cols)+1}:${index%a.source.cols+1}`,output:`${Math.floor(index/a.target.cols)+1}:${index%a.target.cols+1}`,nominal:evaluate(arrayChannelProject(p,index)),perturbed:evaluate(arrayChannelProject(p,index,settings))}));
 const nominalValid=rows.filter(r=>r.nominal.overlap.status==='valid').length,perturbedValid=rows.filter(r=>r.perturbed.overlap.status==='valid').length;
 const status=nominalValid===total&&perturbedValid===total?'complete':nominalValid||perturbedValid?'partial':'not-calculated';
 return {...base,status,reason:status==='complete'?'모든 Channel의 조건부 Gaussian 기준값 계산 완료. 제품 효율·공차 보증이 아닙니다.':'미계산 Channel의 사유를 확인하세요. 일부 결과를 전체 Array 성능으로 환산하지 않습니다.',nominalValid,perturbedValid,rows,nominalSummary:summarize(rows.map(r=>r.nominal),total),perturbedSummary:summarize(rows.map(r=>r.perturbed),total)};
}
export function currentArrayStudy(p:Project,result:ArrayStudyResult|null,invalid=false){return !invalid&&result?.fingerprint===projectFingerprint(p)?result:null;}
