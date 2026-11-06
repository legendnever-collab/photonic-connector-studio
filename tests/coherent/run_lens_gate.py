"""D2.8-E bounded external-library feasibility gate; NOT a Lens wave solver.

Uses unmodified Diffractio 1.0.0 kernels on homogeneous analytical controls.
An actual Spherical Lens run is deliberately absent after the reference gate
fails. No production Engine, Port, manufacturing or Gaussian gate is changed.
Run after tests/coherentFieldInput.test.ts, in the separate pinned environment.
"""
import copy
import hashlib
import importlib.metadata
import importlib.util
import inspect
import json
import math
import os
from pathlib import Path
import platform
import resource
import shutil
import subprocess
import time

import numpy as np
from diffractio.scalar_fields_XY import WPM_schmidt_kernel, PWD_kernel
from diffractio.utils_math import get_k

ROOT = Path(__file__).resolve().parents[2]
BASE = '7c45d7c07dc7b43dc87598277d2002bf50b7d696'
CHECKS = []


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def check(name, condition, detail=None):
    CHECKS.append({'name': name, 'status': 'PASS' if bool(condition) else 'FAIL', 'detail': detail})


def contract(case):
    p = case['project']
    d = p['model']['prescription']
    faces = d['surfaces'][:2]
    a = next(a for a in d['assemblies'] if a['id'] == faces[0]['assemblyId'])
    body = next(b for b in p['bodies'] if b['assemblyId'] == a['id'])
    return {'schemaVersion': 1, 'baselineSHA': BASE, 'caseID': case['id'], 'units': 'SI',
            'fixedPorts': case['fixedPorts'], 'assembly': a, 'surfaces': faces, 'body': body,
            'manufacturingBounds': case['bounds'], 'values': case['values'],
            'sourceAuthoring': p['authoring']['ports']['source'],
            'targetAuthoring': p['authoring']['ports']['target'],
            'launchM': case['boundary']['launch'], 'exitM': case['boundary']['exit'],
            'inputW': case['boundary']['inputW'], 'inputC': case['boundary']['inputC']}


def fdtd_plan(lengths, dx, duration, complex_fields):
    if len(lengths) not in (2, 3) or any(not math.isfinite(x) or x <= 0 for x in [*lengths, dx, duration]):
        raise ValueError('Positive finite 2D/3D planning dimensions required')
    dimensions = [math.ceil(x/dx) for x in lengths]
    cells = math.prod(dimensions)
    steps = math.ceil(duration/(.5*dx/299792458))
    return {'dimensionsM': lengths, 'dxM': dx, 'gridShape': dimensions, 'cells': cells,
            'assumedDurationS': duration, 'assumedCourant': .5, 'steps': steps,
            'cellUpdates': cells*steps,
            # FAQ: nine E/D/H components plus three REAL permittivity scalars.
            # Only fields become complex; do not double the material arrays.
            'fieldArrayBytesEstimate': cells*9*(16 if complex_fields else 8),
            'diagonalPermittivityBytesEstimate': cells*3*8,
            'componentStorageBytesEstimate': cells*(168 if complex_fields else 96),
            'storageScope': 'FAQ component-count planning estimate extended to all-component cylindrical fields; not measured allocation or a certified cylindrical solver lower bound',
            'complexFields': complex_fields, 'measuredSolverRuntimeS': None,
            'convergenceEstablished': False}


def mesh(n, width):
    x = (np.arange(n)-n/2)*(width/n)
    k = get_k(x, flavour='+')
    return x, k[:, None]**2+k[None, :]**2


def external_controls(wavelength, ng, thickness):
    """Test package phase convention; expose why its scalar u is not physical E.

    Plane/slab controls have no spherical surfaces. The slab starts/ends in air,
    so a local sqrt(n) amplitude conversion cannot fix its missing reflections.
    Neither this discrepancy nor the timing pilot is a spherical Lens error.
    """
    k0, width, distance = 2*np.pi/wavelength, 32*wavelength, 7*wavelength
    rows, slabs = [], []
    for n in (32, 64, 128):
        x, kp2 = mesh(n, width)
        for index in (1., ng):
            for modes in ((0, 0), (3, 4)):
                ky, kz = [2*np.pi*m/width for m in modes]
                u = np.exp(1j*(ky*x[:, None]+kz*x[None, :]))
                v = WPM_schmidt_kernel(u, np.full((n, n), index), k0, kp2, distance)
                expected = u*np.exp(1j*distance*np.sqrt((index*k0)**2-ky**2-kz**2))
                error = float(np.linalg.norm(v-expected)/np.linalg.norm(expected))
                power = float(np.mean(abs(v)**2))
                check(f'external plane wave n={n}, index={index}, modes={modes}: complex phase', error < 1e-11, error)
                check(f'external homogeneous n={n}, index={index}, modes={modes}: L2', abs(power-1) < 1e-12)
                rows.append({'grid': n, 'index': index, 'fourierModes': modes, 'complexRelativeError': error, 'scalarL2Relative': power})
        u = np.ones((n, n), complex)
        v = WPM_schmidt_kernel(u, np.full((n, n), ng), k0, kp2, thickness)
        # Infinite, lossless, UNCOATED, normal-incidence glass slab control.
        # Closed transfer-matrix expression includes coherent multiple returns.
        reflectance = ((ng-1)/(ng+1))**2
        delta = k0*ng*thickness
        t = (1-reflectance)*np.exp(1j*delta)/(1-reflectance*np.exp(2j*delta))
        transmittance = abs(t)**2
        airy = 1/(1+4*reflectance/(1-reflectance)**2*np.sin(delta)**2)
        measured = complex(np.mean(v))
        field_error = abs(measured-t)/abs(t)
        piston_error = abs(abs(measured)-abs(t))/abs(t)
        flux_difference = abs(measured)**2-transmittance
        check(f'slab {n}: transfer matrix versus Airy flux', abs(transmittance-airy) < 1e-13)
        check(f'slab {n}: external WPM matches declared reflection-free propagation', abs(measured-np.exp(1j*delta)) < 1e-11)
        check(f'slab {n}: unresolved physical flux cannot pass 0.5 percent target', flux_difference > .005)
        slabs.append({'grid': n, 'externalScalarAmplitude': [measured.real, measured.imag],
                      'uncoatedSlabAmplitude': [t.real, t.imag], 'externalScalarL2': abs(measured)**2,
                      'physicalSlabNormalFlux': transmittance, 'absoluteFluxDifference': flux_difference,
                      'complexRelativeDifference': field_error, 'pistonOnlyRelativeDifference': piston_error,
                      'singleBareInterfaceReflectance': reflectance,
                      'rawScalarAsElectricFieldInterfaceFlux': ng,
                      'physicalSingleInterfaceNormalFlux': 4*ng/(1+ng)**2,
                      'scope': 'Analytical infinite bare slab CONTROL, not the Spherical Lens or coating specification'})
    check('slab discrepancy persists under transverse refinement', max(r['absoluteFluxDifference'] for r in slabs)-min(r['absoluteFluxDifference'] for r in slabs) < 1e-12)
    # Zero-index-contrast negative control: no Fresnel omission remains.
    check('zero-contrast slab has unit transmission', 4.*1/(1+1)**2 == 1.)
    return {'planeWaves': rows, 'slabs': slabs, 'acceptedAsPhysicalLensReference': False,
            'reason': 'No reflected wave or E/H interface solution. Scalar forward diagnostics remain possible, but are not the requested physical field/normal-flux reference.'}


def timing_pilot(frozen):
    """Eight INDEPENDENT calls per grid on ONE index slice; no Lens propagation.

    Uses the exact cap curvature/outer radius solely to time a two-index kernel.
    There is no claim that this slice specifies the unresolved rim EM boundary.
    """
    ng = frozen['surfaces'][0]['nAfter']
    radius = frozen['surfaces'][0]['radius']
    outer = frozen['body']['outerRadius']
    wavelength = frozen['fixedPorts']['wavelength']
    rows = []
    for n in (128, 256, 512):
        x, kp2 = mesh(n, 512e-6)
        r2 = x[:, None]**2+x[None, :]**2
        sag = radius-np.sqrt(np.maximum(0, radius**2-r2))
        index = np.where((r2 <= outer**2) & (sag <= 10e-6), ng, 1.)
        u = np.exp(-r2/frozen['inputW'][0]**2).astype(complex)
        WPM_schmidt_kernel(u, index, 2*np.pi/wavelength, kp2, .1e-6)  # warmup
        start = time.perf_counter()
        for _ in range(8):
            v = WPM_schmidt_kernel(u, index, 2*np.pi/wavelength, kp2, .1e-6)
        elapsed = time.perf_counter()-start
        check(f'external two-index kernel {n}: finite output', np.isfinite(v).all())
        rows.append({'grid': n, 'windowM': 512e-6, 'dxM': 512e-6/n, 'dzM': .1e-6,
                     'independentCalls': 8, 'elapsedS': elapsed, 'secondsPerCall': elapsed/8,
                     'oneComplex128PlaneBytes': 16*n*n, 'fullLensRuntimeS': None})
    return {'scope': 'Repeated single-slice kernel timing, not full propagation or convergence', 'rows': rows}


def main():
    start = time.perf_counter()
    head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    source = ROOT/'benchmark-results/d28b-input.json'
    data = json.loads(source.read_text())
    check('input checkout matches current checkout', data['gitSHA'] == head)
    check('input PR head matches current CI head', data['headSHA'] == os.getenv('GOLDEN_HEAD_SHA'))
    for path, digest in data['sourceSHA256'].items():
        check(f'input source hash: {path}', sha(ROOT/path) == digest)
    case = next(c for c in data['cases'] if c['id'] == 'plus-23-1')
    frozen_path = ROOT/'tests/benchmark/d28e-single-lens.json'
    frozen = json.loads(frozen_path.read_text())
    check('exact geometry/material/Ports/Mode/planes/bounds lock', contract(case) == frozen)
    check('input unit-power convention', frozen['sourceAuthoring']['normalization'] == 'unit-power')
    check('same circular input and curvature', len(set(frozen['inputW'])) == 1 and len(set(frozen['inputC'])) == 1)
    # Prevent silent substitution of a Quadratic Lens or different input geometry.
    for key, value in [('radius', 1e-3), ('shape', 'plane'), ('nAfter', 1.5), ('aperture', 210e-6)]:
        bad = copy.deepcopy(case)
        bad['project']['model']['prescription']['surfaces'][0][key] = value
        check(f'changed Lens {key} does not match frozen reference', contract(bad) != frozen)
    for key in ('inputW', 'inputC'):
        bad = copy.deepcopy(case)
        bad['boundary'][key][0] *= 1.001
        check(f'changed {key} does not match frozen reference', contract(bad) != frozen)
    bad = copy.deepcopy(case)
    bad['fixedPorts']['targetFrame']['origin']['z'] += 1e-6
    check('moved Port does not match frozen reference', contract(bad) != frozen)
    if any(c['status'] == 'FAIL' for c in CHECKS):
        raise RuntimeError('Stale/mismatched fixture: refusing controls before provenance/contract recovery')
    check('external package pinned', importlib.metadata.version('diffractio') == '1.0.0')
    ng = frozen['surfaces'][0]['nAfter']
    thickness = frozen['surfaces'][1]['frame']['origin']['x']-frozen['surfaces'][0]['frame']['origin']['x']
    wavelength = frozen['fixedPorts']['wavelength']
    controls = external_controls(wavelength, ng, thickness)
    pilot = timing_pilot(frozen)
    # Planning dimensions include 20 um radial and 20 um axial padding per end;
    # their adequacy is UNVALIDATED. Refine PML/domain independently in any run.
    radial = frozen['body']['outerRadius']+20e-6
    axial = frozen['exitM']-frozen['launchM']+40e-6
    planning = []
    for ppw in (10, 20, 40):
        dx = wavelength/(ng*ppw)
        planning.append({'geometry': 'axisymmetric m=+/-1', 'glassPointsPerWavelength': ppw,
                         **fdtd_plan([radial, axial], dx, 10e-12, True)})
    planning.append({'geometry': 'full Cartesian 3D', 'glassPointsPerWavelength': 10,
                     **fdtd_plan([2*radial, 2*radial, axial], wavelength/(ng*10), 10e-12, False)})
    a, b = fdtd_plan([16., 8.], 1., 1e-7, True), fdtd_plan([16., 8.], .5, 1e-7, True)
    check('cylindrical refinement storage scaling', b['cells'] == 4*a['cells'])
    real = fdtd_plan([16., 8.], 1., 1e-7, False)
    check('complex doubles fields only', a['fieldArrayBytesEstimate'] == 2*real['fieldArrayBytesEstimate'])
    check('real dielectric arrays are not doubled', a['diagonalPermittivityBytesEstimate'] == real['diagonalPermittivityBytesEstimate'])
    check('complex component-count estimate is 168 bytes per cell', a['componentStorageBytesEstimate'] == 168*a['cells'])
    check('cylindrical refinement work scaling', abs(b['cellUpdates']/a['cellUpdates']-8) <= 4/a['steps'])
    for invalid in (0., -1., math.inf, math.nan):
        try:
            fdtd_plan([1., 1.], invalid, 1., True)
            check(f'reject invalid mesh spacing {invalid}', False)
        except ValueError:
            check(f'reject invalid mesh spacing {invalid}', True)
    mem = {line.split(':')[0]: int(line.split()[1])*1024 for line in Path('/proc/meminfo').read_text().splitlines()
           if line.startswith(('MemTotal:', 'MemAvailable:'))} if Path('/proc/meminfo').exists() else {}
    files = ['tests/coherent/run_lens_gate.py', 'tests/coherent/requirements-lens-gate.txt',
             'tests/benchmark/d28e-single-lens.json', 'tests/coherentFieldInput.test.ts',
             'src/project/pupilRay.ts', 'src/project/trainPupilBenchmark.ts', 'src/project/geometry.ts',
             '.github/workflows/validate.yml', 'package.json', 'docs/D28E_SPHERICAL_LENS_REFERENCE_GATE.md']
    external_files = {Path(inspect.getfile(f)).name: sha(Path(inspect.getfile(f)))
                      for f in (WPM_schmidt_kernel, PWD_kernel, get_k)}
    report = {'schemaVersion': 1, 'baselineSHA': BASE, 'gitSHA': head,
              'headSHA': os.getenv('GOLDEN_HEAD_SHA'), 'units': 'SI',
              'trackedChanges': subprocess.check_output(['git', 'status', '--porcelain'], cwd=ROOT, text=True).strip(),
              'inputSHA256': sha(source), 'fixtureSHA256': sha(frozen_path),
              'sourceSHA256': {p: sha(ROOT/p) for p in files}, 'externalSourceSHA256': external_files,
              'status': 'PASS' if all(c['status'] == 'PASS' for c in CHECKS) else 'FAIL', 'checks': CHECKS,
              'environment': {'python': platform.python_version(),
                              'versions': {p: importlib.metadata.version(p) for p in ['diffractio', 'numpy', 'scipy']},
                              'cpuAffinity': len(os.sched_getaffinity(0)) if hasattr(os, 'sched_getaffinity') else None,
                              'observedHostMemoryBytes': mem, 'guaranteedJobMemoryBytes': None,
                              'peakRSSKiB': resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
                              'packagesPresent': {p: importlib.util.find_spec(p) is not None for p in ['meep', 'bempp', 'ngsolve', 'gmsh']},
                              'executables': {p: shutil.which(p) for p in ['meep', 'comsol', 'conda', 'micromamba']},
                              'commercialLicense': 'unverified; no commercial solver executable found in this environment'},
              'frozenInput': frozen, 'externalLibraryControls': controls, 'kernelTimingPilot': pilot,
              'fdtdPlanning': planning,
              'referenceGate': {'status': 'Model Insufficient', 'decision': 'Path B',
                                'fullSphericalLensRun': False, 'independentSphericalReferenceAccepted': False,
                                'numericalTargetsOnly': {'fieldRelative': .01, 'fluxAbsoluteRelativeToInput': .005},
                                'reasonCodes': ['SCALAR_WPM_NO_REFLECTION_OR_VECTOR_FLUX',
                                                'RIM_COATING_AND_VECTOR_LAUNCH_NOT_SPECIFIED',
                                                'NO_VALIDATED_AVAILABLE_VECTOR_REFERENCE',
                                                'CYLINDRICAL_REFINEMENT_RESOURCES_UNCONFIRMED']},
              'comparison': {'gaussian': {'scope': 'Existing whole-fold Gaussian validity result; not single-Lens accuracy', 'existingResult': case['gaussian']},
                             'eikonal': {'scope': case['boundary']['scope'],
                                         'radialSamples': len(case['boundary']['rows']),
                                         'omittedSourcePower': case['boundary']['omittedSourcePower'],
                                         'maxJacobianError': case['boundary']['maxJacobianError']},
                             'quadraticControl': 'Preserved D2.8-C analytic control; never the actual spherical Lens',
                             'sphericalWaveReference': {'status': 'Uncomputed', 'complexField': None,
                                                       'normalOpticalFlux': None, 'exitWavefront': None,
                                                       'inputModeProjection': None, 'outputModeProjection': None,
                                                       'complexFieldError': None, 'fluxDifference': None,
                                                       'physicalErrorBound': None},
                             'sphericalConvergence': {'grid': 'Not run', 'window': 'Not run', 'domain': 'Not run', 'referencePlane': 'Not run'},
                             'foldTotalCoupling': None, 'freeLensTotalCoupling': None,
                             'engineAdoptionApproved': False},
              'elapsedS': time.perf_counter()-start}
    out = ROOT/'benchmark-results/d28e-spherical-lens-gate.json'
    out.write_text(json.dumps(report, indent=2, allow_nan=False)+'\n')
    print(json.dumps({'status': report['status'], 'checks': len(CHECKS), 'decision': 'Path B',
                      'bareSlabFluxDifference': controls['slabs'][-1]['absoluteFluxDifference'],
                      'cylindricalStorageEstimatesGiB': [r['componentStorageBytesEstimate']/2**30 for r in planning[:3]],
                      'sphericalLensRun': False, 'output': str(out)}))
    if report['status'] != 'PASS':
        raise SystemExit(1)


if __name__ == '__main__':
    main()
