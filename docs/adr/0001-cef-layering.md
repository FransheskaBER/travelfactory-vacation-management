# ADR 0001: CEF Layering — Transport vs Domain Boundary

**Status:** Accepted

## Context

CEF (Common Event Framework) is a transport-normalization framework: it reduces different event sources (API Gateway, direct invocation, etc.) to a single `CommonEvent`, then routes each request through a declared `inputParser` and `handler` pair, based on `root.yaml`.

CEF has no concept of "vacation request," "overlap," or "approval." Per the locked project decision that CEF only routes transport while commands/events form the domain layer, all domain logic has to live entirely inside the two functions CEF hands us: `inputParser` and `handler`. Left unresolved at project start: which of the two owns command construction, which owns command execution, and where persistence (TypeORM) is allowed to be touched.

## Decision

Split responsibility strictly by what each function is actually given access to.

- **`inputParser` — shape-only.** Takes the raw `CommonEvent`, checks that required fields are present and correctly typed, and either returns a plain parsed object or a `400 Response` if the shape is invalid. No database access, no domain construction. Its signature (`(event: CommonEvent) => any`) enforces this by design — it's never given a DB connection, only the raw event.
- **`handler` — everything domain-related happens here.** This is where the relevant Command (e.g. `CreateVacationRequestCommand`) is both constructed and executed: business-rule checks, database queries, persistence, and — on success — the domain event emission.
- **Persistence access from the handler is not uniformly direct or uniformly wrapped.** Rule: wrap a query behind a named repository method only when the query encodes a business rule or concept. Trivial lookups (find-by-id, find-by-email, filtered/paginated list-all) call TypeORM's built-in repository methods directly — wrapping them adds a layer with no meaning behind it. A query that names a business concept (e.g. "which existing requests overlap this date range") gets a named port method (`findOverlapping(...)`), backed by a small adapter class, so that concept has exactly one place to live and one place to change.
- **Events fire only after a successful commit**, from inside the handler. Listeners are downstream-only — they react to something that already happened and cannot gate or reverse it. Any rule that needs to *prevent* something (overlap, invalid dates, illegal status transition) must be checked before the commit, inside the handler, never inside a listener.

### Traced example — `POST /requests`

1. CEF's `buildCommonEvent()` normalizes the raw HTTP event into a `CommonEvent`.
2. CEF resolves the route to its declared `inputParser` and `handler`.
3. `inputParser` reads the body, checks `start_date`/`end_date` are present and well-formed (`reason` optional) — returns parsed input, or a `400` if malformed. No DB call, no business-rule knowledge.
4. `handler` receives the parsed input. `CreateVacationRequestCommand` is constructed and run here:
   - Re-validates date ordering and "not in the past" authoritatively (the parser's version, if any, is UX fast-fail only — this is the rule that actually governs).
   - Calls `VacationRequestRepository.findOverlapping(userId, start, end)` — the one named port in this flow, since "overlap" is a defined business concept.
   - Overlap found → return `409`/`400`. Stop here — no row written, no event fired.
   - Clear → save the new row via TypeORM directly (plain insert; nothing business-specific about "save a row").
5. On successful commit: emit `VacationRequestCreatedEvent`.
6. A logging listener reacts afterward, writing a log line. It has no power over whether the request was accepted — that decision is already final by the time it runs.

## Consequences

**Benefits:**
- The domain layer (commands, rules, events) is fully decoupled from CEF — if CEF were swapped for a different transport framework, only the `inputParser`/`handler` wiring changes, not the commands.
- Parsers stay unit-testable without a database (plain event in, plain object out). Commands stay unit-testable by faking the one repository port instead of spinning up Postgres.
- The repository layer stays deliberately small: one named method (`findOverlapping`) plus TypeORM's defaults everywhere else — avoids the common trap of wrapping every query behind a generic interface that mirrors TypeORM 1:1 and adds no real abstraction.

**Trade-offs:**
- Requires discipline under time pressure — easy to let "just one more query" slip into a parser. Self-review should check that no `inputParser` ever imports the ORM.

## Alternatives Considered

- **Command constructed in the parser, executed in the handler** — rejected. The parser has no DB access by design, so any query-dependent logic (the overlap check) can't run there without reaching into a global DB singleton, breaking parser testability and blurring the transport/domain boundary.
- **Wrap every repository call behind a generic interface** (`IRepository<T>` with `findById`, `findAll`, etc.) — rejected. TypeORM's `Repository<T>` already is that abstraction; a second generic wrapper adds indirection without adding meaning. Reserved for queries that encode an actual business rule.
- **Gate business rules from within event listeners** — rejected outright. Listeners fire after commit; by definition they can't prevent the thing they're reacting to.

## Related ADRs

- Overlap-enforcement specifics (Rule 2, race-condition note) → ADR 0002
- Auth placement in the CEF pipeline → ADR 0003
- Shared `assertPending()` guard → ADR 0004
