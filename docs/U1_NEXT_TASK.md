# Current checkpoint — Linked 3D Report Details

Read docs/REPORT_DETAIL_INSETS.md. Branch feature/report-detail-insets, based on
S3.2 feature/s3-2-lens-design head cb94e372905719a0cd59ea5402eff6160cca647f.
PRs #13 / #14 / #15 remain unmerged; main baseline c246bb6e00242ba189a23edb3451db59dbc505f5.

Report D links overview regions to 3D Lens / Prism details, real dimensions,
world vertex distances, sampled ray direction and valid Gaussian reference
Beam diameters. Shared Project / Surface / Gaussian data; no schema or physics
changes. Preserve B/C, editing windows, exact SaveLoad and Undo.

Deliver validated standalone HTML and a Draft PR stacked on S3.2, then stop.
No main merge or next development without user authorization.

Current review follow-up: v0.9.2-report fixes magnified arrows / pen strokes
covering Prism geometry. Update existing Draft PR #16 and standalone HTML.
See docs/DESIGN_WORKFLOW_FEEDBACK.md for the requested move to direct design
and constrained synthesis. Clarify the open intent questions before implementing
the next solver stage; no Example expansion and no main merge are authorized.
