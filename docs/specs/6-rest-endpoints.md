# Spec: 4.6 — REST endpoints: root.yaml port + handlers

**Status:** approved

> **Freeze rule:** Sections 1–8 freeze at human approval. Section 9 is
> append-only during implementation — deviations get recorded, never
> retro-edited into the plan.

## 1. Overview
Wires the outside world to the machinery: ports the seven domain routes
from `docs/api-contract-draft.yaml` into `backend/src/root.yaml` (the
executable contract — handlers conform to it, never the reverse) and
writes their thin handlers — parse (shape-only) → `requireRole` →
dispatch the 4.4 command or run the trivial query → respond in the D10
envelope. No business rule lives in any handler (ADR 0001); the chunk is
deliberately connective. Also discharges two inherited obligations:
the 4.2 temp-guard revert on `/hello/:name` (4.2 §8 Q9) and the 4.5
end-to-end listener proof (approve via HTTP → structured log line,
4.5 §6.6). Login is **not** rebuilt — 4.2 §8 Q1 delivered it end-to-end;
this chunk re-verifies it after codegen regenerates the registry.
Checklist item 4.6.

## 2. Scope (in)
- `src/root.yaml` — port from the draft: `POST /requests`,
  `GET /requests` (dashboard), `GET /requests/mine`, `GET /requests/team`
  (§8 Q1), `POST /requests/:id/approve`, `POST /requests/:id/reject`,
  `GET /users` (§8 Q2), each with request/response schemas; the
  `components` block (bearerAuth, `VacationRequest`, `Error`,
  `UserSummary`); info block adopts the draft's title. **Remove** the
  temp 401/403 entries + TEMP comment under `/hello/:name`.
- `npm run codegen` after every YAML edit (D13 script self-asserts every
  ref).
- `src/handlers/requests.ts` (new) — parsers + handlers for the six
  request routes (module fixed by the draft's `x-handler` refs).
- `src/handlers/users.ts` (new) — `listUsers`.
- `src/handlers/hello.ts` — unwrap `getHelloByName` (revert part 2).
- Record edits, applied pre-approval (verified by §6.10):
  - checklist 4.6 — stale "auth" dropped (4.2 §8 Q1), team/users added
    (§8 Q1–Q2); checklist 4.7 — date work moved here, 4.7 keeps `reason`
    normalization + message wording (§8 Q7)
  - `docs/tdd.md` §2 — sort sentence scoped (§8 Q6); §6 + §7 tables gain
    the `GET /users` row (§8 Q2)
  - `.claude/rules/backend.md` — non-200 success note (§8 Q3),
    `new Date(string)` validation ban (§8 Q7), pagination default
    corrected 20 → 10 lockstep (PRD US-5 is the requirement, §8 Q9)
  - checklist 4.10 — dashboard name-resolution inheritance (§8 Q10)

No new dependencies.

## 3. Out of scope
- `reason` normalization (`""` → `null`, trimming) and error-message
  wording — 4.7 (checklist; 4.4 §9 adjudication 1). 4.7's date work is
  gone (absorbed here, §8 Q7) — its spec must state that boundary.
- Frontend consumption — 4.8–4.10 (the team view's month-grouping is UI,
  A14; the users combobox is 4.10's).
- Domain changes — none; commands, events, listeners, repository are
  consumed as shipped by 4.4/4.5.
- Pagination on `/requests/mine` (A11) and any self-approval guard (A16)
  — recorded limitations, not this chunk's work.
- Automated tests — Phase 5 (functional-test rows exist per checklist).

## 4. Design
- **Contract-first order.** Routes + schemas land in `root.yaml` first
  (from the draft, with §8 Q4–Q6's deltas), codegen runs, then handlers
  are written to satisfy the YAML. A mismatch discovered while writing a
  handler is a YAML bug or a handler bug — never "adjust whichever."
- **Handler shape (backend.md).** Every handler: `requireRole(role, fn)`
  export; `fn` dispatches a command via `commandBus.execute(...)` (create,
  approve, reject) or runs a trivial TypeORM query directly (the three
  lists + users — ADR 0001 names filtered/paginated list-all as trivial
  CRUD; the team view's `requester` join is a projection, not a business
  concept). Success: plain object → CEF wraps as 200; **create returns
  `new Response(201, saved)`** — the one non-200 success (§8 Q3).
  Errors: commands throw, `index.ts`'s global catch translates (4.2 §8
  Q7); parsers return 400 `Response`s; the wrapper owns 401/403. No
  handler builds error JSON.
- **Roles (TDD §6).** create + mine → `Requester`; dashboard + approve +
  reject + users → `Validator`; team → `"any"` (4.2's contract supports
  it). `actorId` reaches commands per the fixed 4.2 §4 mechanism; `mine`
  filters `userId = actorId` from the JWT — never a query param.
- **Parsers (shape-only, ADR 0001).** Two module-scope helpers in
  `requests.ts`, no copy-pasted regexes (§8 Q8):
  - `isValidDateString` — strict `YYYY-MM-DD`: regex **plus round-trip
    rebuild** via `Date.UTC(y, m-1, d)` re-compared component-wise.
    Never `new Date(string)` — `"2026-02-30"` → `Invalid Date` → `NaN` →
    every comparison `false` → Rules 1/4's reject branches silently never
    fire (§8 Q7; ban recorded in backend.md).
  - `isUuid` — case-insensitive uuid shape; used by approve's `:id`,
    reject's `:id`, dashboard's `?userId=` (§8 Q8).
  Failures → 400 `INVALID_INPUT` naming the field, **built via the
  exported `errorResponse` helper** — every producer calls the one
  function (D10's no-drift guarantee); the scaffold's
  `parseHelloByNameInput` predates the helper and is the shape NOT to
  copy. Dashboard parser: `page`/`limit` must parse as integers ≥ 1
  else 400; `limit > 100` clamps to 100 (§8 Q4); `status` must be one
  of the three enum values else 400 (§8 Q5). Reject parser: `comment`
  present and a string — trimmed-emptiness stays the command's (Rule 5,
  4.4 §8 Q7; upstream verified: the command stores the trimmed value).
- **Queries.** Dashboard: `findAndCount({ where: {status?, userId?},
  order: { createdAt: "DESC" }, skip: (page-1)*limit, take: limit })` —
  filters AND-combine, `total` is the post-filter count (§8 Q5). The
  dashboard deliberately loads **no relations**: rows carry `userId` and
  `reviewedBy` as bare uuids, and US-5's "requester name … who reviewed
  it" is resolved **client-side in 4.10** via `GET /users` (§8 Q10) —
  a joined `User` on raw entities would leak `email`, the exact A10
  concern the users endpoint avoids. A skip past the last row returns
  an empty `data` array with the correct `total` (US-5).
  Mine: `find` by `userId = actorId`, `createdAt DESC`. Team:
  `status = Approved`, `relations: requester`, `order: { startDate:
  "ASC", id: "ASC" }` (§8 Q6), mapped to exactly
  `{ requesterName, startDate, endDate }` — `reason` never crosses (A14).
  Users: `find` selecting `id`, `name` only, `name ASC` (deterministic
  combobox order — decided here, §8 Q2 note).
- **Inherited proofs.** Approve/reject/create now ride HTTP → the 4.5
  listener lines appear in dev-server output (§6.4 discharges 4.5 §6.6's
  carried obligation). `/hello/:name` returns to public (unwrap + YAML
  entries removed) — 4.2 §8 Q2/Q9 closed.

## 5. Contracts
`root.yaml` is the contract; this table freezes the semantics the YAML
can't express. All errors wear the D10 envelope; codes are the existing
set — parser/guard: `INVALID_INPUT`, `UNAUTHORIZED`, `FORBIDDEN`;
domain: the 4.4 §5 table. No new error codes, no new DomainError
subclasses.

| Route | Role | Success | Semantics frozen here |
|---|---|---|---|
| `POST /requests` | Requester | **201** entity | body `{startDate, endDate, reason?}`; both dates strict `YYYY-MM-DD` incl. calendar validity else 400 (§8 Q7); `reason` passed through as received (4.7 owns normalization) |
| `GET /requests` | Validator | 200 `{data, total, page, limit}` | defaults page=1 **limit=10** (PRD US-5, §8 Q9); non-integer or <1 → 400; limit>100 → clamped 100; `status`/`userId` AND-combine; bad enum or bad uuid → 400; `total` = post-filter count; page past last result → 200 empty `data` (US-5); `createdAt DESC` (§8 Q4, Q5, Q9) |
| `GET /requests/mine` | Requester | 200 `VacationRequest[]` | JWT-scoped, unpaginated (A11), `createdAt DESC` |
| `GET /requests/team` | any | 200 `{requesterName, startDate, endDate}[]` | Approved only; exactly those three keys — no `reason`, no ids (A14); `startDate ASC, id ASC` (§8 Q6) |
| `POST /requests/:id/approve` | Validator | 200 entity | `:id` uuid-shape else 400 (never 500, §8 Q8); 404 = well-formed id, no row; 409 = not Pending |
| `POST /requests/:id/reject` | Validator | 200 entity | same `:id` rule; body `{comment}` string else 400; empty-after-trim → command's 400 `COMMENT_REQUIRED` |
| `GET /users` | Validator | 200 `{id, name}[]` | exactly two keys — no email/role/credentials (A10); `name ASC` |

```ts
// src/handlers/requests.ts — exports (names fixed by the draft's x-refs)
export const parseCreateRequestInput: InputParserFn;
export const createRequest: HandlerFn;      // requireRole(Requester)
export const parseDashboardInput: InputParserFn;
export const getDashboard: HandlerFn;       // requireRole(Validator)
export const listMyRequests: HandlerFn;     // requireRole(Requester)
export const listTeamVacations: HandlerFn;  // requireRole("any")
export const parseRequestIdInput: InputParserFn;
export const approveRequest: HandlerFn;     // requireRole(Validator)
export const parseRejectInput: InputParserFn;
export const rejectRequest: HandlerFn;      // requireRole(Validator)

// src/handlers/users.ts
export const listUsers: HandlerFn;          // requireRole(Validator)
```

## 6. Acceptance criteria
Observable postconditions only; every 4xx wears the D10 envelope.

1. **Contract + registry:** `root.yaml` contains the seven routes with
   schemas and no 401/403 entries under `/hello/:name`; codegen output
   asserts all refs registered (D13's own check) **and** the generated
   registry file contains every new `handlers/requests#…` /
   `handlers/users#…` ref; `GET /doc/spec` serves the updated contract.
2. **Create end-to-end:** Requester token + valid future range → 201,
   body is the persisted entity (`id`, `status: "Pending"`), row exists;
   the `VacationRequestCreated` listener line appears in server output
   (upstream verified pre-approval: 4.5 §5/§9 shipped and proved all
   three listeners, not only Approved).
   Rule failures via HTTP: inverted range → 400 `INVALID_DATE_RANGE`;
   past start → 400 `START_DATE_IN_PAST`; overlap vs own Pending → 409
   `OVERLAPPING_REQUEST`; no row written in any failure case.
3. **Date-validation invariant (the NaN mutant-killer):** any
   non-`YYYY-MM-DD`-shaped or calendar-invalid date → 400
   `INVALID_INPUT` and no row. Verified at minimum with: `"8/1/2026"`
   (format) and `"2026-02-30"` (calendar-valid-shape) — the second is
   the case with power to detect a regex-only parser whose downstream
   comparisons silently pass on `NaN`.
4. **Approve end-to-end (inherited 4.5 §6.6 obligation):** Validator
   token on a Pending request → 200, row `Approved`, `reviewed_by` set,
   and the structured `VacationRequestApproved` JSON line appears in
   dev-server output. Non-Pending → 409 `REQUEST_NOT_PENDING`, row
   byte-identical.
5. **Reject end-to-end:** valid comment → 200, `comments` stores the
   trimmed value (upstream verified pre-approval: 4.4 §4/§9 §6.6 —
   the command trims before storing); whitespace comment → 400
   `COMMENT_REQUIRED`; unknown
   well-formed uuid → 404 `REQUEST_NOT_FOUND`; malformed `:id` (e.g.
   `abc`) → **400 `INVALID_INPUT`, never 500 and never 404** (§8 Q8's
   three-way distinction, observable).
6. **Role matrix (Rule 6):** every route × no token → 401
   `UNAUTHORIZED`; wrong role → 403 `FORBIDDEN`. Verified at minimum
   with: create as Validator → 403; dashboard, approve, users as
   Requester → 403; team with **both** roles → 200.
7. **List invariants:** *mine* — each of two seeded requesters sees
   exactly their own rows, all statuses, `createdAt DESC`. *team* —
   only `Approved` rows; every element has exactly
   `{requesterName, startDate, endDate}`; a request whose `reason` is a
   distinctive sentinel appears **without** it (A14 probe); order
   `startDate ASC`. *users* — exactly `{id, name}` per element; no
   email/role/password value anywhere in the body (A10 probe).
8. **Pagination + filter invariants:** omitted params → page 1, ≤10
   rows, `limit: 10` echoed (PRD US-5); a page past the last result →
   200 with `data: []` and the correct `total`, never an error (US-5);
   `limit=500` → ≤100 rows, `limit: 100`
   echoed (clamp observable); `page=abc`, `page=0`, `limit=-1` → 400;
   `status=Foo` and `userId=not-a-uuid` → 400; `status=Pending` →
   every returned row Pending **and** `total` equals the count of the
   filtered set, not the table count (post-filter mutant-killer:
   asserted against a state where the two differ).
9. **Regressions:** `POST /login` still satisfies 4.2 §6.1–6.3 minimum
   (200/401/400 cases) through the regenerated registry;
   `GET /hello/:name` **without any token → 200** (revert observable);
   `GET /hello` → 200.
10. **Gates + records:** `tsc --noEmit`, `npm run lint`, zero `any`
    and zero lint disables in new files; record edits of §2 present
    (checklist 4.6/4.7/4.10 wording, TDD §2 scoped sentence + §6/§7
    users rows, backend.md's three edits incl. the corrected
    pagination default).

## 7. Testing requirements
Manual verification per the 4.2 protocol — curl against the dev server
(port 8888) + dockerized seeded Postgres, tokens obtained via `POST
/login` for one Requester, a second Requester, and the Validator; every
§6 criterion recorded in §9 with the observed status + body. Server
output watched for the listener lines (§6.2, §6.4). DB rows checked via
SQL where a criterion asserts row state. Automated functional tests are
Phase 5's (checklist rows exist for login, create + rule violations,
approve, reject, envelope tripwire).

### Files touched (advisory)
- `src/root.yaml` + `src/generated/HandlerRegistry.ts` (codegen)
- `src/handlers/requests.ts`, `src/handlers/users.ts` (new)
- `src/handlers/hello.ts` (unwrap)
- `docs/travelfactory-assignment-checklist.md` (4.6 + 4.7 + 4.10
  wording — pre-approval)
- `docs/tdd.md` (§2 sentence, §6 + §7 rows — pre-approval)
- `.claude/rules/backend.md` (201 note, date-validation ban, pagination
  default 20 → 10 — pre-approval)

## 8. Q&A
**Q1. Does 4.6 ship `GET /requests/team`? (Draft + TDD §6/§7 have it;
the checklist enumeration omits it.)** A: Ship in 4.6. The chunk is
"REST endpoints ported into root.yaml" — porting the whole draft surface
at once keeps the YAML the single contract and unblocks 4.9; deferring
splits the port and puts backend work inside a frontend chunk with no
checklist line owning it. Backend serves the flat approved-only array;
month-grouping stays frontend (A14 calls it a UI form). Checklist
enumeration fixed lockstep alongside the stale "auth" word.

**Q2. Does 4.6 ship `GET /users` (A10's combobox; in the draft, absent
from checklist and TDD §7)?** A: Ship in 4.6 — trivial projection (id +
name only; no email/role/credentials per A10), completes the draft
surface in one port, unblocks 4.10. TDD §6/§7 tables gain the row
lockstep — they claim to summarize the contract, and the contract now
includes it. (Response order `name ASC` fixed in §4 — deterministic and
combobox-shaped; decided at spec time, not silently.)

**Q3. How does create return 201 when backend.md's rule says "success =
return a plain object" and index.ts wraps plain objects as 200?** A:
The create handler returns `new Response(201, saved)` — index.ts already
passes `Response`s through. REST correctness wins: the draft and TDD §7
both promise 201, and the rule's text simply hadn't met a non-200
success yet. backend.md gets the lockstep one-liner (operative rules
file); every other endpoint stays plain-object/200.

**Q4. Dashboard pagination defaults — draft says limit 10, backend.md
says 20 with cap 100. Which wins, and what do invalid params do?** A
(as corrected by §8 Q9 — the original ruling here chose backend.md on a
false premise): **default limit=10, page=1 — the PRD wins.** Invalid
input unchanged: non-integer or < 1 → 400 `INVALID_INPUT` from the
parser (shape). `limit > 100` → silently clamped to 100 — backend.md
says "cap", and over-asking is a benign preference, not malformed
input; `page=abc` silently meaning page 1 is the kind of behavior a
grader pokes at, so bad shape is rejected, not forgiven.

**Q5. Filter semantics: combination, invalid enum, `total`?** A: AND ·
400 · post-filter. Both params given AND-combine — a filter narrows;
OR-ing filters would surprise everyone. Invalid `status` → 400
`INVALID_INPUT`: it's a declared enum in the contract and enum
membership is shape, same as "this field is a string." Silent-ignore is
the worst option because a validator filtering to Pending would make
approval decisions on wrong data — a filter that lies is a correctness
bug, not a UX nicety. `total` counts post-filter because `total` exists
to drive pagination controls, and pagination pages through the filtered
set — a pre-filter total draws phantom pages.

**Q6. Team view sort — TDD §2 claims "every list endpoint orders by
created_at DESC (A15)", but A15's recorded scope is the dashboard and a
planning view is consumed chronologically.** A: `startDate ASC, id ASC`.
A planning view reads forward in time, and 4.9's month-grouping needs
that order natively. Keeping the doc true by re-sorting in the frontend
would be shipping a worse API to avoid editing a sentence — docs serve
the design, not the reverse. `id ASC` tiebreaks equal start dates so
order is deterministic between queries. TDD §2's sentence was an
overgeneralization of A15 and is scoped lockstep: activity lists
(dashboard, mine) order `created_at DESC`; the team planning view
orders `startDate ASC, id ASC`.

**Q7. Date validation split — 4.4 §3 says format is "the parser's job,
chunks 4.6/4.7", ambiguous between them. Regex now, or typeof-string
until 4.7?** A: **Full date validation ships in 4.6 — format AND
calendar validity, one strict check** (supersedes the drafted
format-only split). 4.4's spec claims commands receive guaranteed
`YYYY-MM-DD` strings, so the guarantee must exist the moment the route
exists. Format alone isn't enough: `"2026-02-30"` passes the regex, and
`new Date("2026-02-30")` yields `Invalid Date` → `NaN` — and every
`NaN` comparison returns `false`, so Rules 1 and 4's reject branches
never fire and invalid input silently passes the exact checks meant to
stop it. Same silent-misjudgment failure class as `"8/1/2026"`, so by
the same principle both checks ship together. One strict parse in the
inputParser (regex + round-trip rebuild via `Date.UTC`). Placement
justification: calendar validity is *shape* because it's decidable from
the value alone against its declared type — no DB, no state, no user
context needed. backend.md gains the rule banning `new Date(string)`
for validation, with the `Invalid Date → NaN → rules silently pass`
chain as the why. 4.7 keeps only `reason` normalization from the
date-adjacent work — stated on its checklist line so the chunk boundary
stays honest.

**Q8. UUID validation on `:id` and `?userId=` — parser 400, or catch
the Postgres cast error → 404?** A: Parser regex → 400 `INVALID_INPUT`.
Format is shape for a declared-uuid param. This keeps 404 meaning
exactly "well-formed id, no such row." The alternative fails three
ways: it conflates malformed input with absent resource; it couples the
handler to a TypeORM/driver internal; and it can't distinguish the
uuid-cast error from other query failures without string-matching
Postgres error codes. One shared parser helper serves approve's `:id`,
reject's `:id`, and the dashboard's `?userId=` — no copy-pasted
regexes.

**Q9. Review finding (pre-approval, blocking): Q4's original ruling
contradicted the PRD without knowing it.** PRD US-5's acceptance
criteria state "Paginated at 10 per page" — the draft's `default: 10`
was not an early placeholder but the requirement faithfully
transcribed, and Q4's question was framed as draft-vs-rules-file when
it was actually requirements-vs-rules-file. A: Reversed — **default
10; backend.md corrected lockstep** (its 20 was the convention file
drifting from the requirement it implements). The precedence argument
was backwards: backend.md is an implementation convention file; the PRD
is the requirements document the grader's Functionality criterion and
the Phase 5 matrix verify against — a rules file doesn't outrank
requirements. Q6's "docs serve the design" doesn't transfer, because
page size isn't a design judgment like sort order — it's a written
acceptance criterion. The draft's superseded-comment (added under the
original ruling) was removed; the draft cell was right all along. The
ported root.yaml schema's `default:` must match the parser's actual
default — the contract must not lie on day one. US-5 also mandates the
empty-page behavior (page past last result → empty array, not an
error) — promoted from Phase-6 material into §5/§6.8, since §6 is what
gets verified now.
The standing principle this freezes (the asymmetry that decides which
exit is honest): **requirements edits need requirements-level reasons;
convention edits only need consistency reasons.** The PRD-edit exit is
legitimate only when the deviating number has an actual product or
design argument — 20 had none, and ratifying drift by rewriting the
requirement gets the authority direction backwards. Q6's "docs serve
the design" doesn't transfer because that principle requires a design
reason the doc is blocking (the team sort had one: chronological
consumption); where there's no reason, there's no design to serve, only
a requirement to honor. The door stays open: a future genuine product
case for a different page size would write its rationale into US-5 and
be a decision, not drift. Residual, deliberately fine as-is: the
clamp-at-100 lives only in backend.md and this spec, not the PRD — the
PRD mandates the page size; the cap is defensive convention, and
promoting it to a requirement would be inventing one.

**Q10. Review finding (pre-approval): US-5 requires each dashboard row
to show "requester name … and who reviewed it," but the dashboard query
loads no relations — rows carry bare uuids, and no chunk owned the
resolution.** A: **Client-side resolution in 4.10 via `GET /users`** —
now a stated decision instead of an accident. Rationale: the users
endpoint is validator-only, exactly matching the dashboard's role; one
fetched list resolves both `userId` and `reviewedBy` (reviewers are
users too); and the alternative — server-side names — would need
relations plus a careful projection, because raw entities with a joined
`User` would leak `email`, the exact A10 concern `GET /users` exists to
avoid. The dashboard's raw-entity response (bare uuids) is thereby
frozen as deliberate, not an omission. Inheritance is mechanical, not
by memory: checklist 4.10's bullet now carries the resolution
obligation citing this Q.

## 9. Implementation Results
*(append-only during build)*

**2026-07-28 — pre-code open-decision audit (first run of the
implementation-mode rule).** No stop-and-ask items: every decision with
contract surface was already frozen in §5/§6. Pure internals proceeded
on, listed here:
1. YAML deltas entailed by §5's table: dashboard and approve gained
   `'400'` response entries the draft lacked (§5 declares those 400s);
   the limit clamp is documented as `description:` text, **not** a
   `maximum:` schema constraint — `maximum` would document
   reject-semantics, and the frozen behavior is clamp.
2. `reason` shape rule: string-when-present; `undefined`/`null` pass
   through untouched — entailed by the draft schema
   (`type: string, nullable: true`) + §5's "passed through as received."
3. Shared `parseJsonObjectBody` helper (rejects arrays as non-objects) —
   4.2's parser precedent extended to both body-bearing routes.
4. `requestsPort()` builds the repository per request off the shared
   DataSource — auth.ts's `findUserByEmail` lazy pattern.
5. Query-param values are plain `string | undefined` per CEF's
   `CommonEvent` type (verified in the .d.ts) — no array handling
   needed.
6. Parser status whitelist derived from the entity's
   `VacationRequestStatus` enum — one source of truth, no string
   duplication.
7. hello.ts unwrap also removed the now-unused `requireRole`/`UserRole`
   imports (entailed by the revert).

**2026-07-28 — implemented, all §6 criteria verified per the §7
protocol: curl against the dev server (port 8888, output captured to a
scratch log for the listener-line criteria) + dockerized Postgres,
freshly wipe-and-reseeded; tokens for alice (Requester), bob
(Requester), carla (Validator).**

- §6.1 ✓ — root.yaml carries all seven routes + components; zero
  401/403 entries and zero TEMP comments under `/hello/:name`; codegen
  printed "Wrote src/generated/HandlerRegistry.ts (16 refs)" + its
  self-assert line, and the registry file contains all 11
  `handlers/requests#…`/`handlers/users#…` refs; `GET /doc/spec` serves
  the updated contract (title "Vacation Management API", `/users`
  present).
- §6.2 ✓ — create (alice, +60..+62, sentinel reason) → 201, body the
  persisted entity (`status: "Pending"`), row count 5→6, exactly one
  `"event":"VacationRequestCreated"` line in server output. Inverted
  range → 400 `INVALID_DATE_RANGE`; past start → 400
  `START_DATE_IN_PAST`; same-range overlap → 409 `OVERLAPPING_REQUEST`;
  row count unchanged after all three.
- §6.3 ✓ — `"8/1/2026"` → 400 `INVALID_INPUT`; `"2026-02-30"` → 400
  `INVALID_INPUT` (the NaN mutant-killer: calendar-invalid but
  regex-shaped, rejected at the parser, no row).
- §6.4 ✓ — approve (carla) → 200, row `Approved|<carla's id>`, exactly
  one structured `"event":"VacationRequestApproved"` JSON line in
  dev-server output — **4.5 §6.6's inherited obligation discharged**.
  Re-approve → 409 `REQUEST_NOT_PENDING`, no additional listener line
  (verified across two extra 409 calls).
- §6.5 ✓ — reject with `"  Coverage gap that week.  "` → 200,
  `comments` = `"Coverage gap that week."` (trimmed, checked in-row via
  SQL), rejected listener line present; whitespace comment → 400
  `COMMENT_REQUIRED`; unknown well-formed uuid → 404
  `REQUEST_NOT_FOUND`; `:id = abc` on both approve and reject → 400
  `INVALID_INPUT` — never 500, never 404.
- §6.6 ✓ — no token → 401 `UNAUTHORIZED` on dashboard, mine, team,
  approve, users, and create-with-valid-body; wrong role → 403
  `FORBIDDEN` (create as Validator; dashboard, approve, users as
  Requester); team → 200 with both roles.
- §6.7 ✓ — mine: alice 6 rows / bob 2 rows, each single-user, all
  statuses present, `createdAt` DESC; team: 3 elements, key set exactly
  `{endDate, requesterName, startDate}` on every element, `startDate`
  ASC, sentinel reason absent (its request appears as requesterName
  "Alice Martin" + dates only); users: key set exactly `{id, name}`,
  names ASC, zero email/hash substrings in the body.
- §6.8 ✓ — defaults `{page:1, limit:10}` echoed with 8 rows (PRD
  US-5); `page=2` past the end → 200 `{data: [], total: 8}`;
  `limit=500` → `limit:100` echoed (clamp observable); `page=abc`,
  `page=0`, `limit=-1`, `status=Foo`, `userId=not-a-uuid` → all 400 in
  the envelope; `status=Pending` → `total:3` vs table count 8 (the
  post-filter killer); `status=Pending&userId=<alice>` → `total:2`,
  one user, one status (AND semantics).
- §6.9 ✓ — login through the regenerated registry: 200 `{token}`,
  wrong password → 401 `INVALID_CREDENTIALS`, non-JSON → 400
  `INVALID_INPUT`; `GET /hello/:name` **without any token → 200**
  (revert observable); `GET /hello` → 200.
- §6.10 ✓ — `tsc --noEmit` + `npm run lint` pass; zero `any` and zero
  lint disables in the new files; §2's record edits all present
  (verified pre-approval by grep, re-confirmed).

**Implementation notes (no deviations from §1–8):**
- Files touched match §7's advisory list exactly, plus the regenerated
  registry (derived artifact, entailed by codegen).
- Pipeline-ordering observation (point-in-time, for Phase 5's test
  derivation): CEF runs the inputParser before the handler, so
  `requireRole` — which wraps the handler — runs *after* shape checks.
  A request that is both malformed and tokenless gets 400, not 401.
  §6.6's criterion holds as written for well-formed requests (verified
  with a valid body → 401); the precedence is CEF's fixed pipeline
  (same short-circuit 4.3 §9 observed from the bus side), not a choice
  this chunk made.

**2026-07-28 — /spec-check adjudications (human): all three ⚠️ accepted;
one adjacent defect found during adjudication, verified live, and
fixed.**

1. `parsePositiveInt` missing from the pre-code inventory — accepted
   as-is (its behavior is fully §5-specified); the fix targets the
   process, not the code. A hand-maintained inventory drifted on the
   rule's first run, so the inventory is now **derived, not recalled**:
   grep the module for module-scope declarations and list what returns
   — an inventory with a mechanical generation rule can be incomplete
   only if the rule is wrong (checkable); one from memory is incomplete
   whenever attention lapses (always). Rule added to
   implementation-mode.md — the D13 move (read success off the effect)
   applied to bookkeeping. The derived inventory for `requests.ts`,
   generated by that rule: `DATE_RE`, `isValidDateString`, `UUID_RE`,
   `isUuid`, `parseJsonObjectBody`, `requestsPort`, `STATUS_VALUES`,
   `parsePositiveInt` — eight module-scope declarations, versus the
   five my recalled list implied.

2. Leading zeros — accepted, with the settling principle recorded:
   **reject when no unambiguous reading exists; normalize when exactly
   one does.** `page=abc` has no integer reading → 400; `page=007` has
   exactly one, and the echo canonicalizes it (verified live:
   `page: 7` echoed). Forgiveness is guessing; this is deterministic
   normalization.
   **Adjacent defect (human-found in adjudication; the audit saw the
   cosmetic surface and not what it was adjacent to):** `/^\d+$/`
   bounded the bottom of the range and not the top.
   `page=99999999999999999999` passed the regex, made
   `skip ≈ 10²⁰` — past Postgres's bigint ceiling — and **verified
   live pre-fix: 500 `INTERNAL_ERROR`** with the `[unmapped error]`
   line in server output. Digits-only curlable input producing a 500 is
   the §8 Q8 failure class exactly. Fixed:
   `Number.isSafeInteger(n) && n >= 1` (requests.ts, one clause).
   Principle recorded for future parsers: **a parser's guarantee must
   cover the full range its output type carries downstream, not just
   the plausible values.** Post-fix verified: huge page → 400
   `INVALID_INPUT`; regressions intact (defaults `{8,1,10}`, `page=2`
   → empty + total, `limit=500` → 100). Consequence flagged, accepted:
   `limit` beyond 2⁵³ now 400s instead of clamping — §5's clamp rule
   reads as scoped to the representable range (past
   `Number.MAX_SAFE_INTEGER` the value isn't faithfully representable
   as the promised integer: malformed, not a preference). Gates re-run:
   pass.

3. Unknown query params ignored — accepted, with the asymmetry against
   §8 Q5 recorded so the record doesn't read as inconsistency: a
   typo'd param *name* (`?userld=`) silently returns the unfiltered
   set — superficially the "filter that lies" Q5 400'd. The
   distinction that holds is **provenance**: param *values* are runtime
   data (typos happen per-request, forever, in production → reject),
   while param *names* are static strings in 4.10's own client code (a
   typo fails visibly on first dev test and is fixed once).
   Strict-unknown rejection would buy protection against a static bug
   already caught in development, at the cost of breaking benign
   additions (cache-busters, tracking params) and departing from REST
   convention. Q5 and this ruling are the same principle applied to
   different provenance, not an inconsistency.

Meta (human): the falling-severity trend holds — inventory
completeness, not silent decisions. Second-order note: the audit
demonstrated the gap's next form itself — it flagged leading zeros and
missed the unbounded top adjacent to it. Inventories can be
mechanically completed; noticing what a finding is *adjacent to*
cannot, which is why the human line-by-line pass stays in the loop.
