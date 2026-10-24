import {z} from 'zod';
const coordinate=z.number().finite().min(-1).max(1);
const vector=z.object({x:coordinate,y:coordinate,z:coordinate}).strict();
export const BoxSchema=z.object({min:vector,max:vector}).strict().refine(b=>['x','y','z'].every(k=>b.min[k as 'x']<b.max[k as 'x']),'Box minimum must be below maximum');
export const RoutingSchema=z.object({version:z.literal(1),
 positionTolerance:z.number().finite().positive().max(1),angleTolerance:z.number().finite().positive().max(Math.PI),
 bounds:BoxSchema.nullable(),keepOut:z.array(BoxSchema).max(8),
 parts:z.object({lens:z.number().int().min(0).max(50),mirror:z.number().int().min(0).max(50),prism:z.number().int().min(0).max(50)}).strict(),
}).strict();
export type Routing=z.infer<typeof RoutingSchema>;
export type Box=z.infer<typeof BoxSchema>;
export const defaultRouting=():Routing=>({version:1,positionTolerance:1e-6,angleTolerance:Math.PI/180*.1,bounds:null,keepOut:[],parts:{lens:2,mirror:2,prism:1}});
