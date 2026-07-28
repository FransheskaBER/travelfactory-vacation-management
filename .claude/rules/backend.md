---
paths:
  - "backend/**"
---

# Backend conventions (CEF + TypeORM)

## File layout — new code goes in its designated home, nowhere else
- src/handlers/         CEF entry points only (thin: parse → auth wrap → command → response)
- src/domain/commands/  one Command class per file
- src/domain/events/    event classes + dispatcher
- src/domain/listeners/ event listeners (logging etc.)
- src/errors/           DomainError subclasses + toErrorResponse (exists — extend it, don't relocate)
- src/repositories/     port interfaces + TypeORM adapters (only for
                        business-concept queries, per ADR 0001)
- src/entities/         TypeORM entities
- src/migrations/       generated + hand-reviewed migrations
- src/auth/             JWT issue/verify, requireRole wrapper
- src/db/               shared DataSource (dataSource.ts) — the only place
                        TypeORM is initialized
- src/generated/        codegen output (`npm run codegen`) — never hand-edited

## Handler shape — every write endpoint, no exceptions
Handlers implement HandlerFn from src/handlers/types.ts:
`(input, event) => Promise<object | Response>`. Success = return a plain
object; CEF wraps it. There is no ok() helper.

    export const approveRequest: HandlerFn = requireRole("Validator",
      async (input: ApproveRequestInput) =>
        new ApproveVacationRequestCommand(deps).execute(input));

How the verified identity from the JWT reaches the command is fixed in
the chunk 4.2 spec — do not improvise it per handler.
If a handler grows past ~15 lines, logic is leaking out of the command.

## Errors
- Commands throw DomainError *subclasses* (ConflictError,
  ValidationError, NotFoundError — src/errors/DomainError.ts).
  DomainError is abstract; the subclass, not the throw site, determines
  the HTTP status.
- src/errors/toErrorResponse.ts is the only thrown-error → HTTP
  translation point. Handlers never build error JSON or pick status
  codes by hand. The status mapping lives in its statusFor() — read it
  there, never restate it in docs or comments.
- Where toErrorResponse is invoked (per-handler catch vs. one shared
  wrapper) is a spec decision for chunk 4.2/4.7 — raise it in that
  spec's Q&A, don't decide it inline.
- Auth failures (401/403) are the requireRole wrapper's job (ADR 0003),
  not DomainErrors. Never let a business rule surface as a 500.

## Pagination (list-all endpoint)
- Query params: ?page=1&limit=20 (defaults; cap limit at 100)
- Response: { data, total, page, limit } — total from a count query,
  not data.length
- Always ordered (created_at DESC) — unordered pagination is
  nondeterministic across pages

## TypeORM
- Import the shared DataSource from src/db/dataSource.ts — enforced by
  lint (eslint.config.mjs bans `new DataSource()` outside that file);
  this line is a pointer, not the rule
- Entities use explicit column types (implicit any is tsc's job —
  strict mode is on)
- Seeds: bcrypt-hash passwords at seed time, cost factor 10
