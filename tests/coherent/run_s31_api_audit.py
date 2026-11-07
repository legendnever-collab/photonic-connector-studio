"""Small independent E/H sign, DFT normalization and interpolation controls."""
import json
from pathlib import Path
import numpy as np
import meep as mp
from run_s31_planar import WL, FREQ, K0, N, analytic, numerical_k, pair
from run_s3_preflight import ROOT, digest, git


def transfer_matrix(thickness):
    # Solve boundary E/H continuity for [r, forward glass, backward glass, t].
    d=K0*N*thickness; p=np.exp(1j*d); q=np.exp(-1j*d)
    matrix=np.array([[1,-1,-1,0],[-1,-N,N,0],[0,p,q,-1],[0,N*p,-N*q,-1]],complex)
    return np.linalg.solve(matrix,np.array([-1,-1,0,0],complex))


def small_sheet(resolution,sign=-1,offset=0.):
    pulse=mp.GaussianSource(FREQ,fwidth=.1*FREQ)
    sim=mp.Simulation(cell_size=mp.Vector3(z=40),dimensions=1,resolution=resolution,Courant=.3,
        force_complex_fields=True,boundary_layers=[mp.PML(4)],sources=[
            mp.Source(pulse,component=mp.Ex,center=mp.Vector3(z=-10),amplitude=-1),
            mp.Source(pulse,component=mp.Hy,center=mp.Vector3(z=-10),amplitude=sign)])
    dft=sim.add_dft_fields([mp.Ex,mp.Hy],FREQ,0,1,center=mp.Vector3(z=offset),size=mp.Vector3(),decimation_factor=1)
    span=sim.add_dft_fields([mp.Ex,mp.Hy],FREQ,0,1,center=mp.Vector3(z=offset),size=mp.Vector3(z=4/resolution),decimation_factor=1)
    flux=sim.add_flux(FREQ,0,1,mp.FluxRegion(center=mp.Vector3(z=offset)),decimation_factor=1)
    back=sim.add_flux(FREQ,0,1,mp.FluxRegion(center=mp.Vector3(z=-15)),decimation_factor=1)
    sim.run(until_after_sources=150)
    e,h=[complex(sim.get_dft_array(dft,c,0)) for c in [mp.Ex,mp.Hy]]
    ef,hf=[complex(sim.get_dft_array(flux,c,0)) for c in [mp.Ex,mp.Hy]]
    z=sim.get_array_metadata(dft_cell=span)[2]
    span_e,span_h=[np.interp(offset,z,sim.get_dft_array(span,c,0)) for c in [mp.Ex,mp.Hy]]
    f,b=mp.get_fluxes(flux)[0],mp.get_fluxes(back)[0]
    result=dict(resolutionPerUm=resolution,magneticSign=sign,monitorZUm=offset,E=pair(e),H=pair(h),
        flux=f,backFlux=b,forwardFraction=abs(f)/(abs(f)+abs(b)),
        dftFluxArraysRelative=max(abs(ef-e),abs(hf-h))/max(abs(e),abs(h),1e-30),
        fluxOverCenteredPoynting=float(f/(.5*np.real(e*h.conjugate()))) if abs(e*h)>1e-30 else None,
        impedance=pair(h/e) if abs(e)>1e-20 else None,
        finiteSpanE=pair(span_e),finiteSpanH=pair(span_h),
        pointReadoutAnomaly=bool(abs(e)<1e-20 and abs(span_e)>1e-6))
    sim.reset_meep();return result


def main():
    mp.verbosity(0)
    formula=[]
    for thickness in [0.,.3,3.,300.]:
        r,a,b,t=transfer_matrix(thickness)
        e,h,T,R=analytic('slab',thickness,thickness/2+6)
        error=abs(t*np.exp(-1j*K0*thickness)-e)
        assert error<1e-12 and abs(abs(t)**2+abs(r)**2-1)<1e-12
        formula.append(dict(thicknessUm=thickness,fieldError=float(error),balance=float(abs(abs(t)**2+abs(r)**2-1))))
    sheets=[small_sheet(res,offset=offset/res) for res in [8,16,32] for offset in [0,.5]]
    negative=small_sheet(32,sign=1)
    assert min(r['forwardFraction'] for r in sheets)>.99
    assert negative['forwardFraction']<.01
    assert max(r['dftFluxArraysRelative'] for r in sheets)<1e-12
    assert all(abs(complex(*r['finiteSpanE']))>1 for r in sheets)
    wrong_phase=abs(np.exp(1j*K0*.2)-np.exp(-1j*K0*.2))
    assert wrong_phase>.01
    cutoff=float(np.sin(np.pi/WL*.3/2)/.3)
    assert cutoff>1
    report=dict(gitSHA=git('rev-parse','HEAD'),adapterSHA256=digest(Path(__file__)),meepVersion=mp.__version__,
        independentBoundarySolve=formula,sheets=sheets,wrongMagneticSign=negative,
        wrongPhaseRelativeError=float(wrong_phase),resourcePilot2CellsPerUmBandArgument=cutoff,
        interpretation='Meep flux uses Re(E cross H*) without 1/2. Multiplying separately interpolated point fields is not identical to interpolating the Yee-grid flux; retain both and converge their discrepancy.',
        status='harness-pass-readout-anomaly-detected' if any(r['pointReadoutAnomaly'] for r in sheets) else 'pass',
        physicsReferenceStatus='uncomputed')
    (ROOT/'benchmark-results/s31-api-audit.json').write_text(json.dumps(report,indent=2)+'\n')
    print(report['status'])


if __name__=='__main__':
    main()
