"""D2.8-B test-only scalar references, not a production POP / qualification engine.

Convention: exp(-i omega t), forward carrier exp(+i k x) removed. SI units.
FFT propagation has periodic boundaries; window/refinement and discarded-spectrum
ledgers are mandatory. L2 norm is the paraxial flux convention, not Maxwell power.
"""
from dataclasses import dataclass
import numpy as np
from scipy.fft import fft2, ifft2, fftfreq
from scipy.special import roots_legendre


@dataclass
class Grid:
    n: int
    width: float
    wavelength: float = 1.31e-6
    offset: float = 0.0  # fraction of a cell; sampling sensitivity, not Port movement

    def __post_init__(self):
        if self.n < 32 or self.n & (self.n - 1) or not np.isfinite(self.width) or self.width <= 0 or self.wavelength <= 0:
            raise ValueError('Positive finite window/wavelength and power-of-two grid >=32 required')
        self.dx = self.width / self.n
        self.axis = (np.arange(self.n) - self.n / 2 + self.offset) * self.dx
        self.y, self.z = self.axis[:, None], self.axis[None, :]
        f = fftfreq(self.n, self.dx)
        self.fy, self.fz = f[:, None], f[None, :]
        self.s2 = self.wavelength**2 * (self.fy**2 + self.fz**2)
        self.cosine = np.sqrt(np.maximum(0, 1 - self.s2))

    def power(self, u):
        return float(np.vdot(u, u).real * self.dx**2)

    def edge(self, u):
        p = abs(u)**2
        inside = (abs(self.y) < .4*self.width) & (abs(self.z) < .4*self.width)
        return float(np.sum(p[~inside]) / max(np.sum(p), 1e-300))

    def spectrum(self, u):
        a = fft2(u, workers=1)
        weight = abs(a)**2 * (self.dx / self.n)**2
        return {'longitudinalScalarFlux': float(np.sum(weight * self.cosine)),
                'evanescentL2': float(np.sum(weight[self.s2 >= 1])),
                'aboveNA01L2': float(np.sum(weight[self.s2 > .1**2])),
                'nyquistEdgeL2': float(np.sum(weight[(abs(self.fy) > .4/self.dx) | (abs(self.fz) > .4/self.dx)]))}

    def propagate(self, u, distance, method='AS'):
        if not np.isfinite(distance) or distance < 0 or method not in ('AS', 'Fresnel'):
            raise ValueError('Only forward homogeneous scalar propagation is supported')
        before = self.power(u)
        if distance == 0:
            return u.copy(), {'distance': 0., 'before': before, 'after': before, 'bandRemoved': 0., 'evanescentRemoved': 0., 'balanceError': 0.}
        a = fft2(u, workers=1)
        weight = abs(a)**2 * (self.dx / self.n)**2
        propagating = self.s2 < 1
        # Phase-gradient sampling: |d phase / d f| Delta_f <= pi on both axes.
        # This is a numerical band limit, NOT a physical aperture or acceptable loss.
        if method == 'AS':
            band = (self.wavelength * distance * abs(self.fy) <= self.width/2*self.cosine) & (self.wavelength * distance * abs(self.fz) <= self.width/2*self.cosine)
            phase = -2*np.pi*distance/self.wavelength*self.s2/(1+self.cosine)
        else:
            band = (self.wavelength * distance * abs(self.fy) <= self.width/2) & (self.wavelength * distance * abs(self.fz) <= self.width/2)
            phase = -np.pi*distance/self.wavelength*self.s2
        evanescent = float(np.sum(weight[~propagating]))
        removed = float(np.sum(weight[propagating & ~band]))
        v = ifft2(a * np.exp(1j*phase) * (propagating & band), workers=1)
        after = self.power(v)
        return v, {'distance': distance, 'before': before, 'after': after, 'bandRemoved': removed,
                   'evanescentRemoved': evanescent, 'balanceError': after+removed+evanescent-before}


def gaussian(y, z, w, distance, wavelength):
    q = 1 + 1j * distance / (np.pi*w*w/wavelength)
    return np.sqrt(2/np.pi)/w/q * np.exp(-(y*y+z*z)/(w*w*q))


def lens_boundary(grid, boundary, stride=1):
    rows = np.asarray(boundary['rows'])[::stride]
    r = np.hypot(grid.y, grid.z)
    amplitude = np.interp(r, rows[:, 1], rows[:, 2], right=0)
    opd = np.interp(r, rows[:, 1], rows[:, 3])
    return amplitude * np.exp(2j*np.pi/grid.wavelength*opd)


def masks(grid, case):
    theta = np.deg2rad(case['degrees'])
    s, c = np.sin(theta/2), np.cos(theta/2)
    a = case['fold']['clearRadius']
    R = case['fold']['bodies'][0]['radius']
    t = case['fold']['bodies'][0]['thickness']
    h = abs(case['offset'])
    z = grid.z * np.sign(case['offset'])
    aperture = grid.y**2 + (z/s)**2 < a*a
    rho = np.sqrt(np.maximum(0, R*R-grid.y**2))
    upper = ~((abs(grid.y) <= R) & (z >= h-s*rho) & (z <= h+s*rho+t*c))
    lower = ~((abs(grid.y) <= R) & (z <= -h+s*rho) & (z >= -h-s*rho-t*c))
    return aperture, upper, lower


def projected_fold(case, n, width, *, offset=0., placement='edge', method='AS', stride=1, obstruct=True):
    """Surrogate of four *transverse* screens in the unfolded chief-ray frame.
    The real tilted Mirror/backing boundaries are NOT these screens. Therefore
    results live only in projectedModelDiagnostic; physical Fold metrics are null.
    No lens/port/part parameter is changed by numerical screen placement variants.
    """
    g = Grid(n, width, offset=offset)
    theta = np.deg2rad(case['degrees'])
    q = max(0., case['fold']['bodies'][0]['radius']*np.cos(theta/2) - abs(case['offset'])/np.tan(theta))
    if placement == 'collapsed':
        q = 0.
    elif placement != 'edge':
        raise ValueError('Only declared screen-collapse diagnostics supported')
    lens = lens_boundary(g, case['boundary'], stride)
    u = lens.copy()
    ledger = []
    edges = [g.edge(u)]
    def prop(length, name):
        nonlocal u
        u, row = g.propagate(u, length, method)
        ledger.append({'stage': name, 'kind': 'propagation', **row})
        edges.append(g.edge(u))
    def mask(m, name):
        nonlocal u
        before = g.power(u)
        if obstruct:
            u = u*m
        after = g.power(u)
        ledger.append({'stage': name, 'kind': 'mask', 'before': before, 'after': after, 'removed': before-after})
        edges.append(g.edge(u))
    aperture, upper, lower = masks(g, case)
    prop(case['fold']['before']-q, 'Lens exit to upstream shadow screen')
    entrance = g.power(u)
    mask(upper, 'upstream neighbouring body projection')
    prop(q, 'upstream screen to Mirror 1')
    mask(aperture, 'Mirror 1 projected clear aperture')
    prop(case['fold']['middleLength'], 'unfolded Mirror 1 to Mirror 2')
    mask(aperture, 'Mirror 2 projected clear aperture')
    prop(q, 'Mirror 2 to downstream screen')
    mask(lower, 'downstream neighbouring body projection')
    # Reciprocity: identical reverse Lens is asserted by the TypeScript exporter.
    # Forward target-emitted field is conjugated to form the adjoint receiver mode.
    back, target_prop = g.propagate(lens, case['fold']['after']-q, method)
    target = np.conjugate(back)
    mode_amplitude = np.vdot(target, u)*g.dx*g.dx
    pout, ptar, pin = g.power(u), g.power(target), g.power(lens)
    raw = float(abs(mode_amplitude)**2)
    spec = g.spectrum(u)
    result = {'n': n, 'windowM': width, 'dxM': g.dx, 'gridOffsetCells': offset, 'placement': placement, 'method': method, 'boundaryStride': stride,
              'inputL2': pin, 'targetReciprocalL2': ptar, 'preFoldL2': entrance, 'lastScreenL2': pout,
              'reciprocalModePowerL2': raw, 'conditionalOverlapL2': raw/max(pout*ptar, 1e-300),
              'maxWindowEdgeFraction': max(edges+[g.edge(target)]), 'spectral': spec,
              'bandRemoved': sum(v.get('bandRemoved', 0) for v in ledger)+target_prop['bandRemoved'],
              'evanescentRemoved': sum(v.get('evanescentRemoved', 0) for v in ledger)+target_prop['evanescentRemoved'],
              'maxBalanceError': max(abs(v.get('balanceError', 0)) for v in ledger),
              'maskRemoved': sum(v.get('removed', 0) for v in ledger), 'ledger': ledger,
              'scope': 'Numerical transverse-screen + eikonal-Lens surrogate ONLY; not physical Fold Transmission or Output Mode Coupling'}
    return result, u


def direct_aperture(w, wavelength, degrees, distance, points, order=128, tilted=False):
    """Independent Rayleigh-Sommerfeld-I surface integral for prescribed Dirichlet
    data on a planar elliptical aperture, including 1/(kr) term. Real mirrors are
    NOT Dirichlet transmission screens. This tests flattening, not EM scattering.
    Surface x=alpha*z; dA*n=(1,0,-alpha) dy dz. Chief carrier is removed exactly.
    """
    s = np.sin(np.deg2rad(degrees)/2)
    alpha = 1/np.tan(np.deg2rad(degrees)/2) if tilted else 0.
    a = 200e-6
    nodes, weights = roots_legendre(order)
    t = nodes[:, None]*np.pi/2
    y = a*np.sin(t)
    z = s*a*np.cos(t)*nodes[None, :]
    jac = s*a*a*np.cos(t)**2 * np.pi/2 * weights[:, None]*weights[None, :]
    xs = alpha*z
    inc = gaussian(y, z, w, xs, wavelength)
    k = 2*np.pi/wavelength
    result = []
    for py, pz in points:
        if distance-alpha*pz <= 0 or distance <= np.max(xs):
            raise ValueError('Observation must be beyond aperture and in the chosen half-space')
        dx, dy, dz = distance-xs, py-y, pz-z
        r = np.sqrt(dx*dx+dy*dy+dz*dz)
        phase = k*(dy*dy+dz*dz)/(r+dx)
        kernel = (dx-alpha*dz)/(2*np.pi*r*r)*(1/r-1j*k)*np.exp(1j*phase)
        result.append(np.sum(jac*inc*kernel))
    return np.asarray(result)


def relative_field(a, b):
    return float(np.linalg.norm(a-b)/max(np.linalg.norm(b), 1e-300))
