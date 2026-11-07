"""Bounded no-Lens m=+/-1 actual injection. No claim about the full exit plane.

Launch-only complex source gain is recorded once per mesh, then held fixed at
all propagation planes. No output-plane fitting/piston/defocus correction.
"""
import argparse
import json
import os
from pathlib import Path
import resource
import time
import numpy as np
import meep as mp
from s31_vector_source import radial,power,inner,projection,verify,WL,F
from run_s3_preflight import ROOT,EXPECTED,digest,git

mp.verbosity(0)
COMPONENTS=[mp.Er,mp.Ep,mp.Ez,mp.Hr,mp.Hp,mp.Hz]


def run(resolution,m,disk=150.,window=170.,pml=5.,after=180.,source_spacing=.1):
    if np.sin(np.pi/WL*.3/resolution)/.3 >= 1:
        raise ValueError('Target frequency is outside the propagating 1D Yee band at this resolution; resource pilot only.')
    # z=0 is the frozen launch plane; source=-10 um exactly as S3.
    src_r=np.arange(0,disk+source_spacing/2,source_spacing)
    shape=radial(src_r,-10.,m)
    rnorm=np.linspace(0,220,2201)
    norm=np.sqrt(2*power(radial(rnorm,0,1),rnorm))
    shape/=norm
    pulse=mp.GaussianSource(1/WL,fwidth=.1/WL)
    # Huygens Je=z cross H, Jm=-z cross E; currents are tangential.
    currents=[(mp.Er,-shape[4]),(mp.Ep,shape[3]),(mp.Hr,shape[1]),(mp.Hp,-shape[0])]
    sources=[]
    for component,values in currents:
        def amplitude(p,values=values):
            # Meep amp_func argument is relative to the source center.
            r=p.x+disk/2
            return complex(np.interp(r,src_r,values,left=values[0],right=0))
        sources.append(mp.Source(pulse,component=component,center=mp.Vector3(disk/2,0,-10),
            size=mp.Vector3(disk,0,0),amp_func=amplitude))
    sim=mp.Simulation(cell_size=mp.Vector3(window+10,0,70),dimensions=mp.CYLINDRICAL,m=m,
        resolution=resolution,Courant=.3,boundary_layers=[mp.PML(pml)],sources=sources,force_complex_fields=True)
    planes=[-5.,0.,5.,10.,20.]
    monitors=[sim.add_dft_fields(COMPONENTS,1/WL,0,1,center=mp.Vector3(window/2,0,z),
        size=mp.Vector3(window,0,0),decimation_factor=1) for z in planes]
    fluxes=[sim.add_flux(1/WL,0,1,mp.FluxRegion(center=mp.Vector3(window/2,0,z),size=mp.Vector3(window,0,0)),decimation_factor=1) for z in planes]
    start=time.monotonic();sim.run(until_after_sources=after)
    arrays=[]; refs=[]; coordinates=[]
    for mon,z in zip(monitors,planes):
        field=np.array([sim.get_dft_array(mon,c,0) for c in COMPONENTS])
        dims,lo,hi=sim.get_array_slice_dimensions(center=mp.Vector3(window/2,0,z),size=mp.Vector3(window,0,0))
        assert field.shape[1:]==dims
        r=np.linspace(lo.x,hi.x,dims[0])
        assert np.all(r>=0) and np.max(abs(np.diff(r)-1/resolution))<1e-9
        coordinates.append(r);arrays.append(field);refs.append(radial(r,z,m)/norm)
    # A single source calibration at frozen launch, shared by E/H and every plane.
    r=coordinates[1]; ref=refs[1]; measured=arrays[1]
    electric_gain=inner(ref[:3],measured[:3],r)/inner(ref[:3],ref[:3],r)
    # Meep complex DFT flux is Re(E x H*), while SI harmonic power has 1/2.
    # This is INPUT calibration, not independent evidence of power accuracy.
    gain=np.exp(1j*np.angle(electric_gain))*np.sqrt(mp.get_fluxes(fluxes[1])[0]/(2*power(ref,r)))
    rows=[]
    for z,r,raw,reference,flux in zip(planes,coordinates,arrays,refs,fluxes):
        calibrated=raw/gain
        p=power(calibrated,r);pref=power(reference,r)
        api_power=mp.get_fluxes(flux)[0]/(2*abs(gain)**2)
        eerr=np.sqrt(abs(inner(calibrated[:3]-reference[:3],calibrated[:3]-reference[:3],r)/inner(reference[:3],reference[:3],r)))
        herr=np.sqrt(abs(inner(calibrated[3:]-reference[3:],calibrated[3:]-reference[3:],r)/inner(reference[3:],reference[3:],r)))
        a=projection(calibrated,reference,r)
        rows.append(dict(zFromLaunchUm=z,globalXM=F['launchM']+z*1e-6,complexEError=float(eerr),complexHError=float(herr),
            powerPerHarmonicW=api_power,centeredFieldPowerPerHarmonicW=p,expectedPowerPerHarmonicW=pref,
            fluxErrorRelativeInput=2*abs(api_power-pref),centeredFieldVsFluxRelativeInput=2*abs(api_power-p),
            modeAmplitude=[float(a.real),float(a.imag)],modePowerRelativeInput=float(abs(a)**2*2*pref),
            rawMeepFlux=mp.get_fluxes(flux)[0],rawIntegratedPoynting=power(raw,r),
            withinTargets=bool(eerr<.01 and herr<.01 and 2*abs(api_power-pref)<.005 and 2*abs(api_power-p)<.005)))
    path=ROOT/'benchmark-results'/f's31-gaussian-r{resolution:g}-m{m:+d}-d{disk:g}-w{window:g}-p{pml:g}-t{after:g}-s{source_spacing:g}.npz'
    np.savez_compressed(path,rUm=coordinates[0],planesUm=planes,raw=np.array(arrays),reference=np.array(refs),sourceGain=gain)
    result=dict(m=m,resolutionPerUm=resolution,sourceDiskUm=disk,windowUm=window,pmlUm=pml,afterSources=after,
        sourceSamplingUm=source_spacing,sourceGain=[float(gain.real),float(gain.imag)],
        electricProjectionGain=[float(electric_gain.real),float(electric_gain.imag)],
        gainPolicy='launch flux sets input amplitude, E projection sets input phase; common to E/H and every plane; launch flux=1 W by construction is NOT validation; linear rescaling, not a second run',
        fieldArtifact=str(path.relative_to(ROOT)),fieldArtifactSHA256=digest(path),rows=rows,
        elapsedS=time.monotonic()-start,peakRSSKiB=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss)
    sim.reset_meep();return result


def main():
    p=argparse.ArgumentParser();p.add_argument('--resolution',type=float,default=2.)
    p.add_argument('--disk',type=float,default=150.);p.add_argument('--window',type=float,default=170.)
    p.add_argument('--pml',type=float,default=5.);p.add_argument('--after',type=float,default=180.)
    p.add_argument('--source-spacing',type=float,default=.1);p.add_argument('--name',required=True)
    p.add_argument('--reference-only',action='store_true');a=p.parse_args()
    check=verify();assert check['passed'],check
    rows=[] if a.reference_only else [run(a.resolution,m,a.disk,a.window,a.pml,a.after,a.source_spacing) for m in [1,-1]]
    report=dict(schemaVersion=1,gitSHA=git('rev-parse','HEAD'),headSHA=os.getenv('GOLDEN_HEAD_SHA'),fixtureSHA256=EXPECTED,
        adapterSHA256=digest(Path(__file__)),sourceAdapterSHA256=digest(Path(__file__).with_name('s31_vector_source.py')),
        environmentLockSHA256=digest(ROOT/'tests/coherent/s3/meep-linux-64-explicit.txt'),meepVersion=mp.__version__,
        referenceVerification=check,runs=rows,harnessStatus='completed',
        twoPolarizations='Y and Z reconstructed by linear superposition of the two actual m runs; separate rotated-source rerun not performed',
        sourceCalibrationStatus='partial-short-domain' if rows else 'reference-only',
        fullFrozenExitPlanes='not-run',physicsReferenceStatus='uncomputed',lensField=None,lensFlux=None,lensModeProjection=None)
    out=ROOT/'benchmark-results'/('s31-'+a.name+'.json');out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(report,indent=2)+'\n');print(out)


if __name__=='__main__':
    main()
