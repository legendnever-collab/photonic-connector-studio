import { describe, expect, test } from "vitest";
import { abcd, axisLogOverlap, beam, fingerprint, rayleigh, solveGaussian } from "../src/physics";
import { syntheticExample } from "../src/examples";
import { exampleDocument, mm, nm, um, parseDocument, serialize } from "../src/domain";

// Independent sampled complex fields: no q/ABCD/closed overlap in this integrator.
function quadrature(wi: number, wt: number, c: number, delta: number, lambda: number, window: number, n: number) {
  const lo = Math.min(-window * wi, delta - window * wt), hi = Math.max(window * wi, delta + window * wt), h = (hi - lo) / n;
  let re = 0, im = 0, pi = 0, pt = 0;
  for (let j = 0; j <= n; j++) {
    const y = lo + j * h, weight = j === 0 || j === n ? 0.5 : 1;
    const ai = Math.exp(-((y / wi) ** 2)), at = Math.exp(-(((y - delta) / wt) ** 2));
    const phase = -Math.PI / lambda * c * y * y;
    re += weight * ai * at * Math.cos(phase); im += weight * ai * at * Math.sin(phase);
    pi += weight * ai * ai; pt += weight * at * at;
  }
  return (re * re + im * im) / (pi * pt);
}
function valid(doc = syntheticExample("matching")) {
  const r = solveGaussian(doc); if (r.status !== "valid") throw new Error(r.reason); return r;
}
describe("independent Gaussian benchmarks", () => {
  test("Rayleigh range independent decimal benchmark / free-space radius", () => {
    expect(rayleigh(um(20), nm(1000))).toBeCloseTo(0.0012566370614359172, 16);
    const r = valid(syntheticExample("free"));
    expect(r.incident.y.radius).toBeCloseTo(37.59270988401046e-6, 15);
    expect(r.incident.y.waistX).toBeCloseTo(0, 15);
    expect(r.samples.at(-1)!.x).toBe(mm(2));
  });
  test("matching waist/plane gives eta=1 with one ideal lens", () => {
    const r = valid(); expect(r.eta).toBeCloseTo(1, 13); expect(r.lossDB).toBeCloseTo(0, 12);
    expect(r.incident.y.radius).toBeCloseTo(17.84124116152771e-6, 16);
    expect(r.incident.y.waistX).toBeCloseTo(0.004, 15); expect(r.incident.y.curvature).toBeCloseTo(0, 10);
  });
  test("equal circular waist: lateral offset eta=exp(-1)", () => {
    expect(valid(syntheticExample("mismatch")).eta).toBeCloseTo(0.36787944117144233, 13);
  });
  test.each([0, 0.1, 0.7, 1, 2, 10])("lateral reference at offset/w=%s", (ratio) => {
    const log = 2 * axisLogOverlap(um(20), um(20), 0, um(20) * ratio / Math.SQRT2, nm(1000));
    expect(Math.exp(log)).toBeCloseTo(Math.exp(-ratio * ratio), 13);
  });
  test.each([0.2, 0.5, 1, 2, 5])("size mismatch wt/wi=%s", (ratio) => {
    const eta = Math.exp(2 * axisLogOverlap(um(20), um(20) * ratio, 0, 0, nm(1000)));
    expect(eta).toBeCloseTo((2 * ratio / (1 + ratio * ratio)) ** 2, 13);
  });
  test("same size but curvature mismatch reduces overlap to 0.5", () => {
    const w = um(20), lambda = nm(1000), curvature = 2 * lambda / (Math.PI * w * w);
    expect(Math.exp(2 * axisLogOverlap(w, w, curvature, 0, lambda))).toBeCloseTo(0.5, 13);
    expect(beam({ re: 0, im: mm(1) }, lambda, 0).curvature).toBe(0);
  });
  for (const [wi, wt, c, delta] of [[20,20,0,0],[20,30,1000,12],[12,25,-2200,-7],[50,10,700,20],[20,20,1591.5494309189535,0]]) {
    test(`complex-field quadrature ${wi}/${wt} µm, curvature ${c}`, () => {
      const closed = Math.exp(axisLogOverlap(um(wi), um(wt), c, um(delta), nm(1000)));
      const values = [quadrature(um(wi),um(wt),c,um(delta),nm(1000),4,512), quadrature(um(wi),um(wt),c,um(delta),nm(1000),6,2048), quadrature(um(wi),um(wt),c,um(delta),nm(1000),8,8192)];
      expect(Math.abs(values[0]-closed)).toBeLessThan(1e-10);
      expect(Math.abs(values[1]-closed)).toBeLessThan(2e-13);
      expect(Math.abs(values[2]-closed)).toBeLessThan(2e-13);
      console.log(JSON.stringify({benchmark:"quadrature",wi,wt,c,delta,closed,values,absError:Math.abs(values[2]-closed)}));
    });
  }
});
test("ABCD identity and free-space segment composition", () => {
  const q = { re: mm(0.4), im: mm(1) };
  expect(abcd(q,[1,0,0,1])).toEqual(q);
  const sum = abcd(q,[1,mm(3),0,1]);
  const split = abcd(abcd(q,[1,mm(1),0,1]),[1,mm(2),0,1]);
  expect(split.re).toBeCloseTo(sum.re, 15); expect(split.im).toBe(sum.im);
  const lens = abcd({re:mm(2),im:mm(1)},[1,0,-1/mm(1.25),1]);
  expect(lens.re).toBeCloseTo(-0.002,15); expect(lens.im).toBeCloseTo(0.001,15);
});
test("disabled lens equals no lens; physical free-space distance preserved", () => {
  const doc=syntheticExample("matching"), lens=doc.components[1]; lens.enabled=false;
  const disabled=valid(doc); doc.components.splice(1,1); const removed=valid(doc);
  expect(disabled.eta).toBe(removed.eta); expect(disabled.incident).toEqual(removed.incident);
});
test("elliptical axes independent and axis swap invariant", () => {
  const doc=syntheticExample("free"), f=doc.components[0], w=doc.components.at(-1)!;
  if(f.kind!=="fiber"||w.kind!=="waveguide") throw 0;
  f.mode.mfdY=um(60); w.mode.mfdX=um(70); w.mode.mfdY=um(50); w.frame.origin.y=um(3);w.frame.origin.z=um(7);
  const a=valid(doc); expect(a.incident.y.radius).not.toBe(a.incident.z.radius);
  [f.mode.mfdX,f.mode.mfdY]=[f.mode.mfdY,f.mode.mfdX]; [w.mode.mfdX,w.mode.mfdY]=[w.mode.mfdY,w.mode.mfdX];
  [w.frame.origin.y,w.frame.origin.z]=[w.frame.origin.z,w.frame.origin.y];
  const b=valid(doc);expect(b.eta).toBeCloseTo(a.eta,14);expect(b.incident.y).toEqual(a.incident.z);
});
test("units nm/µm/mm/m and JSON reload retain results; P0 TBD unchanged", () => {
  expect(nm(1000)).toBeCloseTo(um(1),20);expect(um(1000)).toBe(mm(1));expect(mm(1000)).toBe(1);
  const doc=syntheticExample("matching"), before=valid(doc), after=valid(parseDocument(serialize(doc)));
  expect(after).toEqual(before);expect(solveGaussian(exampleDocument()).status).toBe("invalid");
  expect(exampleDocument().components[0]).toHaveProperty("mode.mfdX",null);
  expect(fingerprint(before.provenance.inputJSON)).toBe(before.provenance.fingerprint);
});
test.each(["order","rotation","source-tilt","decenter","roll","mfd","lambda","f","gap-lens","gap-overlap","polarization","paraxial","position"])('reject invalid/out-of-domain %s', (kind) => {
  const doc=syntheticExample("matching"), f=doc.components[0],l=doc.components[1],w=doc.components.at(-1)!;
  if(f.kind!=="fiber"||w.kind!=="waveguide"||l.kind!=="lens")throw 0;
  if(kind==="order")l.frame.origin.x=mm(3.5);
  if(kind==="rotation")l.frame.rotation.yaw=1e-10;
  if(kind==="source-tilt")f.frame.rotation.pitch=0.1;
  if(kind==="roll")w.frame.rotation.roll=0.01;
  if(kind==="decenter")l.frame.origin.y=um(1);
  if(kind==="mfd")f.mode.mfdX=0;
  if(kind==="lambda")doc.wavelength=NaN;
  if(kind==="f")l.focalLength=0;
  if(kind==="position")l.frame.origin.x=mm(9);
  if(kind==="polarization")w.mode.polarization="TM";
  if(kind==="paraxial")f.mode.mfdX=um(1);
  const g={...doc.components[2],id:"gap",name:"Gap",kind:"gap" as const,length:mm(2),frame:{origin:{x:mm(1),y:0,z:0},rotation:{roll:0,pitch:0,yaw:0}}};
  if(kind==="gap-lens")doc.components.splice(1,0,g);
  if(kind==="gap-overlap"){l.enabled=false;doc.components.splice(1,0,g,{...g,id:"gap2",frame:{...g.frame,origin:{x:mm(1.5),y:0,z:0}},length:mm(.2)});}
  expect(solveGaussian(doc).status).not.toBe("valid");
});
test("planes at identical X / gaps do not double count / enabled order has corrective error", () => {
  const doc=syntheticExample("matching"), base=valid(doc);
  const mating=doc.components[2]; mating.frame.origin.x=mm(2);
  expect(valid(doc).eta).toBeCloseTo(base.eta,14);
  doc.components.splice(1,0,{...mating,id:"gap",kind:"gap",name:"Gap",length:mm(2),frame:{...mating.frame,origin:{x:0,y:0,z:0}}});
  expect(valid(doc).eta).toBeCloseTo(base.eta,14);
  doc.components[1].frame.origin.x=mm(3); const r=solveGaussian(doc);expect(r.status).not.toBe("valid");
});
test("aperture warning never fabricates clipping loss", () => {
  const doc=syntheticExample("matching"), base=valid(doc),lens=doc.components[1];if(lens.kind!=="lens")throw 0;
  lens.aperture=um(1); const small=valid(doc);expect(small.eta).toBe(base.eta);expect(small.warnings.join()).toContain("Clipping");
});
test("unspecified polarization explicitly conditional; stale/invalid has no eta", () => {
  const doc=syntheticExample("matching"),f=doc.components[0];if(f.kind!=="fiber")throw 0;
  f.mode.polarization="unspecified";expect(valid(doc).warnings.join()).toContain("조건부");
  f.mode.mfdY=null;const r=solveGaussian(doc);expect(r.status).toBe("invalid");expect(r).not.toHaveProperty("eta");
});
test("underflow is honestly zero/Infinity, finite diagnostic log retained",()=>{
  const doc=syntheticExample("matching");doc.components.at(-1)!.frame.origin.y=mm(10);
  const r=valid(doc);expect(r.eta).toBe(0);expect(r.lossDB).toBe(Infinity);expect(Number.isFinite(r.logEta)).toBe(true);
});
test("deterministic parameter grid stays in [0,1] without hiding large errors",()=>{
  for(const a of [10,20,50,100])for(const b of [10,30,70])for(const c of [-2000,0,1000])for(const d of [0,10,40]){
    const eta=Math.exp(axisLogOverlap(um(a),um(b),c,um(d),nm(1000)));expect(eta).toBeGreaterThanOrEqual(0);expect(eta).toBeLessThanOrEqual(1);
  }
  expect(()=>abcd({re:0,im:1},[1,0,0,-1])).toThrow();
  expect(()=>axisLogOverlap(-1,1,0,0,1)).toThrow();
});
