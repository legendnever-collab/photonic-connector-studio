"""Export the frozen S3 external-execution contract and probe a local PyMeep import.

This preflight never upgrades an import or contract check into a Physics PASS.
No solver is installed by this script. Missing/failed imports are recorded.
"""
import hashlib
import json
import math
import os
from pathlib import Path
import platform
import resource
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[2]
FIXTURE = ROOT / 'tests/benchmark/d28e-single-lens.json'
EXPECTED = 'ff97f32f92cf9e17200b1e09fb7f1f5349990b63fd82d919579b77b647f42f95'


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT, text=True).strip()


def probe(python):
    command = [python, '-c', 'import meep as mp; print("S3_MEEP_VERSION=" + mp.__version__)']
    start = time.monotonic()
    try:
        result = subprocess.run(command, capture_output=True, text=True, timeout=30)
        versions = [line.split('=', 1)[1] for line in result.stdout.splitlines()
                    if line.startswith('S3_MEEP_VERSION=')]
        return dict(command=command, elapsedS=time.monotonic()-start,
                    status='imported' if result.returncode == 0 and versions else 'import-failed',
                    version=versions[-1] if versions else None, exitCode=result.returncode,
                    stdout=result.stdout, stderr=result.stderr)
    except (subprocess.TimeoutExpired, OSError) as error:
        return dict(command=command, elapsedS=time.monotonic()-start,
                    status='execution-failed', version=None, error=str(error))


def main():
    if digest(FIXTURE) != EXPECTED:
        raise ValueError('Frozen D2.8-E input changed; review the reference contract first.')
    f = json.loads(FIXTURE.read_text())
    first, second = f['surfaces']
    radius, outer = first['radius'], f['body']['outerRadius']
    thickness = second['frame']['origin']['x']
    # Check closure at center, clear edge and physical rim. Both spherical caps
    # extend to outer radius in this declared ideal bare-glass completion.
    sag = lambda r: radius-math.sqrt(radius*radius-r*r)
    edge = thickness-2*sag(outer)
    assert edge > 0 and outer > first['aperture']
    x_front = f['assembly']['frame']['origin']['x']
    launch, exit_plane = f['launchM'], f['exitM']
    center = (launch+exit_plane)/2
    source_plane = launch-10e-6
    contract = {
        'units': 'SI', 'frozenInput': f, 'frozenInputSHA256': EXPECTED,
        'scope': 'Proposed ideal bare-glass centered single-Lens control; physical reference unvalidated',
        'boundary': {
            'glassIndex': first['nAfter'], 'airIndex': 1, 'lossless': True,
            'coating': 'none in this ideal control',
            'volume': 'r <= outerRadius AND Xfront+sag(r) <= X <= Xfront+thickness-sag(r)',
            'sag': 'R-sqrt(R^2-r^2)', 'frontVertexXM': x_front,
            'clearRadiusM': first['aperture'], 'outerRadiusM': outer,
            'centerThicknessM': thickness, 'edgeThicknessM': edge,
            'annulus': 'Same dielectric caps continue from clear to outer radius; no artificial stop',
            'rim': 'Cylindrical dielectric-air side at outerRadius connects the two caps',
        },
        'domain': {
            'coordinateMap': 'Meep z=(global X-centerX)/1e-6, Meep r=sqrt(Y^2+Z^2)/1e-6',
            'centerXM': center, 'radialExtentM': outer+20e-6,
            'axialBoundsM': [launch-20e-6, exit_plane+20e-6],
            'pmlThicknessM': 5e-6, 'sourceXM': source_plane,
            'reflectionMonitorXM': launch-5e-6,
            'referencePlanesXM': [launch, exit_plane, exit_plane+5e-6, exit_plane+10e-6],
            'adequacy': 'unvalidated; padding and PML varied independently after controls',
        },
        'source': {
            'convention': 'exp(-i omega t), forward exp(+i kX X)',
            'scalarLaunch': 'sqrt(2/(pi*w^2))*exp(-r^2/w^2+i*k0*C*r^2/2)',
            'vectorControls': ['prescribed transverse E along global Y', 'prescribed transverse E along global Z'],
            'completion': 'Fourier transverse E from scalarLaunch; EX=-(kY*EY+kZ*EZ)/kX; H=(k cross E)/(mu0*omega)',
            'support': 'kY^2+kZ^2 <= (0.25*k0)^2; remove other components and report removed scalar spectral power',
            'normalization': 'Choose launch amplitude once so 0.5 Re integral(E cross H*) dot +X dA=1 W for each ideal control',
            'injection': 'Back-propagate angular spectrum to source plane; Huygens sheet Je=n cross H, Jm=-n cross E',
            'calibration': 'No-Lens measured E/H and flux at launch must match prescribed source; report finite source disk truncation',
            'harmonics': 'Centered linear controls require m=+1 and -1; verify reconstruction and relative phase before flux integration',
            'ports': 'Frozen unspecified polarization and scalar unit-power Port data retained in frozenInput',
        },
        'acceptance': {
            'fieldRelativeL2': .01, 'fluxRelativeIncident': .005,
            'fieldNorm': 'sqrt(integral |E_ref-exp(i*piston)*E_test|^2 dA / integral |E_ref|^2 dA)',
            'fluxNorm': 'abs(P_test-P_ref)/P_incident',
            'powerLedger': 'P_incident - P_reflected - P_transmitted - P_radialOutgoing; normalize by P_incident',
            'mode': 'Power-normalized receiving E/H at the same plane; record chosen reciprocity projection and forward decomposition',
            'refinement': '10/20/40 points per glass wavelength plus independent PML, padding, plane and settling studies; budgets pending actual pilot',
            'scope': 'Numerical targets; physical model discrepancy reported separately',
        },
        'executionOrder': ['import and version', 'homogeneous plane wave', 'no-Lens Gaussian calibration for both polarizations',
                           'Fresnel interface', 'coherent bare slab', 'full-size Lens short resource pilot',
                           'three-mesh and independent domain/PML/plane/settling study', 'Gaussian and Ray-Pupil comparisons'],
    }
    solver = probe(os.getenv('S3_MEEP_PYTHON', sys.executable))
    memory = dict(line.split(':', 1) for line in Path('/proc/meminfo').read_text().splitlines()) if Path('/proc/meminfo').exists() else {}
    report = {
        'schemaVersion': 1, 'gitSHA': git('rev-parse', 'HEAD'),
        'headSHA': os.getenv('GOLDEN_HEAD_SHA'), 'trackedChanges': git('status', '--porcelain'),
        'adapterSHA256': digest(Path(__file__)), 'contract': contract,
        'contractChecks': 'pass', 'decision': 'resource-blocked' if solver['status'] != 'imported' else 'controls-required',
        'solver': solver, 'runtime': {'python': platform.python_version(),
            'cpuAffinity': len(os.sched_getaffinity(0)) if hasattr(os, 'sched_getaffinity') else None,
            'hostMemTotal': memory.get('MemTotal', '').strip(), 'jobMemoryLimitBytes': None,
            'jobTimeLimitS': None, 'preflightPeakRSSKiB': resource.getrusage(resource.RUSAGE_SELF).ru_maxrss},
        'checkpointA': 'partial', 'checkpointB': 'not-run', 'checkpointC': 'not-run',
        'physicsReferenceStatus': 'uncomputed', 'lensField': None, 'lensFlux': None,
        'lensModeProjection': None, 'measuredLensRuntimeS': None, 'measuredLensPeakRSSBytes': None,
        'totalCoupling': None, 'assemblyYield': None,
    }
    out = ROOT/'benchmark-results/s3-preflight.json'
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps({'contractChecks': 'pass', 'decision': report['decision'], 'solver': solver['status'], 'physicsReference': 'uncomputed'}))


if __name__ == '__main__':
    main()
