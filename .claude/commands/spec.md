---
description: Create an implementation spec for a Phase 4 chunk before any code is written
argument-hint: <chunk number and name, e.g. "4.4 domain commands">
allowed-tools: Read, Write, Glob, Grep
---

Create an implementation spec for chunk: $ARGUMENTS

## Process (in order, do not skip)
1. Read docs/tdd.md sections relevant to this chunk, every ADR it touches,
   docs/assumptions.md (do not re-ask what it already resolves), the
   chunk's line in docs/travelfactory-assignment-checklist.md, and the
   relevant paths in backend/src/root.yaml. Read existing code the chunk
   builds on.
2. Before writing the spec: ask me every question where the docs are
   ambiguous or silent. Record each question AND my answer in the spec's
   Q&A section. Do not invent answers.
3. Write the spec to docs/specs/<chunk-id>-<slug>.md following the
   structure in docs/specs/_template.md exactly.
4. Stop after writing. I review and approve before implementation starts.

## Rules
- The spec must fit one Claude Code session comfortably (~2 pages max)
- If this chunk forces a change to docs/tdd.md or contradicts an ADR,
  say so explicitly and stop — that's a design conversation, not a spec
