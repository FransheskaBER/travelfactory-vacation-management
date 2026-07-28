# Spec: 4.5 — Domain events + logging listener

**Status:** approved

> **Freeze rule:** Sections 1–8 freeze at human approval. Section 9 is
> append-only during implementation — deviations get recorded, never
> retro-edited into the plan.

## 1. Overview
Completes the event layer TDD §5 catalogs: the three event classes
(`VacationRequestCreatedEvent`, `VacationRequestApprovedEvent`,
`VacationRequestRejectedEvent`), one logging-listener module subscribing to
all three, and emission wired into the three 4.4 commands after save — the
exact edit spec 4.4 §8 Q1 predicted ("expected, not a deviation"). This
closes 4.3 §8 Q3's residual: a wrong-class emission is a silent no-op, so
the checklist obligation this chunk inherits is that the listener's log
line **observably appears**. ADR 0001 governs both halves: events fire
only after successful commit; listeners react, never gate. Checklist
item 4.5. No HTTP surface changes — 4.6 owns routes and handlers.

## 2. Scope (in)
- `src/domain/events/VacationRequestCreatedEvent.ts` (new)
- `src/domain/events/VacationRequestApprovedEvent.ts` (new)
- `src/domain/events/VacationRequestRejectedEvent.ts` (new)
- `src/domain/listeners/loggingListeners.ts` (new) — the three
  subscriptions + `registerLoggingListeners()` (§8 Q3, Q5)
- `src/domain/commands/{Create,Approve,Reject}VacationRequestCommand.ts` —
  one awaited emit line after save each (§8 Q2, Q7)
- `src/index.ts` — one `registerLoggingListeners()` call at startup (§8 Q5)
- `docs/travelfactory-assignment-checklist.md` — 4.6 bullet gains the
  end-to-end listener-line obligation this chunk cannot discharge (§6.6;
  the 4.3 §8 Q3 inheritance mechanism — applied pre-approval)
- `docs/tdd.md` — §5's Rejected purpose cell drops `: <comment>`
  (lockstep edit of a falsified design-doc cell, §8 Q9 — applied
  pre-approval)

No new dependencies. No `root.yaml` edit — therefore no codegen run this
chunk.

## 3. Out of scope
- Any listener beyond logging (email, notifications) — "more time"
  material; the pattern's decoupling claim is demonstrated, not exercised.
- The bus debug-line format — deliberately untouched (§8 Q8); 4.3 §4's
  name-only-never-input invariant stands as is.
- Free text (`reason`, `comment`) in any log output — excluded by
  decision (§8 Q4, Q9 — A14's privacy logic extended to logs), not by
  omission.
- End-to-end HTTP proof (curl approve → line in server output) —
  structurally impossible until 4.6's routes exist; obligation carried on
  checklist bullet 4.6 (§6.6), not by memory.
- Automated tests — Phase 5 (4.3 §8 Q8 / 4.4 §8 Q5 precedent), including
  how Phase 5 resolves the no-unsubscribe residual recorded in §8 Q2. No
  unsubscribe/reset API is added speculatively here.

## 4. Design
- **Emission site and order (§8 Q2, Q6, Q7).** Success path only, strictly
  after the port's `save` resolves — with app-level persistence, save
  resolution *is* the commit point (the same reading 4.4's mutation-path
  design rests on). Shape in every command:
  `const saved = await …save(request); await eventDispatcher.emit(new
  <NounVerbed>Event(saved)); return saved;`. Every rule failure throws
  before save, so no failure path can emit. Commands import the
  `eventDispatcher` singleton (§8 Q2 — the 4.3 §8 Q6 injection path).
  Spec 4.4 §6.10's "no `eventDispatcher` in commands" grep inverts by
  design this chunk — that criterion froze 4.4's state, and 4.4 §8 Q1
  named this exact edit as 4.5's.
- **Event shape (§8 Q1).** Each event is a class wrapping the saved
  entity: `constructor(readonly request: VacationRequest)`. The dispatcher
  keys on constructor reference (4.3 §8 Q3), so the three classes need
  distinct identities, not distinct payload shapes — identical bodies are
  correct, not lazy.
- **Listener (§8 Q3, Q4).** One module, three subscriptions, one shared
  formatting helper. Each listener makes exactly one
  `console.info(JSON.stringify(…))` call with the §5-frozen field set.
  TDD §5's message templates are content requirements, not a format
  contract; their `<user>`/`<reviewer>` render as ids (`userId`,
  `reviewedBy`) — the entity carries no names, and a name lookup would
  cost a query per write for log decoration. Free text never crosses
  into a log line (§8 Q9): the rejected line drops the template's
  `<comment>` — lockstep TDD §5 cell edit — because no authorship
  boundary controls content; the line's `requestId` points at the
  governed store instead. Listener bodies add no try/catch: error
  isolation is the dispatcher's job (4.3 §4).
- **Wiring (§8 Q5).** `registerLoggingListeners()` performs the
  subscriptions on the singleton; `index.ts` calls it once at startup.
  No top-level side effects — the scratch script and Phase 5 call the
  same exported function, and a pruned "unused" import can never silently
  unwire production logging.
- **Records.** ADR 0001's "from inside the handler" — stays-true defense,
  no amendment (§8 Q6). TDD §1/§3/§4/§5 already describe this chunk's end
  state (Cmd →> Disp →> Listener, three logging listeners) — no TDD edit
  beyond the §5 Rejected-cell lockstep (§8 Q9).

## 5. Contracts

```ts
// Three separate files (one class per file, filename = class name) —
// shown together here for brevity; §2 lists each path.
export class VacationRequestCreatedEvent {
  constructor(readonly request: VacationRequest) {}
}
export class VacationRequestApprovedEvent {
  constructor(readonly request: VacationRequest) {}
}
export class VacationRequestRejectedEvent {
  constructor(readonly request: VacationRequest) {}
}

// src/domain/listeners/loggingListeners.ts
export function registerLoggingListeners(): void; // subscribes all three on eventDispatcher
```

Log-line contract — one `console.info` of one single-line JSON object per
successful command execution, every value read from the saved entity:

| Command success | `event` value | additional keys |
|---|---|---|
| Create | `VacationRequestCreated` | `requestId`, `userId`, `startDate`, `endDate` |
| Approve | `VacationRequestApproved` | `requestId`, `userId`, `reviewedBy` |
| Reject | `VacationRequestRejected` | `requestId`, `userId`, `reviewedBy` |

The key **set** is exact and frozen — no key outside this table ever
appears. Lines carry only structured, validated, non-free-text values
(identifiers, dates, enum facts); no free-text field of any author ever
crosses into an event line — neither the requester's `reason` nor the
validator's `comment` (§8 Q4, Q9). `requestId` is the pointer into the governed store (DB rows,
API responses) where that text lives under the app's authorization model. Key order is
non-contractual: assertions parse the JSON, never substring-match the
line. Per 4.4 §9 adjudication 1's standing rule, nothing may ever match
on human-readable wording — there is none here to match on; behavior
keys off the parsed fields only.

## 6. Acceptance criteria
Every criterion is an observable postcondition (a log line that parses,
a row state at event time) — never "the emit call exists."

1. **Approve emission (the checklist's named case):** with
   `registerLoggingListeners()` having run, executing
   `ApproveVacationRequestCommand` on a Pending request → by the time
   `execute()` resolves, captured output contains **exactly one** line
   parsing to `event: "VacationRequestApproved"` with `requestId` = the
   request's id, `userId` = the requester's id, `reviewedBy` = `actorId`,
   and no other keys. A wrong-class emission or missing subscription
   yields zero lines and fails this criterion (4.3 §8 Q3's residual,
   closed).
2. **Created / Rejected emissions:** same standard per §5's table —
   the created line carries the request's exact dates; the rejected line
   carries `reviewedBy` = `actorId` and **no `comment` key** (§8 Q9).
   Exactly one line per successful execution, zero duplicates.
3. **Failure-path invariant:** a command execution that throws produces
   zero event log lines, whichever rule failed. Verified at minimum
   with one failure per command: create with `endDate < startDate`,
   approve on an already-Approved row, reject with `"   "`.
4. **Fire-after-commit invariant (ADR 0001):** at listener-invocation
   time the transition is already persisted. Verified with a scratch
   probe listener on `VacationRequestApprovedEvent` that re-reads the row
   via SQL *at event time* and observes `status = 'Approved'` — the one
   probe with power to kill an emit-before-save mutant, which criteria
   1–3 cannot distinguish externally.
5. **Log-hygiene invariant:** no event log line carries a key outside
   §5's table, and no free-text value (`reason`, `comment`) appears in
   any **event log line** — the invariant is scoped to listener output,
   parallel to 4.3 §6.2's bus/dispatcher scoping: TypeORM's dev query
   logging echoes command inputs in SQL `PARAMETERS` (the category-5
   condition 4.3 §9 already filed), so a whole-output assertion would
   fail on environment, not implementation (§8 Q10). Verified at
   minimum with: a created request whose `reason` is a distinctive
   sentinel and a rejection whose `comment` is a second sentinel, both
   asserted absent from every captured line that parses to §5's event
   shape.
6. **Wiring:** `src/index.ts` calls `registerLoggingListeners()` at
   startup, and the scratch run exercises the *same exported function* —
   the HTTP end-to-end proof is 4.6's (no approve route exists yet), so
   checklist bullet 4.6 carries it: approve via HTTP must produce the
   §5 line in server output, citing this spec's §6. *(Checklist edit
   applied pre-approval, per the 4.3 precedent — the criterion exists so
   `/spec-check` verifies presence.)*
7. **Gates:** `tsc --noEmit` and `npm run lint` pass; no `any` and zero
   lint disables in new/edited files; `git diff` shows `root.yaml` and
   `src/generated/HandlerRegistry.ts` untouched. *(4.4 §6.10's
   no-emission grep is expected to invert — see §4.)*

## 7. Testing requirements
Manual verification per the 4.4 protocol: a throw-away scratch script —
calls `registerLoggingListeners()` (the same function `index.ts` calls),
constructs the real `TypeOrmVacationRequestRepository` from the shared
DataSource against dockerized seeded Postgres, captures console output,
executes every §6 path, and checks lines (parsed, not substring-matched)
plus row state via SQL — run during verification, **not committed**,
output transcribed into §9. Criterion 4 adds one probe listener inside
the script. Automated tests are Phase 5's, carrying §8 Q2's recorded
residual (no unsubscribe on the shared singleton) to resolve there.

### Files touched (advisory)
- `src/domain/events/VacationRequestCreatedEvent.ts` (new)
- `src/domain/events/VacationRequestApprovedEvent.ts` (new)
- `src/domain/events/VacationRequestRejectedEvent.ts` (new)
- `src/domain/listeners/loggingListeners.ts` (new)
- `src/domain/commands/CreateVacationRequestCommand.ts` (emit line)
- `src/domain/commands/ApproveVacationRequestCommand.ts` (emit line)
- `src/domain/commands/RejectVacationRequestCommand.ts` (emit line)
- `src/index.ts` (registration call)
- `docs/travelfactory-assignment-checklist.md` (4.6 inheritance —
  applied pre-approval)
- `docs/tdd.md` (§5 Rejected cell — lockstep edit per §8 Q9, applied
  pre-approval)

## 8. Q&A
**Q1. Event payload — saved entity or minimal per-event fields?** A:
Saved entity (`new …Event(request)`). One shape, zero drift as the entity
grows; listeners pick what they log. Accepted trade-off: listeners couple
to the entity type — acceptable inside one domain layer.

**Q2. Dispatcher access — injected dep or singleton import?** A:
Singleton import, matching 4.3 §8 Q6's pattern for handlers: smaller
diff, no TDD §3 dependency-edge edit, imports stay the one injection
path. Accepted trade-off: Phase 5 emission assertions subscribe probe
listeners on the shared singleton rather than a fresh instance.
Residual discovered pre-approval while drafting: `EventDispatcher` has
**no unsubscribe** — singleton probes accumulate across tests. Phase 5
owns the resolution (module mock, module reset, or adding unsubscribe
then); nothing is added speculatively here.

**Q3. Listener scope — checklist minimum (Approved only) or TDD §5's
three? One module or three files?** A: All three, one module. TDD §5
stays true as written, the three log lines share one formatting helper,
and backend.md's one-class-per-file rule governs command/event classes,
not a subscriptions module (the assertPending reading, 4.4 §8 Q8).

**Q4. Structured format vs TDD §5's human-readable templates?** A:
One-line JSON via `console.info`; §5's templates are content
requirements (which facts appear), not a format contract — their
`<user>`/`<reviewer>` render as ids since the entity carries no names.
`reason` excluded from all lines: A14's privacy logic (personal detail,
no stated need) extends to logs, which outlive requests. Machine-parseable
is what makes the acceptance criteria assertable at all. *(This answer's
original inclusion of `comment` on the rejected line was overturned in
review — §8 Q9.)*

**Q5. Where do `subscribe()` calls run?** A: An exported
`registerLoggingListeners()` called once in `index.ts` — explicit and
greppable; scratch script and tests call the same function. A top-level
side-effect import was rejected: invisible import-order magic, and an
import-pruning refactor could silently unwire production logging — the
exact silent no-op this chunk exists to make impossible.

**Q6. ADR 0001 says emission happens "from inside the handler"; emission
lands inside commands (4.4 §8 Q1, frozen). Reconciliation?** A:
Stays-true defense, recorded here — no amendment. The ADR's force is
allocation: emission belongs to the domain execution the handler
initiates, never to the parser or a listener. Commands run on the
handler's call stack, so no allocation a reader could act on changes —
the same defense shape as 4.3 §8 Q1 for "constructed and executed in the
handler." A dated note is reserved for reader-observable divergence
(4.2 §8 Q10's precedent) and would signal a refinement that didn't
happen. Taxonomy: point-in-time record, no reader-observable divergence.

**Q7. Await `emit()` or fire-and-forget?** A: Awaited. `emit` never
rejects (4.3 §5), so awaiting cannot fail the command — this is purely
ordering. Deterministic: when the caller has the result, the log line
exists, which is what makes criterion 1's "by the time `execute()`
resolves" checkable at all. Matches TDD §1's sequence (listener before
the 201). Fire-and-forget bought nothing and made every assertion need
polling.

**Q8. 4.3 §4 left the bus debug-line format open for this chunk to
revisit. Does it?** A: No — out of scope, stated in §3. The
name-only-never-input rule is the invariant and it stands; reformatting
a working debug line adds diff surface to a chunk whose point is the
event pattern. Unifying log grammar is Phase 6 polish material if it
matters at all.

**Q9. Review finding (pre-approval): §5 admitted the validator's
`comment` into the rejected line while excluding `reason` on privacy
grounds — the spec's own three-part argument (personal detail, no stated
need, logs outlive requests) applied verbatim to both, unargued. Pressed
with the hypothetical of a validator writing "rejected — overlaps your
surgery leave": what boundary admits comment but excludes reason, and
does it survive?** A: It doesn't survive; `comment` dropped from the
line. The candidate boundary was authorship/purpose — the employee's
voluntary disclosure vs. the mandated business justification for an
adverse action (Rule 5). It fails at the content level: privacy protects
content, not authorship, and a rejection comment by design *discusses the
requester's situation*, so the employee's personal detail re-enters the
log in the validator's voice — the hypothetical is the ordinary case,
not an edge. The principle that does survive, frozen for every future
listener: **event log lines carry only structured, validated,
non-free-text values — identifiers, dates, enum facts — no free-text
field of any author, ever; `requestId` is the pointer into the governed
store (DB rows, API responses) where free text lives under the app's
authorization model.** Structural, not authorial — only free text can
smuggle personal detail, and no authorship rule controls what gets typed
into it. (Second-pass wording fix, pre-freeze: an earlier draft said
"system-generated," which smuggled authorship back in — the dates are
requester-typed; they're safe because the parser and Rules 1/4 constrain
them to `YYYY-MM-DD`, leaving no capacity for arbitrary content. The
capacity-for-content test is the mechanism, so the rule now states it.) Immutability
seals it: the comment is permanently in the DB and served to its designed
audiences; a log line adds an audience (ops, aggregation, uncontrolled
retention) with no stated need. The dispatcher's error channel (4.3:
logs `err`) stays clean under the same rule — this chunk's listeners
handle only the primitives in §5's table. TDD §5's Rejected cell is
falsified by this decision → lockstep edit (taxonomy: design doc),
applied pre-approval.

**Q10. Review finding (pre-approval): criterion 5's sentinel clause
asserted the reason sentinel "absent from all captured output" —
inheriting a known environmental fact from 4.3 §9 but dropping its
qualifier.** The scratch script runs the real adapter on the shared
DataSource with `logging: true` (4.1 adjudication 1: CLI mirrors
runtime), and 4.3 §9 already observed TypeORM's dev query logging
echoing values in SQL `PARAMETERS` — the create `INSERT` would print the
sentinel and fail the criterion on environment, not implementation. A:
Scoped to event log lines — lines that parse to §5's shape — parallel to
4.3 §6.2's bus/dispatcher scoping. The ORM echo stays what 4.3 filed it
as: a category-5 Phase 6 note (dev-only logging config), not this
chunk's debt. Criteria 1–2 were never exposed (they already filter to
parsed event lines). Mechanism note for the spec system: a frozen
criterion that inherits a sibling spec's §9 fact must carry the
qualifier with it — `/spec-check` audits one spec against its
implementation and cannot catch cross-spec drift; the second-pass human
review is the net for this class.

## 9. Implementation Results
*(append-only during build)*

**2026-07-28 — implemented, all §6 criteria verified against dockerized
Postgres, freshly wipe-and-reseeded. Criteria 1–5 via throw-away scratch
script (`backend/verify-4.5.ts` — called `registerLoggingListeners()`,
constructed the real `TypeOrmVacationRequestRepository` from
`cliDataSource`, captured `console.info` (listener channel) and
`console.log` (ORM channel) separately, parsed — never
substring-matched — every candidate event line; run, transcribed below,
deleted, never committed). Script self-cleaned: its 3 created rows
deleted, seed's 5 rows intact.**

- §6.1 ✓ — approve on a Pending request: by the time `execute()`
  resolved, exactly one line parsing to
  `{event:"VacationRequestApproved", requestId:<id>, userId:<requester>,
  reviewedBy:<validator>}` — exact key set, no extras.
- §6.2 ✓ — created line carried the exact dates (`+60`/`+62` offsets);
  rejected line (comment `"  SENTINEL_COMMENT_XYZZY_45  "`) carried
  `reviewedBy` and **no `comment` key**. Exactly one line per successful
  execution, zero duplicates across all five executions.
- §6.3 ✓ — one failure per command: create with `endDate < startDate` →
  `ValidationError`, approve on Approved → `ConflictError`, reject with
  `"   "` → `ValidationError` — zero new event lines in all three.
- §6.4 ✓ — probe listener on `VacationRequestApprovedEvent` re-read the
  row via SQL *at event time*: `status = 'Approved'` already persisted —
  the emit-before-save mutant is dead.
- §6.5 ✓ — 5 event lines total (created ×3, approved, rejected — one per
  successful execution); neither sentinel
  (`SENTINEL_REASON_XYZZY_45` on create, the comment sentinel on reject)
  appeared in any event line; no key outside §5's table. Context proving
  the scoping was load-bearing (§8 Q10): the ORM channel **did** echo
  both sentinels in SQL `PARAMETERS` — an unscoped assertion would have
  failed on environment, exactly as predicted.
- §6.6 ✓ — `index.ts` line 24 calls `registerLoggingListeners()` (import
  at line 20); the scratch run exercised the same exported function.
  Checklist 4.6 carries the HTTP end-to-end obligation (applied
  pre-approval; re-verified present).
- §6.7 ✓ — `tsc --noEmit` and `npm run lint` pass; zero lint disables
  and zero `any` types in new/edited files (the only grep hit for the
  substring is the English word "any" in a pre-existing `index.ts`
  comment and the listener module's header comment — no type-level
  `any`); `git status` shows `root.yaml` and `src/generated/` untouched.
  4.4 §6.10's no-emission grep inverted as §4 predicted.

**Implementation notes (no deviations from §1–8):**
- Files touched match §7's advisory list exactly.
- One scratch-script defect during verification, zero relevance to the
  implementation: the first run's §6.5 check asserted 4 total event
  lines but 5 successful executions ran (the whitespace-reject case
  needs its own Pending target, whose creation emits a fifth line). The
  script's count was corrected to 5 and re-run clean — every line-level
  assertion had already passed on the first run.

**2026-07-28 — /spec-check adjudications (human), both ⚠️ items accepted:**

1. `logLine` accepting `string | null` (print-null) — accepted as the
   **defined behavior** for a state unreachable through the commands.
   The null admission is the entity's lifecycle type leaking into the
   helper (`reviewedBy` genuinely is null for the entity's pre-review
   life; TypeScript has no cheap "post-approval VacationRequest" type).
   A defensive assert was rejected: it would throw into the
   dispatcher's swallow-and-log path — an untestable branch bought for
   an unreachable state. Print-null is also the *more* conformant
   choice: §5 freezes the key **set** per event type, and print-null
   keeps that set constant in every world, while omit-key would make
   the key set vary with data — the exact variance the freeze exists
   to prevent. Frozen-rule check (posed as a gate, answered
   correctly): `"reviewedBy":null` does **not** violate §8 Q9's rule —
   the ruling turns on **capacity**: null is a one-inhabitant literal
   with zero capacity for content, so it cannot smuggle personal
   detail; ruling it a violation would read the rule's illustrative
   enumeration ("identifiers, dates, enum facts") against its stated
   mechanism, the same wording-over-mechanism drift the pre-freeze
   "system-generated" fix removed.

2. Import-time registration — accepted; in CEF's entry shape,
   module initialization *is* startup (once per container at cold
   start, before any invocation), and no "after env, before traffic"
   position exists in `index.ts`: `envReady` is awaited per-invocation
   inside `handler`, never at module scope, so the only alternative —
   a once-guard inside `handler` — would re-implement module semantics
   with a runtime flag. The latent risk (a future listener doing env/DB
   work *at registration time*, before `envReady`) is fenced by the
   standing read-at-call-time rule from the JWT-secret and DataSource
   lessons; the fence is now explicit in a call-site comment added to
   `index.ts` post-audit: registration is pure in-memory subscription;
   listeners do env/DB work at event time, never at registration time.

**Trend ruling (human):** the 4.4 §9 recurrence tripwire fired — third
consecutive two-item batch of silent decisions (4.1, 4.4, 4.5). Ruling:
not coincidence, but the data shows count constant while severity falls
monotonically (4.1: real bite; 4.4: a genuine near-bug needing
verification; 4.5: zero reachable behavioral surface) — spec resolution
is converging on the right granularity; the failure is **timing**, not
detection. Proportionate fix applied to
`.claude/rules/implementation-mode.md`: before writing any code, list
every decision the spec leaves open — contract surface or reachable
behavior stops for a question; pure internals proceed and are listed in
§9. Trade-off accepted: a few more pre-code interruptions per chunk in
exchange for adjudications happening when they're cheapest — before the
code exists.
