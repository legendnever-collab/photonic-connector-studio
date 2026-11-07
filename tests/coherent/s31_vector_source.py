"""Frozen Gaussian vector completion: independent Hankel and existing FFT grid.

Test-only source adapter, not a Lens/POP solver. um lengths, H in E/Z0 units.
Each m coefficient multiplies exp(i*m*phi). Cartesian x,y = global Y,Z.
"""
import json
import numpy as np
from scipy.special import jv, roots_legendre
from scipy.fft import fft2, ifft2
from scalar_reference import Grid
from run_s3_preflight import FIXTURE

F=json.loads(FIXTURE.read_text())
WL=F['fixedPorts']['wavelength']*1e6
K=2*np.pi/WL
W=F['inputW'][0]*1e6
C=F['inputC'][0]*1e-6
A=1/W**2-1j*K*C/2


def radial(r,z,m=1,nq=512):
    """Continuous forward Maxwell E/H for prescribed transverse Ex Gaussian.

    Radial inverse transform g=integral q*dq/(2*a) exp(-q²/4a) J0(qr).
    Propagating cut q<=k0/4 is fixed by S3. Longitudinal E is -qx Ex/kz.
    """
    nodes,weights=roots_legendre(nq)
    q=(nodes+1)*K/8; weights=weights*K/8
    kz=np.sqrt(K*K-q*q)
    b=weights*q/(2*A)*np.exp(-q*q/(4*A)+1j*kz*z)
    qr=np.outer(np.asarray(r),q)
    j0,j1,j2=(jv(order,qr) for order in [0,1,2])
    g=j0@b
    longitudinal=j1@(b*q/kz)
    hr=(j0@(b*(kz+q*q/(2*kz)))+j2@(b*q*q/(2*kz)))/K
    hp=(j0@(b*(kz+q*q/(2*kz)))-j2@(b*q*q/(2*kz)))/K
    hz=j1@(b*q/K)
    return np.array([g/2,1j*m*g/2,-1j*longitudinal/2,-1j*m*hr/2,hp/2,-m*hz/2])


def power(fields,r):
    """One m, azimuth integrated normal Poynting flux, including 1/2."""
    return float(np.pi*np.trapezoid(np.real(fields[0]*fields[4].conj()-fields[1]*fields[3].conj())*r,r))


def inner(a,b,r):
    return 2*np.pi*np.trapezoid(np.sum(a.conj()*b,axis=0)*r,r)


def projection(test,ref,r):
    integrand=(test[0]*ref[4].conj()-test[1]*ref[3].conj()
               +ref[0].conj()*test[4]-ref[1].conj()*test[3])
    return 2*np.pi*np.trapezoid(integrand*r,r)/(4*power(ref,r))


def cartesian(fields,phi):
    er,ep,ez,hr,hp,hz=fields
    return np.array([er*np.cos(phi)-ep*np.sin(phi),er*np.sin(phi)+ep*np.cos(phi),ez,
                     hr*np.cos(phi)-hp*np.sin(phi),hr*np.sin(phi)+hp*np.cos(phi),hz])


def fft_reference(n=512,width=320.,z=0.):
    # Reuse the D2.8-B grid/spectrum convention, adding the frozen vector completion.
    grid=Grid(n,width*1e-6,WL*1e-6)
    x,y=grid.y*1e6,grid.z*1e6
    scalar=np.exp(-A*(x*x+y*y)); spectrum=fft2(scalar)
    qx=2*np.pi*grid.fy*1e-6; qy=2*np.pi*grid.fz*1e-6
    q2=qx*qx+qy*qy; mask=q2<=(K/4)**2
    kz=np.sqrt(np.maximum(K*K-q2,1e-30))
    ex=spectrum*mask*np.exp(1j*kz*z); zero=np.zeros_like(ex)
    ez=-qx/kz*ex
    fields=np.array([ifft2(v) for v in [ex,zero,ez,qy*ez/K,(kz*ex-qx*ez)/K,-qy*ex/K]])
    removed=float(np.sum(abs(spectrum[~mask])**2)/np.sum(abs(spectrum)**2))
    return grid,fields,removed


def verify():
    rows=[]
    for n,width in [(512,320.),(1024,320.),(1024,400.)]:
        grid,fields,removed=fft_reference(n,width,z=10.)
        r=grid.axis[n//2:]*1e6
        hankel=radial(r,10.,1)+radial(r,10.,-1)
        fft_line=fields[:,n//2:,n//2]
        error=np.linalg.norm(fft_line-hankel)/np.linalg.norm(hankel)
        px=.5*np.sum(np.real(fields[0]*fields[4].conj()-fields[1]*fields[3].conj()))*(grid.dx*1e6)**2
        pr=power(radial(r,10.,1),r)+power(radial(r,10.,-1),r)
        rows.append(dict(n=n,widthUm=width,cartesianVsHankelRelative=float(error),
            jacobianFluxRelative=float(abs(px-pr)/px),removedScalarSpectrum=removed))
    r=np.linspace(0,180,1801)
    plus,minus=radial(r,0,1),radial(r,0,-1)
    symmetry=0.
    for phi in [.1,.7,1.9]:
        ey=cartesian(-1j*plus*np.exp(1j*phi)+1j*minus*np.exp(-1j*phi),phi)
        ph=phi-np.pi/2
        ex=cartesian(plus*np.exp(1j*ph)+minus*np.exp(-1j*ph),ph)
        rotated=np.array([-ex[1],ex[0],ex[2],-ex[4],ex[3],ex[5]])
        symmetry=max(symmetry,float(np.linalg.norm(ey-rotated)/np.linalg.norm(ey)))
    fine=radial(r,0,1,nq=768)
    quadrature=float(np.linalg.norm(fine-plus)/np.linalg.norm(fine))
    return dict(fftComparisons=rows,rotationRelative=symmetry,hankelQuadratureRelative=quadrature,
        normalization='0.5 Re(E cross H*) integrated; SI E=sqrt(Z0)*1e6*E_solver, H=1e6/sqrt(Z0)*H_solver',
        mCoefficients='Y: (+1,-1)=(1,1); Z=(-i,+i), both on common Cartesian source basis',
        passed=bool(max(r['cartesianVsHankelRelative'] for r in rows)<.001 and max(r['jacobianFluxRelative'] for r in rows)<.001 and symmetry<1e-12 and quadrature<1e-8))
