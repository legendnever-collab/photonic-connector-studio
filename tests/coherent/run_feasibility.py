"""D2.8-D: small analytical Maxwell boundary controls and resource arithmetic.

Standard library only. This is NOT a Maxwell spatial discretization, finite
mirror simulation, throughput benchmark, coating fit, or candidate qualifier.
Run after the Golden / finite-beam / developmentPath Vitest exporters.
"""
import cmath
import hashlib
import importlib.util
import json
import math
import os
from pathlib import Path
import platform
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[2]
BASE = 'f39c24ca1fb3ea07e55332ecbb6113ac80d4a89a'
CHECKS = []


def check(name, condition):
    CHECKS.append({'name': name, 'status': 'PASS' if condition else 'FAIL'})


def cross(a, b):
    return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]


def boundary_control(n1, n2, degrees, polarization):
    """Solve tangential vector E,H continuity; compare to closed-form Fresnel.

    exp(-i omega t), interface z=0, incidence toward +z; reflected TM basis
    retains positive tangential E_x, so its r has opposite sign to the common
    reflected right-handed p basis. n=1.5 below is a hypothetical lossless
    dielectric control, NOT a measured coating, glass, or backing parameter.
    """
    s, c = math.sin(math.radians(degrees)), math.cos(math.radians(degrees))
    st, ct = n1/n2*s, cmath.sqrt(1-(n1/n2*s)**2)
    ki, kr, kt = [s, 0, c], [s, 0, -c], [st, 0, ct]
    if polarization == 'TE':
        ei = er = et = [0, 1, 0]
        e_axis, h_axis = 1, 0
        rf = (n1*c-n2*ct)/(n1*c+n2*ct)
        tf = 2*n1*c/(n1*c+n2*ct)
    else:
        ei, er, et = [c, 0, -s], [c, 0, s], [ct, 0, -st]
        e_axis, h_axis = 0, 1
        rf = (n1*ct-n2*c)/(n1*ct+n2*c)
        tf = 2*n1*c/(n1*ct+n2*c)
    hi, hr, ht = [[n*v for v in cross(k, e)] for n, k, e in [(n1, ki, ei), (n1, kr, er), (n2, kt, et)]]
    # 2x2 system, independently assembled from vector tangential continuity.
    a, b, c0, d = er[e_axis], -et[e_axis], hr[h_axis], -ht[h_axis]
    u, v = -ei[e_axis], -hi[h_axis]
    determinant = a*d-b*c0
    r, t = (u*d-b*v)/determinant, (a*v-u*c0)/determinant
    residual = max(abs(ei[e_axis]+r*er[e_axis]-t*et[e_axis]),
                   abs(hi[h_axis]+r*hr[h_axis]-t*ht[h_axis]))
    reflectance, transmittance = abs(r)**2, (n2*ct).real/(n1*ki[2])*abs(t)**2
    pec_r = -ei[e_axis]/er[e_axis]
    check(f'{n1}/{n2}/{degrees}/{polarization}: vector BC versus Fresnel', max(abs(r-rf), abs(t-tf), residual) < 2e-14)
    check(f'{n1}/{n2}/{degrees}/{polarization}: normal Poynting flux', abs(reflectance+transmittance-1) < 2e-14)
    check(f'{n1}/{n2}/{degrees}/{polarization}: ideal PEC boundary', abs(ei[e_axis]+pec_r*er[e_axis]) < 1e-14 and abs(pec_r)**2 == 1)
    return {'nIncident': n1, 'nTransmitted': n2, 'angleFromNormalDegrees': degrees,
            'polarization': polarization, 'r': [r.real, r.imag], 't': [t.real, t.imag],
            'R': reflectance, 'T': transmittance, 'boundaryResidual': residual,
            'pecR': 1, 'scope': 'Infinite plane; hypothetical lossless dielectric / PEC controls only'}


def fdtd_cost(box, dx, duration):
    if len(box) != 3 or any(not math.isfinite(v) or v <= 0 for v in (*box, dx, duration)):
        raise ValueError('Positive finite SI dimensions, dx and duration required')
    dimensions = [math.ceil(v/dx) for v in box]
    cells = math.prod(dimensions)
    dt = .5*dx/299792458
    steps = math.ceil(duration/dt)
    return {'boxM': box, 'dxM': dx, 'assumedDurationS': duration, 'courant': .5,
            'gridDimensions': dimensions, 'cells': cells, 'dtS': dt, 'steps': steps,
            'cellUpdates': cells*steps, 'emptyRealFieldMemoryBytesLowerBound': 96*cells,
            'measuredRuntimeS': None, 'convergenceEstablished': False}


def main():
    controls = [boundary_control(n1, n2, angle, pol)
                for n1, n2, angles in [(1, 1.5, [0, 45, math.degrees(math.atan(1.5)), 78.5]), (1.5, 1, [60])]
                for angle in angles for pol in ['TE', 'TM']]
    check('Brewster control', next(r for r in controls if r['nIncident'] == 1 and r['polarization'] == 'TM' and abs(r['angleFromNormalDegrees']-56.309932474)<1e-6)['R'] < 1e-28)
    check('TIR complex reflection and zero transmitted normal flux', all(abs(r['R']-1)<1e-14 and abs(r['T'])<1e-14 and abs(r['r'][1])>.1 for r in controls if r['nIncident']==1.5))
    wavelength = 1.31e-6
    costs = []
    # Planning boxes include unspecified numerical buffers. No claim that their
    # PML/beam truncation is converged; no coating layers or skin depth resolved.
    for name, box, duration in [('single-mirror', [500e-6,500e-6,100e-6], 5e-12),
                                ('mirror-pair', [600e-6,500e-6,150e-6], 5e-12),
                                ('full-relay', [10200e-6,600e-6,600e-6], 100e-12)]:
        for ppw in [10, 20]:
            costs.append({'name': name, 'airPointsPerWavelength': ppw, **fdtd_cost(box,wavelength/ppw,duration)})
    a, b = fdtd_cost([16.,8.,4.],1.,1e-7), fdtd_cost([16.,8.,4.],.5,1e-7)
    check('3D spatial refinement memory factor 8', b['cells']==8*a['cells'])
    check('Courant refinement work approximately factor 16', abs(b['cellUpdates']/a['cellUpdates']-16) <= 8/a['steps'])
    for bad in [0, -1, math.inf, math.nan]:
        try:
            fdtd_cost([1.,1.,1.],bad,1.)
            check(f'invalid cell size {bad}',False)
        except ValueError:
            check(f'invalid cell size {bad}',True)
    radius, thickness = 220e-6, 20e-6
    area = 2*math.pi*radius**2+2*math.pi*radius*thickness
    bem = []
    for ppw in [6, 10]:
        h = wavelength/ppw
        triangles = math.ceil(area/(math.sqrt(3)*h*h/4))
        unknowns = math.ceil(1.5*triangles)
        bem.append({'edgeLengthM': h, 'trianglesEstimate': triangles, 'rwgUnknownsEstimate': unknowns,
                    'oneDenseComplex128MatrixBytes': 16*unknowns**2,
                    'scope': 'Uniform equilateral-triangle planning estimate, closed PEC cylinder; not an assembled mesh or FMM estimate'})
    evidence = {}
    for filename in ['golden-001.json','d28a-finite-beam.json','d28d-topology.json']:
        path = ROOT/'benchmark-results'/filename
        data = json.loads(path.read_text())
        check(f'{filename}: benchmark PASS', data['status']=='PASS')
        check(f'{filename}: same checkout', data['gitSHA']==subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip())
        head = (data.get('ci') or {}).get('headSHA') if filename=='golden-001.json' else data.get('headSHA')
        check(f'{filename}: same PR head', head==os.getenv('GOLDEN_HEAD_SHA'))
        for source, sha in data.get('sourceSHA256', {}).items():
            check(f'{filename}: source {source}', hashlib.sha256((ROOT/source).read_bytes()).hexdigest()==sha)
        if filename=='golden-001.json':
            files=['tests/goldenBenchmark.test.ts','tests/benchmark/fixture.ts','tests/benchmark/rayOracle.ts','tests/benchmark/modeOracle.ts','tests/prismFixtures.ts']
            payload=json.dumps([{'path':p,'content':(ROOT/p).read_text()} for p in files],ensure_ascii=False,separators=(',',':')).encode()
            check('Golden harness hash matches unchanged sources',hashlib.sha256(payload).hexdigest()==data['harnessSHA256'])
        evidence[filename]={'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'gitSHA':data['gitSHA'],'headSHA':head,
                            'harnessSHA256':data.get('harnessSHA256')}
    # Refuse to report clean provenance when benchmark source was edited later.
    source_files = ['tests/coherent/run_feasibility.py','tests/developmentPath.test.ts']
    mem = {}
    if Path('/proc/meminfo').exists():
        mem = {line.split(':')[0]:int(line.split()[1])*1024 for line in Path('/proc/meminfo').read_text().splitlines() if line.startswith(('MemTotal:','MemAvailable:'))}
    environment = {'python':platform.python_version(), 'cpuAffinityCount':len(os.sched_getaffinity(0)) if hasattr(os,'sched_getaffinity') else None,
       'observedHostMemoryBytes':mem,'guaranteedJobMemoryBytes':None,
       'pythonPackages':{p:importlib.util.find_spec(p) is not None for p in ['meep','bempp','ngsolve','gmsh']},
       'solverExecutables':{p:shutil.which(p) for p in ['meep','gmsh','GetDP','ElmerSolver']},
       'commercialLicenseAvailability':'not assessed'}
    report = {'schemaVersion':1,'baselineSHA':BASE,'gitSHA':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),
      'headSHA':os.getenv('GOLDEN_HEAD_SHA'),'sourceSHA256':{p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in source_files},
      'units':'SI','status':'PASS' if all(c['status']=='PASS' for c in CHECKS) else 'FAIL','checks':CHECKS,'evidence':evidence,
      'environment':environment,'planarMaxwellControls':controls,'fdtdPlanning':costs,'bemPlanning':bem,
      'finiteMirrorMaxwellRun':False,'realCoatingParameters':None,'actualFoldTotalCoupling':None,
      'decision':'Option 3: validate the common spherical Lens field boundary first; preserve optional external Mirror validation and separately approved topology changes',
      'scope':'Boundary algebra and resource estimates only; no large solver allocated, no hardware runtime prediction, no physical candidate qualification'}
    (ROOT/'benchmark-results/d28d-feasibility.json').write_text(json.dumps(report,indent=2,allow_nan=False)+'\n')
    print(json.dumps({'status':report['status'],'checks':len(CHECKS),'failed':[c for c in CHECKS if c['status']=='FAIL']}))
    if report['status']!='PASS':
        raise SystemExit(1)


if __name__ == '__main__':
    main()
