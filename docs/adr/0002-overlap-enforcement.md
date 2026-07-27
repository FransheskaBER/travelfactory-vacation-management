# ADR 0002: Overlap Enforcement — Application-Level Check

**Status:** Accepted

## Context

Rule 2 — vacation requests cannot overlap for the same user. Pending and Approved requests block a new overlapping request; Rejected requests do not (two ranges overlap when `newStart <= existingEnd AND newEnd >= existingStart`, since dates are inclusive). This needs to be enforced somewhere before a new request is persisted.

## Decision

Enforce entirely at the application layer, inside `CreateVacationRequestCommand`'s handler. A single query — `findOverlapping` (the named port from ADR 0001) — checks for any Pending/Approved request for the same user whose range intersects the new one, before the insert runs.

```ts
const overlapping = await requests.findOverlapping(userId, startDate, endDate);
if (overlapping.length > 0) {
  throw new ConflictError('Overlapping vacation request exists');
}
await requests.save(newRequest);
```

## Consequences

**Benefits:**
- Straightforward to implement and read — one query, one guard, inside the same command that already owns every other Rule-1/Rule-4 check for this request.
- Easy to unit test in isolation with a fake repository (ADR 0001) — no need for concurrent transactions or database-level constraints to exercise the rule.
- Keeps all business-rule enforcement for request creation in one place — a reviewer checking "where are the business rules" finds them all inside one command, not split between application code and database schema.

**Trade-offs:**
- **Race condition**: read-then-write is not atomic. Two concurrent requests for the same user, for overlapping dates, submitted at nearly the same instant, could both pass the overlap check before either commits — resulting in two overlapping requests that both reach Approved-eligible state. At this project's actual traffic level (single-user local testing, no concurrent load), this is unlikely to surface in practice, but it is a real gap, not a theoretical one.
- The check is only as strong as every code path that writes to `vacation_requests`. A future feature (bulk import, admin override) that inserts rows without going through this command would bypass it entirely.

## Alternatives Considered

- **Postgres exclusion constraint** (`EXCLUDE USING gist` on `user_id` with a date-range overlap operator) — the database-level fix for the race condition above; genuinely closes the gap, since Postgres itself refuses the second concurrent insert. Not implemented here: it requires a GiST index and a range-type column added to the schema, plus a second failure path (constraint violation → application-level error mapping) to handle. Documented as a known limitation and "what I'd do with more time" rather than a silent gap.

## Related ADRs

- Query enforced through the `findOverlapping` port established in ADR 0001.
