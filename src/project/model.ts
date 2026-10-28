import {SynthesisSchema} from '../synthesis/contract';
import {PortArraysSchema} from './portArrays';
import {ArrayStudySchema} from './arrayStudyContract';
import {ProblemSchema} from '../design/contract';
import { resolveMaterials } from '../surface/materials';
import { RoutingSchema } from '../routing/contract';
import { AuthoringSchema } from '../authoring/contract';
import { z } from 'zod';
import { DocumentSchema, exampleDocument } from '../domain';
import type { DesignDocument } from '../domain';
import { PrescriptionSchema, surfaceSchema, pose, V, pointToWorld, frame, pointToLocal } from '../surface/model';
import type { Prescription } from '../surface/model';
import { surfaceExample } from '../surface/examples';
import type { SurfaceExample } from '../surface/examples';
import { fingerprint, solveGaussian } from '../physics';
const dim = z.number().finite().positive().max(1), id = z.string().min(1).max(100);
export const ModeSchema = z.object({ representation: z.literal('gaussian'), mfdX: dim.nullable(), mfdY: dim.nullable(), polarization: z.enum(['unspecified', 'TE', 'TM']) }).strict();
export type Mode = z.infer<typeof ModeSchema>;
export const unknownMode = (): Mode => ({ representation: 'gaussian', mfdX: null, mfdY: null, polarization: 'unspecified' });
const common = { assemblyId: id };
export const BodySchema = z.discriminatedUnion('kind', [
    z.object({ ...common, kind: z.literal('lens'), outerRadius: dim }).strict(),
    z.object({ ...common, kind: z.literal('mirror'), outline: z.enum(['disc', 'rectangle']), width: dim, height: dim, thickness: dim }).strict(),
    z.object({ ...common, kind: z.literal('prism'), depth: dim }).strict(),
    z.object({ ...common, kind: z.literal('array'), width: dim, height: dim }).strict(),
]);
export type Body = z.infer<typeof BodySchema>;
export const BuildingBlockSchema=z.object({id:z.string().min(1).max(80),name:z.string().min(1).max(80),kind:z.enum(['lens','mirror','prism','array','group']),surfaces:z.array(surfaceSchema).min(1).max(100),body:BodySchema.nullable()}).strict().superRefine((b,ctx)=>{const aid=b.surfaces[0].assemblyId;if(b.surfaces.some(s=>s.assemblyId!==aid)||b.body&&(b.body.assemblyId!==aid||b.body.kind!==b.kind)||new Set(b.surfaces.map(s=>s.id)).size!==b.surfaces.length)ctx.addIssue({code:'custom',message:'Building Block must contain one coherent leaf Component'});});
export type BuildingBlock=z.infer<typeof BuildingBlockSchema>;
export const ProjectSchema = z.object({ kind: z.literal('optical-project'), schemaVersion: z.literal(1), units: z.literal('SI'),
    routing:RoutingSchema.optional(),
    portArrays:PortArraysSchema.optional(),
    arrayStudy:ArrayStudySchema.optional(),
    designScenario:z.enum(['edge-direct','edge-receptacle','vertical','spacer-fold','evanescent','mirror-reference','relay-reference','basic-relay']).optional(),
    synthesis:SynthesisSchema.optional(),
    designProblem:ProblemSchema.optional(),
    targetBody:z.object({radius:dim,length:dim}).strict().nullable().optional(),
    authoring: AuthoringSchema.optional(), buildingBlocks:z.array(BuildingBlockSchema).max(30).optional(),
    model: z.discriminatedUnion('kind', [
        z.object({ kind: z.literal('ideal'), design: DocumentSchema }).strict(),
        z.object({ kind: z.literal('surface'), prescription: PrescriptionSchema, sourceMode: ModeSchema, targetMode: ModeSchema }).strict(),
    ]), bodies: z.array(BodySchema).max(50), sourceBody: z.object({ radius: dim, length: dim }).strict().nullable(),
}).strict().superRefine((p, ctx) => {
    const doc = prescription(p), ids = new Set(doc.assemblies.map(a => a.id));
    if(p.portArrays&&p.model.kind==='ideal')ctx.addIssue({code:'custom',message:'Product Port Arrays require a Physical Project.'});
    if(p.portArrays&&p.model.kind==='surface'&&(doc.source.channels.rows!==1||doc.source.channels.cols!==1))ctx.addIssue({code:'custom',message:'Product Arrays use one representative ray Channel; legacy ray arrays must be converted explicitly.'});
    const moving=p.authoring?.alignment.movingId;if(moving&&moving!=='@source'&&!ids.has(moving))ctx.addIssue({code:'custom',message:'Unknown Alignment moving element'});
    if(p.buildingBlocks&&new Set(p.buildingBlocks.map(b=>b.id)).size!==p.buildingBlocks.length)ctx.addIssue({code:'custom',message:'Duplicate Building Block ID'});
    if (new Set(p.bodies.map(b => b.assemblyId)).size !== p.bodies.length)
        ctx.addIssue({ code: 'custom', message: 'Duplicate body definition' });
    for (const b of p.bodies)
        if (!ids.has(b.assemblyId))
            ctx.addIssue({ code: 'custom', message: 'Unknown body Assembly' });
    if (p.model.kind === 'ideal' && p.bodies.length)
        ctx.addIssue({ code: 'custom', message: 'Ideal lens thickness / solid body undefined; use a physical prescription' });
});
export type Project = z.infer<typeof ProjectSchema>;
// Exactly one authoritative model is stored. The other editor consumes a derived adapter.
export function idealProject(design: DesignDocument = exampleDocument(), sourceBody: Project['sourceBody'] = null): Project { return { kind: 'optical-project', schemaVersion: 1, units: 'SI', model: { kind: 'ideal', design: DocumentSchema.parse(design) }, bodies: [], sourceBody }; }
export function physicalProject(d: Prescription, bodies: Body[] = [], sourceMode = unknownMode(), targetMode = unknownMode()): Project { return { kind: 'optical-project', schemaVersion: 1, units: 'SI', model: { kind: 'surface', prescription: PrescriptionSchema.parse(d), sourceMode, targetMode }, bodies, sourceBody: null }; }
export function projectExample(which: SurfaceExample): Project {
    const d = surfaceExample(which), bodies: Body[] = [];
    for (const a of d.assemblies) {
        if (a.kind === 'lens')
            bodies.push({ kind: 'lens', assemblyId: a.id, outerRadius: .0012 });
        if (a.kind === 'mirror')
            bodies.push({ kind: 'mirror', assemblyId: a.id, outline: 'disc', width: .0032, height: .0032, thickness: .0003 });
        if (a.kind === 'prism')
            bodies.push({ kind: 'prism', assemblyId: a.id, depth: .003 });
        if (a.kind === 'array')
            bodies.push({ kind: 'array', assemblyId: a.id, width: .0019, height: .0019 });
    }
    return { ...physicalProject(d, bodies), sourceBody: { radius: .0002, length: .0006 } };
}
export function prescription(p: Project): Prescription {
    if (p.model.kind === 'surface')
        return p.model.prescription;
    const d = p.model.design, source = d.components[0];
    return { kind: 'surface-prescription', schemaVersion: 1, units: 'SI', name: d.name, wavelength: d.wavelength, provenance: 'synthetic-assumptions',
        source: { frame: source.frame, radius: .00025, samples: 5, n: 1, channels: { rows: 1, cols: 1, pitch: .0006 } },
        assemblies: d.components.slice(1).map(c => ({ id: c.id, name: c.name, kind: c.kind === 'lens' ? 'lens' : c.kind === 'waveguide' ? 'target' : 'group', parentId: null, frame: c.frame })),
        surfaces: d.components.slice(1).map(c => ({ id: c.id, name: c.name + (c.kind === 'lens' ? ' · Ideal Thin Lens' : ''), assemblyId: c.id, frame: pose(), shape: 'plane', radius: .005, aperture: c.kind === 'lens' ? c.aperture / 2 : .0005, interaction: 'probe', nBefore: 1, nAfter: 1, outsideIndex: 1, array: null })) };
}
export function withPrescription(p: Project, next: Prescription): Project {
    next=resolveMaterials(prescription(p),next);
    PrescriptionSchema.parse(next);
    if (p.model.kind === 'surface')
        return { ...p, model: { ...p.model, prescription: next }, bodies: p.bodies.filter(b => next.assemblies.some(a => a.id === b.assemblyId && a.kind === b.kind)) };
    // Ideal components keep their exact semantic type. Surface frames are editable, physical curvature is not invented.
    const old = prescription(p), d = p.model.design;
    if (next.surfaces.length !== old.surfaces.length || next.surfaces.some((s, i) => s.id !== old.surfaces[i].id))
        throw Error('Ideal model: add/remove/order in Gaussian Workspace. Physical surfaces require a Surface project.');
    const components = d.components.map((c, i) => {
        if (i === 0) {
            if(c.locked&&JSON.stringify(c.frame)!==JSON.stringify(next.source.frame))throw Error('Source is locked');
            return { ...c, frame: next.source.frame };
        }
        const s = next.surfaces.find(s => s.id === c.id)!, a = next.assemblies.find(a => a.id === s.assemblyId)!;
        if (s.shape !== 'plane' || s.interaction !== 'probe' || s.nBefore !== 1 || s.nAfter !== 1 || s.array || a.parentId)
            throw Error('Ideal model: physical Surface properties are undefined.');
        // Euler composition is intentionally limited here; ideal components have a single authoritative frame.
        if (s.frame.rotation.roll || s.frame.rotation.pitch || s.frame.rotation.yaw)
            throw Error('Ideal model: edit Assembly orientation; Surface-local rotation is undefined.');
        if(c.kind!=='lens'&&s.aperture!==old.surfaces[i-1].aperture)throw Error('Reference plane Clear Aperture is undefined');
        if(a.kind!==old.assemblies[i-1].kind)throw Error('Ideal component type must be edited in Gaussian Workspace');
        const origin = pointToWorld(frame(a.frame), s.frame.origin), name = s.name !== old.surfaces[i - 1].name ? s.name.replace(' · Ideal Thin Lens', '') : a.name;
        const updated={ ...c, name, frame: { ...a.frame, origin }, ...(c.kind === 'lens' ? { aperture: s.aperture * 2 } : {}) };
        if(c.locked&&JSON.stringify(updated)!==JSON.stringify(c))throw Error(`${c.name}: Component is locked`);
        return updated;
    });
    return { ...p, model: { kind: 'ideal', design: DocumentSchema.parse({ ...d, name: next.name, wavelength: next.wavelength, components }) } };
}
export function modes(p: Project) { return p.model.kind === 'surface' ? { source: p.model.sourceMode, target: p.model.targetMode } : { source: p.model.design.components[0].kind === 'fiber' ? p.model.design.components[0].mode : unknownMode(), target: (p.model.design.components.at(-1)! as Extract<DesignDocument['components'][number], {
        kind: 'waveguide';
    }>).mode }; }
export function withMode(p: Project, which: 'source' | 'target', mode: Mode): Project {
    if (p.model.kind === 'surface')
        return { ...p, model: { ...p.model, [which === 'source' ? 'sourceMode' : 'targetMode']: mode } };
    const index = which === 'source' ? 0 : p.model.design.components.length - 1;
    if(p.model.design.components[index].locked&&JSON.stringify(mode)!==JSON.stringify(modes(p)[which]))throw Error('Port is locked');
    return { ...p, model: { kind: 'ideal', design: DocumentSchema.parse({ ...p.model.design, components: p.model.design.components.map((c, i) => i === index ? { ...c, mode } : c) }) } };
}
export function serializeProject(p: Project) { return JSON.stringify(ProjectSchema.parse(p), null, 2); }
export function parseProject(raw: string): Project {
    if (raw.length > 2000000)
        throw Error('JSON exceeds 2 MB');
    const value = JSON.parse(raw);
    if (value.kind === 'optical-project')
        return ProjectSchema.parse(value);
    if (value.kind === 'surface-prescription')
        return physicalProject(PrescriptionSchema.parse(value));
    return idealProject(DocumentSchema.parse(value));
}
export function projectFingerprint(p: Project) { return fingerprint(JSON.stringify(p)); }
export function gaussianForProject(p: Project) { if(p.model.kind==='ideal'&&p.authoring&&Object.values(p.authoring.ports).some(port=>port.fieldModel!=='gaussian'||port.adapter==='near-field-em-required'||port.mediumIndex!==null&&port.mediumIndex!==1))return {...solveGaussian(p.model.design),status:'out-of-domain' as const,reason:'Port Field / Medium은 Legacy Scalar Gaussian Solver의 유효 영역 밖입니다. Mode Bridge 검증이 필요합니다.'}; return p.model.kind === 'ideal' ? solveGaussian(p.model.design) : { status: 'out-of-domain' as const, reason: 'This entry point handles Legacy Ideal Gaussian. Physical projects use the separate coaxial Surface Gaussian Bridge result contract.' }; }
export function sourceSelection(p: Project) { return p.model.kind === 'ideal' ? p.model.design.components[0].id : '@source'; }
export function targetSelection(p: Project) { return prescription(p).surfaces.at(-1)!.id; }
export function sourceLocal(p: Project, point: ReturnType<typeof V>) { return pointToLocal(frame(prescription(p).source.frame), point); }
