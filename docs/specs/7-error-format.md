# Spec: 4.7 — Input validation + consistent error format

**Status:** approved

> **Freeze rule:** Sections 1–8 freeze at human approval. Section 9 is
> append-only during implementation — deviations get recorded, never
> retro-edited into the plan.

> **Record-reconciliation taxonomy** applies (see `_template.md`); entries
> that invoke it cite the category inline.

## 1. Overview
A closing chunk, not a build chunk (checklist 4.7). The D10 envelope, its
producers (`errorResponse`, `toErrorResponse`), and the single invocation
point (the global try/catch in `index.ts`, settled at 4.2 §8 Q7) all exist
and are wired through the merged 4.6 handlers. This chunk delivers one
behavior change — `reason` normalization plus 500-char caps on both
free-text fields, with the schema, entity, and YAML contract moved in
lockstep — one message-wording pass under a single convention (spec 4.4
§9 adjudication 1 assigned wording here; messages carry zero contract
weight), and one end-to-end audit that every error path still emits the
D10 envelope. One audit finding is fixed: the hand-built `ROUTE_NOT_FOUND`
envelope in `index.ts` routes through `errorResponse`, leaving the envelope
literal written in exactly one place.

## 2. Scope (in)
- `src/lib/reason.ts` (new) — `normalizeReason`; a small cohesive module,
  deliberately not a generic `helpers.ts` grab-bag. Two callers: the create
  parser (before building command input) and `db/seed.ts` (applied to its
  `reason` literals; one literal is deliberately padded so the helper's
  effect is observable — §6.6, review ruling 6).
- `handlers/requests.ts` — create parser normalizes `reason` then enforces
  the 500 cap (post-normalization, so trailing whitespace never counts);
  reject parser enforces the 500 cap on `comment` counted on trimmed length
  (count-only trim — §8 Q8); message wording per §4 convention.
- New additive migration — `ALTER COLUMN` only: `reason` and `comments`
  → `varchar(500)`. The 4.1 migration is history and is not touched.
- `entities/VacationRequest.ts` — `length: 500` on both decorators,
  lockstep with the migration (§8 Q6).
- `src/root.yaml` — `maxLength: 500` on the create body's `reason`, the
  reject body's `comment`, and the `VacationRequest` schema's `reason` and
  `comments` (§8 Q5): the YAML is the contract and must not understate
  parser restrictions. Entails `npm run codegen` + registry check.
- `index.ts` — `ROUTE_NOT_FOUND` 404 built via `errorResponse` (§8 Q7);
  its message joins the wording pass.
- Wording pass over every human-readable error message: `requests.ts`,
  `auth.ts`, `requireRole.ts`, the four domain commands (message strings
  only — no other command-layer change), `index.ts`.
- `.claude/rules/backend.md` — operative-rules lockstep (taxonomy:
  operative file): the "where `toErrorResponse` is invoked is a spec
  decision for chunk 4.2/4.7" bullet is settled — rewrite it as a pointer
  to 4.2 §8 Q7 (global try/catch in `index.ts`).
- Record edits, applied pre-approval (verified by §6.12; 4.6 §6.10
  pattern): checklist 4.7 line rewritten to match this spec's actual
  scope — the line predated the Q&A expansion (caps, migration/entity/
  YAML lockstep, the `ROUTE_NOT_FOUND` fix); checklist 4.9/4.10 lines
  gain the `maxlength="500"` inheritance parentheticals (pattern: 4.6
  §8 Q10's name-resolution note on the 4.10 line).

**Boundaries.** Date validation (format + calendar) lives in 4.6's create
parser and is not this chunk's work (spec 4.6 §8 Q7); `isValidDateString`
has one consumer and stays in `requests.ts`. The normalization guarantee
covers all writers that call `normalizeReason`; nothing enforces its use
by future writers — recorded as a known limitation (§4).

## 3. Out of scope
- Rejecting an empty `reason` — normalization, never validation (spec 4.6
  §9: normalize when exactly one reading exists).
- Moving or duplicating the `comment` trim/required logic — trimmed
  emptiness is Rule 5 and stays in `RejectVacationRequestCommand`
  (spec 4.4 §8 Q7).
- Any change to date validation or `isValidDateString` (spec 4.6 §8 Q7).
- Renaming, adding, or granularizing error `code` values — frozen contract
  from 4.2/4.4/4.6.
- Any change to the envelope shape (D10) or to the command layer beyond
  message wording.
- New validation libraries or generic validation abstractions.
- Frontend `maxlength="500"` on the request form and reject-comment form —
  recorded as an inheritance for 4.9 and 4.10 (same pattern as the
  4.6 → 4.10 name-resolution inheritance).

## 4. Design
- **Layer ownership (§8 Q1).** Normalization is representation, not
  meaning: `""`, `"  "`, and `null` are three wire encodings of "no reason
  given", and collapsing them is format work — the parser's job under the
  parser-owns-format / command-owns-meaning split (spec 4.4 §8 Q6).
  Normalization never rejects, so it is not a business rule and nothing
  forces it into the command. `CreateVacationRequestCommand` keeps
  `reason ?? null` unchanged and trusts its input.
- **Cap placement.** Both caps are parser 400s (`INVALID_INPUT`) — shape,
  not business rules. Reason: checked after normalization. Comment:
  checked on trimmed length, symmetric with reason ("trailing whitespace
  never counts against a cap" — §8 Q8); the trim is count-only — the
  parser never stores it, never emptiness-checks it. A whitespace-only
  comment of any length passes the cap and still hits Rule 5 in the
  command (400 `COMMENT_REQUIRED`) unchanged.
- **Migration.** Additive `ALTER COLUMN` with no `USING`/truncation: if a
  pre-existing row exceeded 500 chars the migration fails loudly rather
  than silently truncating data. Acceptable: dev-only data, wipe-and-reseed.
- **Wording convention** (messages only; codes frozen). Derived from the
  existing majority style; the pass fixes outliers (e.g. `auth.ts`'s
  "Missing field: email"):
  - Validation 400s: "X must be Y" — what's wrong + what's expected.
  - Other errors: one sentence stating what happened and why it's blocked.
  - Field names verbatim as API names (`startDate`, not "start date").
  - Sentence case, no trailing period.
  - The `INTERNAL_ERROR` message stays frozen as "Internal server error"
    (deliberately generic, per 4.2).
  Messages carry zero contract weight (4.4 §9 adjudication 1): no test,
  frontend branch, or doc may match on message text — behavior keys off
  `code` only. Message strings are therefore *not* frozen by this spec;
  the convention is the spec.
- **D10 note (taxonomy: pre-existing imprecision).** D10's rationale says
  the envelope is "produced in exactly two places"; 4.2's exported
  `errorResponse` helper already made that count imprecise. The
  `ROUTE_NOT_FOUND` fix improves the underlying claim (the literal now
  exists in exactly one place, `errorResponse`); the draft text is not
  this chunk's debt and is left untouched.
- **Known limitation.** `normalizeReason` is a convention, not an enforced
  choke point: a future writer that skips the helper can reintroduce
  unnormalized values. Accepted; revisit only if a third writer appears.

## 5. Contracts
```ts
// src/lib/reason.ts
export function normalizeReason(value: string | null | undefined): string | null;
// trim; "" after trim → null; null/undefined → null
```
- Create-parser postcondition: parsed `reason` is `null` or a non-empty
  trimmed string of ≤ 500 chars — never `undefined`, never whitespace-only.
- New 400s (both `INVALID_INPUT`, message per convention):
  - `POST /requests` — normalized `reason` longer than 500 chars.
  - `POST /requests/:id/reject` — trimmed `comment` longer than 500 chars.
- `root.yaml`: `maxLength: 500` on create-body `reason`, reject-body
  `comment`, and `VacationRequest.reason` / `VacationRequest.comments`.
- DB: `vacation_requests.reason` and `.comments` become `varchar(500)`
  (nullable unchanged); entity decorators carry `length: 500`.
- Error codes — frozen, no additions, no renames: `INVALID_INPUT`,
  `UNAUTHORIZED`, `FORBIDDEN`, `INVALID_CREDENTIALS`, `REQUEST_NOT_FOUND`,
  `REQUEST_NOT_PENDING`, `COMMENT_REQUIRED`, `OVERLAPPING_REQUEST`,
  `INVALID_DATE_RANGE`, `START_DATE_IN_PAST`, `ROUTE_NOT_FOUND`,
  `INTERNAL_ERROR`.
- Envelope: `{ error: { code, message } }` on every non-2xx response —
  unchanged (D10).

## 6. Acceptance criteria
Every criterion is an observable postcondition; properties first, probes
as minimum samples. The observed curl transcript is pasted into §9 at
implementation time (§1–8 freeze at approval; same mechanics as 4.6).

1. **Envelope invariant:** every non-2xx response body is exactly
   `{ error: { code, message } }` — verified at minimum with the §6.8
   transcript rows.
2. **Normalization:** any create whose `reason` trims to empty stores SQL
   `NULL`, observable via `GET /requests/mine` returning `"reason": null`
   for that row; a padded reason (`"  x  "`) stores `"x"`.
3. **Caps:** trimmed length 501 → 400 `INVALID_INPUT` (both fields);
   exactly 500 → accepted (boundary probe both sides).
4. **Rule 5 untouched:** whitespace-only `comment` (including one longer
   than 500 chars pre-trim) → 400 `COMMENT_REQUIRED` from the command.
5. **Schema:** `information_schema.columns` shows
   `character_maximum_length = 500` for `reason` and `comments` after
   `migration:run` on a database migrated from scratch.
6. **Seed:** runs clean end-to-end; one `reason` literal is deliberately
   padded (`"  Family visit  "`) and its stored row reads the trimmed
   `"Family visit"` — the padded literal is what makes a missing helper
   call observable (identical clean literals would pass with the helper
   unwired); all other literals unchanged.
7. **Codes unchanged:** the derived code inventory equals §5's frozen
   list. Derivation rule (derived, not recalled): every string literal in
   the code-argument position of an `errorResponse(...)` call or a
   `DomainError`-subclass constructor under `src/`, comments and test
   files excluded. The rule is pinned so the inventory is reproducible; a
   code smuggled through a constant evades it and is caught by review
   only.
8. **Transcript rows** (one curl each, observed body pasted in §9):
   malformed JSON; JSON-valid non-object body; invalid date; oversize
   `reason`; oversize `comment`; whitespace-only `reason` → 201 + null
   stored; whitespace-only `comment` → 400 `COMMENT_REQUIRED`; 401 no
   token; 403 wrong role; 404 unknown id; 409 overlap or not-pending;
   unmatched route → 404 `ROUTE_NOT_FOUND`; unmapped 500 — verified live
   by stopping the Postgres container, hitting an endpoint, confirming the
   catch-all emits the envelope, restarting the container.
9. **Single producer (tripwire, not proof):** the grep
   `/error\s*:\s*\{/` over `src/` (tests and comments excluded) matches
   only `errorResponse`; behavioral proof is §6.8's `ROUTE_NOT_FOUND` row
   plus source review of the one-line `index.ts` fix. Envelope-producer
   uniqueness is enforced by review convention, not by any automated
   check — the grep under-matches (a producer assembling the envelope via
   a variable evades it) and over-matches (fixtures, comments); accepted
   with that gap open (review ruling 6).
10. **Wording:** §9 contains the old → new table whose row set equals the
    derived message inventory (same call sites as §6.7's rule,
    message-argument position) — completeness is derived, not recalled;
    every new message satisfies the §4 convention; `code` values in the
    table are byte-identical old vs new.
11. `tsc --noEmit` passes, lint passes, codegen registry resolves every
    ref after the YAML edit.
12. **Record edits present:** the checklist 4.7 line describes this
    spec's actual scope; the 4.9 and 4.10 lines carry the
    `maxlength="500"` inheritance parentheticals; `backend.md`'s
    invocation-point bullet points at 4.2 §8 Q7 (that last edit lands
    with the implementation, not pre-approval).

## 7. Testing requirements
Derived from §6 only.
- Unit: `normalizeReason` — trims, `""`/whitespace → `null`, `null` →
  `null`, `undefined` → `null`, clean string unchanged (§6.2, §6.6).
- Parser: cap boundaries 500/501 for both fields (§6.3); whitespace-only
  comment passes the parser (§6.4 — the 400 comes from the command).
- Tests assert on `code` and status only — never message text (4.4 §9
  adjudication 1).
- The transcript, schema query, seed run, and grep inventories (§6.5–§6.9)
  are manual acceptance evidence recorded in §9.

### Files touched (advisory)
`src/lib/reason.ts` (new), new migration (new), `handlers/requests.ts`,
`handlers/auth.ts`, `auth/requireRole.ts`, `entities/VacationRequest.ts`,
`src/root.yaml`, `index.ts`, `db/seed.ts`, the four command files (message
strings only), `.claude/rules/backend.md`,
`docs/travelfactory-assignment-checklist.md` (pre-approval record edits).
`handlers/users.ts` sat in the original inventory and is dropped — it
contains no error producers (review ruling 4).

## 8. Q&A
**Q1. Which layer owns `reason` normalization — create parser or command?**
A (human): The parser, as one shared helper `normalizeReason` in
`src/lib/reason.ts`, called by the create parser and `seed.ts`; the
command keeps `reason ?? null` and trusts its input. Normalization is
representation, not meaning (parser owns format / command owns meaning,
4.4 §8 Q6), and it never rejects, so it is not a business rule. Residual
gap (helper use is unenforced for future writers) recorded as a known
limitation instead of adding command-side re-normalization.

**Q2. Empty reason — reject or normalize?** A (human): Never reject;
trim, and store `null` if empty after trim. One meaning, one
representation (spec 4.6 §9: normalize when exactly one reading exists).

**Q3. Error-message convention?** A (human): The §4 convention, applied
as one pass derived from majority style; codes are frozen contract and
untouched; `INTERNAL_ERROR`'s message stays "Internal server error".

**Q4. Length caps?** A (human): 500 chars on both `reason` and `comment`,
parser-enforced 400 `INVALID_INPUT`; one additive migration altering both
columns to `varchar(500)`; frontend `maxlength` recorded as 4.9/4.10
inheritance. (Initially reason-only; extended to `comment` at Q&A when the
symmetry was raised. Reason: no unbounded user input, and consistency with
the `reason` cap — one rule for both fields.)

**Q5. Does `root.yaml` gain `maxLength: 500`?** A (human): Yes, all four
declarations — create-body `reason`, reject-body `comment`, and the
`VacationRequest` schema's `reason`/`comments`. The YAML is the contract;
a parser rejecting what the YAML allows would invert that rule. Entails
codegen + registry check.

**Q6. Entity decorators?** A (human): Lockstep — `length: 500` on both
columns in the same chunk as the migration, so entity and schema never
diverge (`synchronize: false` hides the drift at runtime, which is exactly
why it must not be left).

**Q7. `index.ts`'s hand-built `ROUTE_NOT_FOUND` envelope?** A (human):
Fix in 4.7 — route it through `errorResponse`; it was the one producer
outside the helper, the drift class D10 exists to prevent.

**Q8. Comment cap — raw or trimmed length?** A (human): Trimmed length,
count-only (the parser never stores the trimmed value or checks
emptiness) — symmetric with reason: trailing whitespace never counts
against a cap. Rule 5 stays whole in the command.

**Recorded, not re-asked:** where `toErrorResponse` is invoked was settled
at 4.2 §8 Q7 (global try/catch in `index.ts`); `backend.md`'s bullet
flagging it "for chunk 4.2/4.7" gets the §2 lockstep pointer update.

**Review-round rulings (human, pre-approval)** — from the four-lens pass
(decision-diff, citations, precedent, falsifiability):
1. Migration failure-mode note kept — documents default Postgres behavior
   the human wants visible; no new scope.
2. Q4's recorded reason corrected to the human's actual reason (above);
   the earlier draft attributed a rationale the human never stated.
3. Transcript-in-§9 split ratified — the freeze rule wins over the
   instruction's literal wording. Process rule going forward: when an
   instruction conflicts with an established rule, the conflict is
   flagged before resolving — never resolved unilaterally and declared
   at delivery.
4. `handlers/users.ts` dropped from the inventory — vacuous entry, zero
   error producers (grep-verified).
5. Precedent alignment accepted: §2 record-edits bullet + §6.12, matching
   4.6's §6.10 pattern; checklist 4.7/4.9/4.10 lines edited pre-approval.
6. §6.6 padded seed literal and the §6.7/§6.9/§6.10 derivation-rule pins
   accepted; §6.9's grep demoted to tripwire, with the envelope-producer
   uniqueness gap (review convention, no automated check) stated where
   the rule is defined and accepted as open.

## 9. Implementation Results
(append-only during build)

**2026-07-29 — implementation complete; all §6 criteria verified.**

### Deviations
1. **§7 unit tests deferred to Phase 5 (human ruling, pre-code).** The
   repo has zero test infrastructure; automated tests are deliberately
   Phase 5's (4.3 §8 Q8, spec 4.4 deferral). §7 was written without
   checking that, and the conflict was flagged before any code. Ruling:
   defer — §7's unit-test lines (normalizeReason, cap boundaries) carry
   to Phase 5; §6's live evidence verifies this chunk.
2. **`db/dataSource.ts` touched (not in the §7 advisory inventory).**
   Migrations register by explicit import in `cliDataSource`'s
   `migrations` array, not by glob — discovered when `migration:run`
   reported "No migrations are pending". Added
   `FreeTextLength1785318163979` to the array. Entailed by "new
   migration" given the repo's registration mechanism.
3. **`handlers/auth.ts` stale comment updated** ("chunk 4.7 may revisit"
   → settled: wording only, no format rules added). Comment-only.

### Pure internals (inventory derived per implementation-mode: grep of
module-scope declarations in new/edited modules)
New module-scope declarations: `normalizeReason` (`lib/reason.ts`),
`MAX_FREE_TEXT = 500` (`handlers/requests.ts`, shared by both cap checks;
messages interpolate it), `FreeTextLength1785318163979` (migration, with
`down()` reverting both columns to unbounded varchar). §5's
`export function` signature implemented as a const arrow (type contract
identical; codebase idiom). All other module-scope declarations in the
grep output predate this chunk.

### Wording table (old → new; `code` byte-identical in every row;
completeness = the derived message inventory, same call sites as §6.7)
| Code | Old | New |
|---|---|---|
| INVALID_INPUT | Missing field: email | email must be a non-empty string |
| INVALID_INPUT | Missing field: password | password must be a non-empty string |
| INVALID_DATE_RANGE | End date must not be before start date | endDate must not be before startDate |
| START_DATE_IN_PAST | Start date must not be in the past | startDate must not be in the past |
| COMMENT_REQUIRED | A rejection comment is required | comment must not be empty |
| INVALID_INPUT | — (new) | reason must be 500 characters or fewer |
| INVALID_INPUT | — (new) | comment must be 500 characters or fewer |

Unchanged (already conform; rest of the derived inventory): Body must be
valid JSON · Body must be a JSON object · startDate/endDate must be a
valid YYYY-MM-DD date · reason must be a string when provided · status
must be Pending, Approved or Rejected · userId must be a uuid · page/limit
must be an integer >= 1 · id must be a uuid · comment must be a string ·
Missing or invalid token · Insufficient role · Invalid email or password ·
Vacation request not found (×2 sites) · Request is not pending · An
overlapping vacation request already exists · Route not found · Internal
server error (frozen).

### Evidence
- **§6.5** `information_schema.columns` after `migration:run`:
  `reason | character varying | 500`, `comments | character varying | 500`.
- **§6.6** seed ran clean; padded literal stored trimmed:
  `SELECT '['||reason||']'` → `[Family visit]`.
- **§6.7** multiline-aware derivation (comments stripped) returned exactly
  the twelve frozen codes. Note: a naive line-based grep missed the four
  codes in multi-line constructor calls — the derivation script, not a
  one-liner, is the reproducible form of the rule.
- **§6.9** tripwire: `/error\s*:\s*\{/` over `src/` (generated excluded)
  matches only `toErrorResponse.ts:16` (`errorResponse`).
- **§6.11** codegen self-asserted all 16 refs; `tsc --noEmit` and lint
  clean (re-run after the `dataSource.ts` edit).

### §6.8 curl transcript (observed bodies, dev server on :8888)
```
R1  malformed JSON            {"error":{"code":"INVALID_INPUT","message":"Body must be valid JSON"}} => 400
R2  non-object body ([1,2])   {"error":{"code":"INVALID_INPUT","message":"Body must be a JSON object"}} => 400
R3  invalid date (02-30)      {"error":{"code":"INVALID_INPUT","message":"startDate must be a valid YYYY-MM-DD date"}} => 400
R4  reason 501 post-trim      {"error":{"code":"INVALID_INPUT","message":"reason must be 500 characters or fewer"}} => 400
R5  reason exactly 500        => 201
R6  whitespace-only reason    201, body shows "reason":null; GET /mine row: None
R7  "  padded reason  "       201, body shows "reason":"padded reason"; GET /mine confirms
R9  comment trimmed 501       {"error":{"code":"INVALID_INPUT","message":"comment must be 500 characters or fewer"}} => 400
R10 501 spaces as comment     {"error":{"code":"COMMENT_REQUIRED","message":"comment must not be empty"}} => 400 (passes cap, hits Rule 5)
R11 no token                  {"error":{"code":"UNAUTHORIZED","message":"Missing or invalid token"}} => 401
R12 Requester calls approve   {"error":{"code":"FORBIDDEN","message":"Insufficient role"}} => 403
R13 unknown well-formed uuid  {"error":{"code":"REQUEST_NOT_FOUND","message":"Vacation request not found"}} => 404
R14 overlap re-book           {"error":{"code":"OVERLAPPING_REQUEST","message":"An overlapping vacation request already exists"}} => 409
R15 GET /nope                 {"error":{"code":"ROUTE_NOT_FOUND","message":"Route not found"}} => 404
R16 comment exactly 500       => 200 (reject succeeds)
R17 Postgres stopped          {"error":{"code":"INTERNAL_ERROR","message":"Internal server error"}} => 500;
    container restarted, same token+endpoint => 200 (connection re-init
    recovers per 4.1's cleared-initPromise design)
```
Every non-2xx row wears the D10 envelope (§6.1). Note for reviewers: R16
rejected Bob's seeded pending request (Hiking trip) with a 500-char
comment — `npm run seed` restores pristine demo data.
