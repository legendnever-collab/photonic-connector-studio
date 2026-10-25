import {LensSolutionSchema} from '../lens/contract';
import {z} from 'zod';
const coordinate=z.number().finite().min(-1).max(1);
const vector=z.object({x:coordinate,y:coordinate,z:coordinate}).strict();
export const TopologySchema=z.enum(['direct','mirror1','mirror2','prism1','mirror-prism']);
export type Topology=z.infer<typeof TopologySchema>;
export const SearchOptionsSchema=z.object({version:z.literal(1),templates:z.array(TopologySchema).min(1).max(5).refine(a=>new Set(a).size===a.length,'Duplicate topology'),
 budget:z.number().int().min(1).max(256),clearRadius:z.number().finite().min(1e-6).max(.01),
 prismLeg:z.number().finite().min(4e-6).max(.04),mirrorThickness:z.number().finite().min(1e-7).max(.01),
 clearance:z.number().finite().min(0).max(.01),ranking:z.enum(['fewest-parts','shortest-path'])}).strict();
export type SearchOptions=z.infer<typeof SearchOptionsSchema>;
export const defaultSearchOptions=():SearchOptions=>({version:1,templates:['direct','mirror1','mirror2','prism1','mirror-prism'],budget:128,clearRadius:20e-6,prismLeg:80e-6,mirrorThickness:5e-6,clearance:1e-6,ranking:'fewest-parts'});
export const BoxSchema=z.object({min:vector,max:vector}).strict().refine(b=>['x','y','z'].every(k=>b.min[k as 'x']<b.max[k as 'x']),'Box minimum must be below maximum');
export const RoutingSchema=z.object({version:z.literal(1),
 search:SearchOptionsSchema.optional(),
 lensSolution:LensSolutionSchema.optional(),
 solution:z.object({engine:z.literal('bounded-port-routing/1.0.0'),topology:TopologySchema,baselineFingerprint:z.string(),designFingerprint:z.string(),evaluated:z.number().int().min(1).max(256)}).strict().optional(),
 positionTolerance:z.number().finite().positive().max(1),angleTolerance:z.number().finite().positive().max(Math.PI),
 bounds:BoxSchema.nullable(),keepOut:z.array(BoxSchema).max(8),
 parts:z.object({lens:z.number().int().min(0).max(50),mirror:z.number().int().min(0).max(50),prism:z.number().int().min(0).max(50)}).strict(),
}).strict();
export type Routing=z.infer<typeof RoutingSchema>;
export type Box=z.infer<typeof BoxSchema>;
export const defaultRouting=():Routing=>({version:1,positionTolerance:1e-6,angleTolerance:Math.PI/180*.1,bounds:null,keepOut:[],parts:{lens:2,mirror:2,prism:1}});
