# Current checkpoint — S0 / S1 Port Routing

Read `docs/S0_S1_PORT_ROUTING.md`. The user approved the staged Port-to-Port
solution-synthesis plan and authorized S0 / S1 implementation. F1.1 source and
Draft PR #11 are preserved; no merge was authorized.

Branch: `feature/s0-s1-port-routing`, stacked on `feature/f1-1-conic-aspheric`.
PC first. Deliver a Draft PR and standalone HTML for Play Review. Do not merge
main, PR #11, or this checkpoint; do not automatically begin S2.

One canonical Project: optional routing constraints, optional Port device metadata,
Input Source frame and Output last-probe frame. World Output edits must transform
back through the existing parent hierarchy. Mode definitions and mechanical bodies
remain separate. Reuse finite 3D Surface rays / geometry, never World-X sorting.

Center reference ray diagnostics report target-local position, directional incidence
error and OPL. They never imply mode coupling. PIC Gaussian values are user
references; receiving Field / device response and folded Gaussian propagation are
unavailable. Space sampling / conservative AABB Keep-out checks are labeled limits.

Manual examples: Fiber z −10 µm → Lens → two Mirrors → PIC z +50 µm (+X),
and Fiber → Lens → BK7 TIR Prism → PIC (+Z). They are explicit manual prescriptions,
not solver-generated solutions. Preserve the 10 mm Fiber–Lens–Fiber starter.

Future: S2 topology / pose search, S3 Beam / Mode matching, S4 Field / Coupling.
