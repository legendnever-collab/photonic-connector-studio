import {z} from 'zod';
import {LensOptionsSchema} from '../lens/contract';
import {SearchOptionsSchema} from '../routing/contract';
const tolerance=z.tuple([z.number().finite().min(0).max(.001),z.number().finite().min(0).max(.001),z.number().finite().min(0).max(.001)]);
const angle=z.tuple([z.number().finite().min(0).max(.05),z.number().finite().min(0).max(.05),z.number().finite().min(0).max(.05)]);
export const ProblemSchema=z.object({version:z.literal(1),strategy:z.enum(['lens','route']),objective:z.literal('robustness'),
 maxParts:z.number().int().min(0).max(50),maxGenerated:z.number().int().min(0).max(50),
 fixedSurfaces:z.array(z.string().min(1).max(100)).max(100).refine(a=>new Set(a).size===a.length,'Duplicate fixed Surface'),
 lens:LensOptionsSchema.nullable(),routes:SearchOptionsSchema,
 tolerance:z.object({portPosition:tolerance,portAngle:angle,componentPosition:tolerance,componentAngle:angle,
  minimumOverlap:z.number().finite().min(0).max(1),maxCases:z.number().int().min(1).max(256)}).strict()
}).strict();
export type DesignProblem=z.infer<typeof ProblemSchema>;
