---
description: Audit implementation against its spec; report, don't fix
argument-hint: <chunk id, e.g. "4.4">
allowed-tools: Read, Glob, Grep, Bash(npx tsc --noEmit:*), Bash(npx vue-tsc:*), Bash(npm test:*), Bash(npm run lint:*)
---

Audit chunk $ARGUMENTS against docs/specs/$ARGUMENTS-*.md.
If no spec file matches, stop and say so — there is nothing to audit
against, and that is itself the finding.

## Process (in order)
1. Read the full spec, including §9 Implementation Results. A deviation
   already recorded in §9 is adjudicated — do not re-flag it.
2. Compare the implemented code to every Contract (§5) and every
   Acceptance criterion (§6).
3. Check test traceability in BOTH directions: every acceptance
   criterion has a test, and no test asserts behavior the spec doesn't
   require (tests derived from the implementation instead of §6).
4. Run the done-gates on the affected package: `tsc --noEmit`, lint,
   affected tests.

## Output — three lists
- ✅ satisfied
- ❌ violated (file:line + what differs from the spec)
- ⚠️ implemented-but-unspecified (scope creep or silent decisions)

Change NOTHING — no code edits, no spec edits, no §9 appends. I decide
per deviation: fix the code, or append the deviation + rationale to §9
Implementation Results myself.
