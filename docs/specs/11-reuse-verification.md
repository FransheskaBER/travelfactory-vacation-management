# Spec: 4.11 — Reuse verification (audit + gap-closure)

**Status:** approved <!-- human approval, 2026-07-29 (review round 2 directive: three frozen amendments + "set Status: approved"); line edited by Claude executing that instruction -->

> **Freeze rule:** Sections 1–8 freeze at human approval. Section 9 is
> append-only during implementation — deviations get recorded, never
> retro-edited into the plan.

> **Record-reconciliation taxonomy** (from spec 4.3's review rounds) —
> when a decision this spec freezes touches an existing record:
> - **Operative rules file** → update in this chunk's scope.
> - **Design doc falsified by the decision** → lockstep update at freeze.
> - **Point-in-time record, no reader-observable divergence** → stays-true
>   defense, recorded in Q&A.
> - **Point-in-time record with observable divergence** → dated amendment
>   note, original text untouched.
> - **Pre-existing imprecision the decision didn't change** → not this
>   chunk's debt.

## 1. Overview

This chunk is an **audit + gap-closure, not an extraction pass**. The four
named shared components — StatusBadge, RequestTable, PaginationControls,
FormField — already exist, each with a single definition in
`src/components/` and every consumer importing it; their APIs (specs 4.9 §5,
4.10 §5) are **frozen**. The audit (run 2026-07-29 on this branch, transcript
in §9) found the two interfaces clean against each other: no table, status,
or pagination markup anywhere under `pages/`. What remains is duplication
that predates or sits beside the four components, and this spec's only job
is to close those gaps. Traces to the assignment's reusable-components
requirement (PRD), checklist line 4.11, and `.claude/rules/frontend.md`
"Reusable components".

## 2. Scope (in)

1. **LoginPage → FormField migration** (§8 Q1): extend FormField's `type`
   union with `"email" | "password"` and add an optional
   `autocomplete?: string` passthrough — additive optional props, the
   sanctioned extension mechanism. Replace LoginPage's two inline
   label+input pairs with FormField.
2. **AppButton** (§8 Q5): new `src/components/AppButton.vue` (variant prop,
   §5). All `<button>` elements under `pages/` migrate to it.
3. **`formatDateRange` util** (§8 Q7): added to `src/utils/formatDate.ts`;
   the three date-range slot templates use it.
4. **`apiErrorMessage` util** (§8 Q8): 3-line helper in `src/api/client.ts`;
   the six `err instanceof ApiError ? err.message : …` ternaries and the two
   DashboardPage 409 sites' message assembly migrate to it.
5. **Known-limitations entry 11** (§8 Q4): FormField's combobox
   `comboText`/`modelValue` desync, documented — not fixed.
6. **Operative-record updates** (taxonomy): add AppButton to
   `.claude/rules/frontend.md`'s shared-component list (§6.11); dated
   amendment on checklist line 4.11's "no new extractions expected"
   (superseded by §8 Q5's ruling) when the human checks the line off.

## 3. Out of scope

- **Any change to RequestTable.vue, StatusBadge.vue, or
  PaginationControls.vue** — hard guard, zero-diff (§6.2).
- **Renames** of any component, file, prop, emit, or slot.
- **Behavior changes anywhere** — output is behavior-identical (§4 defines).
- **FormField combobox desync fix** (§8 Q4): `comboText` never syncs back
  from `modelValue`; works for the dashboard's current usage but is a
  latent contract gap. Fixing it is behavior change disguised as
  refactoring — known-limitations note only. Owner: none (backlog).
- **Error-text and loading-text fragments** (§8 Q6): `<p class="text-sm
  text-red-600">` ×7 and `<p class="text-sm text-slate-500">` ×3 are
  incidental utility overlap under §4's definition — ruled out by name so
  /spec-check doesn't flag them.
- **AppHeader.vue**: not one of the four, single logout button (no
  duplication), stays untouched; AppButton adoption there is at most a
  Phase 6 note.
- Anything backend; Phase 6 quality-pass items.

## 4. Design

- **"Copy-pasted markup" defined** (the audit's positive signal, §8 Q2):
  *semantic duplication* — a unit with a name in the UI vocabulary (form
  field, button, status badge, table, pagination control) structurally
  reproduced in more than one file — counts. *Incidental Tailwind utility
  overlap* (shared spacing/typography classes such as `mb-4`, `text-sm`)
  does not. Without this line the audit either passes trivially or flags
  every spacing class.
- **The markup/logic boundary** (the Q6 vs Q7/Q8 line): the definition
  above governs *markup* — repetition of how something looks. Repeated
  *logic* — an expression that decides an output (the date-range join, the
  ApiError narrowing ternary) — is judged separately: a decision duplicated
  across files drifts silently when one site changes, so it goes to a
  shared util. A repeated `<p>` with two utility classes decides nothing;
  the ternary decides which message renders. That is why Q6 is OUT and
  Q7/Q8 are IN, and both rulings are stable under the same test.
- **"Behavior-identical" defined**: same rendered text, same control
  semantics (input types, `required`, `maxlength`, `autocomplete`,
  `id`/`for` wiring, disabled states, submit types), same visual rhythm.
  DOM wrapper differences are allowed — FormField's `div.mb-4` wrapper
  replaces LoginPage's per-input `mb-4`.
- **FormField extension is zero-template-change**: `"email"`/`"password"`
  fall through to the existing `v-else` input branch (`:type="type ??
  'text'"`); the diff is the union widening, the `autocomplete` prop, and
  one `:autocomplete` binding on the input branch. Existing consumers are
  untouched.
- LoginPage keeps its single page-level error `<p>` (one message for both
  fields) — FormField's per-field `#error` slot is not used there.
- AppButton is a class-map component (§5): variant → Tailwind cluster,
  content via default slot, no click handling of its own (consumers keep
  `@click`; native events fall through via Vue's attribute inheritance).

## 5. Contracts

```ts
// src/components/FormField.vue — additive delta only (frozen surface otherwise)
type?: "text" | "date" | "textarea" | "select" | "combobox"
     | "email" | "password";
autocomplete?: string;   // bound on the v-else input branch only

// src/components/AppButton.vue
defineProps<{
  variant?: "primary" | "success" | "danger" | "secondary"; // default "primary"
  type?: "button" | "submit";                               // default "button"
  disabled?: boolean;
}>();
// Default slot = label. Class map (exact current clusters, so rendered
// output is unchanged):
//   primary   → rounded bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50
//   success   → rounded bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600 disabled:opacity-50
//   danger    → rounded bg-red-700 … (two sizes exist in the wild: dashboard
//               row actions use px-3 py-1.5 text-xs, the reject-confirm uses
//               px-4 py-2 text-sm — resolved by a size?: "sm" | "md" prop,
//               default "md", rather than two variants)
//   secondary → rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50

// src/utils/formatDate.ts
export const formatDateRange: (startIso: string, endIso: string) => string;
// ≡ `${formatDate(startIso)} – ${formatDate(endIso)}` (en dash, same spacing)

// src/api/client.ts (addition)
export const apiErrorMessage: (err: unknown, fallback: string) => string;
// ≡ err instanceof ApiError ? err.message : fallback

// DashboardPage `approve`/`submitReject` catch blocks — target shape
// (frozen at approval; transcription, not redesign):
//   } catch (err) {
//     actionError.value = apiErrorMessage(err, "Something went wrong — try again");
//     if (err instanceof ApiError && err.status === 409) {
//       await refetchAfterConflict();
//     }
//   }
// submitReject: `rejectError.value` instead of `actionError.value`; its
// existing `actionPending`/early-return structure stays as-is. The two
// statements are independent — message assignment and the 409 guard don't
// interact. The `? :` ternary narrowing disappears from these blocks;
// that is expected, and is what makes §6.10's grep → 0 satisfiable.
// Every other catch block under `pages/` swaps its ternary for
// `apiErrorMessage(err, <same fallback string>)` with no other changes.
```

## 6. Acceptance criteria

Mechanical wherever possible — each states an observable postcondition and
is chosen to catch a specific wrong implementation.

1. **No raw form controls in pages**: `grep -n "<label\|<input\|<textarea\|<select"
   frontend/src/pages/*.vue` → 0 matches. *(Catches partial LoginPage
   migration.)*
2. **Frozen internals untouched**: `git diff main --
   frontend/src/components/RequestTable.vue …StatusBadge.vue
   …PaginationControls.vue` → empty. *(Catches scope creep into the guard.)*
3. **No raw buttons in pages**: `grep -n "<button"
   frontend/src/pages/*.vue` → 0 matches; AppButton has exactly one
   definition, imported by every page containing a button (LoginPage,
   MyRequestsPage, DashboardPage — TeamPage has none, and must not gain a
   dead import). *(Catches a partial button migration.)*
4. **Login semantics preserved**: rendered login DOM has
   `input#email[type=email][autocomplete=username][required]` and
   `input#password[type=password][autocomplete=current-password][required]`,
   each with a `label[for]` match. *(Catches the extension dropping
   `autocomplete` or the union defaulting to text.)*
5. **Date ranges via the util**: `grep -n "formatDate(row.startDate)"
   frontend/src/pages/*.vue` → 0 matches; `formatDateRange` used in all
   three former sites; `formatDateRange("2026-08-21", "2026-08-25")` renders
   `"Aug 21, 2026 – Aug 25, 2026"` (en dash). *(Catches a hyphen/space
   drift.)*
6. **Existing FormField consumers behavior-unchanged**: MyRequestsPage and
   DashboardPage diffs contain only §2 items (button/date-range swaps) —
   no FormField prop changes. *(Catches accidental API break; §5's delta is
   additive-optional, so `vue-tsc` passing over unchanged consumer code
   corroborates.)*
7. **Known-limitations entry 11 exists** describing the combobox desync,
   and no diff touches FormField's combobox logic. *(Catches the "fix it
   while I'm here" failure mode.)*
8. **Toolchain green**: `npm run build` (includes `vue-tsc -b`) and
   `npm run lint` pass in `frontend/`.
9. **Visual parity**: login, my-requests (form open), team, dashboard
   (reject form open) render with unchanged layout/spacing — checked in the
   browser preview, screenshots in §9.
10. **Error-message assembly via the helper**: `grep -n "instanceof ApiError ?"
    frontend/src/pages/*.vue` → 0 matches; `apiErrorMessage` defined once in
    `src/api/client.ts`; the only remaining `instanceof ApiError`
    occurrences anywhere under `pages/` are the two 409 guard conditions in
    DashboardPage, in the §5 target shape. *(Catches a partial migration,
    and catches the helper swallowing the 409 narrowing — the conflict
    refetch must still fire.)*
11. **frontend.md records AppButton**: `grep -c "AppButton"
    .claude/rules/frontend.md` ≥ 1. *(§2.6 — unchecked scope items don't
    happen.)*

## 7. Testing requirements

No frontend test runner exists (package.json: dev/build/preview/lint only)
— adding one is not this chunk's scope. §6 is verified as a recorded
transcript in §9: the greps and empty-diff checks (§6.1–3, 5–7) run
verbatim, §6.4/§6.9 via rendered DOM + screenshots in the browser preview,
§6.8 by command output. Each check is pass/fail against the §6 wording —
derived from §6 only.

**409 conflict test (manual, recorded in §9):** two browser sessions logged
in as two validators, both viewing the same Pending row; approve in session
A, then reject in session B. Session B must show the 409 error message AND
the table must refresh to show the row as Approved. Screenshot both
sessions.

### Files touched (advisory)

`frontend/src/components/FormField.vue`, `frontend/src/components/AppButton.vue`
(new), `frontend/src/pages/{LoginPage,MyRequestsPage,TeamPage,DashboardPage}.vue`,
`frontend/src/utils/formatDate.ts`, `frontend/src/api/client.ts`,
`docs/known-limitations-draft.md`, `.claude/rules/frontend.md`,
`docs/specs/_template.md` (traceability rule), this file (§9).

## 8. Q&A

Q1–Q4 were answered directly by the human (directive, 2026-07-29), Q8 by
the human at review round 1. Q5–Q7 are **pre-answered rulings derived from
the directive's own rules**, per its instruction to pre-answer scope
questions at spec time — each shows its derivation; confirm or strike at
approval (an unanswered/struck question blocks approval).

- **Q1 — LoginPage's inline fields (predate FormField, 4.8 vs 4.9): migrate?**
  **A (human): IN.** Migrate to FormField via the named extension — `type`
  union widened with `"email" | "password"` + `autocomplete` passthrough.
  Form-field markup in a page is a rejected diff (frontend.md); the
  extension mechanism is the one the checklist already sanctions.
- **Q2 — what counts as "copy-pasted markup"?** **A (human):** semantic
  duplication (fields, buttons, status rendering, tables) counts;
  incidental Tailwind utility overlap (`mb-4`, `text-sm`) doesn't. Recorded
  as §4's definition.
- **Q3 — blast radius?** **A (human):** hard guard — no changes to
  RequestTable/StatusBadge/PaginationControls internals, no renames,
  behavior-identical output, acceptance criteria mechanical where possible.
- **Q4 — FormField combobox `comboText` doesn't sync from `modelValue`?**
  **A (human): OUT.** Works for current usage; latent contract gap. Fixing
  it here is behavior change disguised as refactoring — known-limitations
  note only.
- **Q5 — AppButton in or out?** **A (derived): IN.** Derivation: Q2's
  definition names buttons as semantic duplication; the directive's mandate
  is "close remaining duplication only"; the button clusters repeat across
  LoginPage/MyRequestsPage/DashboardPage (3 variants, 7 sites). This
  supersedes the checklist's "no new extractions **expected**" — a
  prediction the audit falsified, not a prohibition; recorded via §2.6's
  dated amendment.
  **Risk (from the directive, restored — v1 quoted only the pro-argument):**
  AppButton touches every page containing a button, with zero automated
  frontend tests to catch regressions. **Adjudication (Claude, review round
  1):** risk accepted — the §5 class map transcribes the existing Tailwind
  clusters byte-for-byte, so the failure modes left are wiring mistakes
  (wrong variant, wrong `type`, dropped `disabled`), and each has a named
  catcher: §6.3's grep for stragglers, §6.4's rendered-DOM check, §6.9's
  four-page visual parity, and the §9 button-`type` audit for the
  inside-a-form hazard. The blast radius is wide but shallow: template-only
  swaps, no logic moves. If that reasoning is wrong anywhere, strike this
  ruling rather than patching it.
- **Q6 — error-text (×7) and loading-text (×3) `<p>` fragments in or out?**
  **A (derived): OUT.** Derivation: Q2's semantic vocabulary doesn't
  include them; two utility classes with no structure or logic is the
  definition's incidental side. Ruled out by name in §3 so the audit's
  clean result is checkable.
- **Q7 — date-range template expression (×3) in or out?** **A (derived):
  IN, as a util, not a component.** Derivation: frontend.md's operative
  rule routes *all* date display through `src/utils/formatDate.ts` and bans
  ad-hoc formatting in components; the en-dash join is date display
  currently assembled ad hoc in three files. A util addition leaves every
  component API frozen.
- **Q8 — `err instanceof ApiError ? err.message : <fallback>` (×6) in or
  out?** **A (human, review round 1): IN**, as `apiErrorMessage(err,
  fallback)` in `src/api/client.ts` — the Q7 route: a util, no component
  API touched. The two DashboardPage 409 sites (`approve`, `submitReject`)
  also adopt the helper for message assembly but keep one
  `instanceof ApiError` each for the `.status === 409` check — that
  surviving narrowing encodes a *different* decision (conflict handling),
  not message duplication (§6.10 pins both halves). Pages whose only
  `ApiError` use was the ternary drop the now-unused import (lint enforces).
  **Omission note:** this item was silently absent from v1 of this spec —
  §4's definition covered markup only, and unlike Q7 no operative rule
  existed to hook the expression, so the definition became a loophole.
  Caught at review, not by any check; traceability rule added to
  `_template.md` §8 so the failure class is closed, not just this instance.

## 9. Implementation Results

*(append-only during build)*

- **Audit record (2026-07-29, pre-spec — the §1 baseline):** single
  definitions confirmed for all four components (one file each under
  `src/components/`); consumers — RequestTable ← MyRequests/Team/Dashboard,
  StatusBadge ← MyRequests/Dashboard, FormField ← MyRequests/Dashboard,
  PaginationControls ← Dashboard (sole paginated view, by design).
  TeamPage omitting StatusBadge is design (A14/D1: approved-only view, no
  status column), not drift. Greps for table/status-pill/pagination markup
  under `pages/`: 0 matches each. Gaps found: LoginPage inline fields
  (→ Q1), button clusters (→ Q5), date-range expression (→ Q7), plus the
  §3 fragments ruled incidental (→ Q6). The 4.10 prop extensions
  (RequestTable `expandedKey`, FormField `select`/`combobox`) verified as
  additive — 4.9 consumers unchanged.
- **Pre-approval audit (2026-07-29, review round 1) — AppButton's
  `type` default:** native `<button>` defaults to `type="submit"` *inside a
  form*; AppButton defaults to `"button"`. Safe today because the invariant
  holds (traced by the human, re-verified independently): every no-type
  button under `pages/` — MyRequests' toggle-form button, Dashboard's
  approve and reject row actions — sits outside any `<form>`, where the
  submit default is inert; every in-form button carries an explicit type
  (login submit, request-form submit, reject-confirm `submit`,
  reject-cancel `button`). The `"button"` default rests on that invariant:
  any future in-form AppButton must pass `type` explicitly or it will stop
  submitting.
- **Implementation (2026-07-29) — pure-internals inventory** (derived by
  grepping module-scope declarations in new/edited modules, per
  implementation-mode):
  - `AppButton.vue`: `Variant`/`Size` type aliases; `VARIANT_CLASSES` +
    `SIZE_CLASSES` static maps + `classes` computed — each §5 cluster is
    decomposed into color (variant) × dimensions (size) × common
    (`rounded font-medium`); the union reproduces each original class set
    exactly (order differs, Tailwind is order-independent).
  - `formatDate.ts`: `formatDateRange` (pure arrow fn); `client.ts`:
    `apiErrorMessage` (pure arrow fn). No per-call value promoted to
    module scope (4.4 §9 adjudication-2 class checked: new declarations
    are static maps and pure functions only).
  - Consumer size/variant wiring: dashboard row actions `success sm` /
    `danger sm`; reject-confirm `danger` (md default); cancel `secondary`;
    all others `primary` md. LoginPage's `w-full` stays consumer-side via
    class fallthrough.
  - MyRequests' toggle button gains `disabled:opacity-50` (in AppButton's
    primary cluster, absent from the old inline markup) — inert without a
    `disabled` attribute, behavior-identical.
  - Toggle/approve/reject buttons now render an explicit `type="button"`
    where they previously had none — same semantics (all sit outside
    forms; the §9 audit above is the invariant).
  - Unused `ApiError` imports dropped from LoginPage/MyRequests/TeamPage
    (only the ternary used it); DashboardPage keeps it for the 409 guards.
  - `.claude/rules/frontend.md`: AppButton added to the shared list, and
    "buttons" added to the extract-on-sight markup list (consistent with
    §4's Q2 definition — convention-level edit).
- **Verification transcript (2026-07-29):** §6.1/6.3/6.5/6.10 greps → 0
  matches (AppButton imported by exactly LoginPage/MyRequestsPage/
  DashboardPage; `formatDateRange` at 3 sites; surviving `instanceof
  ApiError` = DashboardPage:150,170, both in the §5 shape). §6.2 `git diff
  main` on the three frozen components → empty. §6.4 rendered login DOM:
  `#email[type=email][autocomplete=username][required]`,
  `#password[type=password][autocomplete=current-password][required]`,
  labels wired via `for`; submit button class set = original cluster +
  `w-full`. §6.5 range renders "Dec 14, 2026 – Dec 15, 2026" (en dash) in
  the UI. §6.7 known-limitations entry 11 present; combobox logic diff-free.
  §6.8 `npm run build` + `npm run lint` → clean. §6.9 screenshots taken in
  session (login, my-requests form open, team, dashboard reject-form open)
  — layout unchanged. §6.11 grep → 1. **§7 conflict test: PASS with two
  recorded deviations.** (1) Seed has exactly one validator (carla), so
  both sessions were carla — the 409 needs a processed row, not two
  distinct reviewers; seeding a second validator is a backend change §3
  excludes. (2) The browser shares one cookie jar, so session A was a curl
  session (login → cookie → `POST …/approve`, transcript above session B's
  screenshots); session B was the browser. Observed: approve in A
  succeeded; B's confirm-reject returned **409 Conflict** on the wire, the
  detail row shows the envelope message "Request is not pending" with the
  comment retained, and the table refreshed to show the row **Approved /
  Carla Dupont** with its action buttons gone — displayed truth, per spec
  4.10 §4. Test intent (B's conflict UI on a concurrently processed row)
  fully exercised.
- **§6.6 verified post-hoc during /spec-check (2026-07-29, human-directed
  append):** the original verification transcript above silently omitted
  §6.6 — caught by the audit's traceability pass. Re-run first-hand, not
  transcribed from the audit's claim: `git diff main --
  frontend/src/pages/MyRequestsPage.vue frontend/src/pages/DashboardPage.vue`
  → every hunk is a §2 item (ternary → `apiErrorMessage` with identical
  fallback strings, the two §5 catch-block rewrites, `formatDateRange`
  swaps, `<button>` → AppButton swaps, and the import changes those
  entail); grep of the changed lines for `FormField` → 0 — no FormField
  prop changes at either consumer. Criterion satisfied.
