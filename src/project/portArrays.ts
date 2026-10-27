import {z} from 'zod';
import {V,pointToWorld} from '../surface/model';
import type {Frame} from '../surface/model';
import type {Project} from './model';
const grid=z.object({rows:z.number().int().min(1).max(32),cols:z.number().int().min(1).max(32),pitchY:z.number().finite().positive().max(.1),pitchZ:z.number().finite().positive().max(.1),referenceRow:z.number().int().min(0),referenceCol:z.number().int().min(0)}).strict().superRefine((a,c)=>{
 if(a.rows*a.cols>256)c.addIssue({code:'custom',message:'Port Array supports at most 256 channels.'});
 if(a.referenceRow>=a.rows||a.referenceCol>=a.cols)c.addIssue({code:'custom',message:'Reference Channel must belong to the Array.'});
});
export const PortArraysSchema=z.object({version:z.literal(1),source:grid,target:grid,mapping:z.enum(['row-major','unassigned']),interface:z.enum(['unspecified','edge','vertical','evanescent']),assembly:z.enum(['unspecified','fixed','vertical-insertion'])}).strict().superRefine((a,c)=>{
 if(a.mapping==='row-major'&&a.source.rows*a.source.cols!==a.target.rows*a.target.cols)c.addIssue({code:'custom',message:'1:1 mapping requires equal Input and Output channel counts.'});
 if(a.mapping==='row-major'&&a.source.referenceRow*a.source.cols+a.source.referenceCol!==a.target.referenceRow*a.target.cols+a.target.referenceCol)c.addIssue({code:'custom',message:'Reference Channels must be the same row-major pair.'});
});
export type PortArrays=z.infer<typeof PortArraysSchema>;
export type PortGrid=PortArrays['source'];
export const singlePortGrid=():PortGrid=>({rows:1,cols:1,pitchY:250e-6,pitchZ:250e-6,referenceRow:0,referenceCol:0});
export function defaultPortArrays(p?:Project):PortArrays{
 const legacy=p?.model.kind==='surface'?p.model.prescription.source.channels:null;
 return {version:1,source:{...singlePortGrid(),...(legacy&&legacy.rows*legacy.cols>1?{rows:legacy.rows,cols:legacy.cols,pitchY:legacy.pitch,pitchZ:legacy.pitch}:{} )},target:singlePortGrid(),mapping:legacy&&legacy.rows*legacy.cols>1?'unassigned':'row-major',interface:'unspecified',assembly:'unspecified'};
}
export function portArrayPoints(a:PortGrid,f:Frame){return Array.from({length:a.rows*a.cols},(_,i)=>{
 const row=Math.floor(i/a.cols),col=i%a.cols;
 return {id:`${row+1}:${col+1}`,row,col,point:pointToWorld(f,V(0,(col-a.referenceCol)*a.pitchY,(row-a.referenceRow)*a.pitchZ))};
});}
export function arrayAssessment(p:Project){
 const a=p.portArrays;
 return {scope:a?'representative-channel' as const:'legacy' as const,portArrays:a??null,arrayModeOverlap:null,arrayTolerance:null,channelCrosstalk:null,status:'not-assessed' as const,reason:a?'Port Pose = selected reference Channel. Array placement is defined; only the representative channel is optically evaluated. No Array-wide tolerance / crosstalk assessment.':'No explicit product Port Array contract.'};
}
