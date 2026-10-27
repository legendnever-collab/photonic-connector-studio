import type {Overlap} from './physicalGaussian';
/** The same evaluator/domain object is used by Analysis, Gaussian and Report. */
export function ModeDomain({result}:{result:Overlap|null}){
 if(!result)return null;
 if(result.status!=='valid')return <p className="surface-note" data-testid="mode-domain-reason">{result.reason}</p>;
 const d=result.domain,g=result.gaussianReference;
 return <details className="surface-note" data-testid="mode-domain"><summary>Mode evaluation · {d?'Prism / TIR angular spectrum':'Gaussian complex-field integral'}</summary><p>{result.scope}</p><p>Comparison class: {result.comparisonClass}</p>{g&&<div data-testid="spherical-domain"><p>{g.assumptions}</p>{g.surfaces.map(s=><p key={s.id}>{s.id}: incidence {(s.incidenceRad*1000).toPrecision(4)} mrad · footprint / |R| {s.footprintRatio.toPrecision(4)} · power T / S {s.tangentialPower.toPrecision(6)} / {s.sagittalPower.toPrecision(6)} m⁻¹</p>)}</div>}{d&&<><p>{d.assumptions}</p>{d.prisms.map(s=><p key={s.id}>{s.id}: {s.polarization} · chief phase {s.phaseRad.toPrecision(5)} rad · critical margin {(s.criticalMarginRad*180/Math.PI).toPrecision(4)}° · divergence {(s.divergenceRad*1000).toPrecision(4)} mrad</p>)}<p>Sampling 32² / 64², window 7 / 8 · Δη {d.quadratureError.toExponential(2)} · paraxial phase bound {d.paraxialPhaseBound.toExponential(2)} rad. Validated model tolerance: absolute η {d.modelEtaTolerance}.</p></>}</details>;
}
