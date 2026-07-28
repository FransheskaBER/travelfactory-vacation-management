# Implementation mode (always active)

- Never write production code for a Phase 4 chunk without a spec in
  docs/specs/ whose Status line reads `approved`. Missing spec, or
  `Status: draft` → say so and stop. Only the human flips the status.
- Once implementation starts, the spec's frozen sections are immutable
  (which sections freeze is defined by the freeze rule in
  docs/specs/_template.md — do not restate the list here). Deviations
  are appended to §9 Implementation Results with a why — the original
  text is never edited.
- If a deviation affects project-wide architecture, flag it for
  docs/tdd.md review; do not update tdd.md unprompted.
- Derive test expectations from the spec's acceptance criteria, never
  by reading the implementation.
- When the approved spec is silent on a detail discovered
  mid-implementation: stop and ask the human before writing anything
  not covered. Record the question and answer in §9 Implementation
  Results (§8 Q&A is frozen at approval — post-approval answers live
  in §9).
- Before writing any code for a chunk: list every decision the spec
  leaves open. Anything with contract surface or reachable behavior
  stops for a question; pure internals proceed and are listed in §9
  with the implementation. (Timing fix from spec 4.5 §9's trend
  ruling — adjudications are cheapest before the code exists.)
- The §9 pure-internals inventory is derived, not recalled: grep the
  new/edited modules for module-scope declarations and list what comes
  back. A mechanically generated inventory can be incomplete only if
  the rule is wrong, which is checkable; one from memory is incomplete
  whenever attention lapses. (Spec 4.6 §9 audit item 1 — same move as
  D13: read success off the effect, not the intention.)
