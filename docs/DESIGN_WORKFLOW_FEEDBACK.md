# User intent checkpoint · direct constrained optical synthesis

User feedback after Report review (2026-10-25): growing a catalog of Example
Projects makes real design difficult. Keep Input / Output Mode Ports at user-
defined locations and MFD. Author optical Surfaces in the existing row-based
editor, define e.g. four Surfaces, then request solutions for the remaining
optics. Compare combinations involving Lens, Mirror, Prism, Microlens and
possibly Parabolic / Freeform Surfaces while working in the actual Project.

This is a proposed next direction, not an implemented universal synthesis
engine. No new Example Projects are added by this fix. Current bounded routing
and one/two-Lens Q-reference fitting cannot silently evaluate arbitrary
Freeform, curved reflection, array fields or actual PIC receiving-field
coupling. Broader geometric / field evaluators and constraint search are
required before those candidates can be ranked as optical Mode solutions.

Original clarification questions (answered below):
1. Do the four authored Surfaces mean entirely fixed prescription values,
   per-parameter locks, or a starting layout whose count/type may also change?
2. Which shape / manufacturing families may be proposed, and what bounds apply
   to extra component count, allowed volume, materials and minimum features?
3. What ranks candidates: best Mode matching, compact/few-part solutions that
   meet a threshold, or alignment / assembly robustness?

Proposed workflow, subject to these answers: same canonical Project → editable
Surface rows with fixed/variable values and bounds → bounded component-family
and placement search → parameter optimization → geometry + field validation →
ranked candidates with residuals, assumptions and limitations → Preview / Apply
with one Undo. Position, direction and MFD / phase goals must be distinct;
geometric ray arrival alone never qualifies as Mode coupling. Exhausted search
reports its best tested candidates and remaining errors, not proof of global
infeasibility or a guaranteed answer for every arbitrary configuration.

Accepted user answers: four Surfaces are a starting layout whose type/count may
change; user supplies additional component limits and allowed volume; alignment
and assembly robustness is the first priority. User authorized development of
the first Design Problem checkpoint. See D1_DESIGN_PROBLEM.md for its implemented
bounded scope and explicit later extensions.
