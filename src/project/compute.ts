import { compile } from '../surface/model';
import { tracePrescription } from '../surface/trace';
import type { Trace } from '../surface/trace';
import type { Project } from './model';
import { prescription, projectFingerprint } from './model';
import { bodyGeometry, insideBody } from './geometry';
export function projectTrace(p: Project): Trace {
    const d = prescription(p), surfaces = compile(d), geometry = bodyGeometry(d, surfaces, p.bodies, p.sourceBody), fingerprint = projectFingerprint(p);
    if (p.model.kind === 'ideal' || geometry.issues.length)
        return { status: 'invalid', reason: p.model.kind === 'ideal' ? 'Ideal Thin Lens 설계입니다. Surface는 위치·Clear Aperture 참조이며 물리적 곡면/Geometric Ray Trace는 미정의입니다.' : geometry.issues.join(' · '), paths: [], surfaces, reached: 0, centroid: null, centroidLocal: null, rms: null, fingerprint };
    return { ...tracePrescription(d, (point, s) => insideBody(point, s, geometry)), fingerprint };
}
