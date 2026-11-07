"""Summarize measured files without turning process success into Physics PASS."""
import argparse
import json
from pathlib import Path
import numpy as np
from scipy.fft import fft2,ifft2
from run_s3_preflight import ROOT,EXPECTED,digest,git
from s31_vector_source import radial,power,inner,projection,fft_reference,K,A


def load(name):
    path=ROOT/'benchmark-results'/f's31-{name}.json'
    if not path.exists():return None
    value=json.loads(path.read_text())
    if 'fixtureSHA256' in value:assert value['fixtureSHA256']==EXPECTED
    return value


def gaussian_summary(report):
    rows=[];arrays=[]
    for run in report['runs']:
        path=ROOT/run['fieldArtifact'];assert digest(path)==run['fieldArtifactSHA256']
        data=np.load(path);r=data['rUm'];raw=data['raw'];ref=data['reference']
        phase=np.angle(inner(ref[1,:3],raw[1,:3],r))
        gain=np.exp(1j*phase)*np.sqrt(run['rows'][1]['rawMeepFlux']/(2*power(ref[1],r)))
        fields=raw/gain;arrays.append(raw)
        for i,z in enumerate(data['planesUm']):
            p=run['rows'][i]['rawMeepFlux']/(2*abs(gain)**2);pr=power(ref[i],r)
            e=np.sqrt(abs(inner(fields[i,:3]-ref[i,:3],fields[i,:3]-ref[i,:3],r)/inner(ref[i,:3],ref[i,:3],r)))
            h=np.sqrt(abs(inner(fields[i,3:]-ref[i,3:],fields[i,3:]-ref[i,3:],r)/inner(ref[i,3:],ref[i,3:],r)))
            pp=power(fields[i],r);mode=projection(fields[i],ref[i],r)
            rows.append(dict(m=run['m'],planeUm=float(z),Eerror=float(e),Herror=float(h),
                fluxError=2*abs(p-pr),fieldVsAPIFlux=2*abs(p-pp),
                modeProjectionPower=float(abs(mode)**2*2*pr),
                targetsPass=bool(e<.01 and h<.01 and 2*abs(p-pr)<.005 and 2*abs(p-pp)<.005)))
    parity=np.array([1,-1,1,-1,1,-1])[None,:,None]
    symmetry=float(np.linalg.norm(arrays[0]-arrays[1]*parity)/np.linalg.norm(arrays[0]))
    return dict(resolution=report['runs'][0]['resolutionPerUm'],rows=rows,
        actualHarmonicParityRelative=symmetry,
        twoLinearPolarizations='same full-plane power by harmonic orthogonality; Y=(+1,+1), Z=(-i,+i); Cartesian rotation verified separately',
        normalization='recomputed INPUT flux scale and launch E phase once per m from saved raw data; no output fitting',
        fullExitPlanes='not-run',status='unresolved')


def source_support():
    r=np.linspace(0,240,2401);s=radial(r,-10,1)
    current=np.sum(abs(s[[0,1,3,4]])**2,axis=0)*r
    total=np.trapezoid(current,r)
    removed={str(radius):float(np.trapezoid(current[r>=radius],r[r>=radius])/total) for radius in [100,150,170,190]}
    scalar=float(np.exp(-(K/4)**2*np.real(1/A)/2))
    models=[]
    for distance in [0.,20.]:
        grid,vector,_=fft_reference(1024,400.,distance)
        x,y=grid.y*1e6,grid.z*1e6
        q2=(2*np.pi*grid.fy*1e-6)**2+(2*np.pi*grid.fz*1e-6)**2
        paraxial=ifft2(fft2(np.exp(-A*(x*x+y*y)))*(q2<=(K/4)**2)*np.exp(1j*(K-q2/(2*K))*distance))
        longitudinal=float(np.sum(abs(vector[2])**2)/np.sum(abs(vector[:3])**2))
        transverse=float(np.linalg.norm(vector[0]-paraxial)/np.linalg.norm(vector[0]))
        models.append(dict(distanceFromLaunchUm=distance,scalarParaxialVsVectorTransverse=transverse,
            longitudinalElectricNormFraction=longitudinal))
    return dict(sourceTangentialCurrentL2OutsideRadius=removed,analyticScalarSpectrumRemoved=scalar,
        scalarParaxialComparison=models,
        note='current L2 and scalar spectral truncation are diagnostics, not physical absorbed power')


def main():
    p=argparse.ArgumentParser();p.add_argument('--profile',choices=['all','planar','gaussian'],default='all');a=p.parse_args()
    result=dict(gitSHA=git('rev-parse','HEAD'),fixtureSHA256=EXPECTED,
        adapterSHA256=digest(Path(__file__)),profile=a.profile,physicsReferenceStatus='uncomputed',
        lensField=None,lensFlux=None,lensModeProjection=None,totalCoupling=None,assemblyYield=None)
    if a.profile in ['all','planar']:
        baseline=ROOT/'benchmark-results/s3-meep-controls.json'
        if baseline.exists():
            original=json.loads((ROOT/'tests/coherent/s31/baseline-planar.json').read_text())
            current=json.loads(baseline.read_text())
            assert len(original['rows'])==len(current['planarControls'])==6
            error=max(abs(x[k]-y[k]) for x,y in zip(original['rows'],current['planarControls'])
                for k in ['T','R','fluxError','complexRelativeError','balanceError'])
            hashes={key:original[key]==current[key] for key in ['fixtureSHA256','adapterSHA256','environmentLockSHA256','contractAdapterSHA256']}
            assert error<1e-10 and all(hashes.values())
            result['baselineRecovery']=dict(maxNumericDifference=error,hashesMatch=hashes,source=original['artifactURL'])
        else:result['baselineRecovery']='not-run-in-this-job'
        names=['long','long-fine','short','short-fine','settling','settling16','pml','padding','shift','no-average','bandwidth','short-pml','short-settling','negative-time']
        result['planar']={name:[{key:r.get(key) for key in ['kind','points','errors','withinTargets','subtractionVsNet','diagnosticDiscretePrediction','reason']} for r in load(name)['rows']] for name in names if load(name)}
        result['homogeneous']=load('homogeneous')
        result['apiAudit']=load('api-audit')
        result['A']='diagnosed: dispersion, settling, interpolation/readout; boundary residuals remain' if result['homogeneous'] and result['apiAudit'] else 'incomplete: homogeneous/API audit missing'
        short_checks=[load(name) for name in ['short-pml','short-settling']]
        short_pass=all(item and all(row['withinTargets'] for row in item['rows']) for item in short_checks)
        result['B']='partial: short control passes; frozen 300 um control unresolved' if short_pass else 'incomplete: independent short-control acceptance not established'
    if a.profile in ['all','gaussian']:
        names=['gaussian-r4','gaussian-r6','gaussian-r8','gaussian-disk','gaussian-window','gaussian-pml','gaussian-time','gaussian-sampling']
        result['gaussian']={name:gaussian_summary(load(name)) for name in names if load(name)}
        result['sourceSupport']=source_support()
        result['C']='partial: actual m +/-1 and short planes; full frozen no-Lens exit planes not run' if result['gaussian'] else 'not-run: Gaussian results missing'
    result['inputReportSHA256']={p.name:digest(p) for p in (ROOT/'benchmark-results').glob('s31-*.json') if not p.name.endswith('-summary.json')}
    result['D']='blocked: B/C gates unmet, three full-Lens meshes and guaranteed resource budget unavailable'
    (ROOT/'benchmark-results'/f's31-{a.profile}-summary.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps({k:v for k,v in result.items() if k in ['A','B','C','D','physicsReferenceStatus']}))


if __name__=='__main__':
    main()
