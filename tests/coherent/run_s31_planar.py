"""S3.1 bounded planar audit. Continuous Maxwell is the acceptance reference.

Discrete dispersion predictions are diagnostics, NEVER corrected acceptance data.
All lengths below are um; E/H use Meep's dimensionless impedance convention.
"""
import argparse
import json
import math
import os
from pathlib import Path
import resource
import time
import numpy as np
import meep as mp
from run_s3_preflight import ROOT, FIXTURE, EXPECTED, digest, git

mp.verbosity(0)
F = json.loads(FIXTURE.read_text())
assert digest(FIXTURE) == EXPECTED
N = F['surfaces'][0]['nAfter']
WL = F['fixedPorts']['wavelength'] * 1e6
FREQ = 1 / WL
K0 = 2 * np.pi / WL


def pair(z):
    return [float(np.real(z)), float(np.imag(z))]


def numerical_k(n, resolution, courant=.5):
    # sin(omega dt/2) = (Courant/n) sin(k dz/2), dt=Courant*dz.
    return 2 * resolution * np.arcsin(n / courant * np.sin(np.pi * FREQ * courant / resolution))


def analytic(kind, thickness, right, shift=0, k_air=K0, k_glass=K0*N):
    r = (N-1)/(N+1)
    if kind == 'interface':
        e = 2/(1+N) * np.exp(1j*(k_glass-k_air)*(right-shift))
        return e, N*e, 1-r*r, r*r
    delta = k_glass * thickness
    t = (1-r*r)*np.exp(1j*delta)/(1-r*r*np.exp(2j*delta))
    e = t*np.exp(-1j*k_air*thickness)
    return e, e, abs(t)**2, 1-abs(t)**2


def simulate(resolution, kind, thickness=300., pml=4., padding=0.,
             shift=0., averaging=True, settling=4., fwidth=.1, incident=None):
    half = thickness/2+12
    size = 2*(half+padding)
    source_z, left_z, right_z = -half+6, -half+8, half-6
    geometry = []
    if kind == 'slab':
        geometry = [mp.Block(center=mp.Vector3(z=shift), size=mp.Vector3(mp.inf,mp.inf,thickness), material=mp.Medium(index=N))]
    elif kind == 'interface':
        geometry = [mp.Block(center=mp.Vector3(z=(shift+size/2)/2), size=mp.Vector3(mp.inf,mp.inf,size/2-shift), material=mp.Medium(index=N))]
    sim = mp.Simulation(cell_size=mp.Vector3(z=size), dimensions=1, resolution=resolution,
        boundary_layers=[mp.PML(pml)], geometry=geometry, eps_averaging=averaging,
        sources=[mp.Source(mp.GaussianSource(FREQ,fwidth=fwidth*FREQ),component=mp.Ex,center=mp.Vector3(z=source_z))])
    dft = sim.add_dft_fields([mp.Ex,mp.Hy],FREQ,0,1,center=mp.Vector3(z=right_z),size=mp.Vector3(),decimation_factor=1)
    span = sim.add_dft_fields([mp.Ex,mp.Hy],FREQ,0,1,center=mp.Vector3(z=right_z),size=mp.Vector3(z=4/resolution),decimation_factor=1)
    left = sim.add_flux(FREQ,0,1,mp.FluxRegion(center=mp.Vector3(z=left_z)),decimation_factor=1)
    right = sim.add_flux(FREQ,0,1,mp.FluxRegion(center=mp.Vector3(z=right_z)),decimation_factor=1)
    sub = sim.add_flux(FREQ,0,1,mp.FluxRegion(center=mp.Vector3(z=left_z)),decimation_factor=1)
    if incident is not None:
        sim.load_minus_flux_data(sub,incident)
    start = time.monotonic()
    sim.run(until_after_sources=settling*N*size)
    point_e = complex(np.asarray(sim.get_dft_array(dft,mp.Ex,0)).item())
    point_h = complex(np.asarray(sim.get_dft_array(dft,mp.Hy,0)).item())
    span_z = sim.get_array_metadata(dft_cell=span)[2]
    e,h = [complex(np.interp(right_z,span_z,sim.get_dft_array(span,c,0))) for c in [mp.Ex,mp.Hy]]
    # Persist actual sampled dielectric and coordinates near the physical boundaries.
    profiles = []
    for boundary in ([shift] if kind=='interface' else [shift-thickness/2,shift+thickness/2] if kind=='slab' else []):
        c,s=mp.Vector3(z=boundary),mp.Vector3(z=4/resolution)
        eps=sim.get_array(center=c,size=s,component=mp.Dielectric)
        coords=sim.get_array_metadata(center=c,size=s)[2]
        profiles.append({'boundaryUm':boundary,'zUm':coords.tolist(),'epsilon':eps.tolist()})
    result = dict(E=pair(e),H=pair(h),leftFlux=mp.get_fluxes(left)[0],rightFlux=mp.get_fluxes(right)[0],
        subtractedLeftFlux=mp.get_fluxes(sub)[0],timeUnits=sim.meep_time(),elapsedS=time.monotonic()-start,
        sourceZUm=source_z,leftZUm=left_z,rightZUm=right_z,requestedCellUm=size,
        actualCellUm=float(sim.fields.total_volume().in_direction(mp.Z)),
        dftZUm=sim.get_array_metadata(dft_cell=dft)[2].tolist(),finiteSpanZUm=span_z.tolist(),
        directPointE=pair(point_e),directPointH=pair(point_h),
        pointVsSpanRelative=abs(e-point_e)/max(abs(e),1e-30),materialProfiles=profiles)
    data=sim.get_flux_data(left) if kind=='vacuum' else None
    sim.reset_meep()
    return result,data


def boundary_case(points, **options):
    resolution = points*N/WL
    vacuum,incident = simulate(resolution,'vacuum',**options)
    if abs(complex(*vacuum['E']))<1e-20 or abs(vacuum['rightFlux'])<1e-30:
        return [dict(kind='invalid-incident-reference',points=points,resolutionPerUm=resolution,
            options=options,withinTargets=False,reason='Incident pulse has not reached transmission monitor; ratios undefined',vacuum=vacuum)]
    rows=[]
    for kind in ['interface','slab']:
        raw,_=simulate(resolution,kind,incident=incident,**options)
        e=complex(*raw['E'])/complex(*vacuum['E'])
        h=complex(*raw['H'])/complex(*vacuum['H'])
        t=raw['rightFlux']/vacuum['rightFlux']
        r=-raw['subtractedLeftFlux']/vacuum['leftFlux']
        r_net=1-raw['leftFlux']/vacuum['leftFlux']
        args=(kind,options.get('thickness',300.),raw['rightZUm'],options.get('shift',0.))
        er,hr,tr,rr=analytic(*args)
        ed,hd,td,rd=analytic(*args,k_air=numerical_k(1,resolution),k_glass=numerical_k(N,resolution))
        errors=dict(complexE=abs(e-er)/abs(er),complexH=abs(h-hr)/abs(hr),flux=abs(t-tr),reflection=abs(r-rr),balance=abs(1-r-t))
        rows.append(dict(kind=kind,points=points,resolutionPerUm=resolution,options=options,
            relativeE=pair(e),relativeH=pair(h),expectedE=pair(er),expectedH=pair(hr),T=t,R=r,Rnet=r_net,
            expectedT=tr,expectedR=rr,errors=errors,subtractionVsNet=abs(r-r_net),
            diagnosticDiscretePrediction=dict(E=pair(ed),T=td,complexResidual=abs(e-ed)/abs(ed),fluxResidual=abs(t-td)),
            withinTargets=bool(errors['complexE']<.01 and errors['complexH']<.01 and errors['flux']<.005 and errors['reflection']<.005 and errors['balance']<.005),
            raw=raw,vacuum=vacuum))
    return rows


def homogeneous(points,n):
    resolution=points*N/WL
    sim=mp.Simulation(cell_size=mp.Vector3(z=324),dimensions=1,resolution=resolution,
        default_material=mp.Medium(index=n),boundary_layers=[mp.PML(4)],
        sources=[mp.Source(mp.GaussianSource(FREQ,fwidth=.1*FREQ),component=mp.Ex,center=mp.Vector3(z=-156))])
    dft=sim.add_dft_fields([mp.Ex,mp.Hy],FREQ,0,1,center=mp.Vector3(),size=mp.Vector3(z=300),decimation_factor=1)
    sim.run(until_after_sources=4*N*324)
    z=sim.get_array_metadata(dft_cell=dft)[2]
    e=sim.get_dft_array(dft,mp.Ex,0)
    h=sim.get_dft_array(dft,mp.Hy,0)
    phase=np.unwrap(np.angle(e))
    k=numerical_k(n,resolution)
    rows=[]
    for length in [1.,10.,100.,299.]:
        j=int(np.argmin(abs(z-z[0]-length)))
        distance=float(z[j]-z[0]); value=e[j]/e[0]
        rows.append(dict(requestedDistanceUm=length,actualDistanceUm=distance,relativeE=pair(value),
            unwrappedPhase=float(phase[j]-phase[0]),continuousPhase=K0*n*distance,discretePhase=float(k*distance),
            continuousComplexError=float(abs(value-np.exp(1j*K0*n*distance))),
            discreteComplexError=float(abs(value-np.exp(1j*k*distance)))))
    result=dict(points=points,index=n,dispersionKPerUm=float(k),continuousKPerUm=float(n*K0),
        measuredPhaseSlopePerUm=float(np.polyfit(z,phase,1)[0]),
        impedanceRelativeError=float(np.linalg.norm(h-n*e)/np.linalg.norm(n*e)),distances=rows)
    sim.reset_meep()
    return result


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--suite',choices=['homogeneous','boundary'],required=True)
    parser.add_argument('--points',type=float,nargs='+',default=[10,20,40])
    parser.add_argument('--thickness',type=float,default=300.)
    parser.add_argument('--pml',type=float,default=4.)
    parser.add_argument('--padding',type=float,default=0.)
    parser.add_argument('--settling',type=float,default=4.)
    parser.add_argument('--shift-cells',type=float,default=0.)
    parser.add_argument('--no-averaging',action='store_true')
    parser.add_argument('--fwidth',type=float,default=.1)
    parser.add_argument('--name',required=True)
    a=parser.parse_args(); start=time.monotonic(); rows=[]
    for points in a.points:
        if a.suite=='homogeneous':
            rows.extend(homogeneous(points,n) for n in [1.,N])
        else:
            rows.extend(boundary_case(points,thickness=a.thickness,pml=a.pml,padding=a.padding,
                settling=a.settling,shift=a.shift_cells/(points*N/WL),averaging=not a.no_averaging,fwidth=a.fwidth))
    report=dict(schemaVersion=1,gitSHA=git('rev-parse','HEAD'),headSHA=os.getenv('GOLDEN_HEAD_SHA'),
        fixtureSHA256=EXPECTED,adapterSHA256=digest(Path(__file__)),
        environmentLockSHA256=digest(ROOT/'tests/coherent/s3/meep-linux-64-explicit.txt'),meepVersion=mp.__version__,
        parameters=vars(a),rows=rows,elapsedS=time.monotonic()-start,peakRSSKiB=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
        convention='exp(-i omega t), +z forward, Ex/Hy positive; global (X,Y,Z)=(z,x,y)',
        norm='complex E and H divided by same-plane vacuum component; |test-ref|/|ref|, no piston or amplitude fit',
        fluxNorm='T=right/material over right/vacuum; R=-incident-subtracted left over left/vacuum',
        numericalTargets=dict(field=.01,flux=.005),harnessStatus='completed',physicsReferenceStatus='uncomputed',lensField=None)
    out=ROOT/'benchmark-results'/('s31-'+a.name+'.json');out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(dict(output=str(out),rows=len(rows),elapsedS=report['elapsedS'])))


if __name__=='__main__':
    main()
