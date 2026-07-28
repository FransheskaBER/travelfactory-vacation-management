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

## 7. Testing requirements
Derived from §6 only — no test invents a requirement.

### Files touched (advisory)
Planning aid, **not a contract**. If implementation touches a file not
listed here, that's a §9 entry, not a violation.

## 8. Q&A
Questions raised before approval, with answers. Ambiguity surfaces here,
before code exists — an unanswered question blocks approval.

## 9. Implementation Results
Append-only during build: deviations from §1–8 and why, unpredicted
files touched, anything discovered that the next spec should know.
