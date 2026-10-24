import { z } from 'zod';
import { poseSchema } from '../surface/model';
const finite = z.number().finite();
// Optional extension: v1 projects are read without filling in unknown physics.
export const PortContractSchema = z.object({
 fieldModel:z.enum(['gaussian','imported-complex']),
 referencePlane:z.literal('port-frame'),
 phase:z.enum(['unspecified','waist-plane']),
 normalization:z.enum(['unspecified','unit-power','absolute-power']),
 powerW:finite.positive().max(1e6).nullable(),
 mediumIndex:finite.min(1).max(5).nullable(),
 adapter:z.enum(['unspecified','homogeneous-paraxial','near-field-em-required']),
 // Original complex field is reserved for the F2 importer; never synthesized from an image.
 imported:z.object({fileName:z.string().max(200),coordinates:z.literal('local-yz'),
  referencePlane:z.string().min(1),units:z.literal('SI'),
  ny:z.number().int().min(2).max(256),nz:z.number().int().min(2).max(256),
  dy:finite.positive(),dz:finite.positive(),originY:finite,originZ:finite,
  real:z.array(finite).max(65536),imag:z.array(finite).max(65536),
  normalization:z.enum(['unspecified','scalar-integral','power-flux'])
 }).strict().refine(v=>v.real.length===v.ny*v.nz&&v.imag.length===v.real.length,'Complex field grid mismatch').nullable(),
}).strict();
export type PortContract = z.infer<typeof PortContractSchema>;
export const unknownPort = ():PortContract=>({fieldModel:'gaussian',referencePlane:'port-frame',phase:'unspecified',normalization:'unspecified',powerW:null,mediumIndex:null,adapter:'unspecified',imported:null});
export const AuthoringSchema = z.object({version:z.literal(1),ports:z.object({source:PortContractSchema,target:PortContractSchema}).strict(),
 templates:z.record(z.string(),z.string()),
 alignment:z.object({movingId:z.string().nullable(),referencePose:poseSchema.nullable(),delta:poseSchema,
 pivot:z.enum(['reference-origin']),frame:z.enum(['reference-local']),applied:z.literal(false)}).strict(),
}).strict();
export type Authoring = z.infer<typeof AuthoringSchema>;
export const unknownAuthoring = ():Authoring=>({version:1,ports:{source:unknownPort(),target:unknownPort()},templates:{},alignment:{movingId:null,referencePose:null,delta:{origin:{x:0,y:0,z:0},rotation:{roll:0,pitch:0,yaw:0}},pivot:'reference-origin',frame:'reference-local',applied:false}});
