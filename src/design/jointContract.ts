import {z} from 'zod';
const xyz=(max:number)=>z.tuple([z.number().finite().min(0).max(max),z.number().finite().min(0).max(max),z.number().finite().min(0).max(max)]);
const ids=z.array(z.string().min(1).max(80)).max(50).refine(a=>new Set(a).size===a.length,'Duplicate component');
/** Explicit deterministic bounded scenarios, without a probability distribution. SI. */
export const JointToleranceSchema=z.object({
 version:z.literal(1),seed:z.number().int().min(0).max(4294967295),samples:z.number().int().min(4).max(256),maxCases:z.number().int().min(1).max(256),
 mating:z.object({ports:z.array(z.enum(['source','target'])).max(2).refine(a=>new Set(a).size===a.length,'Duplicate Port'),components:ids,
  pivot:z.tuple([z.number().finite().min(-1).max(1),z.number().finite().min(-1).max(1),z.number().finite().min(-1).max(1)]),position:xyz(.001),angle:xyz(.05)}).strict(),
 assembly:z.object({position:xyz(.001),angle:xyz(.05)}).strict(),
 minimumOverlap:z.number().finite().min(0).max(1)
}).strict();
export type JointTolerance=z.infer<typeof JointToleranceSchema>;
