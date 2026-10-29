import {z} from 'zod';
const finite=z.number().finite();
const interval=z.tuple([finite,finite]).refine(([lo,hi])=>lo<=hi,'Minimum must not exceed maximum');
export const LensVariableSchema=z.object({id:z.string().min(1).max(80),position:interval,front:interval,rear:interval,thickness:interval}).strict();
export const LensAlignmentSchema=z.object({decenter:finite.min(0).max(.002),tilt:finite.min(0).max(.05),fixed:z.array(z.string()).max(2)}).strict();
export const LensOptionsSchema=z.object({template:z.enum(['existing','relay2']),budget:z.number().int().min(1).max(4096),variables:z.array(LensVariableSchema).min(1).max(2),alignment:LensAlignmentSchema.optional(),diameterTolerance:finite.min(.001).max(1),phaseTolerance:finite.min(.001).max(1),clearance:finite.min(0).max(.01)}).strict();
export type LensOptions=z.infer<typeof LensOptionsSchema>;
export type LensVariable=z.infer<typeof LensVariableSchema>;
export const LensSolutionSchema=z.object({engine:z.literal('bounded-lens-reference/1.0.0'),baselineFingerprint:z.string(),designFingerprint:z.string(),evaluated:z.number().int().min(1).max(4096),score:finite.nonnegative(),goalsMet:z.boolean(),options:LensOptionsSchema}).strict();
