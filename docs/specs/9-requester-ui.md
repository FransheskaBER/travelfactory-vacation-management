# Spec: 4.9 — Requester UI

**Status:** approved

> **Freeze rule:** Sections 1–8 freeze at human approval. Section 9 is
> append-only during implementation — deviations get recorded, never
> retro-edited into the plan.

> **Record-reconciliation taxonomy** applies (see `_template.md`); entries
> that invoke it cite the category inline.

## 1. Overview
The frontend of US-2 (submit), US-3 (my requests), and US-4 (shared team
view): replaces the internals of 4.8's `MyRequestsPage`/`TeamPage`
placeholders — route paths + meta are the frozen 4.8 §5 contract and are
not touched — and consumes 4.6's endpoints as-is over the cookie-auth
client (ADR 0006; no auth work in this chunk). Ships the shared
components `StatusBadge`, `RequestTable`, `FormField` into
`src/components/` from the start, per the human's pre-spec scope decision
(§8 Q0, 2026-07-29): extraction happens in-chunk where 4.9 itself has two
consumers or internal repetition; 4.10 consumes them as-is; 4.11 becomes
a verification pass. Checklist item 4.9.

## 2. Scope (in)
- `src/types.ts` (extend) — `VacationRequestStatus`, `VacationRequest`,
  `TeamVacation` (§5).
- `src/api/requests.ts` (new) — `createRequest`, `listMyRequests`,
  `listTeamVacations` over the existing `apiClient`.
- `src/utils/formatDate.ts` (new) — `formatDate` + `formatMonth`, plus
  the eslint ban on inline `toLocaleDateString` (frontend.md: the first
  date-rendering chunk creates both; this is it). Same
  `eslint.config.mjs` edit also corrects the stale `setTokenProvider`
  reference in the client.ts rule's message string (post-4.12
  staleness, same reconciliation as the frontend.md record edit; the
  function no longer exists — the message names
  `setUnauthorizedHandler` instead).
- `src/components/StatusBadge.vue`, `RequestTable.vue`, `FormField.vue`
  (new) — contracts in §5, per §8 Q0.
- `src/pages/MyRequestsPage.vue` — collapsible new-request form (§8 Q3)
  + own-requests table.
- `src/pages/TeamPage.vue` — month-grouped approved-only view (§8 Q1–Q2).
- `src/components/AppHeader.vue` — role-aware nav links, both roles
  (§8 Q4); logout button unchanged.
- Record edits, applied pre-approval 2026-07-29 in the working tree —
  committed by the human alongside approval, never by the agent
  (CLAUDE.md workflow rule):
  - checklist 4.9/4.10/4.11 lines carry the §8 Q0 decision; the 4.9
    line also anchors the §8 Q4 nav scope (review finding 3 — 4.10's
    "inherits AppHeader finished" needs a checklist line to dangle from)
  - `.claude/rules/frontend.md` State & auth + API-layer sections
    rewritten for cookie transport (taxonomy: operative file — review
    finding 2: the file still described `setTokenProvider`/token-in-store
    auth that 4.12 deleted, and it auto-loads for every `frontend/**`
    edit this chunk makes; 4.12 ran without a /spec, so nothing had
    forced this reconciliation)
  - `docs/known-limitations-draft.md` entry 10 — §8 Q2's
    start-month-only grouping disclosed as a decision (review judgment
    call)

## 3. Out of scope
- `PaginationControls` and everything dashboard — 4.10 (§8 Q0: its first
  consumer is 4.10). Approve/reject UI — 4.10.
- Refactoring `LoginPage` onto `FormField` — 4.8 §3 left it plain markup;
  whether it ever migrates is 4.11's call under its new
  verification-pass wording, not this chunk's surface.
- Edit/cancel of requests (A9), pagination of the own list (A11),
  calendar-grid UI and any `reason` on the team view (A14).
- Router, store, and `client.ts` changes — 4.8/migration wiring is
  consumed untouched.
- Backend changes of any kind.
- Automated tests — TDD §8 defines no frontend unit layer; Playwright
  E2E is D6's first-cut; Phase 5 owns the matrix.

## 4. Design
- **Data (ADR 0005):** each page fetches its own list into local
  `ref` state on mount; after a successful create, my-requests
  **refetches** — no client-side list mutation, Postgres stays the
  source of truth. Fetch failure renders `ApiError.message` in place of
  the table; a `pending` flag renders a loading line.
- **`RequestTable` is a dumb renderer:** rows + column config; custom
  cells via named scoped slots (`#cell-<key>`), never render callbacks
  in props (frontend.md). The team view's `reason` exclusion is column
  config, not a fork (§8 Q0, A14). Default cell renders the row value as
  text; `emptyText` renders as the body when `rows` is empty.
- **My-requests columns (§8 Q6):** Dates (one range cell,
  `formatDate(start) – formatDate(end)`), Status (`StatusBadge` in the
  slot), Reason, Comment (rejection comment, rejected rows only — US-3),
  Submitted (`createdAt`). Server order preserved as received
  (`createdAt DESC`, spec 4.6 §5) — no client re-sort.
- **Team view (§8 Q1–Q2):** page groups the flat `startDate ASC` array
  by the UTC month of `startDate`; one `RequestTable` (columns: name,
  dates) per group under a `formatMonth` heading. Insertion order is
  chronological because the input is sorted — no client re-sort. A span
  crossing months appears once, under its start month, full range shown.
- **Form (§8 Q3):** a "New request" toggle button; the collapsible card
  holds start/end (native `type="date"` via `FormField`) and reason
  (`type="textarea"`, `maxlength=500` — spec 4.7 §3). `min` attributes:
  start ≥ today (client-local date — UX only, A5's server-UTC check is
  the enforcement), end ≥ current start value. Submit: success →
  collapse + clear + refetch; failure → `ApiError.message` rendered
  form-level inside the card (the 4.8 login pattern), card stays open,
  values retained. `reason` is sent as typed — `""`/whitespace → `null`
  is the server's `normalizeReason` (4.7), not the client's.
- **`StatusBadge`:** colored pill — Pending amber, Approved green,
  Rejected red. The only file where status markup exists (§6.1).
- **Nav (§8 Q4):** `RouterLink`s per role — Requester: My Requests,
  Team; Validator: Dashboard, Team — with active-route styling.
- **`formatDate` (§8 Q7):** `Intl.DateTimeFormat("en-US",
  { timeZone: "UTC", … })` → "Aug 21, 2026"; `formatMonth` → "August
  2026". Fixed locale keeps output deterministic across machines (and
  future Playwright assertions); UTC matches the wire's date-only
  semantics (A2/A5).

## 5. Contracts
```ts
// src/types.ts (additions)
export type VacationRequestStatus = "Pending" | "Approved" | "Rejected";
export interface VacationRequest {
  id: string; userId: string; startDate: string; endDate: string;
  reason: string | null; status: VacationRequestStatus;
  comments: string | null; reviewedBy: string | null;
  createdAt: string; updatedAt: string;
}
export interface TeamVacation {
  requesterName: string; startDate: string; endDate: string;
}

// src/api/requests.ts — all throw ApiError via the client interceptor
export interface CreateRequestInput {
  startDate: string; endDate: string; reason?: string;
}
export const createRequest: (input: CreateRequestInput) => Promise<VacationRequest>;
export const listMyRequests: () => Promise<VacationRequest[]>;
export const listTeamVacations: () => Promise<TeamVacation[]>;

// src/utils/formatDate.ts
export const formatDate: (isoDate: string) => string;   // "2026-08-21" → "Aug 21, 2026"
export const formatMonth: (isoDate: string) => string;  // "2026-08-21" → "August 2026"

// src/components/StatusBadge.vue — status enum only, no request-specific
// props (§8 Q0)
defineProps<{ status: VacationRequestStatus }>();

// src/components/RequestTable.vue — generic="Row extends Record<string, unknown>"
interface Column<Row> { key: keyof Row & string; label: string }
defineProps<{
  rows: Row[]; columns: Column<Row>[];
  rowKey: keyof Row & string; emptyText: string;
}>();
// Named scoped slot `#cell-<key>`="{ row }" overrides the default text
// cell — where StatusBadge, date ranges, and the rejection comment
// render. 4.10 builds its dashboard columns against exactly this surface.

// src/components/FormField.vue — label + v-model + #error slot +
// maxlength passthrough (§8 Q0)
defineProps<{
  id: string; label: string; modelValue: string;
  type?: "text" | "date" | "textarea";   // default "text"
  maxlength?: number; min?: string; required?: boolean;
}>();
defineEmits<{ "update:modelValue": [value: string] }>();
// #error slot renders below the control; consumer owns the message markup.
```

## 6. Acceptance criteria
Seeded users per 4.1b (alice/bob Requesters, carla Validator, password
`Demo1234!`). Every criterion is an observable postcondition.

1. **Markup invariant (§8 Q0):** no template markup for status rendering
   or request rows exists outside `src/components/` — `<table` appears
   in exactly one `.vue` file (`RequestTable.vue`), and the status-pill
   markup only in `StatusBadge.vue`. Grep-verified, commands in §9.
2. **Single definition, real consumption:** `StatusBadge.vue`,
   `RequestTable.vue`, `FormField.vue` exist exactly once, in
   `src/components/`; `MyRequestsPage` **and** `TeamPage` both import
   `RequestTable`; every form control in the request form renders
   through `FormField` (no bare `<input`/`<textarea` in
   `MyRequestsPage.vue`). (Kills copy-paste satisfying §6.1 by luck.)
3. **My-requests renders truth:** as alice, the table shows her seeded
   rows with columns Dates/Status/Reason/Comment/Submitted, newest
   submitted first; the rejected row shows its comment; non-rejected
   rows show an empty comment cell. (Kills a wrong column config and a
   client re-sort.)
4. **Create round-trip:** valid future range + reason → new row appears
   in the list with a Pending badge **without a manual reload**, form
   collapsed and cleared. (Kills a success path that skips the refetch.)
5. **Create failure surfaces the envelope:** a range overlapping an
   existing Pending/Approved request → the 409 envelope message renders
   inside the card, card stays open, field values retained, list
   unchanged. Overlap is the probe deliberately: `min` attributes can't
   prevent it client-side, so it must reach the backend and come back.
6. **Reason semantics:** the reason control is a `textarea` carrying
   `maxlength="500"` in the DOM (spec 4.7 §3); submitting a
   whitespace-only reason succeeds and the new row's reason cell is
   empty (server `normalizeReason` observable through the UI).
7. **Date UX (§8 Q8):** the start input's `min` is today; changing
   start moves the end input's `min` to match. DOM-observable.
8. **Team-view invariants (§8 Q1–Q2, A14), checked as both roles:**
   only approved requests appear (seeded pending/rejected rows absent);
   a distinctive sentinel `reason` on an approved seeded request appears
   **nowhere** in the team DOM (A14 probe); rows show requester name +
   formatted range only; month headers ascend chronologically; a
   cross-month span appears exactly once, under its start month, with
   its full range visible.
9. **Role-aware nav (§8 Q4):** as Requester the header links are
   My Requests + Team; as Validator, Dashboard + Team; each link
   navigates to its route. (Kills a role-blind nav.)
10. **Formatting invariant (§8 Q7):** no raw `YYYY-MM-DD` string is
    visible on any of the three touched views — dates read
    "Aug 21, 2026"-style, month headers "August 2026". (Kills ad-hoc
    rendering that bypasses `formatDate`.) The eslint
    `toLocaleDateString` ban is present **and effective**: a scratch
    inline usage fails lint, then is reverted (effect, not intention —
    D13).
11. **Gates:** `npx vue-tsc -b` exit 0; `npm run lint` clean; zero
    `any`, zero new suppressions.
12. **Records:** checklist 4.9/4.10/4.11 lines carry the §8 Q0 wording
    and the 4.9 line the §8 Q4 nav anchor; frontend.md's State & auth
    section describes cookie transport with zero `setTokenProvider` /
    token-in-store references; known-limitations entry 10 (§8 Q2)
    present. All grep-verified (4.7 §6.12 pattern) **against committed
    state** — the pre-approval edits must be in the human's approval
    commit, not just the working tree (review finding 1: a claim frozen
    at approval must describe a record that exists).

## 7. Testing requirements
Derived from §6 only. Manual browser verification (Chrome pane against
the Vite dev server + seeded backend on :8888), per-criterion results
recorded in §9 — the 4.8 §9 transcript pattern. Grep criteria (§6.1, 2,
12) recorded with their exact commands. Seeding for §6.8's probes: the
existing seed's approved rows serve the sentinel/cross-month checks if
present; otherwise create the needed rows through the UI/curl as alice
and approve as carla — recorded in §9 either way. Known, deliberate gap:
`emptyText` (rows = []) is unreachable with the fixed seeds — left
unverified here and exercised by 4.10's filtered-empty dashboard page;
recorded so the gap is a decision, not an oversight.

### Files touched (advisory)
`frontend/src/types.ts`, `frontend/src/api/requests.ts` (new),
`frontend/src/utils/formatDate.ts` (new),
`frontend/src/components/{StatusBadge,RequestTable,FormField}.vue` (new),
`frontend/src/pages/{MyRequestsPage,TeamPage}.vue`,
`frontend/src/components/AppHeader.vue`, `frontend/eslint.config.mjs`
(toLocaleDateString ban + stale-message fix, §2),
`docs/travelfactory-assignment-checklist.md`,
`.claude/rules/frontend.md`, `docs/known-limitations-draft.md`
(the last three already edited pre-approval, §2).

## 8. Q&A
**Q0 — Pre-spec scope decision (human, 2026-07-29, recorded on
checklist 4.9/4.10/4.11 before this spec run).** Shared components are
extracted **in-chunk** wherever 4.9 itself has two consumers or internal
repetition: `StatusBadge`, `RequestTable`, `FormField` live in
`src/components/` from the start; my-requests and the team view must
both consume `RequestTable`; the request form must consume `FormField`.
`PaginationControls` explicitly OUT — its first consumer is 4.10. 4.10
consumes 4.9's components as-is and extends via props, never forks; 4.11
is reworded from an extraction pass to a reuse-verification pass. The
props contracts in §5 are pinned by the same decision: `StatusBadge`
takes the status enum and nothing request-specific; `RequestTable` takes
rows + a column config, because the team view hides `reason` (D1/A14)
while my-requests shows it — the privacy exclusion is rendering config,
not a separate component; `FormField` is label + model binding + error
slot + maxlength passthrough (the reason field carries
`maxlength="500"`, spec 4.7 §3). §6.1's markup criterion is part of the
same decision.

**Q1 — Team-view month grouping: page or component?** → **In the page.**
`TeamPage` computes month groups from the flat `startDate ASC` array and
renders one `RequestTable` per group. The component stays a dumb
rows+columns renderer; grouping logic is page-local and never leaks into
the shared contract (4.10's dashboard won't group).

**Q2 — A vacation spanning two months appears under which header?** →
**Start month only.** One row per request, matching the server order
natively — no row duplication, no span-splitting (the exact complexity
A14 traded away with the calendar grid); the range text still shows the
span crosses months. Review follow-up: this costs visibility against
US-4's planning purpose (a Sep 1–3 tail is invisible under the
September header) — disclosed as known-limitations entry 10 so the
evaluator reads it as a decision, not a bug.

**Q3 — Request form placement?** → **Collapsible on `/my-requests`**
(over the inline-card recommendation). The page's subject is the list —
the form appears behind a "New request" toggle and collapses after a
successful submit; slightly more UI state, cleaner list-first reading.
The frozen 4.8 route table stays closed either way.

**Q4 — Header nav links?** → **Role-aware nav for both roles now.**
Requester: My Requests + Team; Validator: Dashboard + Team. `AppHeader`
is touched once and 4.10 inherits it finished; the validator links point
at an existing route (placeholder page until 4.10). Review follow-up:
this is a real scope addition, so the checklist 4.9 line anchors it
(§2's record edits) — 4.10's inheritance claim no longer dangles.

**Q5 — Component name: RequestTable or RequestList?** → **`RequestTable`
with `<table>` markup**, matching frontend.md's operative component list
verbatim; both consumers are tabular. (The checklist's "RequestTable/
List" shorthand resolves to this name; no rules-file edit needed.)

**Q6 — My-requests columns beyond US-3's set?** → **Add Submitted
(`createdAt`).** The list is sorted by it (`createdAt DESC`); showing
the sort key makes the order legible. Costs one column.

**Q7 — `formatDate` display format?** → **"Aug 21, 2026" / month headers
"August 2026"** — `Intl.DateTimeFormat` with fixed `en-US` locale and
UTC. Fixed locale keeps output deterministic across machines and in
later Playwright assertions; UTC matches the backend's date-only
semantics (A2/A5).

**Q8 — Client-side date restriction?** → **Native `min` attributes**:
start ≥ today (client-local), end ≥ current start. UX only, per A5 —
the server's UTC check is the enforcement; backend rule errors render
form-level from the envelope (the 4.8 login-error pattern).

## 9. Implementation Results
_Append-only during build._

### 2026-07-29 — pre-code open-decisions pass (implementation-mode rule)
No stop-and-ask items: §5 pins every contract surface, §4/§8 pin all
reachable behavior. Pure internals decided during build: TeamPage's
composite row key (below), range cells riding the `startDate` column key
with slot overrides, lint-ban mechanism (`no-restricted-syntax` on
`toLocaleDateString` calls), empty/loading/button wording, client-local
"today" computation for the `min` attribute, `RouterLink active-class`
for nav styling.

### Pure-internals inventory (derived: grep of module-scope declarations
in new/edited modules, per implementation-mode)
- `api/requests.ts` — `createRequest`, `listMyRequests`,
  `listTeamVacations`, `CreateRequestInput` (all §5).
- `utils/formatDate.ts` — `DATE_FORMAT`, `MONTH_FORMAT` (module-scope
  `Intl.DateTimeFormat` instances), `formatDate`, `formatMonth`.
- `StatusBadge.vue` — `COLORS` record, `colorClasses` computed.
- `FormField.vue` — `onInput` (native-event → `update:modelValue`).
- `RequestTable.vue` — `Column` interface, `cellText` (null/undefined →
  `""`); `defineSlots<Record<string, (props: { row: Row }) => unknown>>`
  so consumers' slot `row` props are typed, not loosely inferred.
- `TeamPage.vue` — `vacations`/`loading`/`loadError` refs, `monthGroups`
  computed (Map keyed on `startDate.slice(0, 7)`), `columns`;
  **`KeyedVacation = TeamVacation & { key: string }`** — `TeamVacation`
  has no `id`, so the page synthesizes
  `${requesterName}|${startDate}|${endDate}` for Vue's `:key` (unique in
  practice: Rule 2 forbids one person holding two identical approved
  ranges). Page-local mapping; the shared contract is untouched.
- `MyRequestsPage.vue` — list refs + `load`, form refs
  (`formOpen`/`startDate`/`endDate`/`reason`/`submitError`/`submitting`),
  `today`/`todayIso` (client-local, §8 Q8), `endMin` computed,
  `toggleForm`, `submit`, `columns`.
- `AppHeader.vue` — `navLinks` computed (role → link list), `logout`
  (unchanged behavior).

### Deviations
1. **§5 `RequestTable` generic constraint changed:**
   `Row extends Record<string, unknown>` → `Row extends object`. TS
   interfaces carry no implicit index signature, so the frozen
   constraint rejected the exact row types §5 itself defines
   (`vue-tsc`: "Index signature for type 'string' is missing in type
   'KeyedVacation'"). Props, slots, and column typing
   (`keyof Row & string`) are unchanged — the constraint text was the
   only casualty. 4.10 builds against the same surface.
2. **Files outside §7's advisory list:** `.claude/launch.json`
   (`autoPort: true` on the frontend entry) and `frontend/vite.config.ts`
   (`server.port` honors an assigned `PORT` env, defaults 5173) —
   session tooling only: another session's dev servers held :5173/:8888,
   and Vite doesn't read `PORT` on its own. Behavior with no `PORT` set
   is identical to before.
3. **§6.10 probe revert method:** `git checkout` couldn't restore
   `utils/formatDate.ts` (new file, untracked), so the scratch
   `toLocaleDateString` line was removed by edit; lint + `vue-tsc`
   re-ran green afterwards. The probe itself behaved as specified
   (error with the formatDate message).

### Verification transcript (Chrome pane at http://localhost:65499 —
autoPort, deviation 2; backend = the already-running :8888 dev server
from this working tree, legitimate because this chunk ships zero backend
changes; DB freshly seeded: alice 3 rows Approved/Pending/Rejected, Bob
Chen approved Jun 29–Jul 3, 2026)
- Gates first (§6.11): `npx vue-tsc -b` exit 0; `npm run lint` clean;
  zero `any`, zero suppressions in new files. ✓
- §6.1 ✓ — `grep -rl "<table" src --include="*.vue"` →
  `RequestTable.vue` only; pill markup (`rounded-full`/status colors) →
  `StatusBadge.vue` only.
- §6.2 ✓ — one definition each in `src/components/`; `grep -l
  RequestTable src/pages/*.vue` → both TeamPage and MyRequestsPage;
  `grep -c "<input\|<textarea" MyRequestsPage.vue` → 0 (every control
  is a FormField).
- §6.3 ✓ — as alice: columns Dates/Status/Reason/Comment/Submitted;
  rejected row shows "Team is understaffed that week — please pick
  other dates.", other rows' comment cells empty; after the §6.4
  create, the newest row rendered first (DESC observable).
- §6.4 ✓ — Sep 10–12 + reason submitted → row appears with Pending
  badge, no reload (network log: POST then refetch of
  `/api/requests/mine`); form collapsed + cleared.
- §6.5 ✓ — Sep 11–13 (overlaps own new Pending) → card renders "An
  overlapping vacation request already exists" (409 envelope), form
  open, both date values retained, row count unchanged.
- §6.6 ✓ — reason control is a `textarea` with `maxlength="500"` in
  the DOM; whitespace-only reason ("   ") on Oct 5–6 → 201, new row's
  reason cell empty (server `normalizeReason` observable).
- §6.7 ✓ — start `min` = 2026-07-29 (today); setting start to
  2026-09-10 moved end's `min` to 2026-09-10.
- §6.8 ✓ — as alice AND as carla: only approved rows (alice's
  Pending/Rejected/new rows absent); no reason string anywhere in the
  team DOM (checked all four seeded/created reasons, including
  "Family visit" on Alice's approved row — the sentinel); headers
  June 2026 → August 2026 chronological; **Bob Chen Jun 29 – Jul 3
  spans into July and appears exactly once, under June, full range
  shown** (§8 Q2's case, natively in the seed).
- §6.9 ✓ — alice's header: My Requests + Team; carla lands
  `/dashboard`, header: Dashboard + Team; links navigate (active link
  styled).
- §6.10 ✓ — regex probe `\d{4}-\d{2}-\d{2}` over rendered text of
  both views: no match; dates "Aug 5, 2026"-style, headers "August
  2026". Lint ban effective: scratch inline `toLocaleDateString` →
  eslint error with the formatDate message; reverted (deviation 3),
  gates green after.
- §6.11 ✓ — re-run after the probe revert: both gates green.
- §6.12 ✓ — greps: checklist Q0 + Q4-anchor wording present;
  frontend.md contains "httpOnly cookie", zero `setTokenProvider`
  (also zero in `eslint.config.mjs` post-fix); known-limitations
  entry 10 present. Working tree — the human's approval/merge commit
  carries them, per §2.

### Notes for the next chunk
- Verification wrote two Pending rows for alice (Sep 10–12 "Spec 4.9
  verification trip", Oct 5–6 null reason) into the dev DB — reseed
  clears them if pristine state is wanted.
- The seed observed here differs from 4.6 §9's (alice 3 rows, not 6) —
  DB was re-seeded between chunks; point-in-time note, nothing depends
  on it.
- 4.10 consumes: `RequestTable` (generic `Row extends object`, §9
  deviation 1), `StatusBadge`, `FormField`, `formatDate` — plus the
  finished role-aware AppHeader. `emptyText` is wired but unexercised
  (§7's recorded gap) — the dashboard's filtered-empty page is its
  first real render.

### 2026-07-29 — post-verification addition (human-approved in session):
### page canvas fix
Observed during verification: no element ever set the page background —
pages sat on the browser's default canvas, which is near-black in
dark-mode contexts while all text assumes a light ground (pre-existing;
4.8's placeholders had the same structure). Fix, in the project's
Tailwind idiom rather than raw CSS (human's call):
`frontend/index.html` `<body>` gains
`class="min-h-screen bg-slate-50 scheme-light"` — the body background
propagates to the whole canvas, and `scheme-light` keeps native
controls (date inputs) from dark-theming. Verified in the dark-themed
pane: slate-50 canvas, headings legible; computed styles confirm after
a dev-server restart (the running server's content scan had missed the
`index.html`-only utilities — a restart, not a code change, resolved
it; production builds scan fresh by construction). LoginPage's own
`bg-slate-50` is now redundant but harmless — left for 4.11's drift
pass to fold if it wants.
