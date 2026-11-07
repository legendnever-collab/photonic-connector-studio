"""Bounded external Meep controls and full-size allocation/timestep pilot.

Lens pilot uses an arbitrary dipole and never exports optical Lens metrics.
"""
import json
import math
import os
from pathlib import Path
import resource
import subprocess
import sys
import time
import numpy as np
import meep as mp
from run_s3_preflight import FIXTURE, EXPECTED, ROOT, digest, git

mp.verbosity(0)
f = json.loads(FIXTURE.read_text())
assert digest(FIXTURE) == EXPECTED
wavelength = f['fixedPorts']['wavelength']*1e6
frequency = 1/wavelength
index = f['surfaces'][0]['nAfter']
thickness = f['surfaces'][1]['frame']['origin']['x']*1e6


def planar(resolution, kind):
    size = thickness+24
    component = mp.Ex
    geometry = []
    if kind == 'slab':
        geometry = [mp.Block(size=mp.Vector3(mp.inf, mp.inf, thickness), material=mp.Medium(index=index))]
    elif kind == 'interface':
        geometry = [mp.Block(center=mp.Vector3(z=size/4), size=mp.Vector3(mp.inf,mp.inf,size/2), material=mp.Medium(index=index))]
    sim = mp.Simulation(cell_size=mp.Vector3(z=size), dimensions=1, resolution=resolution,
        boundary_layers=[mp.PML(4)], geometry=geometry,
        sources=[mp.Source(mp.GaussianSource(frequency, fwidth=.1*frequency), component=component,
                           center=mp.Vector3(z=-size/2+6))])
    monitor = sim.add_dft_fields([component,mp.Hy], frequency,0,1,
                                 center=mp.Vector3(z=size/2-6),size=mp.Vector3())
    left = sim.add_flux(frequency,0,1,mp.FluxRegion(center=mp.Vector3(z=-size/2+8)))
    right = sim.add_flux(frequency,0,1,mp.FluxRegion(center=mp.Vector3(z=size/2-6)))
    # Fixed duration is itself unvalidated. A second duration is required before
    # declaring settling or physical reference convergence.
    sim.run(until_after_sources=4*index*size)
    field = complex(np.asarray(sim.get_dft_array(monitor, component,0)).item())
    magnetic = complex(np.asarray(sim.get_dft_array(monitor,mp.Hy,0)).item())
    result = {'E':[field.real,field.imag], 'H':[magnetic.real,magnetic.imag],
              'leftFlux':mp.get_fluxes(left)[0], 'rightFlux':mp.get_fluxes(right)[0],
              'timeUnits':sim.meep_time()}
    sim.reset_meep()
    return result


def controls():
    rows=[]
    R=((index-1)/(index+1))**2
    delta=2*math.pi*index*thickness/wavelength
    slab_t=(1-R)*np.exp(1j*delta)/(1-R*np.exp(2j*delta))
    for points in [10,20,40]:
        for polarization in ['X']:
            resolution=points*index/wavelength
            raw={kind:planar(resolution,kind) for kind in ['vacuum','interface','slab']}
            vacuum=raw['vacuum']
            for kind in ['interface','slab']:
                row=raw[kind]
                T=row['rightFlux']/vacuum['rightFlux']
                reflected=1-row['leftFlux']/vacuum['leftFlux']
                expectedT=1-R if kind=='interface' else abs(slab_t)**2
                # Relative E at the fixed output plane removes the vacuum path.
                E=complex(*row['E'])/complex(*vacuum['E'])
                glassLength=(thickness+24)/2-6 if kind=='interface' else thickness
                expectedE=(2/(1+index)*np.exp(2j*np.pi*(index-1)*glassLength/wavelength)
                           if kind=='interface' else slab_t*np.exp(-2j*np.pi*thickness/wavelength))
                rows.append({'glassPointsPerWavelength':points,'polarization':polarization,'kind':kind,
                    'resolutionPerUm':resolution,'T':T,'R':reflected,'expectedT':expectedT,
                    'fluxError':abs(T-expectedT),'balanceError':abs(1-T-reflected),
                    'relativeE':[E.real,E.imag],'expectedRelativeE':[expectedE.real,expectedE.imag],
                    'complexRelativeError':abs(E-expectedE)/abs(expectedE),
                    'status':'within-proposed-targets' if abs(T-expectedT)<.005 and abs(E-expectedE)/abs(expectedE)<.01 else 'unresolved',
                    'raw':raw,'settlingValidated':False})
    return rows


def pilot(resolution):
    radius=f['surfaces'][0]['radius']*1e6
    outer=f['body']['outerRadius']*1e6
    front=f['assembly']['frame']['origin']['x']*1e6
    launch,exit_plane=f['launchM']*1e6,f['exitM']*1e6
    center=(launch+exit_plane)/2
    glass=mp.Medium(index=index)
    def material(p):
        if p.x>outer:return mp.air
        sag=radius-math.sqrt(radius**2-p.x**2)
        return glass if front+sag<=p.z+center<=front+thickness-sag else mp.air
    start=time.monotonic()
    sim=mp.Simulation(cell_size=mp.Vector3(outer+20,0,exit_plane-launch+40),dimensions=mp.CYLINDRICAL,
        m=1,resolution=resolution,Courant=.3,boundary_layers=[mp.PML(5)],material_function=material,
        eps_averaging=False,sources=[mp.Source(mp.GaussianSource(frequency,fwidth=.1*frequency),component=mp.Er,
                                             center=mp.Vector3(1,0,launch-center))])
    sim.init_sim()
    initialized=time.monotonic()
    sim.run(until=20*.3/resolution)
    end=time.monotonic()
    return {'resolutionPerUm':resolution,'initializationS':initialized-start,'stepCount':sim.fields.t,
            'timestepElapsedS':end-initialized,'peakRSSKiB':resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
            'scope':'Full-size frozen Lens geometry, unvalidated m=1 dipole, 20 steps; allocation/timing only',
            'epsilonAveraging':False,'fieldConverged':False,'lensField':None,'lensFlux':None,'lensModeProjection':None}


if __name__=='__main__':
    if len(sys.argv)>1:
        print('S3_PILOT='+json.dumps(pilot(float(sys.argv[1]))))
    else:
        start=time.monotonic()
        rows=controls()
        pilots=[]
        for row in rows:
            assert all(math.isfinite(row[key]) for key in ['T','R','fluxError','complexRelativeError','balanceError'])
        for resolution in [2,4]:
            result=subprocess.run([sys.executable,__file__,str(resolution)],capture_output=True,text=True,timeout=180)
            if result.returncode:raise RuntimeError(result.stderr)
            pilots.append(json.loads(next(s.split('=',1)[1] for s in result.stdout.splitlines() if s.startswith('S3_PILOT='))))
        report={'gitSHA':git('rev-parse','HEAD'),'headSHA':os.getenv('GOLDEN_HEAD_SHA'),
            'fixtureSHA256':EXPECTED,'adapterSHA256':digest(Path(__file__)),'meepVersion':mp.__version__,
            'elapsedS':time.monotonic()-start,'planarControls':rows,'resourcePilots':pilots,
            'environmentLockSHA256':digest(ROOT/'tests/coherent/s3/meep-linux-64-explicit.txt'),
            'contractAdapterSHA256':digest(ROOT/'tests/coherent/run_s3_preflight.py'),
            'decision':'controls-and-resource-gate-unresolved',
            'controlCoverage':{'planned':6,'executed':len(rows),'polarizationsTested':['Global Y mapped to Meep Ex'],
                'gaussianPolarizationsTested':0,'independentPMLOrSettlingStudies':0},
            'numericalTargets':{'complexFieldRelative':.01,'fluxRelativeIncident':.005},
            'noLensGaussianCalibration':'not-run','sourceCompletionValidation':'not-run',
            'lensConvergence':'not-run','physicsReferenceStatus':'uncomputed','lensField':None,'lensFlux':None,'lensModeProjection':None}
        (ROOT/'benchmark-results/s3-meep-controls.json').write_text(json.dumps(report,indent=2)+'\n')
        print(json.dumps({'planarRows':len(rows),'maxFluxError':max(r['fluxError'] for r in rows),
                          'maxFieldError':max(r['complexRelativeError'] for r in rows),'pilots':pilots}))
