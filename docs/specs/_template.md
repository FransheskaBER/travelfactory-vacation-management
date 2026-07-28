# Spec: {chunk-id} — {name}

**Status:** draft <!-- the human flips this to `approved` — nothing else does -->

> **Freeze rule:** Sections 1–8 freeze at human approval. Section 9 is
> append-only during implementation — deviations get recorded, never
> retro-edited into the plan.

## 1. Overview
What this chunk does and why — traced to a PRD requirement, TDD section,
or ADR. One paragraph.

## 2. Scope (in)
What this chunk delivers.

## 3. Out of scope
Explicit. Anything a reasonable implementer might assume is included but
isn't, with a pointer to the chunk that owns it.

## 4. Design
Chunk-specific decisions only. Reference ADRs by number — never restate
their content (restatement is where drift starts).

## 5. Contracts
Exact shapes: TypeScript types/signatures, endpoints, status codes,
error codes. If it crosses a boundary, its shape is written here —
acceptance criteria without contracts leave shape-invention to the
implementer.

## 6. Acceptance criteria
Testable statements. Cover success AND failure paths.
Every criterion states an **observable postcondition** — a checkable state
of the world — never a command that was executed. "Ran X" is satisfiable by
a silent no-op; only X's effect verifies it. (Added after 4.2's
stale-registry incident — spec 2-auth §9.)
Criteria state **invariants, not input enumerations** — when the intent is
a property ("every 4xx wears the D10 envelope"), write the property, and
demote probes to minimum samples ("verified at minimum with: …"). An
enumerated probe list leaves the gap between the cases outside the claim.
(Same 4.2 review — the JSON-valid non-object input escaped §6.3's
enumeration entirely.)

## 7. Testing requirements
Derived from §6 only — no test invents a requirement.

### Files touched (advisory)
Planning aid, **not a contract**. If implementation touches a file not
listed here, that's a §9 entry, not a violation.
Derived artifacts (lockfile, generated registry) are entailed by their
generating action — never listed here, never flagged as unspecified.

## 8. Q&A
Questions raised before approval, with answers. Ambiguity surfaces here,
before code exists — an unanswered question blocks approval.

## 9. Implementation Results
Append-only during build: deviations from §1–8 and why, unpredicted
files touched, anything discovered that the next spec should know.
