"""D2.8-C: fail-closed physical-boundary audit and independent numerical checks.

PASS means the stated control assertions passed. Path B / Uncomputed is an
engineering decision, not a test failure or evidence that a Fold is impossible.
"""
import copy
import hashlib
import json
import platform
from pathlib import Path
import subprocess
import sys
import time
import numpy as np
import scipy
from scalar_reference import Grid, gaussian, lens_boundary, direct_aperture, relative_field
from boundary_reference import prescribed_surface, lens_parameters, quadratic_lens, quadratic_analytic, phase_aligned_error

ROOT = Path(__file__).resolve().parents[2]
BASE = 'd95ca6c219530a1ca7e6c95e283b9fd4c7f00c5b'
CHECKS = []


def check(name, ok, detail=None):
    CHECKS.append({'name':name, 'status':'PASS' if bool(ok) else 'FAIL', 'detail':detail})


def xyz(v):
    return np.array([v[k] for k in ('x','y','z')])


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',',':')).encode()).hexdigest()


def single_mirror():
    rows = []
    # Exact propagating plane-wave superposition: no paraxial approximation.
    # Off-axis directions and complex weights detect lost phase / coordinate signs.
    transverse = np.array([[0.,0.],[.025,.04],[-.035,.015],[.02,-.03]])
    directions = np.column_stack((np.sqrt(1-np.sum(transverse**2,axis=1)),transverse))
    weights = np.array([1., .3+.2j, -.15+.1j, .2-.12j])
    k = 2*np.pi/1.31e-6
    for degrees in (21.,23.,25.):
        t = np.deg2rad(degrees)
        n = np.array([-np.sin(t/2),0.,np.cos(t/2)])
        h = np.eye(3)-2*np.outer(n,n)
        reflected = directions@h
        analytic = np.column_stack((np.cos(t)*directions[:,0]+np.sin(t)*directions[:,2],
                                    directions[:,1], np.sin(t)*directions[:,0]-np.cos(t)*directions[:,2]))
        # Actual tilted surface; compare field values and normal derivatives.
        u, v = np.meshgrid(np.linspace(-150e-6,150e-6,19),np.linspace(-80e-6,80e-6,13))
        surface = np.column_stack((u.ravel()*np.cos(t/2),v.ravel(),u.ravel()*np.sin(t/2)))
        inc = np.exp(1j*k*surface@directions.T)*weights
        ref = np.exp(1j*k*surface@reflected.T)*weights
        dirichlet_residual = np.linalg.norm(np.sum(inc-ref,axis=1))/np.linalg.norm(np.sum(inc,axis=1))
        dn_i, dn_r = directions@n, reflected@n
        neumann_residual = np.linalg.norm(np.sum(inc*dn_i+ref*dn_r,axis=1))/np.linalg.norm(np.sum(inc*dn_i,axis=1))
        incoming_flux = float(np.sum(abs(weights)**2*(-dn_i)))
        outgoing_flux = float(np.sum(abs(weights)**2*dn_r))
        # Spectral Mode projection in the ideal orthogonal plane-wave basis.
        mode = np.array([.5+.1j,.2,-.1j,.4]);metric = -dn_i
        overlap = abs(np.vdot(mode*metric,weights))**2/(np.sum(abs(mode)**2*metric)*np.sum(abs(weights)**2*metric))
        phase_overlap = abs(np.vdot(mode*metric,weights*np.exp(.73j)))**2/(np.sum(abs(mode)**2*metric)*np.sum(abs(weights)**2*metric))
        check(f'{degrees}: actual tilted infinite-mirror analytic reflection', np.max(abs(reflected-analytic))<1e-14)
        check(f'{degrees}: exact Dirichlet and Neumann infinite-plane boundaries', max(dirichlet_residual,neumann_residual)<1e-11)
        check(f'{degrees}: incoming/outgoing normal scalar flux', abs(incoming_flux-outgoing_flux)<1e-14)
        check(f'{degrees}: spectral Mode projection and phase invariance',0<=overlap<=1 and abs(overlap-phase_overlap)<1e-14)
        rows.append({'degrees':degrees,'dirichletResidual':float(dirichlet_residual),
                     'neumannResidual':float(neumann_residual),'incomingNormalFlux':incoming_flux,
                     'outgoingNormalFlux':outgoing_flux,'scope':'Exact infinite scalar plane; D and N are separate ideal BCs, not a finite coated Mirror'})
    return rows


def tilted_aperture():
    pts = [(0.,0.),(0.,8e-6),(0.,-8e-6),(0.,32e-6),(0.,-32e-6),(32e-6,0.)]
    rows = []
    for angle in (21,23,25):
        history = []
        for order in (384,768,1536):
            d = prescribed_surface(angle,200e-6,.001,pts,order,'dirichlet')
            n = prescribed_surface(angle,200e-6,.001,pts,order,'neumann')
            history.append((d,n))
        changes = [max(relative_field(history[i+1][j],history[i][j]) for j in (0,1)) for i in (0,1)]
        old = direct_aperture(50e-6,1.31e-6,angle,.001,pts,512,True)
        independent = relative_field(history[-1][0],old)
        check(f'{angle}: tilted disk independent polar vs D2.8-B Cartesian RS-I',independent<1e-6,independent)
        check(f'{angle}: both prescribed aperture problems converge',max(changes)<1e-5,changes)
        rows.append({'degrees':angle,'orders':[384,768,1536],'successiveFieldChanges':changes,
                     'independentRSIError':independent,'differentBoundaryDataFieldDifference':relative_field(history[-1][0],history[-1][1]),
                     'dirichletComplexSamples':[[float(z.real),float(z.imag)] for z in history[-1][0]],
                     'neumannComplexSamples':[[float(z.real),float(z.imag)] for z in history[-1][1]],
                     'scope':'Six fixed points, different D/N aperture data; neither number is a Mirror error bound'})
    # Enlarge the numerical surface support toward an infinite unobstructed mirror.
    # No physical part is enlarged. Low-NA Gaussian w=50 um, lambda/(pi w)=0.00834.
    expected = gaussian(np.array([p[0] for p in pts]),np.array([p[1] for p in pts]),50e-6,.002,1.31e-6)
    windows = []
    for radius in (600e-6,800e-6,1000e-6):
        a = prescribed_surface(23,radius,.002,pts,512)
        b = prescribed_surface(23,radius,.002,pts,1024)
        windows.append({'supportRadiusM':radius,'quadratureChange':relative_field(b,a),
                        'lowNAGaussianError':relative_field(b,expected),'field':b})
    changes = [relative_field(windows[i+1]['field'],windows[i]['field']) for i in (0,1)]
    check('large tilted support: quadrature and independent window refinement',max(w['quadratureChange'] for w in windows)<1e-5 and max(changes)<1e-3,changes)
    check('large tilted support reproduces unobstructed low-NA Gaussian',windows[-1]['lowNAGaussianError']<1e-3,windows[-1]['lowNAGaussianError'])
    for row in windows: del row['field']
    try:
        prescribed_surface(23,200e-6,1e-6,pts,32)
        rejected = False
    except ValueError:
        rejected = True
    check('invalid outgoing half-space is rejected',rejected)
    return {'sampleYZCoordinatesM':pts,'finitePrescribedAperture':rows,'infiniteSupportControl':windows,
            'windowFieldChanges':changes,'scope':'Reflection coordinate / propagation controls only; finite-body scattering NOT validated'}


def lens_handoff(seed):
    history = []
    for size,width in ((512,768e-6),(1024,768e-6),(2048,768e-6),(2048,1536e-6)):
        g = Grid(size,width)
        fft,ledger = quadratic_lens(g,seed)
        wave,ray,parameters = quadratic_analytic(g.y,g.z,seed)
        existing = lens_boundary(g,seed['boundary'])
        err = relative_field(fft,wave)
        check(f'quadratic Lens {size}/{width}: independent full complex Gaussian integral',err<1e-7,err)
        check(f'quadratic Lens {size}/{width}: lossless L2 ledger',abs(g.power(fft)-1)<1e-8 and max(abs(r['balanceError']) for r in ledger)<1e-12 and sum(r['bandRemoved']+r['evanescentRemoved'] for r in ledger)<1e-8)
        history.append({'n':size,'windowM':width,'complexAnalyticError':err,
                        'rayVsDiffractiveQuadraticPistonAlignedError':phase_aligned_error(ray,wave),
                        'existingSphericalEikonalVsQuadraticWavePistonAlignedError':phase_aligned_error(existing,wave),
                        'existingSphericalEikonalVsQuadraticRayPistonAlignedError':phase_aligned_error(existing,ray),
                        'existingL2':g.power(existing),'quadraticWaveL2':g.power(wave),
                        'maxEdgeFraction':max(g.edge(fft),g.edge(existing)), 'analytic':parameters})
    key='existingSphericalEikonalVsQuadraticWavePistonAlignedError'
    changes=[abs(history[i+1][key]-history[i][key]) for i in range(3)]
    check('Lens diagnostic Grid/Window stability',max(changes)<1e-4 and max(r['maxEdgeFraction'] for r in history)<1e-6,changes)
    # A homogeneous slab isolates missing internal diffraction without aberration.
    # At a waist C=0 all geometrical rays are parallel: ray-tube width stays fixed.
    slab=[]
    for w in (seed['boundary']['inputW'][0],4.6e-6):
        index= lens_parameters(seed)[2];length=300e-6
        zr=np.pi*index*w*w/1.31e-6
        g=Grid(512,512e-6,1.31e-6/index)
        u=gaussian(g.y,g.z,w,0,g.wavelength)
        v,ledger=g.propagate(u,length,'Fresnel')
        analytic=gaussian(g.y,g.z,w,length,g.wavelength)
        check(f'slab w={w}: independent diffractive Gaussian',relative_field(v,analytic)<1e-8)
        slab.append({'waistRadiusM':w,'internalDistanceOverRayleigh':length/zr,
                     'waveWidthOverRayWidth':float(np.sqrt(1+(length/zr)**2)),
                     'rayVsWavePistonAlignedError':phase_aligned_error(u,v)})
    check('small-waist negative control exposes omitted internal diffraction',slab[-1]['rayVsWavePistonAlignedError']>.5)
    bad=copy.deepcopy(seed)
    # Locate the first Lens explicitly rather than relying on assembly order.
    first=next(f['assemblyId'] for f in bad['project']['model']['prescription']['surfaces'] if f['interaction']=='refract')
    next(a for a in bad['project']['model']['prescription']['assemblies'] if a['id']==first)['frame']['rotation']['pitch']=.01
    try:
        lens_parameters(bad);rejected=False
    except ValueError:
        rejected=True
    check('unsupported tilted Lens diagnostic rejected',rejected)
    return {'status':'Uncomputed','physicalSphericalLensFieldErrorBound':None,'history':history,
            'slabControls':slab,'interpretation':'Quadratic control includes internal diffraction; differences to spherical eikonal mix aberration and model error. No physical Lens handoff certification.'}


def boundary_audit(case):
    f=case['fold'];lam=case['fixedPorts']['wavelength']
    c1,c2=map(xyz,f['mirrorCenters']);n1,n2=map(xyz,f['mirrorNormals'])
    separation=float(abs(np.dot(c2-c1,n1)))
    s=np.sin(np.deg2rad(case['degrees'])/2)
    central_gap=abs(case['offset'])-f['bodies'][0]['radius']*s
    # Backing lies BEHIND each reflecting front, so thickness is NOT subtracted
    # from the front-to-front normal gap. The projected gap is a different length.
    analytical=abs(case['offset'])/(2*np.cos(np.deg2rad(case['degrees'])/2))
    check(f"{case['id']}: opposing fronts and independent normal separation",np.linalg.norm(n1+n2)<1e-12 and abs(separation-analytical)<1e-14)
    check(f"{case['id']}: actual fixed Port/Mode wavelengths and dimensions",lam==1.31e-6 and case['fixedPorts']['modes']['source']==case['fixedPorts']['modes']['target'] and f['clearRadius']==200e-6 and all(abs(b['thickness']-20e-6)<1e-15 for b in f['bodies']))
    return {'id':case['id'],'projectSHA256':digest(case['project']),'portsSHA256':digest(case['fixedPorts']),
            'grazingAngleDegrees':case['degrees']/2,'incidenceFromNormalDegrees':90-case['degrees']/2,
            'frontPlaneNormalSeparationM':separation,'frontPlaneNormalSeparationWavelengths':separation/lam,
            'centralProjectedHalfGapM':central_gap,'centralProjectedHalfGapWavelengths':central_gap/lam,
            'projectedClearHalfApertureM':f['clearRadius']*s,'backingThicknessWavelengths':f['bodies'][0]['thickness']/lam,
            'boundaryModel':{'front':'ideal geometrical reflect; complex EM response unspecified',
                             'rimAndBack':'opaque ray solid; impedance/permittivity unspecified',
                             'polarization':case['fixedPorts']['modes']['source']['polarization']},
            'physicalFold':{'status':'Uncomputed','transmission':None,'outputModeCoupling':None,
                            'scalarFlux':None,'maxwellEnergyLedger':None,'physicalErrorBound':None},
            'candidateQualified':False}


def main():
    start=time.time()
    path=ROOT/'benchmark-results/d28b-input.json'
    inputs=json.loads(path.read_text())
    head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
    if inputs['gitSHA']!=head:
        raise RuntimeError('Stale input: rerun npm run benchmark:boundary')
    for name,sha in inputs['sourceSHA256'].items():
        if hashlib.sha256((ROOT/name).read_bytes()).hexdigest()!=sha:
            raise RuntimeError('Stale exported source: '+name)
    before=digest(inputs)
    seed=next(c for c in inputs['cases'] if c['id']=='plus-23-1')
    mirror=single_mirror()
    aperture=tilted_aperture()
    lens=lens_handoff(seed)
    cases=[boundary_audit(c) for c in inputs['cases']]
    plus=next(c for c in cases if c['id']=='plus-23-1');minus=next(c for c in cases if c['id']=='minus-23-1')
    check('signed-offset geometry and boundary audit symmetry',all(abs(plus[k]-minus[k])<1e-14 for k in ('frontPlaneNormalSeparationM','centralProjectedHalfGapM','projectedClearHalfApertureM')))
    check('all input Projects / fixed Ports / Modes unchanged',before==digest(inputs))
    check('all actual Fold Field metrics remain null / Uncomputed',all(c['physicalFold']['status']=='Uncomputed' and all(v is None for k,v in c['physicalFold'].items() if k!='status') and not c['candidateQualified'] for c in cases))
    own=['tests/coherent/boundary_reference.py','tests/coherent/run_boundary.py','tests/coherent/scalar_reference.py','tests/coherent/requirements.txt']
    report={'schemaVersion':1,'benchmark':'D2.8-C Physical Boundary Validation','baseSHA':BASE,
            'gitSHA':head,'headSHA':inputs['headSHA'],'inputSHA256':hashlib.sha256(path.read_bytes()).hexdigest(),
            'sourceSHA256':{**inputs['sourceSHA256'],**{n:hashlib.sha256((ROOT/n).read_bytes()).hexdigest() for n in own}},
            'trackedChanges':subprocess.check_output(['git','status','--porcelain'],cwd=ROOT,text=True).strip(),
            'runtime':{'python':platform.python_version(),'numpy':np.__version__,'scipy':scipy.__version__},
            'command':'npm run benchmark:boundary','partialRun':False,
            'status':'PASS' if all(c['status']=='PASS' for c in CHECKS) else 'FAIL',
            'statusMeaning':'Boundary/control audit completed; NOT Fold optical feasibility or qualification',
            'controlTolerances':{'exactMirrorBoundaryResidual':1e-11,'exactMirrorFluxAbsolute':1e-14,
                                 'independentTiltedIntegralRelativeField':1e-6,'surfaceRefinementRelativeField':1e-5,
                                 'infiniteSupportRelativeField':1e-3,'quadraticFFTAnalyticRelativeField':1e-7,
                                 'quadraticL2BalanceAbsolute':1e-12,'lensDiagnosticMetricRefinement':1e-4},
            'engineeringDecision':{'path':'B','label':'Model Insufficient','optimizationReady':False,
                                  'topologyImpossible':False,'twoFiniteMirrorFieldExpansion':'blocked at boundary-validity gate',
                                  'reasons':['Finite opaque backing is not an EM boundary condition; front/rim/back response is unspecified',
                                             'Prescribed Dirichlet/Neumann aperture propagation does not solve induced finite-reflector fields',
                                             'Multiple scattering, vector edge response and Lens handoff error are not bounded'],
                                  'nextMinimumTask':'Specify one ideal material/polarization control; verify a single finite reflector with backing using an established external Maxwell solver before the pair'},
            'checks':CHECKS,'singleInfiniteMirror':mirror,'tiltedPropagation':aperture,
            'lensHandoff':lens,'cases':cases,'elapsedSeconds':time.time()-start}
    out=ROOT/'benchmark-results/d28c-physical-boundary.json'
    out.write_text(json.dumps(report,indent=2,allow_nan=False))
    failed=[c for c in CHECKS if c['status']=='FAIL']
    print(json.dumps({'status':report['status'],'checks':len(CHECKS),'failures':failed,'path':'B','seconds':report['elapsedSeconds']}),flush=True)
    return bool(failed)


if __name__=='__main__':
    sys.exit(main())
