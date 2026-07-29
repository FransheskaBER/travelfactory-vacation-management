# Technical Decisions

Decisions are numbered in the order they were made. D1–D7 were locked during
planning; D8–D15 were made during implementation. Where a decision has a full
ADR, the ADR holds the deeper reasoning — each entry here is the short form.

## D1 — Team vacation view is one shared page

- **Decision:** One shared view of approved requests, visible to both roles.
- **Alternative considered:** Separate team views per role.
- **Why this one:** The requirement is underspecified. One shared component is
  the simplest reading, recorded as an assumption in [assumptions.md](assumptions.md).
- **What it costs:** If the assignment meant something richer (per-team
  filtering, a full calendar), this reading undershoots it.

## D2 — Overlap rule enforced at the application level

- **Decision:** Rule 2 (no overlapping requests per user) runs inside
  `CreateVacationRequestCommand` via a `findOverlapping` query.
- **Alternative considered:** A Postgres exclusion constraint enforcing it in
  the database.
- **Why this one:** Simple and unit-testable with a fake repository. Full
  comparison in [ADR 0002](adr/0002-overlap-enforcement.md).
- **What it costs:** A read-then-write race window
  ([known limitation 1](known-limitations.md)).

## D3 — No role selection in the UI

- **Decision:** Role lives in `users.role`, is read server-side at login, and
  travels in the JWT. The frontend routes based on the JWT role.
- **Alternative considered:** The client declares its role (a role picker at
  login).
- **Why this one:** The client is never trusted to state its own permissions.
  Every protected route re-checks the role server-side
  ([ADR 0003](adr/0003-auth-placement.md)).
- **What it costs:** Changing a user's role means editing the database. There
  is no admin UI.

## D4 — TypeScript on both ends

- **Decision:** TypeScript everywhere, strict mode, `any` banned.
- **Alternative considered:** Plain JavaScript.
- **Why this one:** CEF scaffolds TypeScript, and one typed contract across
  the stack catches shape errors at compile time.
- **What it costs:** More tooling (tsc, codegen) and stricter compile
  discipline than plain JS.

## D5 — A domain layer on top of CEF

- **Decision:** A command bus and event dispatcher, hand-rolled, sit between
  CEF handlers and the database.
- **Alternative considered:** Business logic written directly in CEF handlers.
- **Why this one:** CEF only routes transport. Command classes make the six
  business rules testable without HTTP
  ([ADR 0001](adr/0001-cef-layering.md)).
- **What it costs:** More indirection than an app this small strictly needs.

## D6 — Test order: unit, then functional, then E2E

- **Decision:** Unit tests on business rules first, then functional endpoint
  tests, then one E2E happy path — cut from the bottom if time runs out.
- **Alternative considered:** E2E-first coverage.
- **Why this one:** The business rules are the evaluation spine; unit tests
  pin them at the lowest cost.
- **What it costs:** The E2E path was the item cut. The suite is 23 unit and
  10 functional tests; there is no browser-level test.

## D7 — Seeded passwords are bcrypt-hashed

- **Decision:** The seed script hashes every demo password with bcrypt, cost
  factor 10.
- **Alternative considered:** Plaintext passwords in seed data.
- **Why this one:** Seeded rows should be indistinguishable from rows the real
  login path could verify. Plaintext credentials in a repo fail code review on
  sight.
- **What it costs:** The demo password must be documented separately (README),
  since hashes cannot be read back.

## D8 — TypeORM runs with `synchronize: false`

- **Decision:** Schema changes happen only through explicit, committed
  migrations.
- **Alternative considered:** `synchronize: true`, which auto-alters the live
  schema by diffing entities on every startup.
- **Why this one:** Auto-sync cannot tell a renamed column from a
  drop-and-add — silent data loss with no audit trail. Migrations are
  versioned and reviewable.
- **What it costs:** Every schema change needs a generated, hand-reviewed
  migration file.

## D9 — All error paths go through `toErrorResponse`

- **Decision:** The entry point deviates from the CEF README template: every
  thrown error routes through `errors/toErrorResponse.ts`.
- **Alternative considered:** The template's catch block,
  `new Response(500, err)`, which serializes the raw error to the client.
- **Why this one:** Raw errors can carry stack traces, SQL fragments, or
  connection strings. Known `DomainError` subclasses map to safe 4xx
  responses; everything else is logged server-side and returned as a generic
  500.
- **What it costs:** A deliberate deviation from the framework's documented
  template — anyone comparing against the CEF README needs this entry.

## D10 — One error envelope everywhere

- **Decision:** Every non-2xx response is `{ error: { code, message } }`.
- **Alternative considered:** CEF's mixed shapes — a plain string on 404, a
  raw serialized error on 500.
- **Why this one:** The frontend interceptor reads `error.code` on any failure
  with no per-endpoint cases. Codes stay stable when messages are reworded.
- **What it costs:** The envelope is produced in exactly two places (the 404
  branch in `index.ts` and `toErrorResponse`); every new error path must route
  through them.

## D11 — `reviewed_by` column, beyond the assignment's schema

- **Decision:** `vacation_requests.reviewed_by`, a nullable FK to `users.id`,
  written only by the approve/reject commands.
- **Alternative considered:** Keeping the assignment's column list exactly.
- **Why this one:** The assignment's own validator dashboard shows who
  reviewed each request. Without the column, that fact is unrecorded.
- **What it costs:** A documented schema divergence. It is additive only — the
  given schema remains a strict subset, nothing removed, renamed, or
  repurposed.

## D12 — Single JWT, 24 h expiry, no refresh token

- **Decision:** One access token per login, valid 24 hours.
- **Alternative considered:** Short-lived access tokens with DB-backed refresh
  rotation.
- **Why this one:** The assignment asks for simple auth. One token keeps
  login, storage, and the frontend trivial.
- **What it costs:** No revocation — a stolen token stays valid until expiry
  ([known limitation 4](known-limitations.md)).

## D13 — Codegen calls the generator function directly

- **Decision:** `npm run codegen` imports CEF's generator function and then
  asserts every `x-handler`/`x-inputParser` ref in `root.yaml` exists in the
  generated registry.
- **Alternative considered:** CEF's documented `cef-gen-handlers` CLI.
- **Why this one:** The CLI silently no-ops when run through npm's bin
  symlink — its direct-execution guard misreads the symlinked path and exits 0
  without writing. The wrapper reads success off the effect, not the exit
  code.
- **What it costs:** It depends on a CEF internal export, verified against
  `commoneventframework@1.0.6`. Re-verify on any upgrade.

## D14 — Command bus is a thin executor

- **Decision:** Commands stay self-executing (own `execute()`,
  constructor-injected deps); the bus is the single dispatch choke point.
- **Alternative considered:** A classic registry bus — data-only command
  objects routed to executors registered at a composition root.
- **Why this one:** The registry contradicts ADR 0001's handler-owns-execution
  allocation and multiplies machinery for a domain with three commands.
- **What it costs:** A modest routing story — the event dispatcher carries the
  decoupling showcase. Full Q&A:
  [spec 3, §8 Q1](specs/3-command-bus-and-events.md).

## D15 — JWT moved to an httpOnly cookie mid-project

- **Decision:** Token transport migrated from localStorage plus
  `Authorization` header to an httpOnly `SameSite=Lax` cookie.
- **Alternative considered:** Keeping the localStorage design, which was built
  and verified first.
- **Why this one:** An injected script cannot read an httpOnly cookie. The XSS
  token-theft channel closes structurally, not by policy. Full reasoning:
  [ADR 0006](adr/0006-token-transport.md).
- **What it costs:** A CSRF surface opens (mitigated by `SameSite=Lax`; every
  mutating endpoint is a POST), logout needs a backend endpoint, and dev
  traffic must ride the Vite `/api` proxy. Migration record:
  [spec 12](specs/12-cookie-transport.md).
