# Spec: 4.3 — Command bus + event dispatcher core

**Status:** approved

> **Freeze rule:** Sections 1–8 freeze at human approval. Section 9 is
> append-only during implementation — deviations get recorded, never
> retro-edited into the plan.

## 1. Overview
Builds the domain messaging core from TDD §1/§4/§5: a `CommandBus` (the
single choke point every command execution passes through) and an
`EventDispatcher` (pub/sub for domain events, consumed by 4.5's listeners).
Both are small and hand-rolled — checklist 4.3 calls this "the architecture
showcase, keep it readable." The bus is the **thin-executor** shape (§8 Q1):
what it preserves is the command *shape* — self-executing commands with
constructor-injected deps — so ADR 0001's allocation stays true as written,
no amendment (Q1 records the defense). Records that state call paths or
signatures change in lockstep instead: backend.md's operative handler
example gains the bus call (in scope, loaded during 4.4), and TDD §1/§3
were updated pre-approval — including approve/reject moving to single-input
signatures, a contradiction with §5's `Command` contract that review
surfaced (§8 Q9).
Live proof: the existing login flow is rewired through the bus so the rails
carry real traffic before 4.4 builds on them (§8 Q4).

## 2. Scope (in)
- `src/domain/bus/CommandBus.ts` (new folder, §8 Q5) — thin executor +
  module-level singleton `commandBus`; one debug line per dispatch, command
  class name only (§8 Q7)
- `src/domain/events/EventDispatcher.ts` (folder per backend.md layout) —
  subscribe/emit keyed by event class constructor (§8 Q3), listeners awaited
  sequentially in subscription order, each error-isolated (§8 Q2);
  module-level singleton `eventDispatcher` (§8 Q6)
- `src/handlers/auth.ts` — login handler dispatches `LoginCommand` through
  `commandBus.execute(...)` instead of calling `.execute()` directly
- `.claude/rules/backend.md` — two edits: file-layout list gains the
  `src/domain/bus/` line, and the handler-shape example's direct
  `new ApproveVacationRequestCommand(deps).execute(input)` becomes a
  `commandBus.execute(...)` dispatch — the example is operative (loaded
  during 4.4's implementation) and must demonstrate the canonical
  invocation, or 4.4 reproduces the bypass criterion 1 exists to prevent
- `docs/tdd.md` — §1: sequence diagram gains the `CommandBus` hop
  (`Auth →> Bus: execute(cmd, input)`, `Bus →> Cmd: execute(input)`),
  layering diagram's emit node names `eventDispatcher`; §3: class diagram
  gains `Command` (interface), `CommandBus`, `EventDispatcher`, and
  approve/reject signatures become single input objects (§8 Q9 — applied
  pre-approval)
- Checklist bullet 4.5 amended with the inherited listener-log-line
  acceptance obligation (4.2 §8 Q9's mechanism; §8 Q3)
- `docs/technical-decisions-draft.md` — D14 row: thin executor over registry
  bus, pointing at §8 Q1 (review finding: the strongest trade-off narrative
  belongs where the rubric looks, not only in a spec's Q&A)

No new dependencies. No `root.yaml` edit — therefore no codegen run this
chunk (the codegen rule triggers on YAML edits only).

## 3. Out of scope
- Domain commands and business rules — chunk 4.4. The bus ships with exactly
  one consumer (login).
- Event classes and listeners — chunk 4.5. The dispatcher ships with **zero
  events and zero subscriptions**; nothing emits in production code yet.
- The emit-after-commit rule (ADR 0001) — enforced at the emission sites,
  which 4.4/4.5 own. This chunk provides the mechanism, not the call sites.
- Middleware, command registry, async command queueing — deliberately absent
  (§8 Q1: thin executor).
- Automated tests — Phase 5 (§8 Q8). Design keeps both classes
  constructible fresh (public constructors, no hidden state) so Phase 5
  unit tests need no DB, no CEF, and no singleton reset hooks.

## 4. Design
- **Bus (§8 Q1).** `execute(command, input)` awaits the command's own
  `execute(input)` and returns its result; thrown `DomainError`s propagate
  untouched to the existing global catch in `index.ts`. The bus adds exactly
  one behavior: a `console.debug` line naming `command.constructor.name`.
  Never the input — login payloads contain passwords (§8 Q7). 4.5's
  structured-logging chunk may revisit the log format; the
  name-only-never-input rule is the invariant, the formatting is not.
- **Dispatcher (§8 Q2, Q3).** `subscribe(EventClass, listener)` keys on the
  class constructor reference — type-safe generics (listener's parameter
  type is inferred from the class), rename-refactor safe, no string drift.
  `emit(event)` looks up `event.constructor`, awaits each listener
  sequentially in subscription order, wraps each in try/catch:
  failures are logged (`console.error`, event class name + error) and
  swallowed — `emit` never rejects. A broken listener cannot fail an
  already-committed operation (ADR 0001: listeners react, never gate).
  Emitting a class with no subscribers is a silent no-op.
- **Typing.** `any` is banned. Public signatures are fully generic (§5);
  internal listener storage erases to `unknown`-based types with the
  `subscribe` signature guaranteeing the pairing — never `any`.
- **Lifecycle (§8 Q6).** Each file exports one shared singleton. CEF
  resolves handlers by string ref from the generated registry, so imports
  are the injection path — same way handlers already reach `signJwt` and
  the DataSource.
- **Login rewire (§8 Q4).** `handlers/auth.ts` keeps constructing
  `LoginCommand` with its `findUserByEmail` dep; only the call changes:
  `commandBus.execute(new LoginCommand(deps), input)`. Handler shape,
  parser, root.yaml, and every 4.2 contract stay untouched.

## 5. Contracts

```ts
// src/domain/bus/CommandBus.ts
export interface Command<TInput, TResult> {
  execute(input: TInput): Promise<TResult>;
}
export class CommandBus {
  execute<TInput, TResult>(
    command: Command<TInput, TResult>,
    input: TInput
  ): Promise<TResult>;
}
export const commandBus: CommandBus;

// src/domain/events/EventDispatcher.ts
export type EventClass<TEvent> = new (...args: never[]) => TEvent;
export type EventListener<TEvent> = (event: TEvent) => void | Promise<void>;
export class EventDispatcher {
  subscribe<TEvent extends object>(
    eventClass: EventClass<TEvent>,
    listener: EventListener<TEvent>
  ): void;
  emit(event: object): Promise<void>;   // never rejects
}
export const eventDispatcher: EventDispatcher;
```

HTTP contracts: unchanged. `POST /login` behaves byte-for-byte per spec
4.2 §5 — this chunk changes its internal path, not its contract.

Observable side channel (the only new output): per dispatch, one debug line
containing the command class name (e.g. `LoginCommand`).

## 6. Acceptance criteria
1. `POST /login` still satisfies spec 4.2 §6.1–6.3 — verified at minimum
   with: seeded credentials → 200 `{ token }`; wrong password → 401
   `INVALID_CREDENTIALS`; non-JSON body → 400 `INVALID_INPUT` — **and** each
   login attempt that reaches the handler produces the bus's dispatch line
   naming `LoginCommand` in server output, proving the route runs through
   the bus, not around it.
2. Log-hygiene invariant: bus-emitted output contains command class names
   only — no field of any command input (notably `email`/`password`) appears
   in any bus or dispatcher output. Verified at minimum with: inspecting
   server output for a login request with a recognizable email.
3. Dispatcher ordering: two listeners subscribed to one event class run
   sequentially in subscription order on `emit` (observed output order
   matches subscription order).
4. Error isolation invariant: with the first of two listeners throwing,
   `emit` resolves (never rejects), the failure is logged with the event
   class name, and the second listener still runs.
5. Emitting an event class with zero subscribers resolves without error and
   produces no output.
6. Grep over `src/domain/bus/` and `src/domain/events/` finds no `any`
   (lint's `no-explicit-any` passes with zero disables in these files).
7. `tsc --noEmit` and `npm run lint` pass. `git diff` shows `root.yaml` and
   `src/generated/HandlerRegistry.ts` untouched this chunk.
8. `.claude/rules/backend.md` file-layout list contains the
   `src/domain/bus/` line, and its handler-shape example invokes via
   `commandBus.execute(...)` — no direct `.execute(input)` call remains in
   the example.
9. `docs/technical-decisions-draft.md` contains the D14 thin-executor row,
   pointing at this spec's §8 Q1. *(Applied pre-approval with the spec
   edits, same as 4.2 §6.10's doc rows — the criterion exists so
   `/spec-check` verifies presence, not to schedule work.)*
10. Checklist bullet 4.5 carries the listener-log-line acceptance
    requirement, citing this spec's §8 Q3. *(Applied pre-approval, same
    note as 9.)*
11. `docs/tdd.md` §1's sequence diagram routes
    `Auth →> Bus: execute(cmd, input)` then `Bus →> Cmd: execute(input)`
    and its layering diagram's emit node names `eventDispatcher`; §3's
    class diagram contains `Command` (interface), `CommandBus`, and
    `EventDispatcher`, with all three domain commands implementing
    `Command` via single-input `execute(input)` signatures. The §1
    emission path routes `Cmd →> Disp: emit(event)` then
    `Disp →> Listener` with `eventDispatcher` as a participant — no
    direct command→listener call remains. *(Applied pre-approval, same
    note as 9.)*

## 7. Testing requirements
Manual verification per the 4.2 protocol (§8 Q8), each §6 criterion recorded
in §9: criteria 1–2 via curl against the dev server + seeded Postgres;
criteria 3–5 via a throw-away scratch script (constructs a fresh
`EventDispatcher`, two listeners, one throwing) run during verification and
**not committed** — its output transcribed into §9. Automated unit tests are
deliberately Phase 5's (checklist Phase 5; §8 Q8): the public constructors
mean those tests construct fresh instances with no reset hooks.

### Files touched (advisory)
- `src/domain/bus/CommandBus.ts` (new)
- `src/domain/events/EventDispatcher.ts` (new)
- `src/handlers/auth.ts` (login dispatch rewire)
- `.claude/rules/backend.md` (layout line + handler-example invocation)
- `docs/technical-decisions-draft.md` (D14 row — applied pre-approval)
- `docs/tdd.md` (§1 + §3 diagrams — applied pre-approval, §8 Q9)
- `docs/travelfactory-assignment-checklist.md` (4.5 parenthetical —
  applied pre-approval)
- `docs/specs/_template.md` (record-reconciliation taxonomy — workflow
  capture from this spec's review rounds, applied pre-approval; the 4.2
  precedent for systemic rules landing in the template)

## 8. Q&A
**Q1. Bus shape — thin executor over self-executing commands, or classic
registry bus (data-only commands routed to registered executors)?** A: Thin
executor. Commands keep `execute()` + constructor-injected deps as TDD §3
diagrams; the bus is the single choke point where cross-cutting behavior
attaches. ADR 0001 ("constructed and executed in the handler") stays true —
the defense below. The other records pressed in review don't get that
defense, because they claim more than allocation: backend.md's handler
example shows the direct `.execute(input)` call — operative, not
point-in-time, so updated in scope (§2) rather than defended; TDD §1's
sequence diagram claims the call path itself and §3's class diagram claims
signatures — both updated in lockstep pre-approval (§2), not deferred to
4.4. The TDD's truth condition is "describes the intended architecture,"
which changed the moment this Q froze, not the moment 4.4 ships — and §3's
approve/reject signatures turned out to outright contradict §5's contract
(§8 Q9), so deferral would have handed 4.4 two conflicting authoritative
documents. Trade-off accepted: the
routing story is modest; the event dispatcher carries the decoupling
showcase.
On ADR 0001's "constructed and executed in the handler" surviving the
rewire (review pressed this): still true as intended, no amendment. The
ADR's Context allocates domain work between CEF's two functions — parser
vs handler — and the sentence's force is that execution belongs to the
handler, not the parser or a listener. Post-rewire, the handler still
constructs the command, initiates execution, and awaits the result on its
own call stack; the bus decorates that call (one log line), it does not
relocate it. Contrast 4.2 §8 Q10, where ADR 0003's snippet showed a
reader-observable contract divergence (wrong envelope) and got a dated
note: here no allocation a reader could act on changes, so a note would
signal a refinement that didn't happen.

**Q2. Listener execution — awaited or fire-and-forget?** A: Awaited
sequentially in subscription order, each listener error-isolated
(try/catch, log, never rethrow). Deterministic for 4.5's listener and
Phase 5's tests; a broken listener can't fail a committed operation.

**Q3. Registration keying — class constructor or string name?** A: Class
constructor reference. Type-safe via generics, rename-refactor safe; a
string key could typo-compile and silently never fire. Residual:
constructor keying protects `subscribe`, not `emit` — a wrong-class
emission compiles and is a silent no-op (criterion 5 makes that a
feature), the same failure class on the other side of the API. Mitigated
by 4.5's acceptance criteria requiring the listener's log line to appear;
that obligation is carried on checklist bullet 4.5, not by memory.

**Q4. Does 4.3 rewire login through the bus as its live proof?** A: Yes —
on the live-proof rationale alone: the rails should carry real traffic
before 4.4 builds trains (same philosophy as 4.2's temp guard). Spec 4.2
§8 Q4 does **not** assign this refactor here — its assignment was
conditional ("if 4.3's bus changes handler shape"), and Q1's thin executor
keeps handler shape unchanged, so the condition is false. (An earlier draft
misquoted 4.2 Q4 as the justification; reworded pre-approval when review
caught it.)

**Q5. Where does `CommandBus.ts` live? backend.md names a home for the
dispatcher but none for the bus.** A: New folder `src/domain/bus/`;
backend.md's layout list gains the line (4.2's amend-the-rule-file
precedent). Symmetric with `events/`, unambiguous import for 4.4.

**Q6. Instantiation — module-level singletons or composition root in
`index.ts`?** A: Module-level singletons. CEF resolves handlers by string
ref, so there is no parameter path for injected instances; imports are how
handlers already reach everything. Constructors stay public so Phase 5
tests build fresh instances.

**Q7. Does `bus.execute()` do anything observable beyond awaiting?** A:
Yes — one debug line per dispatch, command class name only, never the
input (login payloads contain passwords). Makes "goes through the bus" a
checkable postcondition instead of code inspection (the 4.2 stale-registry
lesson: verify effects, not invocations).

**Q8. Test timing — Phase 5 per precedent, or unit tests now? (Alternative
explained: install Vitest in 4.3, ship bus/dispatcher tests with the
chunk.)** A: Phase 5. Both options end with the same tests existing before
submission; the only variable is how long the error-isolation invariant
lives without an automated tripwire (chunks 4.4–4.6). Keeping the phase
structure coherent — one testing pass in Phase 5, per the 4.2 precedent —
is worth that small, time-boxed window.

**Q9. Fourth review round, absorbing the TDD update, surfaced a
contradiction the earlier deferral was hiding: §5's
`Command<TInput, TResult>` takes one input parameter, but TDD §3 diagrammed
`ApproveVacationRequestCommand.execute(id, validatorId)` and
`RejectVacationRequestCommand.execute(id, validatorId, comment)` —
multi-arg signatures that cannot implement the interface. Which record
wins?** A: The bus contract. Approve/reject move to single input objects
(`execute({ id, validatorId })`, `execute({ id, validatorId, comment })`) —
forced by `Command`, and already consistent with backend.md's handler shape
(single-arg `.execute(input)`). TDD §1 and §3 updated in lockstep
pre-approval: the TDD's truth condition is "describes the intended
architecture," which changed when Q1 froze, not when 4.4 ships — the bus
hop's position is fully determined by this spec's own contracts, so
deferral bought no information, only a window in which TDD §3 and this §5
would have reached 4.4's implementer as two conflicting authoritative
documents. The earlier draft's claim that TDD §3 "stays true as written"
was false for two of four commands; §1 and Q1 now claim only what the thin
executor actually preserves — the shape (self-executing commands,
constructor-injected deps), not the verbatim diagram.

## 9. Implementation Results
*(append-only during build)*

**2026-07-28 — implemented, all §6 criteria verified against the dev server
(port 8888) + dockerized Postgres with seed data; dispatcher criteria via
throw-away scratch script (run, transcribed, deleted — never committed).**

- §6.1 ✓ — seeded credentials → 200 `{ token }`; wrong password → 401
  `INVALID_CREDENTIALS`; non-JSON body → 400 `INVALID_INPUT`. Server output
  contains `[bus] dispatching LoginCommand` exactly **2** times — matching
  the two requests that reached the handler; the non-JSON request
  short-circuits at the parser and correctly produces no dispatch line.
- §6.2 ✓ — bus output is the class name only; `Demo1234` (the password)
  appears nowhere in server output; the email appears in no bus/dispatcher
  line. Observation (pre-existing, outside the criterion's scope — the
  invariant is scoped to bus/dispatcher output): TypeORM's dev query
  logging echoes the email in SQL `PARAMETERS`. Taxonomy category 5 — a
  condition 4.3 didn't create or change; candidate Phase 6 note (dev-only
  logging config), not 4.3 debt.
- §6.3 ✓ — scratch output `C3 observed order: first:7 -> second:7` —
  subscription order preserved across a sync and an async listener.
- §6.4 ✓ — first listener threw; `emit` resolved (`rejected: false`),
  failure logged as `[events] listener for SampleEvent failed: Error: boom`
  (event class name present), second listener still ran.
- §6.5 ✓ — zero-subscriber emit resolved; no dispatcher output produced.
- §6.6 ✓ — grep for `any` over `src/domain/bus/` + `src/domain/events/`:
  zero matches (not even as a substring); lint passes with zero disables in
  both files.
- §6.7 ✓ — `tsc --noEmit` and `npm run lint` pass; `git status` shows
  `root.yaml` and `src/generated/HandlerRegistry.ts` unmodified.
- §6.8 ✓ — backend.md layout lists `src/domain/bus/` (line 11) and the
  handler example invokes `commandBus.execute(new … , input)` — no direct
  `.execute(input)` remains in the example.
- §6.9 ✓ / §6.10 ✓ / §6.11 ✓ — D14 row present; checklist 4.5 carries the
  listener-log-line obligation citing §8 Q3; TDD §1 routes
  `Auth →> Bus →> Cmd` and `Cmd →> Disp →> Listener`, §3 contains
  `Command`/`CommandBus`/`EventDispatcher` with single-input command
  signatures (all applied pre-approval; re-verified by grep post-build).

**Implementation notes (no deviations from §1–8):**
- The two `as` casts in `EventDispatcher` (`listener as
  EventListener<unknown>` at registration, `event.constructor as
  EventClass<unknown>` at lookup) are the §4-designed unknown-based
  type erasure — assertions to `unknown`-parameterized types, no `any`.
- Files touched match §7's advisory list exactly; no unpredicted files.
