# TravelFactory — Vacation Management (technical test)

Vacation request app, two roles: Requester submits, Validator approves/rejects.
Stack: Vue 3 + TS + Pinia + Tailwind (frontend) · Node + TS + CEF + TypeORM +
PostgreSQL (backend).
This is a graded assignment. Optimize for readability and clear architecture
over cleverness.

## Source of truth (read before changing the relevant area)
- Requirements, roles, business rules: docs/prd.md
- Architecture + reasoning: docs/tdd.md and docs/adr/ (0001–0005)
- API contract: backend/src/root.yaml — the YAML is the contract; handlers
  conform to it, never the reverse
- Ambiguity resolutions: docs/assumptions.md — do not re-decide resolved
  ambiguities
- Per-chunk implementation specs: docs/specs/ — created via /spec, approved
  by the human before any code

## Hard rules (a diff violating these is wrong even if it works)
- inputParsers are shape-only: no ORM imports, no DB access, no business
  rules (ADR 0001)
- Business rules live inside Command classes only — never in parsers,
  listeners, or handlers directly
- Domain events fire only after successful commit; listeners react, they
  never gate or prevent (ADR 0001)
- Role and identity come from the verified JWT server-side, never from
  client-supplied input (ADR 0003)
- Named repository methods only for queries encoding a business concept
  (e.g. findOverlapping); trivial CRUD uses TypeORM directly (ADR 0001)

## Conventions (cross-stack; stack detail lives in .claude/rules/)
- TypeScript strict everywhere. `any` is banned — precise types or
  `unknown` + narrowing
- Naming: commands `VerbNounCommand`, events `NounVerbedEvent`, one class
  per file, filename = class name
- One error shape end to end: `{ error: { code, message } }`. Backend
  produces it, frontend parses it — nothing else crosses the wire on failure
- No hardcoded environment values (ports, secrets, URLs, DB config) —
  process.env only, every variable documented in .env.example
- Comments explain *why*, not *what*. No commented-out code in commits

## Workflow (non-negotiable)
- NEVER run `git commit` or `git push`. The human reviews every diff and
  commits manually
- No production code for a Phase 4 chunk without an approved spec in
  docs/specs/ (see .claude/rules/implementation-mode.md)
- Do not invent CEF APIs. Verify any CEF method against the package README
  before using it. If unsure, say so
- After any edit to root.yaml: run `npm run codegen`, confirm the generated
  registry compiles
- Database changes via TypeORM migrations only (synchronize: false, D8).
  Never edit an already-applied migration
- Before declaring a task done: `tsc --noEmit` passes, lint passes,
  affected tests pass
- If a task conflicts with an ADR or a spec, stop and flag the conflict —
  do not silently deviate
