# Spec: 4.10 — Validator UI

**Status:** approved

> **Freeze rule:** Sections 1–8 freeze at human approval. Section 9 is
> append-only during implementation — deviations get recorded, never
> retro-edited into the plan.

> **Record-reconciliation taxonomy** applies (see `_template.md`); entries
> that invoke it cite the category inline.

## 1. Overview
The frontend of US-5 (dashboard), US-6 (approve), US-7 (reject):
replaces the internals of 4.8's `DashboardPage` placeholder — route path
+ meta are the frozen 4.8 §5 contract and are not touched — and consumes
4.6's `GET /requests`, `POST /requests/:id/approve`,
`POST /requests/:id/reject`, and `GET /users` endpoints as-is over the
cookie-auth client (ADR 0006). Composes 4.9's shared components
(`RequestTable`, `StatusBadge`, `FormField`) per §8 Q0 of spec 4.9 —
extended via props where the dashboard needs more, never forked — and
ships the one new shared component the checklist names:
`PaginationControls`. Name resolution for `userId`/`reviewedBy` is
client-side via `GET /users`, discharging the inheritance frozen at
spec 4.6 §8 Q10. Checklist item 4.10.

## 2. Scope (in)
- `src/types.ts` (extend) — `UserSummary`, `DashboardResult` (§5).
- `src/api/requests.ts` (extend) — `listDashboard`, `approveRequest`,
  `rejectRequest` over the existing `apiClient`.
- `src/api/users.ts` (new) — `listUsers` (§5).
- `src/components/PaginationControls.vue` (new) — Prev/Next +
  "Page X of Y" (§8 Q2); contract in §5.
- `src/components/FormField.vue` (extend via props, §8 Q3 — the
  checklist's sanctioned mechanism) — `type: "select"` for the status
  filter and `type: "combobox"` (custom dropdown, §8 Q5) for the user
  filter, both fed by a shared `options` prop; contracts in §5.
- `src/components/RequestTable.vue` (extend via props) — optional
  `expandedKey` prop + `#row-detail` slot for the inline reject form
  (§8 Q1); contract in §5. Existing consumers unaffected (both
  additions optional).
- `src/pages/DashboardPage.vue` — full replacement of placeholder
  internals: filter bar, table, pagination, approve/reject actions.

## 3. Out of scope
- Backend changes of any kind — all four endpoints ship as built
  (4.6/4.7/4.12).
- Requester views, `TeamPage`, `AppHeader` — inherited finished
  (4.9 §8 Q4); untouched.
- Reuse verification pass — 4.11.
- Server-side name search in the combobox — A10 fixes client-side
  type-ahead at this scale.
- Approve-with-comment (A12), edit/cancel (A9), self-approval guard
  (A16) — recorded resolutions, not this chunk's work.
- Automated tests — Phase 5 (TDD §8 defines no frontend unit layer).

## 4. Design
- **Data (ADR 0005):** page-local `ref` state. On mount, `listUsers`
  and the first `listDashboard` fetch run in parallel; **either failing
  renders the load-error state** — a dashboard that can't resolve names
  or can't list rows is broken either way, and partial-degradation UI
  is unrequested surface. The load-error state, fully: a single error
  line (`ApiError.message`) replaces the entire content region — filter
  bar, table, and pagination all withheld (the filter bar's combobox
  needs the users list that just failed; rendering half a toolbar
  invites interaction with a dead page). No retry control — recovery is
  a browser reload, exactly the recovery 4.9's pages offer for the same
  state; a retry button is unrequested surface. A `loading` flag
  renders a loading line the same way (whole region). Both full-region
  treatments are **mount-only**: post-mount refetches (page/filter
  changes, action refetches) keep the filter bar and controls rendered,
  and a post-mount refetch failure renders in the page-level error line
  (the action-failure line below) with the last-good table retained —
  collapsing the toolbar on every page turn would drop focus and state
  the validator is actively using. Stale rows after a failed refetch
  are safe to display because enforcement is server-side — a stale
  action draws a 409, which refetches and clamps back (A5's
  client-never-enforces logic). No client-side list mutation; every
  state change refetches — Postgres stays the source of truth.
- **Name resolution (spec 4.6 §8 Q10):** a `Map<uuid, name>` computed
  from the fetched `UserSummary[]` resolves both `userId` and
  `reviewedBy` at render time via slot overrides. `reviewedBy: null`
  (Pending) renders blank — US-5's "blank for Pending" falls out of
  the null, no special case. A uuid absent from the map renders as the
  raw uuid (§8 Q8) — truthful fallback for a state no legitimate path
  reaches.
- **Columns (US-5 + §8 Q9 + actions):** Requester (resolved name),
  Dates (range cell, `formatDate` — 4.9 pattern), Reason, Status
  (`StatusBadge` slot), Reviewed by (resolved name or blank),
  Submitted (`createdAt` via `formatDate` — §8 Q9, display-only),
  Actions — Approve/Reject buttons on Pending rows only; terminal
  rows render an empty actions cell (§8 Q7). Server order
  (`createdAt DESC`, A15) preserved as received — no client re-sort.
- **Filters:** a filter bar above the table — status via FormField
  `type="select"` with options All (`""` → param omitted) / Pending /
  Approved / Rejected; user via FormField `type="combobox"` (§8 Q5):
  options are the fetched users keyed by id, the dropdown filtered
  case-insensitively on the typed text. Selecting an option sends its
  userId; clearing the input emits `""` and removes the filter;
  typed-but-unselected text applies no filter (§8 Q6). Filters
  AND-combine by sending both params (server semantics, 4.6 §5). Any
  filter change resets `page` to 1, then refetches (§8 Q4).
- **Pagination (§8 Q2):** `PaginationControls` below the table;
  `totalPages = max(1, ceil(total / limit))`; Prev disabled at page 1,
  Next disabled at the last page. The page never requests `limit` —
  the server's default 10 (PRD US-5) is the contract; sending it would
  hardcode a server value client-side. The same rule governs display:
  `PaginationControls` receives the **response's** `limit` field as its
  `limit` prop — a literal 10 appears nowhere in the page-count math.
- **Approve (US-6):** one button click → `approveRequest(id)` →
  refetch. No confirmation step (the brief: one action).
- **Reject (US-7, §8 Q1):** the row's Reject button sets that row as
  `expandedKey`; RequestTable renders the `#row-detail` slot as a
  full-width row beneath it, containing a FormField textarea
  (`maxlength=500` — spec 4.7 §3 inheritance, DOM-observable),
  Confirm/Cancel. One row's form open at a time (opening another
  closes the first; approve/filter/page actions close it). Confirm →
  `rejectRequest(id, comment)` → collapse + refetch. Submit failure →
  envelope message rendered inside the detail row, form open, value
  retained (4.9 §4 pattern). Client `required` is UX only —
  whitespace-only comments reach the server and come back as Rule 5's
  400 (the enforcement, per A5's client-never-enforces logic).
- **Action failure + stale state:** any action `ApiError` renders its
  envelope message in a page-level line above the table (4.9's
  `submitError` pattern). If the failure status is 409 (processed
  elsewhere — A8's guard), the page **also refetches**: the row's real
  status is displayed truth, not the stale Pending.
- **Refetch page semantics (§8 Q4):** clamp-back is a property of
  **every** refetch, not of the success path: whenever any refetch —
  after a successful action **or** the 409 branch's — returns an empty
  `data` with `page > 1`, step back one page and refetch. (A 409 means
  the row was processed elsewhere; if it was the page's last row, the
  refetch comes back empty and the validator must not strand there —
  the same §8 Q4 invariant, regardless of who processed the row.)
  Page 1 empty renders
  `emptyText` — this is `RequestTable.emptyText`'s first real render
  (closing the gap recorded at 4.9 §7).

## 5. Contracts
```ts
// src/types.ts (additions)
export interface UserSummary { id: string; name: string }  // GET /users element (A10)
export interface DashboardResult {
  data: VacationRequest[]; total: number; page: number; limit: number;
}

// src/api/requests.ts (additions) — all throw ApiError via the interceptor
export interface DashboardQuery {
  page?: number;                    // omitted → server default 1
  status?: VacationRequestStatus;   // omitted → no status filter
  userId?: string;                  // omitted → no user filter
}
export const listDashboard: (query: DashboardQuery) => Promise<DashboardResult>;
export const approveRequest: (id: string) => Promise<VacationRequest>;
export const rejectRequest: (id: string, comment: string) => Promise<VacationRequest>;

// src/api/users.ts (new)
export const listUsers: () => Promise<UserSummary[]>;

// src/components/PaginationControls.vue (new)
defineProps<{ page: number; total: number; limit: number }>();
defineEmits<{ "update:page": [page: number] }>();
// Renders Prev / "Page X of Y" / Next; Y = max(1, ceil(total/limit));
// Prev disabled at page <= 1, Next at page >= Y. Emits only in-range pages.

// src/components/FormField.vue (extension — all additions optional,
// existing consumers compile unchanged)
type?: "text" | "date" | "textarea" | "select" | "combobox";  // both new
options?: { value: string; label: string }[];  // select + combobox list
// "combobox" (§8 Q5 — custom dropdown): text input + options list keyed
// by option VALUE (the userId); list filtered client-side by
// case-insensitive substring match on the typed text (A10 type-ahead).
// Opens on focus/typing; select by click; Esc or click-outside closes
// without selecting. Selecting emits the option value via
// update:modelValue and displays the option label; clearing the input
// emits "" (the consumer's un-filter path, §8 Q6); typed-but-unselected
// text emits nothing. No keyboard option-navigation, no ARIA listbox
// (out of scope — known-limitations candidate, §8 Q5).

// src/components/RequestTable.vue (extension — optional, existing
// consumers unchanged)
expandedKey?: string | null;  // rowKey value whose detail row renders
// New optional named slot #row-detail="{ row }": rendered as a
// full-width (colspan) row directly beneath the matching data row.

// DashboardPage reject form: the comment FormField's `id` is the static
// string "reject-comment" — NOT derived from the request uuid. Unique in
// the DOM by construction (§4: one detail row open at a time), and it
// keeps uuids out of the rendered DOM so §6.3's uuid probe holds even
// while a reject form is open.
```

## 6. Acceptance criteria
Seeded users per 4.1b (alice/bob Requesters, carla Validator, password
`Demo1234!`). Every criterion is an observable postcondition; each is
chosen to kill a specific wrong implementation.

1. **Reuse invariant (4.9 §6.1 extended):** `<table` appears in exactly
   one `.vue` file (`RequestTable.vue`); status-pill markup only in
   `StatusBadge.vue`; `PaginationControls.vue` exists exactly once, in
   `src/components/`; `DashboardPage.vue` contains no bare `<input`,
   `<textarea`, or `<select` — every control renders through
   `FormField` (§8 Q3/Q5) — and no pagination markup. The bare-control
   greps target `DashboardPage.vue` only: `FormField.vue` is the
   sanctioned home of the combobox's input and dropdown-list markup
   (§8 Q5), so its internals are exempt by construction, not by
   allowlist. Grep-verified, commands in §9. (Kills a fork or
   page-local copy.)
2. **Existing consumers untouched by the extensions:** `git diff` for
   this chunk shows no edits to `MyRequestsPage.vue`, `TeamPage.vue`;
   both still compile and render (spot-check one each). (Kills an
   extension that broke the frozen 4.9 surface.)
3. **Dashboard renders truth, names not uuids:** as carla, all seeded
   requests across users appear, newest-submitted first; columns per
   §4; requester and reviewed-by cells show display names; the uuid
   regex `[0-9a-f]{8}-[0-9a-f]{4}` matches nowhere in the rendered
   dashboard DOM on any legitimate path — including with a reject
   detail row open, which the static `reject-comment` field id (§5)
   guarantees by keeping request uuids out of element ids; Pending
   rows' reviewed-by is blank. (Kills skipped name resolution, a
   client re-sort, and a uuid-embedding field id.)
4. **Filters filter, combined, reset to page 1:** status=Pending shows
   only Pending rows across users; selecting a user option from the
   combobox dropdown shows only that user's rows; both together AND;
   clearing the combobox input restores the unfiltered list (network
   log: the `userId` param absent — §8 Q6's un-filter path); applying
   any filter while on page ≥ 2 lands on page 1 (page indicator
   observable). (Kills client-side filtering — verify via the network
   log that params ride the request — a sticky page number, and a
   clear that keeps filtering.)
5. **Pagination against the wire:** with > 10 matching rows, page 1
   renders exactly 10 rows, Next renders the remainder, the indicator
   reads "Page 1 of ⌈total/limit⌉" computed from the **response's**
   `total` and `limit` fields (resolving to 10 per page with the
   server default — a literal 10 appears nowhere client-side, §4);
   Prev is disabled on page 1, Next on the last page. (Kills a
   client-side slice of an unpaginated fetch — network log shows
   `page=2` — an off-by-one in totalPages, and a hardcoded page
   size.)
6. **Approve round-trip:** approving a Pending row updates it to an
   Approved badge with carla's name in reviewed-by **without a manual
   reload** (network log: POST then refetch). (Kills a success path
   that skips the refetch or fakes the row client-side.)
7. **Reject requires a real comment:** the reject detail-row textarea
   carries `maxlength="500"` in the DOM (spec 4.7 §3); submitting a
   whitespace-only comment reaches the server and the Rule 5 envelope
   message renders inside the detail row, form open, value retained.
   (Client `required` can't catch whitespace — this probes the server
   enforcement through the UI, and kills a client-side trim that
   would mask Rule 5.)
8. **Reject round-trip, cross-view:** rejecting with a valid comment
   updates the row to Rejected + carla's name without reload; as
   alice, my-requests shows that comment on the rejected row (the
   comment's consumer view — US-3). (Kills a comment that's sent but
   dropped, observable end to end.)
9. **Stale-state 409 recovers:** approving a row already processed
   out-of-band (second tab or curl) renders the 409 envelope message
   **and** the refetched row shows its true status. If the 409'd row
   was the only row on a page > 1 (filter Pending), the refetch
   clamps back one page exactly as §6.10's success path does — §4
   grants clamp-back to every refetch. (Kills silent failure, a UI
   stuck on stale Pending, and a 409 branch that strands on an
   empty page.)
10. **Clamp-back (§8 Q4):** with filter Pending and a last page
    containing exactly one row, approving it lands on the previous
    page with content — not an empty page. A zero-match filter
    combination on page 1 renders `RequestTable`'s `emptyText`
    (first real render — 4.9 §7's recorded gap closes here).
11. **Gates:** `npx vue-tsc -b` exit 0; `npm run lint` clean; zero
    `any`, zero new suppressions.

## 7. Testing requirements
Derived from §6 only. Manual browser verification (Chrome pane against
the Vite dev server + seeded backend on :8888), per-criterion results
recorded in §9 — the 4.8/4.9 transcript pattern. Grep criteria (§6.1)
recorded with exact commands. §6.5's > 10-row precondition: the seed
alone is too small — create the missing rows via UI/curl as
alice/bob; dates must be **future** (Rule 4 rejects past dates at
creation) and spread to avoid Rule 2 overlaps per user. Recorded in §9.
§6.9's out-of-band processing: curl as carla or a second browser tab,
recorded in §9.

### Files touched (advisory)
`frontend/src/types.ts`, `frontend/src/api/requests.ts`,
`frontend/src/api/users.ts` (new),
`frontend/src/components/PaginationControls.vue` (new),
`frontend/src/components/FormField.vue`,
`frontend/src/components/RequestTable.vue`,
`frontend/src/pages/DashboardPage.vue`.

## 8. Q&A
Q1–Q4 were answered by the human in-session (2026-07-29, first
question batch). Q5–Q9 went unanswered twice in the same session and
were answered by the human in the follow-up review pass (2026-07-29);
recorded below under the same ownership convention — every answer is
the human's decision, never the agent's recommendation ratified by
silence.

**Q1 — Reject-comment entry UI?** → **Inline expandable row** (human,
recommended option). Clicking Reject expands a comment form directly
under that row — FormField textarea, Confirm/Cancel — one open at a
time. No modal infrastructure; keeps FormField reuse. Entailed
mechanism (agent, recorded here for review): `RequestTable` gains the
optional `expandedKey` prop + `#row-detail` slot (§5) — an extension
via props per the checklist's rule, not a fork; existing consumers
unaffected.

**Q2 — PaginationControls shape?** → **Prev/Next + "Page X of Y"**
(human, recommended option). Smallest correct control; numbered pages
add truncation logic with no evaluation value at seed scale.

**Q3 — Filter controls home?** → **Extend FormField** (human, against
the agent's page-local recommendation — decision is the human's own).
FormField gains `type: "select"` + `options` (§5); this is the
checklist's sanctioned extend-via-props mechanism, and it keeps §6.1's
no-bare-controls invariant extendable to the dashboard. The combobox's
mechanism inside FormField is Q5.

**Q4 — Page-number semantics on filter change / after actions?** →
**Reset + clamp-back** (human, recommended option). Filter change →
page 1; action success → refetch current page; empty result on
page > 1 → step back one page and refetch.

**Q5 — Combobox mechanism inside FormField (A10 type-ahead)?** →
**Custom dropdown inside FormField** (human, against the agent's
datalist recommendation — decision is the human's own; Q3 phrasing
precedent). Interaction contract, pinned in §5: `type: "combobox"` —
text input + options list keyed by option **value** (the userId),
filtered client-side on the typed text, case-insensitive substring
match (A10's type-ahead). Opens on focus/typing; select by click; Esc
or click-outside closes without selection. Selecting emits the option
value and the displayed text becomes the option label; a cleared input
(empty text) emits `""` = filter removed — the explicit un-filter
path. No keyboard option-navigation and no ARIA listbox work — out of
scope, a known-limitations candidate alongside the duplicate-name
entry. Duplicate-name note, updated for this mechanism: id-keyed
options make both same-named users **selectable** — each user is its
own option — but still visually **indistinguishable**, because
`GET /users` carries no third field to render (the select is the
privacy boundary — backend `handlers/users.ts`, spec 4.6 §5; no email,
role, or credentials, A10 — and widening it is a 4.6 contract change
out of this chunk's scope). The limitation is narrowed, not closed;
the known-limitations entry stays warranted.

**Q6 — Combobox text with no matching option?** → **Filter inactive**
(human, recommended option; reworded from the earlier "exact name
match" phrasing, which was datalist semantics and died with Q5's
answer): the `userId` param is sent only when an option is
**selected**; typed text matching zero options shows an empty options
list and applies no filter.

**Q7 — Actions cell on Approved/Rejected rows?** → **Empty cell**
(human, recommended option). Approved/Rejected are terminal states
(Rule 3, A8's state machine) — no action exists on them, so none
renders. Buttons render on Pending rows only (§4).

**Q8 — Render fallback when a `userId`/`reviewedBy` uuid is absent
from `GET /users` (unreachable in practice — no user deletion
exists)?** → **Raw uuid** (human, recommended option) — truthful and
debuggable; never renders on a legitimate path. §6.3's no-uuid
criterion covers legitimate paths only; this fallback could render
solely in the unreachable missing-from-`GET /users` state, which is
outside §6.3's probe — no conflict.

**Q9 — Add a Submitted (`createdAt`) column, mirroring 4.9 §8 Q6's
precedent?** → **Yes** (human, recommended option). Rationale (human,
verbatim): the list orders by createdAt DESC and A14 records this
assignment's usability-over-visual-creativity priority — an invisible
sort key is a usability gap; the column makes the order legible and
matches my-requests (4.9 §8 Q6). **Display-only:** the server already
orders `createdAt DESC` (A15); §4's "server order preserved as
received — no client re-sort" stands unchanged, and §6.3 still kills a
client re-sort. No client-side sorting exists anywhere in this chunk.

## 9. Implementation Results
_Append-only during build._

### 2026-07-29 — pre-code open-decisions pass (implementation-mode rule)
No stop-and-ask items: §5 pins every contract surface; §4/§8 pin all
reachable behavior, including the combobox interaction contract (Q5),
un-filter path (Q6), terminal-row actions cell (Q7), uuid fallback
(Q8), and column set (Q9). Pure internals decided during build, listed
before code per the rule:
- **Actions column rides the `id` key** — `RequestTable.Column.key` is
  `keyof Row & string` (frozen 4.9 §5 surface), and no `actions` field
  exists on `VacationRequest`; the `#cell-id` slot override replaces
  the default text cell entirely, so the uuid never renders (§6.3
  safe). Chosen over widening the Column type — that would touch the
  frozen generic surface for a purely internal need.
- **Combobox internals:** display text + open flag as component-local
  refs; dropdown closes on input blur (which click-outside triggers
  natively) and on Esc; option selection uses `mousedown.prevent` so
  the click lands before blur closes the list. Zero-match typed text
  (Q6): the empty options list renders as no dropdown box — the
  rejected Q6 alternative was an explicit "no matching user" state, so
  nothing-to-show hides the box rather than painting an empty border.
- **Filter application mechanism:** a `watch` on the two filter models
  (select emits on change; combobox emits only on select/clear per §5)
  → reset page to 1 → refetch. Typing triggers nothing because the
  combobox emits nothing on typing — the §4 behavior falls out of the
  §5 contract rather than being re-implemented in the page.
- **Clamp-back implementation:** recursive step-back inside the single
  fetch routine (terminates — page strictly decreases toward 1), so
  every caller inherits it (§4's "property of every refetch").
- **One `actionPending` flag** disables Approve/Reject/Confirm while
  any action is in flight (mirrors 4.9's `submitting`).
- **Status-filter narrowing:** a `isVacationRequestStatus` type guard
  narrows the select's string model to the union — no `as` cast.
- Wording internals: empty/loading/error strings, button labels,
  filter-bar labels ("Status", "Requester").

### Pure-internals inventory (derived: grep of module-scope declarations
in new/edited modules, per implementation-mode)
- `api/users.ts` — `listUsers` (§5).
- `api/requests.ts` (additions) — `DashboardQuery`, `listDashboard`,
  `approveRequest`, `rejectRequest` (all §5).
- `types.ts` (additions) — `UserSummary`, `DashboardResult` (both §5).
- `PaginationControls.vue` — `totalPages` computed
  (`max(1, ceil(total/limit))`, §5), `goTo` (in-range guard — kept
  independent of the disabled attributes so the emit contract doesn't
  depend on markup).
- `FormField.vue` — `Option` interface; `onSelectChange`; combobox
  internals `comboText`/`comboOpen` refs, `filteredOptions` computed
  (case-insensitive `includes`), `onComboInput` (empty text → emit
  `""`, §8 Q6), `selectOption` (emit value, display label). Existing
  `onInput` untouched.
- `RequestTable.vue` — `Column`/`cellText` unchanged; template gains a
  keyed `<template v-for>` wrapper so the data row + optional detail
  row share one iteration key.
- `DashboardPage.vue` — state refs
  (`users`/`result`/`loading`/`loadError`/`page`/`statusFilter`/
  `userFilter`/`actionError`/`rejectingId`/`rejectComment`/
  `rejectError`/`actionPending`), `isVacationRequestStatus` guard,
  `fetchPage` (single fetch routine carrying clamp-back), `nameById` +
  `resolveName` (§4 name resolution, §8 Q8 fallback), `userOptions`/
  `statusOptions`, `refetch`, `openReject`/`closeReject`, watch on the
  two filter models, `onPageChange`, `refetchAfterConflict` (shared
  409 truth-refresh), `approve`, `submitReject`, `columns` (actions
  riding the `id` key per the pre-code pass).

### Deviations
1. **Terminal-row actions cell needs a real empty element.** First
   render showed raw uuids in the Actions cell of Approved rows: a
   scoped slot whose render output is comment-nodes-only (the
   `v-if="Pending"` wrapper on terminal rows) makes Vue fall back to
   the default cell — which prints the column's row value, the `id`.
   Fix: `<span v-else></span>` in the `#cell-id` slot so the slot
   always renders real content. §4/§8 Q7 behavior is unchanged — this
   is the mechanism that delivers it; recorded because the naive
   reading of "empty cell" produces a §6.3 violation.
2. **Session tooling, reverted before finish** (4.9 §9 deviation 2
   precedent): another session's dev servers held :8888/:5173, so
   verification ran against a temporary `backend-4-10-verify`
   launch.json entry (backend on :9899 — the CEF dev server takes its
   port from argv, `devServ.js`) plus a temporary
   `frontend/.env.local` (`VITE_API_PROXY_TARGET=http://localhost:9899`;
   the proxy target was already env-configurable). Both removed after
   verification; `git status` confirms only the seven §7 files differ.

### Verification transcript (2026-07-29, Browser pane; frontend :50085
via autoPort, backend :9899 per deviation 2, same Postgres/seed as the
running dev DB — 7 rows at start: alice 5, bob 2, per the 4.9 §9 notes)
Preconditions built via curl (§7): logins as alice/bob/carla
(seed emails, `Demo1234!`); +5 requests before §6.5 (alice Nov 2–4,
Nov 9–11 "Family visit north", Nov 16–18; bob Sep 1–3 "Conference
days", Sep 21–25) → 12 total; +5 more before §6.10 (alice Dec 1–2,
Dec 7–8, Dec 14–15; bob Oct 12–14, Oct 19–21) → 11 Pending. All
future-dated (Rule 4), non-overlapping per user (Rule 2).
- Gates (§6.11): `npx vue-tsc -b` exit 0; `npm run lint` clean — run
  twice, the second time after deviation 1's fix. Zero `any`, zero
  suppressions in touched files (grep).
- §6.1 ✓ — `grep -rl "<table" src --include="*.vue"` →
  `RequestTable.vue` only; `rounded-full` → `StatusBadge.vue` only;
  `find src -name PaginationControls.vue` → one file in
  `src/components/`; `grep -c "<input\|<textarea\|<select"
  DashboardPage.vue` → 0; no `Previous`/`totalPages` markup in the
  page; page imports all four shared components.
- §6.2 ✓ — `git status` diff set = exactly the seven §7 files;
  `MyRequestsPage.vue`/`TeamPage.vue` absent. Spot-renders as alice:
  my-requests table + team month groups (June/Aug/Sep/Nov 2026) render.
- §6.3 ✓ — as carla: 12 rows across users, newest-submitted first
  (server order); columns Requester/Dates/Reason/Status/Reviewed by/
  Submitted/Actions; names render (Alice Martin, Bob Chen, Carla
  Dupont); Pending reviewed-by blank; uuid regex over `innerText` AND
  `innerHTML` of `main`: **null**, re-probed with the reject detail
  row open (static `reject-comment` id in DOM) — null again. (First
  probe caught deviation 1; re-run clean after the fix.)
- §6.4 ✓ — status=Pending applied from page 2 → request
  `page=1&status=Pending` (network log), 9 Pending rows, indicator
  page 1; combobox "ali" → dropdown filters to Alice Martin (typing
  fired no request), click-select → `page=1&status=Pending&userId=61e2…`
  — AND-combined, 6 rows, input displays the label; zero-match text
  ("Alice Martinx") → no dropdown, no request, prior filter retained
  (§8 Q5/Q6 contract); clear to "" → next request **without**
  `userId`, both requesters return.
- §6.5 ✓ — 12 rows: page 1 renders exactly 10, "Page 1 of 2"
  (⌈12/10⌉ from the response's total+limit — requests carry no
  `limit` param, network-verified), Prev disabled; Next →
  `page=2`, 2 rows, "Page 2 of 2", Next disabled, Prev enabled.
- §6.6 ✓ — Approve on Bob Sep 21–25: network shows POST …/approve →
  200 then GET refetch; row renders Approved badge + Carla Dupont, no
  reload.
- §6.7 ✓ — reject detail textarea: `maxlength="500"`, `required`,
  id `reject-comment` in DOM; whitespace-only "   " passed the client
  `required`, POST → 400, "comment must not be empty" rendered inside
  the detail row, form open, value retained.
- §6.8 ✓ — same form, "Team coverage is too thin that week." → row
  Rejected + Carla Dupont, form collapsed, no reload; as alice,
  my-requests shows that comment on the Nov 16 rejected row.
- §6.9 ✓ — alice Nov 9 approved out-of-band via curl as carla; UI
  Approve on the stale row → POST → 409, page-level "Request is not
  pending", refetch fired, row displays Approved + Carla Dupont.
  (The empty-last-page 409 variant is covered by §6.10's clamp-back —
  §4 routes both branches through the same fetch routine.)
- §6.10 ✓ — 11 Pending, filter Pending: "Page 1 of 2"; page 2 = one
  row (Bob Aug 12–16); Approve → network trace POST → 200, GET
  `page=2&status=Pending` (empty), GET `page=1&status=Pending` —
  landed "Page 1 of 1" with 10 rows, never stranded. Empty state:
  Rejected + Bob Chen (zero matches) → `emptyText` "No requests match
  the current filters." renders — `RequestTable.emptyText`'s first
  real render, closing 4.9 §7's recorded gap.
- §5 combobox contract extras — open-on-focus and Esc-close verified
  (Esc via dispatched `KeyboardEvent` exercising the `@keydown.esc`
  binding — the pane's raw key injection doesn't reach the page);
  blur-close observed when focus moved to other controls.

### Notes for the next chunk / the human
- Verification wrote 10 rows into the dev DB (5 pre-§6.5, 5
  pre-§6.10) and processed several seeded rows (Bob Sep 21 + Aug 12 +
  alice Nov 9 approved; alice Nov 16 rejected "Team coverage is too
  thin that week."). Reseed for pristine state.
- The two known-limitations entries entailed by §8 Q5 (duplicate-name
  indistinguishability; no keyboard-nav/ARIA on the combobox) are
  still unwritten — `docs/known-limitations-draft.md` was outside this
  chunk's file scope. They need a home before any record-verification
  cites them (flagged at spec review; unresolved).
- 4.11's grep pass inherits: `<table` in one file, pill markup in one
  file, `PaginationControls` single definition, zero bare controls in
  both pages — all green at this chunk's close.
