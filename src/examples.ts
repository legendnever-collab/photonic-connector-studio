import { DocumentSchema, exampleDocument, mm, nm, newFrame, um } from "./domain";
import type { DesignDocument } from "./domain";
export type ExampleId = "free" | "matching" | "mismatch";
export const EXAMPLES: Record<ExampleId, { label: string; description: string }> = {
  free: { label: "Free-space Gaussian", description: "Synthetic · λ=1000 nm, w₀=20 µm, F–W=2 mm, Lens 없음. Target waist도20 µm이며 Phase/Size mismatch가 발생합니다." },
  matching: { label: "Mode Matching", description: "Synthetic · λ=1000 nm, zR=1 mm, w₀=√(λzR/π)=17.841241 µm. F=0, Lens=2 mm, f=1.25 mm, W=4 mm. q(W)=i·1 mm → η=100%. Optimization이 아닌 기준값 Reset입니다." },
  mismatch: { label: "Mismatch / WG Offset", description: "Synthetic · Matching과 동일하되 WG Y Offset=w₀=17.841241 µm. η=exp(−1)=36.787944%." },
};
export function syntheticExample(id: ExampleId): DesignDocument {
  const doc = exampleDocument(), source = doc.components[0], target = doc.components.at(-1)!;
  if (source.kind !== "fiber" || target.kind !== "waveguide") throw new Error("Ports");
  doc.name = `${EXAMPLES[id].label} · Synthetic assumption`;
  doc.wavelength = nm(1000);
  const radius = id === "free" ? um(20) : Math.sqrt(nm(1000) * mm(1) / Math.PI);
  source.mode = { representation: "gaussian", mfdX: radius * 2, mfdY: radius * 2, polarization: "TE" };
  target.mode = { ...source.mode };
  target.frame = newFrame(mm(id === "free" ? 2 : 4));
  if (id === "mismatch") target.frame.origin.y = radius;
  const mating = doc.components.find(c => c.kind === "mating-plane")!;
  mating.frame = newFrame(mm(id === "free" ? 1 : 3));
  const lens = doc.components.find(c => c.id === "lens-f")!;
  if (lens.kind !== "lens") throw new Error("Lens");
  lens.frame = newFrame(mm(2)); lens.focalLength = mm(1.25); lens.aperture = mm(1);
  doc.components = id === "free" ? [source, mating, target] : [source, lens, mating, target];
  return DocumentSchema.parse(doc);
}
