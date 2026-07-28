# Spec: 4.4 — Domain commands + business-rule validation

**Status:** approved

> **Freeze rule:** Sections 1–8 freeze at human approval. Section 9 is
> append-only during implementation — deviations get recorded, never
> retro-edited into the plan.

## 1. Overview
Builds the three vacation-request domain commands from TDD §3/§4 —
`CreateVacationRequestCommand`, `ApproveVacationRequestCommand`,
`RejectVacationRequestCommand` — with Business Rules 1–5 enforced inside
them (D2, ADR 0001/0002), plus the `VacationRequestRepository` port and its
TypeORM adapter (the `findOverlapping` business-concept query, ADR 0001/0002)
and the shared `assertPending()` guard (ADR 0004). Commands implement the
4.3 bus's `Command` interface; 4.6's handlers will dispatch them through
`commandBus.execute(...)`. Checklist item 4.4. This chunk ships the domain
layer with no HTTP surface — its consumers arrive in 4.6 (§8 Q5 fixes how
it is verified without one).

## 2. Scope (in)
- `src/repositories/VacationRequestRepository.ts` — port interface:
  `findOverlapping` + `findOneBy` + `save` (§8 Q2)
- `src/repositories/TypeOrmVacationRequestRepository.ts` — adapter;
  constructor takes `Repository<VacationRequest>` (TDD §3)
- `src/domain/commands/CreateVacationRequestCommand.ts` — Rules 1, 4, 2
- `src/domain/commands/ApproveVacationRequestCommand.ts` — Rule 3
- `src/domain/commands/RejectVacationRequestCommand.ts` — Rules 3, 5
- `src/domain/commands/assertPending.ts` — shared guard (§8 Q8)

No new dependencies. No `root.yaml` edit — therefore no codegen run this
chunk.

## 3. Out of scope
- Event classes, `emit` calls inside commands, listeners — chunk 4.5 owns
  all three together (§8 Q1). Commands here end at save-and-return.
- Handlers, input parsers, routes, `requireRole` wiring — chunk 4.6.
  Until then the commands have no production caller.
- Input *format* validation (is this string `YYYY-MM-DD`?) — parser's job,
  chunks 4.6/4.7 (§8 Q6). Commands trust the shape and check meaning.
- Read/list endpoints — not commands; TDD §4's catalog is complete at four.
  4.6's handlers query directly (trivial CRUD, ADR 0001).
- `FakeVacationRequestRepository` + automated unit tests — Phase 5
  (§8 Q5; 4.3 §8 Q8 precedent). The port interface built here is what
  Phase 5 fakes.
- Postgres exclusion constraint for the overlap race — rejected in
  ADR 0002, Known Limitations material.
- `reason` normalization (`""` vs `null`, trimming) — 4.7's validation
  pass, same shape-vs-meaning split as §8 Q6. This chunk's command
  stores what it receives (`reason ?? null`).

## 4. Design
- **Command shape.** Each command implements `Command<TInput, TResult>`
  (4.3 §5), constructor takes
  `deps: { requests: VacationRequestRepository }` — one injected port
  (§8 Q2). Commands throw `DomainError` subclasses; `statusFor` already
  maps them (backend.md — status mapping is read there, not restated).
- **Identity.** Inputs carry `actorId` verbatim as merged by `requireRole`
  (spec 4.2 §4's fixed mechanism) — create: the requester's id;
  approve/reject: the validator's (§8 Q3). Handlers stay pass-through.
- **Dates are strings.** All comparisons are `'YYYY-MM-DD'` string
  comparisons (spec 4.1 §5 note — lexicographic order equals chronological
  order for this format). "Today" = `new Date().toISOString().slice(0, 10)`
  — server UTC date (A5). No format re-checking (§8 Q6).
- **Create — check order fixed:** Rule 1 (`endDate >= startDate`, A2) →
  Rule 4 (`startDate >= today`, A5/A6) → Rule 2
  (`findOverlapping(actorId, startDate, endDate)` non-empty → conflict).
  Input-only checks run before the query touches the DB. On clear: build
  the entity (`userId = actorId`, dates, `reason ?? null`), set `status`
  **explicitly** to `Pending` — entailed by §5: the DB default would leave
  `status` unset on the returned object without a reload, and the contract
  returns the complete entity. Save via the port; return the saved entity.
- **findOverlapping (adapter).** One query:
  `user_id = :userId AND status IN ('Pending','Approved') AND
  start_date <= :endDate AND end_date >= :startDate` — inclusive-boundary
  intersection per A3, blocking statuses per A4, served by the
  `(user_id, status)` composite index (TDD §2). `findOneBy`/`save`
  delegate to TypeORM's own methods — the port names no new concepts for
  them (§8 Q2).
- **Approve/Reject — ADR 0004's order:** `findOneBy(id)` → `null` throws
  `NotFoundError` → `assertPending(request)` throws `ConflictError` on any
  non-Pending status (the whitelist enforcing A8's state machine) → reject
  only: comment trimmed, empty result throws `ValidationError` (§8 Q7);
  the **trimmed** string is what gets stored (entailed by Q7 — the trim
  defines validity, so the stored value is the validated one). Then:
  status transition, `reviewedBy = actorId`, `comments` (reject only),
  save via the port, return the updated entity.
- **Mutation path.** All writes go through the port's `save` — create
  passes a newly constructed entity, approve/reject pass the fetched and
  mutated one; never raw SQL, never QueryBuilder update. Standing
  constraint from spec 4.1 §9 adjudication 4: `updated_at` is ORM-level
  (`@UpdateDateColumn`), so any non-ORM write path silently stops it
  advancing. §6 makes the advancing timestamp an observable criterion.
- **Error codes (§8 Q4).** Granular, per-rule — the full set is frozen
  in §5's table.

## 5. Contracts

```ts
// src/repositories/VacationRequestRepository.ts
export interface VacationRequestRepository {
  findOverlapping(userId: string, startDate: string, endDate: string): Promise<VacationRequest[]>;
  findOneBy(id: string): Promise<VacationRequest | null>;
  save(request: VacationRequest): Promise<VacationRequest>;
}

// src/repositories/TypeOrmVacationRequestRepository.ts
export class TypeOrmVacationRequestRepository implements VacationRequestRepository {
  constructor(repo: Repository<VacationRequest>);
}

// src/domain/commands/CreateVacationRequestCommand.ts
export interface CreateVacationRequestInput {
  actorId: string;        // verified requester id (requireRole)
  startDate: string;      // 'YYYY-MM-DD'
  endDate: string;        // 'YYYY-MM-DD'
  reason?: string | null;
}
export class CreateVacationRequestCommand
  implements Command<CreateVacationRequestInput, VacationRequest> {
  constructor(deps: { requests: VacationRequestRepository });
  execute(input: CreateVacationRequestInput): Promise<VacationRequest>;
}

// src/domain/commands/ApproveVacationRequestCommand.ts
export interface ApproveVacationRequestInput { id: string; actorId: string }
export class ApproveVacationRequestCommand
  implements Command<ApproveVacationRequestInput, VacationRequest> { /* same shape */ }

// src/domain/commands/RejectVacationRequestCommand.ts
export interface RejectVacationRequestInput { id: string; actorId: string; comment: string }
export class RejectVacationRequestCommand
  implements Command<RejectVacationRequestInput, VacationRequest> { /* same shape */ }

// src/domain/commands/assertPending.ts
export function assertPending(request: VacationRequest): void; // throws ConflictError REQUEST_NOT_PENDING
```

Error contract (code strings frozen here; HTTP status is `statusFor`'s
mapping of the subclass, not restated per backend.md):

| Rule / condition | Subclass | `code` |
|---|---|---|
| Rule 1 — `endDate < startDate` | `ValidationError` | `INVALID_DATE_RANGE` |
| Rule 4 — `startDate < today` (UTC) | `ValidationError` | `START_DATE_IN_PAST` |
| Rule 2 — overlap (Pending/Approved, same user) | `ConflictError` | `OVERLAPPING_REQUEST` |
| id not found (approve/reject) | `NotFoundError` | `REQUEST_NOT_FOUND` |
| Rule 3 — status not Pending | `ConflictError` | `REQUEST_NOT_PENDING` |
| Rule 5 — comment empty after trim | `ValidationError` | `COMMENT_REQUIRED` |

## 6. Acceptance criteria
Every criterion is an observable postcondition; failure criteria assert
**both** the thrown error (subclass + code) **and** the absence/invariance
of rows — a thrown error with a leaked write is a failure.

1. **Create, happy path:** for a seeded requester with no blocking
   requests, a valid future range → a `vacation_requests` row exists with
   `user_id = actorId`, the given dates, `status = 'Pending'`,
   `reason` as given (`null` when omitted), and the resolved value is that
   persisted entity (has `id`, `status: 'Pending'`, timestamps). Verified
   at minimum with: a multi-day range, and a single-day range
   (`startDate === endDate`, legal per A2).
2. **Rule 1 invariant:** any input with `endDate < startDate` →
   `ValidationError` / `INVALID_DATE_RANGE`, no row written.
3. **Rule 4 invariant:** any `startDate` before the server's UTC today →
   `ValidationError` / `START_DATE_IN_PAST`, no row written.
   `startDate === today` succeeds (A6). Verified at minimum with:
   yesterday (fails), today (succeeds).
4. **Rule 2 invariant:** any new range intersecting (inclusive, A3) any
   Pending **or** Approved request of the same user →
   `ConflictError` / `OVERLAPPING_REQUEST`, no row written. Neither
   Rejected requests nor other users' requests ever block. Verified at
   minimum with: shared-boundary-day overlap vs Pending (A3's exact
   example — fails), same range vs the user's **own Approved** request
   (fails — the one case with power to detect a Pending-only blocking
   set, §8 Q10), same range vs a Rejected request (succeeds), same range
   vs another user's Approved request (succeeds).
5. **Approve, happy path:** a Pending request → row now has
   `status = 'Approved'`, `reviewed_by = actorId`, `comments` still null,
   and `updated_at` advanced (the observable proof of the ORM-save
   mutation path); resolved value reflects the updated row.
6. **Reject, happy path:** a Pending request + comment with content →
   row now has `status = 'Rejected'`, `comments` = the trimmed comment,
   `reviewed_by = actorId`, `updated_at` advanced; resolved value reflects
   the updated row.
7. **Rule 3 invariant:** approve or reject on any non-Pending request →
   `ConflictError` / `REQUEST_NOT_PENDING`, and the row is byte-identical
   after (status, comments, reviewed_by, updated_at all unchanged).
   Verified at minimum with all four illegal combinations: approve on
   Approved, reject on Approved, approve on Rejected, reject on Rejected
   (§8 Q10 — the criterion verifies the guard's observable behavior, not
   its implementation's symmetry).
8. **Unknown id:** approve and reject with a nonexistent uuid →
   `NotFoundError` / `REQUEST_NOT_FOUND`.
9. **Rule 5 invariant:** reject with a comment that is empty after trim →
   `ValidationError` / `COMMENT_REQUIRED`, row unchanged. Verified at
   minimum with: `""` and `"   "`.
10. **No emission this chunk (§8 Q1):** grep over `src/domain/commands/`
    and `src/repositories/` finds no reference to `eventDispatcher` or
    `emit(`.
11. **Mutation-path invariant:** grep over the new files finds no
    `.query(` and no QueryBuilder write (`.update(`, `.insert(`,
    `.delete(`) — combined with 5/6's advancing `updated_at`, all writes
    provably ride the ORM save path (spec 4.1 §9 constraint).
12. **Gates:** `tsc --noEmit` and `npm run lint` pass; no `any` and zero
    lint disables in the new files; `git diff` shows `root.yaml` and
    `src/generated/HandlerRegistry.ts` untouched.

## 7. Testing requirements
Manual verification per the 4.3 protocol (§8 Q5): a throw-away scratch
script — constructs the real `TypeOrmVacationRequestRepository` from the
shared DataSource against dockerized, seeded Postgres, executes every §6
path, and checks rows via SQL after each step — run during verification,
**not committed**, its output transcribed into §9. Automated unit tests
(commands against `FakeVacationRequestRepository`, adapter integration
test) are deliberately Phase 5's (checklist Phase 5; TDD §8; 4.3 §8 Q8
precedent) — the single-port dependency exists so those tests fake one
interface and need no DB.

### Files touched (advisory)
- `src/repositories/VacationRequestRepository.ts` (new)
- `src/repositories/TypeOrmVacationRequestRepository.ts` (new)
- `src/domain/commands/CreateVacationRequestCommand.ts` (new)
- `src/domain/commands/ApproveVacationRequestCommand.ts` (new)
- `src/domain/commands/RejectVacationRequestCommand.ts` (new)
- `src/domain/commands/assertPending.ts` (new)
- `docs/tdd.md` (§3 prose sentence — lockstep edit per §8 Q9, applied
  pre-approval)

## 8. Q&A
**Q1. Event emission — do 4.4's commands emit, or does 4.5 own emission?**
A: Emission lands in 4.5, with the event classes and listener together.
Commands here end at save-and-return. Rationale: emitting with zero
subscribers is a silent no-op (4.3 §8 Q3's residual), so 4.4-emitted
events would be unverifiable for a whole chunk; landing emit + listener
together means the listener's log line proves emission the moment it
exists. 4.5 therefore edits the three command files (adding emit lines
after save) — expected, not a deviation.

**Q2. Command persistence dependency — TDD §3 draws a three-method port,
ADR 0001 says only business-concept queries get named methods.** A: One
port interface with all three (`findOverlapping`, `findOneBy`, `save`);
the adapter delegates the trivial two to TypeORM. Matches TDD §3/§8 as
drawn — one injected dep per command, one fake in Phase 5. ADR 0001 is
read as "don't invent *names* for trivial queries": `findOneBy`/`save`
keep TypeORM's own names and add no concept. ADR 0001 itself needs no
amendment — its allocation (business concept → named method) is intact;
that stays-true defense is recorded here. TDD §3, however, internally
contradicted itself: its prose denied `findOneBy` port membership while
its own class diagram drew it inside the port. The diagram and §8's
testing strategy force the three-method port, so the prose was amended in
this PR to match (mechanism and precedent in Q9).

**Q3. Identity field — `actorId` verbatim, or domain names with handler
remapping?** A: `actorId` end-to-end. Handlers stay pure pass-through
exactly as backend.md's canonical example shows (`commandBus.execute(new
…Command(deps), input)` — no field surgery). On 4.3 §8 Q9 naming its
example inputs `{ id, validatorId }`: that Q's frozen decision was
**arity** (single input object, forced by `Command<TInput, TResult>`),
which this spec honors; the field names inside its parenthetical were
illustrative, nothing consumed them, and no code or contract carried
them — stays-true defense, no amendment to spec 4.3 (taxonomy:
point-in-time record, no reader-observable divergence).

**Q4. Error-code granularity?** A: Granular, per-rule — the §5 table.
Matches `DomainError`'s documented contract (rule-specific codes, its own
example is `OVERLAPPING_REQUEST`); each Phase 5 matrix row gets its own
greppable code and the frontend can message per-rule without both 409s
being indistinguishable.

**Q5. Verification without an HTTP surface — nothing exists to curl until
4.6.** A: Tests in Phase 5 only, per the 4.3 §8 Q8 precedent; this chunk
verifies via the uncommitted scratch-script protocol (§7), output
transcribed into §9.

**Q6. Do commands re-assert date *format*?** A: No — trust the parser;
shape is transport's job (ADR 0001). Commands check meaning on the
`'YYYY-MM-DD'` strings the parser guarantees (spec 4.1 §5 note).

**Q7. Is a whitespace-only rejection comment valid?** A: No — trim, then
require non-empty; failure is `COMMENT_REQUIRED`. Consequence recorded in
§4: the trimmed string is what gets stored, since the trim defines what
counted as valid.

**Q8. Where does `assertPending` live? backend.md's commands-folder rule
is "one Command class per file" and this is a shared function.** A:
`src/domain/commands/assertPending.ts`, next to its two callers. The
folder rule governs command classes; it doesn't forbid a named shared
guard module. (ADR 0004 already fixes the function's existence and shape;
only its home was open.)

**Q9. Review finding (pre-approval): Q2's original "no reader-observable
divergence" claim was false.** TDD §3's prose said "`findOneBy` isn't a
separate port method; it's TypeORM's own default, used directly" while
§3's own class diagram places `findOneBy` (and `save`) inside the port —
the TDD contradicted itself, and the spec had silently sided with the
diagram. A: Contradiction named; resolved in the diagram's favor (Q2's
rationale — the single fakeable port is what TDD §8's testing table
depends on). Mechanism: **lockstep edit** of the falsified prose sentence,
not an ADR-style amendment note — the taxonomy classifies the TDD as a
design doc whose truth condition is "describes intended architecture"
(lockstep at freeze, never deferred; 4.3's precedent of editing TDD §1/§3
directly). Applied pre-approval; the edited sentence points back here.

**Q10. Review finding (pre-approval): two acceptance-criteria gaps.**
AC4's minimum set had no case proving Approved blocks — every listed case
passed under a Pending-only blocking set; AC7 covered three of four
illegal transitions (reject-on-Rejected missing). A: Both added. The
principle recorded for Phase 5's test derivation: the overlap query is a
conjunction of orthogonal predicates, and each needs its own
discriminating case in the correct failure *direction* — "another user's
Approved doesn't block" tests the `user_id` conjunct against
over-matching (false positives) and has zero power against
under-matching; only "own Approved blocks" discriminates the status
disjunction (false negatives — the double-booked state Rule 2 exists to
prevent). Success cases never substitute for failure cases on a
different predicate. AC7's enumeration follows the same standard from
the other side: `assertPending` makes all four illegal combinations
equivalent in principle, but the criterion verifies the guard's
observable behavior, never its implementation's symmetry — the same
logic that makes AC9 probe both `""` and `"   "`.

## 9. Implementation Results
*(append-only during build)*

**2026-07-28 — implemented, all §6 criteria verified against dockerized
Postgres, freshly re-seeded (wipe-and-reseed) for deterministic state.
Criteria 1–9 via throw-away scratch script (`backend/verify-4.4.ts` —
constructed the real `TypeOrmVacationRequestRepository` from
`cliDataSource`, executed every path, checked rows via SQL after each
step; run, transcribed below, deleted — never committed). Script
self-cleaned: deleted its 5 created rows, seed's 5 rows intact and
unmutated.**

- §6.1 ✓ — multi-day create (alice, +40..+44, reason "Conference
  travel"): row `status=Pending`, `user_id=alice`, dates exact, reason
  stored; returned entity carries id/status/timestamps without reload.
  Single-day create (+50..+50, reason omitted): row `Pending`,
  `reason=null`.
- §6.2 ✓ — `endDate < startDate` → `ValidationError`/`INVALID_DATE_RANGE`,
  row count unchanged (7 → 7).
- §6.3 ✓ — yesterday-start → `ValidationError`/`START_DATE_IN_PAST`, no
  row; `startDate == today` (bob, today..today) → created, `Pending` (A6).
- §6.4 ✓ — all four minimum cases: boundary-day overlap vs own Pending
  (new +25..+26 vs seed +21..+25 — A3's exact shape) →
  `ConflictError`/`OVERLAPPING_REQUEST`, no row; overlap vs own
  **Approved** (+44..+45 vs approved +40..+44) → same error — the
  §8 Q10 mutant-killer, proving the blocking set isn't Pending-only;
  same range as own Rejected (+14..+16) → created; identical range vs
  another user's Approved (bob +40..+44 = alice's) → created.
- §6.5 ✓ — approve (carla on alice's +40..+44): `status=Approved`,
  `reviewed_by=carla`, `comments` still null, `updated_at` advanced
  (checked against pre-approve value — the ORM-save-path proof).
- §6.6 ✓ — reject with `"  Coverage gap that week.  "`: `status=Rejected`,
  `comments="Coverage gap that week."` (**trimmed**), `reviewed_by=carla`,
  `updated_at` advanced.
- §6.7 ✓ — all four illegal combinations (approve/reject × Approved/
  Rejected) → `ConflictError`/`REQUEST_NOT_PENDING`, row byte-identical
  after each (full-row `row_to_json` snapshot compare).
- §6.8 ✓ — approve and reject on a nonexistent uuid →
  `NotFoundError`/`REQUEST_NOT_FOUND`.
- §6.9 ✓ — reject with `""` and `"   "` →
  `ValidationError`/`COMMENT_REQUIRED`, row snapshot unchanged, still
  Pending.
- §6.10 ✓ — grep over `src/domain/commands/` + `src/repositories/`: zero
  matches for `eventDispatcher` / `emit(`.
- §6.11 ✓ — grep: zero matches for `.query(` / `.update(` / `.insert(` /
  `.delete(` in the new files; combined with §6.5/§6.6's advancing
  `updated_at`, all writes ride the ORM save path.
- §6.12 ✓ — `tsc --noEmit` and `npm run lint` pass; zero `any` (grep found
  no matches even as a substring) and zero lint disables in the new files;
  `git status`/`git diff` show `root.yaml` and
  `src/generated/HandlerRegistry.ts` untouched.

**Implementation notes (no deviations from §1–8):**
- Files touched match §7's advisory list exactly — the six new source
  files, nothing else.
- `findOverlapping` uses `find()` with `In`/`LessThanOrEqual`/
  `MoreThanOrEqual` operators — the §4 predicate expressed in TypeORM's
  operator vocabulary, no QueryBuilder needed.
- Scratch-script observation, zero relevance to the implementation: the
  raw pg driver returns `date` columns as JS `Date` objects, unlike the
  entity path's `'YYYY-MM-DD'` strings (spec 4.1 §5). Two script SQL
  checks needed `::text` casts; commands never touch the raw driver, so
  the taxonomy doesn't apply — noted only so a future scratch script
  doesn't rediscover it.

**2026-07-28 — /spec-check adjudications (human), both ⚠️ items accepted:**

1. Error message strings — accepted as-is, 4.7 owns wording. Load-bearing
   condition, stated so a future violation is catchable as one: messages
   carry zero contract weight — no test, frontend branch, or doc may ever
   match on message text; machine-readable behavior keys off `code` only
   (§8 Q4's granularity exists for exactly this). A Phase 5 test asserting
   a message string silently promotes it to contract — that is a
   violation, not a style choice.

2. `todayUtc` module-level helper — accepted as-is, but only after
   verifying evaluation timing, which the "just organization" framing
   hides: the arrow-function form (line 20, invoked per execute at line
   39) computes "today" per call. The bare-constant form would have frozen
   "today" at import — a real Rule 4 bug past midnight UTC (same class as
   4.2's read-the-JWT-secret-at-call-time rule). The 4.1 shared-consts
   precedent does not transfer: ENTITIES must evaluate once, "today" must
   not — same refactor shape, opposite correctness condition. The standing
   evaluation-timing check lives on the Phase 6 audit bullet (operative
   home), not here.

Recurrence note: both items are the 4.1 §9 pattern again — silent
decisions that should have been pre-implementation questions. Two chunks
running. If 4.5's audit surfaces a third batch, treat it as a documented
trend requiring a process fix, not a coincidence.
