"""Run D2.8-B references. Exit failure means an implementation/control failure,
not an unavailable physical Fold result. Unresolved computations remain explicit.
"""
import argparse
import hashlib
import json
import platform
import subprocess
from pathlib import Path
import sys
import time
import numpy as np
import scipy
from scipy.special import roots_legendre, erf
from scalar_reference import Grid, gaussian, lens_boundary, masks, projected_fold, direct_aperture, relative_field

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT/'benchmark-results/d28b-coherent-field.json'
CHECKS = []

def check(name, ok, detail=None):
    CHECKS.append({'name': name, 'status': 'PASS' if bool(ok) else 'FAIL', 'detail': detail})


def complex_pairs(u):
    return [[float(v.real), float(v.imag)] for v in u]


def controls(case):
    g = Grid(512, 512e-6)
    u = gaussian(g.y, g.z, 40e-6, 0, g.wavelength)
    expected = gaussian(g.y, g.z, 40e-6, .002, g.wavelength)
    f, fl = g.propagate(u, .002, 'Fresnel')
    a, al = g.propagate(u, .002)
    ferr, aerr = relative_field(f, expected), relative_field(a, expected)
    check('complex Fresnel Gaussian agrees with analytic radius, curvature and Gouy phase', ferr < 1e-10, ferr)
    check('AS approaches paraxial Gaussian in declared low-NA control', aerr < 1e-4, aerr)
    check('unobstructed L2 energy and scalar longitudinal flux conserved', abs(al['after']-al['before']) < 1e-12 and abs(g.spectrum(a)['longitudinalScalarFlux']-g.spectrum(u)['longitudinalScalarFlux']) < 1e-12, al)
    eta=float(abs(np.vdot(u,f)*g.dx*g.dx)**2)
    eta_exact=1/(1+(.002/(2*np.pi*(40e-6)**2/g.wavelength))**2)
    check('complex Gaussian Mode overlap includes curvature mismatch',abs(eta-eta_exact)<1e-12,{'computed':eta,'analytical':eta_exact})
    # Free propagation semigroup, including a translated complex phase ramp.
    u = gaussian(g.y-10e-6, g.z+7e-6, 40e-6, 0, g.wavelength)*np.exp(2j*np.pi*.01*g.z/g.wavelength)
    a, _ = g.propagate(u, .001)
    b, _ = g.propagate(a, .001)
    c, _ = g.propagate(u, .002)
    check('complex translated/tilted free-space semigroup', relative_field(b,c)<1e-10)
    v=gaussian(g.y+5e-6,g.z-3e-6,35e-6,0,g.wavelength)
    pv,_=g.propagate(v,.002)
    check('reciprocal bilinear field integral, with adjoint conjugation convention',abs(np.sum(c*v-u*pv)*g.dx*g.dx)<1e-12)
    v = 1j*u
    eta = abs(np.vdot(v,u)*g.dx*g.dx)**2/(g.power(u)*g.power(v))
    check('overlap is invariant under global phase; power normalization is explicit', abs(eta-1)<1e-12)
    vg = Grid(256, 256*1.31e-6/4)
    v = np.broadcast_to(np.exp(2j*np.pi*90*np.arange(256)/256), (256,256))
    _, bad = vg.propagate(v, 100e-6)
    check('evanescent plane-wave control is removed and reported, never renormalized', bad['evanescentRemoved'] > .999*bad['before'] and bad['after'] < bad['before']*1e-20)
    try:
        g.propagate(u, -.001)
        check('unsupported backward propagation fails closed', False)
    except ValueError:
        check('unsupported backward propagation fails closed', True)
    # Collapsed zero-distance four-mask limit: exactly the D2.8-A local mask model.
    geometric = []
    for n in [512,1024,2048]:
        q = Grid(n,512e-6)
        a, up, down = masks(q,case)
        u = gaussian(q.y,q.z,50e-6,0,q.wavelength)
        geometric.append({'n':n,'aperture':q.power(u*a),'clear':q.power(u*a*up*down)})
    check('D2.8-A local aperture-only limit', abs(geometric[-1]['aperture']-case['localMask']['apertureTransmission'])<2e-3, geometric)
    check('D2.8-A common mask geometric limit (not actual ray train / diffraction equivalence)', abs(geometric[-1]['clear']-case['localMask']['clearTransmission'])<2e-3, geometric)
    # Independent separable Fresnel integral of a finite rectangular Gaussian pupil.
    points = [(0.,0.), (0.,8e-6), (0.,32e-6), (32e-6,0.)]
    w, ay, az, length = 50e-6,80e-6,8e-6,.001
    def rectangle(order):
        x,wt=roots_legendre(order)
        def one(a,p):
            return a*np.sum(wt*np.exp(-(a*x/w)**2+1j*np.pi/(g.wavelength*length)*(p-a*x)**2))
        return np.asarray([np.sqrt(2/np.pi)/w/(1j*g.wavelength*length)*one(ay,y)*one(az,z) for y,z in points])
    exact=rectangle(256)
    check('independent rectangular Fresnel quadrature refinement', relative_field(exact,rectangle(128))<1e-10)
    rectangular=[]
    for n in [512,1024,2048]:
        q=Grid(n,512e-6,offset=.5)
        u=gaussian(q.y,q.z,w,0,q.wavelength)*((abs(q.y)<ay)&(abs(q.z)<az))
        out,ledger=q.propagate(u,length,'Fresnel')
        # Bilinear sample at fixed physical points on the half-cell shifted grid.
        vals=sample(q,out,points)
        rectangular.append({'n':n,'fieldError':relative_field(vals,exact),'bandRemoved':ledger['bandRemoved']})
    check('rectangular single-aperture diffraction agrees with independent integral', rectangular[-1]['fieldError']<.003,rectangular)
    # Whole central ROI, closed-form complex-erf Fresnel integral, independent
    # of both FFT and the Legendre point controls. Expand W at fixed dx.
    A=1/w**2-1j*np.pi/(g.wavelength*length)
    def closed(a,p):
        B=-2j*np.pi*p/(g.wavelength*length)
        return np.exp(1j*np.pi*p*p/(g.wavelength*length))*np.sqrt(np.pi)/(2*np.sqrt(A))*np.exp(B*B/(4*A))*(erf(np.sqrt(A)*a-B/(2*np.sqrt(A)))-erf(-np.sqrt(A)*a-B/(2*np.sqrt(A))))
    closed_points=np.asarray([np.sqrt(2/np.pi)/w/(1j*g.wavelength*length)*closed(ay,y)*closed(az,z) for y,z in points])
    check('closed-form aperture field agrees with independent quadrature',relative_field(closed_points,exact)<1e-10)
    aperture_windows=[];roi_changes=[];previous_roi=None
    for n,width in [(1024,512e-6),(2048,1024e-6),(4096,2048e-6)]:
        q=Grid(n,width,offset=.5)
        u=gaussian(q.y,q.z,w,0,q.wavelength)*((abs(q.y)<ay)&(abs(q.z)<az))
        out,ledger=q.propagate(u,length,'Fresnel')
        ids=np.flatnonzero(abs(q.axis)<64e-6);axis=q.axis[ids]
        roi=out[np.ix_(ids,ids)]
        analytic=np.sqrt(2/np.pi)/w/(1j*q.wavelength*length)*closed(ay,axis[:,None])*closed(az,axis[None,:])
        aperture_windows.append({'n':n,'windowM':width,'roiHalfWidthM':64e-6,'complexROIError':relative_field(roi,analytic),'bandRemoved':ledger['bandRemoved']})
        if previous_roi is not None:roi_changes.append(relative_field(roi,previous_roi))
        previous_roi=roi
        del q,u,out,analytic
    check('single-aperture complex ROI agrees with exact Fresnel solution and window refinement',aperture_windows[-1]['complexROIError']<.005 and max(roi_changes)<.005,{'windows':aperture_windows,'successiveROIChanges':roi_changes})
    # Circular Gaussian aperture energy is independently analytic.
    q=Grid(1024,512e-6)
    u=gaussian(q.y,q.z,w,0,q.wavelength)
    p=q.power(u*(q.y*q.y+q.z*q.z<40e-6**2))
    check('circular Gaussian aperture analytical power',abs(p-(1-np.exp(-2*(40/50)**2)))<1e-3,p)
    # Independent tilted-surface integral uses no FFT / propagation kernel code.
    oblique={}
    for angle in [21,23,25]:
        pts=[(0.,0.),(0.,8e-6),(0.,-8e-6),(0.,32e-6),(0.,-32e-6),(32e-6,0.)]
        hist=[]
        for order in [128,256,512]:
            flat=direct_aperture(w,g.wavelength,angle,length,pts,order,False)
            tilted=direct_aperture(w,g.wavelength,angle,length,pts,order,True)
            hist.append({'order':order,'flat':complex_pairs(flat),'tilted':complex_pairs(tilted)})
        errors=[max(relative_field(np.asarray(v['flat'])@np.array([1,1j]),np.asarray(hist[i]['flat'])@np.array([1,1j])),relative_field(np.asarray(v['tilted'])@np.array([1,1j]),np.asarray(hist[i]['tilted'])@np.array([1,1j]))) for i,v in enumerate(hist[1:])]
        error=relative_field(flat,tilted)
        check(f'{angle}: independent tilted integral converges',max(errors)<1e-6,errors)
        oblique[str(angle)]={'history':hist,'successiveFieldChanges':errors,'projectionSampleFieldError':error,'projectionTolerance':.01,'projectionGate':'out-of-model' if error>.01 else 'local-control-only','scope':'Prescribed planar Dirichlet aperture, six fixed points at 1 mm; not a full Mirror or fold error bound.'}
        if angle==23:
            q=Grid(2048,512e-6)
            aperture=q.y*q.y+(q.z/np.sin(np.deg2rad(angle)/2))**2<(200e-6)**2
            out,_=q.propagate(gaussian(q.y,q.z,w,0,q.wavelength)*aperture,length)
            err=relative_field(sample(q,out,pts),flat)
            check('flat AS aperture agrees with independent RS-I integral',err<.005,err)
    return {'gaussian':{'FresnelComplexError':ferr,'ASParaxialDifference':aerr},'geometricMaskLimit':geometric,'rectangularDiffraction':rectangular,'apertureWindowConvergence':aperture_windows,'oblique':oblique}


def sample(g,u,points):
    # Only used for independent control comparison; never to change physical inputs.
    values=[]
    for y,z in points:
        iy=(y/g.dx+g.n/2-g.offset);iz=(z/g.dx+g.n/2-g.offset)
        i,j=int(np.floor(iy)),int(np.floor(iz));fy,fz=iy-i,iz-j
        values.append((1-fy)*(1-fz)*u[i,j]+fy*(1-fz)*u[i+1,j]+(1-fy)*fz*u[i,j+1]+fy*fz*u[i+1,j+1])
    return np.asarray(values)


def convergence(history,field_changes,extras=None):
    tolerances={'absolutePowerChange':.002,'complexFieldChange':.05,'windowEdgeFraction':.001,'numericalBandRemoved':.001}
    last=history[-3:]
    field_changes=field_changes[-2:]
    valid=len(last)==3 and all(last[i+1]['n']==2*last[i]['n'] and last[i+1]['windowM']==last[i]['windowM'] for i in range(2))
    changes={k:max(abs(last[i+1][k]-last[i][k]) for i in range(2)) if valid else None for k in ['lastScreenL2','reciprocalModePowerL2','conditionalOverlapL2']}
    gates={'threeGrids':valid,'scalarMetrics':valid and max(changes.values())<.002,'complexField':len(field_changes)==2 and max(field_changes)<.05,'windowEdge':max((v['maxWindowEdgeFraction'] for v in last),default=float('inf'))<.001,'discardedBand':max((v['bandRemoved'] for v in last),default=float('inf'))<.001}
    if extras is not None:
        gates.update(extras)
    return {'status':'converged' if all(gates.values()) else 'Unresolved','gates':gates,'metricChanges':changes,'complexFieldChanges':field_changes,'tolerances':tolerances,'physicalErrorBound':None,'scope':'Observed transverse-screen model convergence only; no actual tilted Fold qualification'}


def assess(case):
    history=[];changes=[];previous=None
    for n in ([512,1024,2048,4096] if case['degrees']==23 and case['positionFactor']==1 else [512,1024,2048]):
        row,u=projected_fold(case,n,512e-6)
        history.append(row)
        if previous is not None:
            changes.append(relative_field(u[::2,::2],previous))
        previous=u
    del previous,u
    # Window / sampling / boundary representation are independent axes, not only N.
    windows=[history[0]]
    for n,width in [(1024,1024e-6),(2048,2048e-6)]:
        row,u=projected_fold(case,n,width)
        windows.append(row);del u
    shifted,_=projected_fold(case,1024,512e-6,offset=.5)
    coarse_boundary,_=projected_fold(case,1024,512e-6,stride=4)
    placement,_=projected_fold(case,1024,512e-6,placement='collapsed')
    corner,_=projected_fold(case,2048,1024e-6)
    keys=['lastScreenL2','reciprocalModePowerL2','conditionalOverlapL2']
    window_error=max(abs(windows[i+1][k]-windows[i][k]) for k in keys for i in range(2))
    sampling_error=max(abs(shifted[k]-history[1][k]) for k in keys)
    boundary_error=max(abs(coarse_boundary[k]-history[1][k]) for k in keys)
    corner_error=max(abs(corner[k]-history[1][k]) for k in keys)
    placement_error=max(abs(placement[k]-history[1][k]) for k in keys)
    conv=convergence(history,changes,{'independentWindow':window_error<.002,'subpixelSampling':sampling_error<.002,'LensBoundaryInterpolation':boundary_error<2e-5,'jointGridWindow':corner_error<.002})
    for row in history+windows[1:]+[shifted,coarse_boundary,placement,corner]:
        check(f"{case['id']}: {row['n']}/{row['windowM']}/{row['gridOffsetCells']}/{row['placement']}/{row['boundaryStride']} power ledger",abs(row['inputL2']-row['lastScreenL2']-row['maskRemoved']-sum(v.get('bandRemoved',0)+v.get('evanescentRemoved',0) for v in row['ledger']))<1e-10 and row['maxBalanceError']<1e-10 and 0<=row['conditionalOverlapL2']<=1+1e-12)
    return {'id':case['id'],'geometry':case['geometry'],'gaussian':case['gaussian']['status'],
            'physicalFold':{'status':'Uncomputed','transmission':None,'outputModeCoupling':None,'reasons':['Projected transverse-screen replacement is not the actual oblique Mirror/body boundary','Lens eikonal boundary has no independent diffractive field error bound','Coating, polarization, vector edge scattering and multiple reflections excluded']},
            'projectedModelDiagnostic':{'history':history,'windowsAtFixedDx':windows,'shiftedGrid':shifted,'coarseLensBoundary':coarse_boundary,'collapsedPlacement':placement,'jointGridWindowCorner':corner,'jointGridWindowChange':corner_error,'windowMetricChange':window_error,'samplingMetricChange':sampling_error,'boundaryMetricChange':boundary_error,'placementModelSensitivity':placement_error,'convergence':conv},
            'totalCoupling':{'status':'Uncomputed'},'yield':{'status':'Uncomputed'}}


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--controls-only',action='store_true');parser.add_argument('--case');args=parser.parse_args()
    start=time.time();inputs=json.loads((ROOT/'benchmark-results/d28b-input.json').read_text())
    head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
    if inputs['gitSHA']!=head:
        raise RuntimeError('Stale input export: rerun npm run benchmark:coherent')
    for path,sha in inputs['sourceSHA256'].items():
        if hashlib.sha256((ROOT/path).read_bytes()).hexdigest()!=sha:
            raise RuntimeError('Stale exported source: '+path)
    seed=next(c for c in inputs['cases'] if c['id']=='plus-23-1')
    reference=controls(seed)
    assessments=[]
    if not args.controls_only:
        for case in inputs['cases']:
            if args.case and case['id']!=args.case:continue
            print('Assessing',case['id'],flush=True)
            assessments.append(assess(case))
        if not args.case:
            plus=next(c for c in assessments if c['id']=='plus-23-1')['projectedModelDiagnostic']['history']
            minus=next(c for c in assessments if c['id']=='minus-23-1')['projectedModelDiagnostic']['history']
            check('signed-offset numerical symmetry',max(abs(p[k]-m[k]) for p,m in zip(plus,minus) for k in ['lastScreenL2','reciprocalModePowerL2','conditionalOverlapL2'])<1e-10)
    # Explicit negative: insufficient history never converges; no invented value for actual Fold.
    check('insufficient refinement remains Unresolved',convergence([],[])['status']=='Unresolved')
    files=['tests/coherent/scalar_reference.py','tests/coherent/run_reference.py','tests/coherent/requirements.txt']
    report={'schemaVersion':1,'benchmark':'D2.8-B coherent finite-field reference','status':'PASS' if all(c['status']=='PASS' for c in CHECKS) else 'FAIL','statusMeaning':'Reference/control assertions only, not connector qualification','command':'npm run benchmark:coherent','partialRun':args.controls_only or args.case is not None,'baseSHA':inputs['baseSHA'],'gitSHA':head,'headSHA':inputs['headSHA'],'trackedChanges':subprocess.check_output(['git','status','--porcelain'],cwd=ROOT,text=True).strip(),
            'inputSHA256':hashlib.sha256((ROOT/'benchmark-results/d28b-input.json').read_bytes()).hexdigest(),'sourceSHA256':{**inputs['sourceSHA256'],**{p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in files}},'runtime':{'python':platform.python_version(),'numpy':np.__version__,'scipy':scipy.__version__,'platform':platform.platform()},'elapsedSeconds':time.time()-start,'checks':CHECKS,'controls':reference,'assessments':assessments,'physicalFoldStatus':'Uncomputed','physicalErrorBound':None,'totalCoupling':None}
    OUT.write_text(json.dumps(report,indent=2,allow_nan=False))
    failed=[c for c in CHECKS if c['status']=='FAIL']
    print(json.dumps({'status':report['status'],'checks':len(CHECKS),'failures':failed,'seconds':report['elapsedSeconds']}),flush=True)
    return 1 if failed else 0

if __name__=='__main__':
    sys.exit(main())
