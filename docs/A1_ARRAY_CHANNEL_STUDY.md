# A1 — Channel evaluation and reference examples

Based on UX1 PR #28. This checkpoint does not merge the review stack.

## User-facing flow

Templates retains Edge / Vertical / Evanescent categories. Each card has one start action,
a short optical path, and collapsed component roles / assumptions / reference information.
The selected scenario remains in Project JSON and is available in 설계 조건 and Report metadata.
It describes the original starting scenario, not a certification of later edits.

Conditions-only templates still insert no optical components. Two separate **계산 연습**
entries insert actual modeled surfaces, with explicit synthetic assumptions:

* Mirror 방향 전환: eight independent Gaussian launches through one shared 45° planar
  reflector, 250 µm pitch, two 0.5 mm path segments, 60 µm MFD and 1310 nm wavelength.
  This is a broad-beam reference at virtual planes, not a real Fiber/PIC prescription,
  individual mirror array, or thermal/mechanical model. Output roll starts at 1 mrad.
* 공용 2-Lens Relay: two finite BK7 spherical lenses constructed by the existing relay
  builder, 1 mm thickness each, 1 mm clear radius, 10 mm Port spacing, eight 127 µm-pitch
  ports, 9.2 µm MFD at 1310 nm. Reference channel is #4. Output roll of 180° represents
  image inversion. The on-axis seed is matched; off-axis channels are separately evaluated
  and some exceed the existing first-order spherical domain. This is intentionally a
  **partial** example. It never reports a whole-array average from the surviving subset.

Analysis → Array Channel 평가 → Channel별 비교 실행 evaluates nominal and changed states.
The optional Output change controls persist in JSON / Undo / Redo. Results have a project
fingerprint, are suppressed after edits or unapplied numeric input, and require re-evaluation.
Undo back to exactly the evaluated project may reuse the result. JSON download and Report
SVG metadata contain every channel, failure reason, settings and evaluator identifiers.
Report SVG's visible caption states coverage and that the displayed rays are representative.
The geometry area retains a minimum height while result sections scroll separately; Korean
scenario titles use an embedded font in both the SVG and PNG export.

## Attachment interpretation

Reviewed the supplied three images and all six pages of the supplied Focuslight brochure.
The original patent identifiers and image provenance were not supplied; no attribution or
optical prescription is inferred from unreadable numbers or diagram scale.

| Reference | Adopted scenario | Not inferred |
| --- | --- | --- |
| Mirror Array / thermally-stable frame / groove image | Array direction change and mechanical registration | PIC type, lens power, actual pitches, thermal stability value |
| FIG.3 and Spacer cross-section | Fiber facet and folded path through/around a spacer | TIR versus coating, glass index, actual lens surfaces and dimensions |
| Focuslight brochure p.3 | FAU, connector collimation and PIC connections | Complete manufactured optical prescription |
| Focuslight p.4–5 | FAU-side collimator/reflector and PIC-side focusing microprism lens ending at Edge Coupler | Curvature, coating, PIC receiving field, product coupling efficiency |

127 µm and 250 µm are listed pitch options on brochure p.4; our chosen channel counts,
port spacings and example modes remain labeled synthetic assumptions. Vendor tolerance
limits are not imported as Gaussian σ or yield distributions. The PDF shows integrated
lens/prism functions, so external component count is not equated with optical function count.
An ordinary fold redirects light; collimation/refocusing must be supplied when required by
the intended mode transformation. No universal “every prism needs two lenses” rule is used.
Source images/PDF are not embedded or redistributed in the repository or offline HTML.

## Physics contract

Evaluator: `shared-optics-channel-study/1.0.0`, wrapping the existing transported Gaussian
and conditional tensor-overlap evaluators. This introduces independent channel sampling,
not a new electromagnetic solver or a broader validity domain.

For each explicit row-major Input/Output pair, move the source frame to that channel's
physical position and the Output probe to the receiving channel position. Keep **all
optical assemblies and their surfaces fixed**. Each port uses the corresponding declared
source/target reference Mode. We do not clone Lens/Mirror components or infer lenslets.
The current single-channel solver's geometry, aperture, spherical-incidence, PIC-field,
TIR/combined-lens, divergence and phase gates apply independently to each sampled channel.
Surface arrays remain unsupported by that solver. Unequal/unassigned mappings and
Evanescent interfaces are not evaluated.

The changed state applies Output-only local translation, roll, tilt Y/Z and signed pitch
deltas. For nominal Output frame F and settings d:

`F_changed = F ∘ Pose(0, shiftY, shiftZ, yaw=tiltZ, pitch=tiltY, roll=roll)`

The rotation matrix is `Rz(tiltZ) Ry(tiltY) Rx(roll)`. Grid coordinates use `pitchY + deltaY`
and `pitchZ + deltaZ` about the selected reference channel. That reference is the explicit
rotation/pitch pivot. Changing the reference preserves nominal port locations but changes
this experiment's pivot. Input, lenses, mirrors and prisms stay fixed. This is a comparison
of two user-defined states, not OAT bounds, a distribution, a joint worst-case or a yield.

Offsets are limited to ±100 µm, angles to ±10 mrad and pitch deltas to ±10 µm. Actual pitches
must stay positive. Max 256 channels gives at most 512 evaluations per user-triggered run.
No cross-channel fields, coherent sums, random per-channel jitter, replicated micro-optics,
neighbor-body clearance, diffraction from clipping, Fresnel throughput or total coupling
are evaluated. Existing representative-channel synthesis/tolerance remains unchanged.

Each state has a whole-array conditional mean/worst only if **every** requested channel
returns a valid conditional overlap. Missing channels are not replaced by zero or copied
from the representative. Worst channel uses log-overlap to retain ordering under numerical
underflow. `totalCoupling`, `crosstalk`, `yield` and Array tolerance remain null.

## Validation

* Independent analytic circular-Gaussian free-space overlap:
  `eta = exp(-d² / (w² D)) / D`, `D = 1 + (L / (2 zR))²`, `zR = π w² / λ`.
  Checks all 16 positions in a 4×4 grid with shared shifts, roll and pitch deltas.
* The planar mirror example agrees with the unfolded 1 mm free-space result.
* Arbitrary common world rigid transformations preserve nominal/changed results.
* Representative changes preserve nominal results; tilt rotates about the stated pivot.
* Actual two-Lens on-axis overlap exceeds 0.99; invalid outer channels produce partial
  coverage with no whole-array aggregate. Clipped mirror edges similarly remain partial.
* No mutation of source project; optical assemblies remain fixed across channels;
  schema, mapping, field gates, JSON roundtrip and stale-result suppression.
* Offline desktop/mobile examples, actual computation, settings, result JSON, Report SVG
  metadata/caption, stale-result removal and reference descriptions.

Final test totals and artifact provenance are recorded in the PR.

## Next checkpoint — Astra recommended

Explicit per-channel micro-optic ownership and repeat transforms, lenslet/prism surface
construction with parity/mapping, channel-specific mode definitions, independent field
benchmarks and mutual/finite-body clearance. Then separate common rigid alignment,
systematic pitch and random per-channel errors for a verified tolerance model. A faithful
Focuslight-style collimator/reflector + focusing microprism example requires these contracts
and sufficient material/curvature/receiving-field inputs; it is not claimed complete here.
