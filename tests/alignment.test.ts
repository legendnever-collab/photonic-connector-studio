import { expect, test } from "vitest";
import { axisLogOverlap, lensAxis, MAX_SLOPE, propagateAxis, solveGaussian } from "../src/physics";
import { syntheticExample } from "../src/examples";
import { mm, nm, um, parseDocument, serialize } from "../src/domain";
import { computeSensitivity, DEFAULT_SENSITIVITY, sensitivityCSV } from "../src/sensitivity";
function valid(doc=syntheticExample("matching")){const r=solveGaussian(doc);if(r.status!=="valid")throw new Error(r.reason);return r;}
// Direct sampled fields, including independent spatial centers / both phase ramps.
function numeric(wi:number,wt:number,c:number,hi:number,ht:number,si:number,st:number,window:number,n:number){
  const lambda=1e-6,k=2*Math.PI/lambda,lo=Math.min(hi-window*wi,ht-window*wt),hiGrid=Math.max(hi+window*wi,ht+window*wt);let re=0,im=0,pi=0,pt=0;
  for(let j=0;j<=n;j++){const u=lo+(hiGrid-lo)*j/n,d=u-hi,t=u-ht,weight=j===0||j===n?.5:1;
    const ai=Math.exp(-((d/wi)**2)),at=Math.exp(-((t/wt)**2));
    const incidentPhase=-k*(c*d*d/2+si*d),targetPhase=-k*st*t,phase=incidentPhase-targetPhase;
    re+=weight*ai*at*Math.cos(phase);im+=weight*ai*at*Math.sin(phase);pi+=weight*ai*ai;pt+=weight*at*at;
  }return (re*re+im*im)/(pi*pt);
}
test("axis free space and centered lens independently known trajectory",()=>{
  const axis={height:um(3),slope:.005};expect(propagateAxis(axis,mm(2)).height).toBeCloseTo(um(13),16);
  expect(lensAxis({height:um(10),slope:.005},0,mm(1.25)).slope).toBeCloseTo(-.003,15);
  const doc=syntheticExample("matching");doc.components[0].frame.rotation.yaw=.005;const r=valid(doc);
  // Whole train ABCD: A=D=-.6, B=.8 mm, C=-800/m; [0,.005] -> [4 µm,-.003].
  expect(r.incident.axis.y.height).toBeCloseTo(um(4),16);expect(r.incident.axis.y.slope).toBeCloseTo(-.003,15);
  expect(r.incident.y).toEqual(valid().incident.y);expect(r.samples[0].axis.y.slope).toBe(.005);
});
test("Z Pitch sign and Y/Z axis interchange preserve power",()=>{
  const y=syntheticExample("matching");y.components[0].frame.rotation.yaw=.005;y.components.at(-1)!.frame.origin.y=um(7);y.components.at(-1)!.frame.rotation.yaw=-.002;
  const z=syntheticExample("matching");z.components[0].frame.rotation.pitch=-.005;z.components.at(-1)!.frame.origin.z=um(7);z.components.at(-1)!.frame.rotation.pitch=.002;
  const a=valid(y),b=valid(z);expect(a.eta).toBeCloseTo(b.eta,14);expect(a.incident.axis.y).toEqual(b.incident.axis.z);
});
test.each([0,.001,.005,.01,.02])("equal flat modes angular benchmark at %s rad",theta=>{
  const w=um(20),lambda=nm(1000);expect(Math.exp(2*axisLogOverlap(w,w,0,0,lambda,theta/Math.SQRT2))).toBeCloseTo(Math.exp(-((Math.PI*w*theta/lambda)**2)),13);
});
test("simultaneous flat displacement and tilt matches analytic product",()=>{
  const w=um(20),lambda=nm(1000),d=um(12),theta=.007;
  expect(Math.exp(axisLogOverlap(w,w,0,d,lambda,theta))).toBeCloseTo(Math.exp(-((d/w)**2)-(Math.PI*w*theta/lambda)**2),13);
});
for(const [wi,wt,c,hi,ht,si,st] of [[20,20,0,0,12,.005,-.003],[20,30,1000,5,17,.01,-.004],[12,25,-2200,-5,-12,-.012,.002],[50,10,700,8,28,.007,-.003],[20,20,1591.5494309189535,3,13,-.005,.003]]){
 test(`independent phase-ramp quadrature ${wi}/${wt}, c=${c}`,()=>{
  const closed=Math.exp(axisLogOverlap(um(wi),um(wt),c,um(ht-hi),nm(1000),si-st));
  const values=[[4,512],[6,2048],[8,8192]].map(([window,n])=>numeric(um(wi),um(wt),c,um(hi),um(ht),si,st,window,n));
  expect(Math.abs(values[0]-closed)).toBeLessThan(1e-10);expect(Math.abs(values[1]-closed)).toBeLessThan(2e-13);expect(Math.abs(values[2]-closed)).toBeLessThan(2e-13);
  console.log(JSON.stringify({alignmentQuadrature:{wi,wt,c,hi,ht,si,st,closed,values,error:Math.abs(values[2]-closed)}}));
 });
}
test("curvature/offset/tilt cross term responds to sign, not independent penalties",()=>{
 const a=axisLogOverlap(um(20),um(30),1000,um(12),nm(1000),.01),b=axisLogOverlap(um(20),um(30),1000,um(12),nm(1000),-.01);expect(a).not.toBeCloseTo(b,5);
 const reverse=axisLogOverlap(um(20),um(30),1000,-um(12),nm(1000),-.01);expect(reverse).toBeCloseTo(a,14);
});
test.each(["source-limit","target-norm","roll","lens-tilt","lens-decenter","propagated-angle"])("domain gating %s",kind=>{
 const doc=syntheticExample("matching"),f=doc.components[0],l=doc.components[1],w=doc.components.at(-1)!;
 if(kind==="source-limit")f.frame.rotation.yaw=MAX_SLOPE+1e-8;
 if(kind==="target-norm"){w.frame.rotation.yaw=.04;w.frame.rotation.pitch=.04;}
 if(kind==="roll")w.frame.rotation.roll=1e-10;
 if(kind==="lens-tilt")l.frame.rotation.pitch=.001;
 if(kind==="lens-decenter")l.frame.origin.y=um(1);
 if(kind==="propagated-angle"){f.frame.rotation.yaw=.04;if(l.kind==="lens")l.focalLength=mm(.5);}
 expect(solveGaussian(doc).status).toBe("out-of-domain");
});
test("zero-angle P1.1 benchmark, fast solve and JSON/history inputs retain identical results",()=>{
 const doc=syntheticExample("matching"),r=valid(doc),fast=solveGaussian(doc,{sampleBeam:false});expect(r.eta).toBeCloseTo(1,13);expect(fast).toMatchObject({status:"valid",eta:r.eta,samples:[]});
 doc.components[0].frame.rotation.yaw=.005;expect(valid(parseDocument(serialize(doc)))).toEqual(valid(doc));
});
test("sensitivity thresholds agree with closed 80% matching references; input is immutable",()=>{
 const doc=syntheticExample("matching"),before=serialize(doc),r=computeSensitivity(doc);if(r.status!=="valid")throw 0;
 const radius=Math.sqrt(1e-9/Math.PI),offset=radius*Math.sqrt(-Math.log(.8)),angle=1e-6/(Math.PI*radius)*Math.sqrt(-Math.log(.8));
 expect(r.offsetAcceptance.status).toBe("passes");expect(r.tiltAcceptance.status).toBe("passes");
 if(r.offsetAcceptance.status!=="passes"||r.tiltAcceptance.status!=="passes")throw 0;
 expect(r.offsetAcceptance.low.kind).toBe("crossing");expect(Math.abs(r.offsetAcceptance.low.delta+offset)).toBeLessThan(1e-14);expect(Math.abs(r.tiltAcceptance.high.delta-angle)).toBeLessThan(1e-11);
 expect(serialize(doc)).toBe(before);expect(r.map).toHaveLength(441);expect(r.offsetCurve[30].eta).toBe(r.nominalEta);
 const p=r.map[7*21+14];expect(p.eta).toBeCloseTo(Math.exp(-((p.offset/radius)**2)-(Math.PI*radius*p.rotation/1e-6)**2),13);
 const csv=sensitivityCSV(r);expect(csv).toContain(r.fingerprint);expect(csv.split('\n')).toHaveLength(565); // 1 header + 61+61+441 data + trailing newline
});
test("finite scan edge, domain edge, nominal failure and off-nominal passing points stay distinct",()=>{
 const doc=syntheticExample("matching"),narrow=computeSensitivity(doc,{...DEFAULT_SENSITIVITY,offsetSpan:um(1),tiltSpan:.001});
 if(narrow.status!=="valid"||narrow.offsetAcceptance.status!=="passes")throw 0;expect(narrow.offsetAcceptance.high.kind).toBe("scan-edge");
 doc.components.at(-1)!.frame.rotation.yaw=.049;const near=computeSensitivity(doc,{...DEFAULT_SENSITIVITY,threshold:1e-6});
 if(near.status!=="valid"||near.tiltAcceptance.status!=="passes")throw 0;expect(near.tiltAcceptance.high.kind).toBe("domain-edge");expect(near.map.some(p=>p.eta===null&&p.status==="out-of-domain")).toBe(true);
 const mismatch=computeSensitivity(syntheticExample("mismatch"));if(mismatch.status!=="valid")throw 0;expect(mismatch.offsetAcceptance.status).toBe("nominal-below-threshold");expect(mismatch.offsetCurve.some(p=>p.eta!==null&&p.eta>.8)).toBe(true);
});
test.each([0,-1,NaN,Infinity])("invalid sensitivity span %s",offsetSpan=>{expect(computeSensitivity(syntheticExample("matching"),{...DEFAULT_SENSITIVITY,offsetSpan}).status).toBe("invalid");});
test("invalid nominal and zero threshold never produce stale sensitivity",()=>{
 const doc=syntheticExample("matching");doc.components[0].frame.rotation.yaw=.1;expect(computeSensitivity(doc).status).toBe("invalid");expect(computeSensitivity(syntheticExample("matching"),{...DEFAULT_SENSITIVITY,threshold:0}).status).toBe("invalid");
});
