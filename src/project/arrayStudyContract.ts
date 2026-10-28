import {z} from 'zod';
const shift=z.number().finite().min(-100e-6).max(100e-6),angle=z.number().finite().min(-.01).max(.01),pitch=z.number().finite().min(-10e-6).max(10e-6);
export const ArrayStudySchema=z.object({version:z.literal(1),outputShiftY:shift,outputShiftZ:shift,outputRoll:angle,outputTiltY:angle,outputTiltZ:angle,outputPitchY:pitch,outputPitchZ:pitch}).strict();
export type ArrayStudySettings=z.infer<typeof ArrayStudySchema>;
export const defaultArrayStudy=():ArrayStudySettings=>({version:1,outputShiftY:0,outputShiftZ:0,outputRoll:0,outputTiltY:0,outputTiltZ:0,outputPitchY:0,outputPitchZ:0});
