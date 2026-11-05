"""D2.8-C bounded diagnostic controls, NOT a finite-body scattering solver.

SI; exp(-i omega t), exp(+ikx) carrier removed. The two surface integrals
prescribe DIFFERENT aperture boundary data; neither solves a metal disk.
"""
import numpy as np
from scipy.special import roots_legendre
from scalar_reference import gaussian


def prescribed_surface(degrees, radius, distance, points, order, kind='dirichlet'):
    """RS-I or RS-II on the actual tilted disk x=cot(theta/2) z.

    Independent polar-disk cubature (D2.8-B uses Cartesian ellipse quadrature).
    RS-I prescribes U on the disk and zero U on the rest of an infinite plane.
    RS-II prescribes dU/dn on the disk and zero derivative on the rest.
    The incident Gaussian is PARAxial; agreement with its continued field is a
    low-NA control, not an exact Helmholtz Gaussian or physical reflector result.
    """
    if kind not in ('dirichlet', 'neumann') or not 0 < degrees < 90:
        raise ValueError('Declared aperture control only')
    if radius <= 0 or distance <= 0 or order < 16:
        raise ValueError('Positive dimensions and adequate quadrature required')
    wavelength, w = 1.31e-6, 50e-6
    k = 2*np.pi/wavelength
    s, c = np.sin(np.deg2rad(degrees)/2), np.cos(np.deg2rad(degrees)/2)
    nodes, weights = roots_legendre(order)
    rho = radius*np.sqrt((nodes[:, None]+1)/2)
    phi = np.pi*(nodes[None, :]+1)
    y, z = rho*np.cos(phi), s*rho*np.sin(phi)
    x = c*rho*np.sin(phi)
    dA = radius**2/4*np.pi*weights[:, None]*weights[None, :]
    inc = gaussian(y, z, w, x, wavelength)
    q = 1+1j*x/(np.pi*w*w/wavelength)
    qp = 1j/(np.pi*w*w/wavelength)
    derivative = inc*(s*(1j*k-qp/q+(y*y+z*z)*qp/(w*w*q*q))
                      + c*2*z/(w*w*q))
    values = []
    for py, pz in points:
        if distance <= radius*c or s*distance-c*pz <= 0:
            raise ValueError('Observation outside declared outgoing half-space')
        dx, dy, dz = distance-x, py-y, pz-z
        r = np.sqrt(dx*dx+dy*dy+dz*dz)
        # Remove incident/output carrier analytically; avoid k(r+xs-L) cancellation.
        carrier = np.exp(1j*k*(dy*dy+dz*dz)/(r+dx))
        if kind == 'dirichlet':
            kernel = (s*dx-c*dz)/(2*np.pi*r*r)*(1/r-1j*k)
            field = inc*kernel
        else:
            field = -derivative/(2*np.pi*r)
        values.append(np.sum(dA*field*carrier))
    return np.array(values)


def lens_parameters(case):
    """Read unchanged first Lens vertices; fail closed outside this fixed fixture."""
    p = case['project']['model']['prescription']
    faces = [f for f in p['surfaces'] if f['interaction'] == 'refract'][:2]
    a = next(a for a in p['assemblies'] if a['id'] == faces[0]['assemblyId'])
    if (faces[1]['assemblyId'] != a['id'] or a['parentId'] is not None
            or any(a['frame']['rotation'].values())
            or any(any(f['frame']['rotation'].values()) for f in faces)
            or any(f['shape'] != 'sphere' for f in faces)
            or a['frame']['origin']['y'] != 0 or a['frame']['origin']['z'] != 0
            or any(f['frame']['origin']['y'] != 0 or f['frame']['origin']['z'] != 0 for f in faces)):
        raise ValueError('Only the existing coaxial first Lens control is supported')
    xs = [a['frame']['origin']['x']+f['frame']['origin']['x'] for f in faces]
    b = case['boundary']
    lengths = [xs[0]-b['launch'], xs[1]-xs[0], b['exit']-xs[1]]
    if min(lengths) <= 0 or faces[0]['nBefore'] != 1 or faces[1]['nAfter'] != 1 or faces[0]['nAfter'] != faces[1]['nBefore']:
        raise ValueError('Invalid first Lens medium/plane sequence')
    powers = [(f['nAfter']-f['nBefore'])/f['radius'] for f in faces]
    return lengths, powers, faces[0]['nAfter']


def quadratic_lens(grid, case):
    """Independent quadratic-surface Fresnel control, not the spherical Lens.

    Vertex phase powers are separated by the ACTUAL 300 um glass thickness.
    Internal diffraction is explicit at wavelength lambda/n. No Aperture or
    Fresnel coefficients: infinite lossless paraxial control only.
    """
    from scalar_reference import Grid
    lengths, powers, ng = lens_parameters(case)
    b, k = case['boundary'], 2*np.pi/grid.wavelength
    rr = grid.y*grid.y+grid.z*grid.z
    w, curvature = b['inputW'][0], b['inputC'][0]
    u = np.sqrt(2/np.pi)/w*np.exp(-rr/w**2+1j*k*curvature*rr/2)
    ledger = []
    for i, (length, index) in enumerate(zip(lengths, [1., ng, 1.])):
        medium = Grid(grid.n, grid.width, grid.wavelength/index, grid.offset)
        u, row = medium.propagate(u, length, 'Fresnel')
        ledger.append(row)
        if i < 2:
            u *= np.exp(-1j*k*powers[i]*rr/2)
    return u, ledger


def quadratic_analytic(y, z, case):
    """Closed Gaussian integral recurrence, independent of FFT / production Q code.

    U=A exp(-a r^2). Free propagation over reduced length B=L/n gives
    a'=a/(1+2iBa/k), A'=A/(1+2iBa/k); power surface adds ik P/2 to a.
    """
    lengths, powers, ng = lens_parameters(case)
    b, k = case['boundary'], 2*np.pi/1.31e-6
    w, curvature = b['inputW'][0], b['inputC'][0]
    a = 1/w**2-1j*k*curvature/2
    amp = np.sqrt(2/np.pi)/w+0j
    # Real ray transfer independently gives the zero-diffraction geometrical control.
    m = np.eye(2)
    for i, (length, index) in enumerate(zip(lengths, [1., ng, 1.])):
        reduced = length/index
        den = 1+2j*reduced*a/k
        amp, a = amp/den, a/den
        m = np.array([[1., reduced], [0., 1.]])@m
        if i < 2:
            a += 1j*k*powers[i]/2
            m = np.array([[1., 0.], [-powers[i], 1.]])@m
    magnification = m[0, 0]+m[0, 1]*curvature
    if magnification <= 0:
        raise ValueError('Caustic unsupported by this ray-amplitude control')
    ray_c = (m[1, 0]+m[1, 1]*curvature)/magnification
    rr = y*y+z*z
    wave = amp*np.exp(-a*rr)
    ray = np.sqrt(2/np.pi)/(w*magnification)*np.exp(-rr/(w*magnification)**2+1j*k*ray_c*rr/2)
    return wave, ray, {'matrix':m.tolist(), 'rayMagnification':float(magnification),
                       'waveRadiusM':float(1/np.sqrt(a.real)), 'waveCurvaturePerM':float(-2*a.imag/k)}


def phase_aligned_error(a, b):
    """Remove a global piston ONLY; never fit tilt, curvature, amplitude or Mode."""
    phase = np.angle(np.vdot(b, a))
    return float(np.linalg.norm(a*np.exp(-1j*phase)-b)/np.linalg.norm(b))
