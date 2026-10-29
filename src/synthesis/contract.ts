import {z} from 'zod';
import {TopologySchema} from '../routing/contract';
const interval=z.tuple([z.number().finite().positive(),z.number().finite().positive()]).refine(([a,b])=>a<=b,'Minimum exceeds maximum');
export const SYNTHESIS_ID='bounded-mode-synthesis/1.0.0' as const;
export const SynthesisSchema=z.object({version:z.literal(1),families:z.array(TopologySchema).min(1).max(6).refine(a=>new Set(a).size===a.length,'Duplicate family'),
 budget:z.number().int().min(1).max(8192),geometryBudget:z.number().int().min(1).max(128),fitBudget:z.number().int().min(1).max(2048),
 clearRadius:interval.refine(([a,b])=>a>=10e-6&&b<=.005,'Clear radius outside 10 µm–5 mm'),thickness:interval.refine(([a,b])=>a>=20e-6&&b<=.002,'Thickness outside 20 µm–2 mm'),
 lensAlignment:z.object({decenter:z.number().finite().min(0).max(.002),tilt:z.number().finite().min(0).max(.05)}).strict().optional(),
 lensPlacement:z.enum(['endpoints','all-air']).optional(),
 prismLeg:interval.refine(([a,b])=>a>=4e-6&&b<=.04,'Prism leg outside 4 µm–40 mm').optional(),
 material:z.literal('N-BK7'),minimumOverlap:z.number().finite().min(0).max(1),diameterTolerance:z.number().finite().min(.001).max(1),phaseTolerance:z.number().finite().min(.001).max(1),
 solution:z.object({engine:z.literal(SYNTHESIS_ID),baselineFingerprint:z.string(),designFingerprint:z.string(),evaluated:z.number().int().nonnegative().max(8192),geometryEvaluated:z.number().int().nonnegative().max(128),topology:z.string(),qualified:z.boolean()}).strict().optional(),
 toleranceMode:z.enum(['oat','joint']).optional(),jointBudget:z.number().int().min(1).max(8192).optional()
}).strict();
export type SynthesisOptions=z.infer<typeof SynthesisSchema>;
export const defaultSynthesis=():SynthesisOptions=>({version:1,families:['direct','mirror1','mirror2','prism1','mirror-prism'],budget:8192,geometryBudget:128,fitBudget:1536,lensAlignment:{decenter:.001,tilt:.02},lensPlacement:'endpoints',clearRadius:[.0002,.0005],thickness:[.00005,.0003],material:'N-BK7',minimumOverlap:.9,diameterTolerance:.05,phaseTolerance:.05});
