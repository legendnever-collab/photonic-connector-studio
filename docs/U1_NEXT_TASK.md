# Current checkpoint — S2 Bounded Port Routing Search

The user merged F1.1 PR #11 and S0/S1 PR #12, then explicitly authorized S2.
Main baseline: c246bb6e00242ba189a23edb3451db59dbc505f5.
Branch: feature/s2-route-search. Read docs/S2_ROUTE_SEARCH.md.

Preserve the existing canonical Project, strict v1 SaveLoad, Source/Target Mode
contracts, frames, BK7 material dispersion, Surface/Report evaluators and 10 mm
Fiber–Lens–Fiber startup. The added displaced PIC routing task is an extra example.

S2 fixes the existing Lens prefix and both Ports, enumerates Direct / one or two
Mirrors / right-angle BK7 TIR Prism / Mirror+Prism, analytically closes geometric
paths and samples/refines bounded placements. Revalidate actual finite rays,
component/space/clearance constraints, not just construction lines. Preview never
writes the Project; Apply is one Undo and checks the exact baseline signature.

No arrays, non-air Ports, or Lens-after-fold search. Lens shapes / Modes / physical
Coupling are not optimized. AABB clearance is conservative broad-phase screening,
not certified solid collision or global infeasibility proof. Budget exhaustion,
unsupported setups, cancellation and no candidate found are distinct outcomes.

PC first. Deliver Draft PR and standalone HTML, then stop for Play Review.
Do not automatically merge main or start S3.
