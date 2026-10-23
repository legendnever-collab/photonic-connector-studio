import { pose, PrescriptionSchema } from "./model";
import type { Prescription, Surface, Assembly, Pose } from "./model";
const mm = (v: number) => v * 1e-3;
const a = (id: string, kind: Assembly["kind"], p: Pose = pose(), parentId: string | null = null): Assembly => ({ id, name: id, kind, parentId, frame: p });
const s = (id: string, assemblyId: string, x: number, y = 0, yaw = 0, interaction: Surface["interaction"] = "probe", nBefore = 1, nAfter = 1): Surface => ({ id, name: id, assemblyId, frame: pose(mm(x), mm(y), 0, yaw), shape: "plane", radius: mm(5), aperture: mm(1.5), interaction, nBefore, nAfter, outsideIndex: 1, array: null });
const base = (): Prescription => ({ kind: "surface-prescription", schemaVersion: 1, units: "SI", name: "", wavelength: 1310e-9, provenance: "synthetic-assumptions", source: { frame: pose(), radius: mm(.25), samples: 5, n: 1, channels: { rows: 1, cols: 1, pitch: mm(.6) } }, assemblies: [], surfaces: [] });
export const SURFACE_EXAMPLES = { lens: "Physical Lens", mirror: "Fold Mirror", prism: "TIR Prism", array: "Microlens Array", compound: "MLA + Prism + Mirror" } as const;
export type SurfaceExample = keyof typeof SURFACE_EXAMPLES;
export function surfaceExample(which: SurfaceExample): Prescription {
    const d = base();
    d.name = SURFACE_EXAMPLES[which] + " · Synthetic";
    if (which === "lens") {
        d.assemblies = [a("Lens", "lens", pose(mm(2))), a("Target", "target")];
        d.surfaces = [{ ...s("L1-front", "Lens", 0, 0, 0, "refract", 1, 1.5), shape: "sphere", radius: mm(5), aperture: mm(1) }, { ...s("L1-back", "Lens", 1, 0, 0, "refract", 1.5, 1), shape: "sphere", radius: mm(-5), aperture: mm(1) }, s("Target", "Target", 7.83)];
    }
    else if (which === "mirror") {
        d.assemblies = [a("Mirror", "mirror", pose(mm(3), 0, 0, -Math.PI / 4)), a("Target", "target")];
        d.surfaces = [s("M1", "Mirror", 0, 0, 0, "reflect"), s("Target", "Target", 3, 4, Math.PI / 2)];
    }
    else if (which === "prism") {
        d.assemblies = [a("Prism", "prism", pose(mm(3))), a("Target", "target")];
        d.surfaces = [s("P-entry", "Prism", 0, 0, 0, "refract", 1, 1.5), s("P-TIR", "Prism", 2, 0, -Math.PI / 4, "tir", 1.5, 1.5), s("P-exit", "Prism", 2, 2, Math.PI / 2, "refract", 1.5, 1), s("Target", "Target", 5, 4, Math.PI / 2)];
    }
    else {
        d.source.channels = { rows: 3, cols: 3, pitch: mm(.6) };
        d.source.radius = mm(.1);
        d.source.samples = 3;
        d.assemblies = [a("MLA", "array", pose(mm(1))), a("Target", "target")];
        const array = { rows: 3, cols: 3, pitch: mm(.6) };
        d.surfaces = [{ ...s("MLA-front", "MLA", 0, 0, 0, "refract", 1, 1.5), shape: "sphere", radius: mm(5), aperture: mm(.28), array }, { ...s("MLA-back", "MLA", .2, 0, 0, "refract", 1.5, 1), shape: "sphere", radius: mm(-5), aperture: mm(.28), array }];
        if (which === "array")
            d.surfaces.push(s("Target", "Target", 6.17));
        else {
            d.assemblies.push(a("Module", "group"), a("Prism", "prism", pose(mm(3)), "Module"), a("Mirror", "mirror", pose(mm(5), mm(4), 0, 3 * Math.PI / 4), "Module"));
            d.surfaces.push(s("P-entry", "Prism", 0, 0, 0, "refract", 1, 1.5), s("P-TIR", "Prism", 2, 0, -Math.PI / 4, "tir", 1.5, 1.5), s("P-exit", "Prism", 2, 2, Math.PI / 2, "refract", 1.5, 1), s("M1", "Mirror", 0, 0, 0, "reflect"), s("Target", "Target", 8, 4));
        }
    }
    return PrescriptionSchema.parse(d);
}
