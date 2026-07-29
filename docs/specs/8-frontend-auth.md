# Spec: 4.8 — Frontend auth flow

**Status:** approved

> **Freeze rule:** Sections 1–8 freeze at human approval. Section 9 is
> append-only during implementation — deviations get recorded, never
> retro-edited into the plan.

> **Record-reconciliation taxonomy** applies (see `_template.md`); entries
> that invoke it cite the category inline.

## 1. Overview
The frontend half of US-1: login page, auth state in a persisted Pinia
store (ADR 0005), and role-based route guards driven by
`meta.requiresRole` (frontend.md; client counterpart of ADR 0003 — the
guard is UX, the backend wrapper is the enforcement). First frontend
chunk: it also fixes the route table and page-file conventions that 4.9,
4.10, and 4.11 inherit (§8 Q1), so later chunks replace page internals
without reopening router or store wiring. Backend contract consumed as-is:
`POST /login → 200 { token }` (spec 4.2 §5), token payload
`{ userId, role, iat, exp }`, HS256, 24 h expiry.

## 2. Scope (in)
- Install `jwt-decode` + `pinia-plugin-persistedstate`; register the
  plugin on the Pinia instance in `main.ts`.
- `src/types.ts` (new) — `Role = "Requester" | "Validator"`, shared by
  store, guard, and router meta augmentation.
- `src/stores/auth.ts` (new) — `useAuthStore` per ADR 0005: state
  `{ token, role, userId }` decoded from the JWT at login, `persist: true`,
  `isAuthenticated` getter that is false for an absent **or expired**
  token (§8 Q4 proactive half), `login(email, password)` action calling
  `src/api/auth.ts`, `logout()` clearing state.
- `src/api/auth.ts` (new) — `login` function wrapping `POST /login`.
- `src/api/client.ts` (extend, never rewrite — frontend.md) —
  `setUnauthorizedHandler(fn)`: response interceptor invokes it on 401
  **only when `code === "UNAUTHORIZED"`** — `INVALID_CREDENTIALS` is a
  login failure the login page renders, never a session expiry (§4).
- `main.ts` — wire `setTokenProvider` and `setUnauthorizedHandler`
  (store.logout + push `/login`) once; same inversion pattern for both
  (client.ts importing a store is a lint-banned circular dep).
- `src/router/index.ts` — route table per §5; one global `beforeEach`
  implementing the guard matrix (§4); `RouteMeta` module augmentation
  typing `requiresRole?: Role | "any"`.
- `src/router/roleHome.ts` (new) — `roleHome(role)` mapping, the single
  source for every "land on your own home" redirect (§8 Q3).
- `src/pages/` (new dir) — `LoginPage.vue` plus placeholder
  `MyRequestsPage.vue`, `TeamPage.vue`, `DashboardPage.vue`, each
  rendering a distinguishable heading so guard redirects are observable
  (§6). 4.9/4.10 replace their internals.
- `src/components/AppHeader.vue` (new) — minimal header (app name,
  logout button) rendered on authenticated pages via `App.vue`; logout is
  a button + store action, no `/logout` URL (§8 Q5).
- Remove the scaffold `HelloWorld.vue` route and component (dead once the
  route table lands).
- `backend/.env.example` — document `dev_FRONT_END_URL=http://localhost:5173`
  (§8 Q6): CEF's `loadEnv` alias mechanism copies it to `FRONT_END_URL`,
  which CEF's `Response` reads for `Access-Control-Allow-Origin`; unset
  falls back to `*` (verified against the package source, CLAUDE.md CEF
  rule).
- `docs/known-limitations-draft.md` — two new entries: **(5)** the JWT
  persisted to localStorage is readable by any script that achieves XSS;
  a stolen token is valid until expiry (compounds limitation 4/D12).
  Production alternative: an HttpOnly cookie, which trades XSS exposure
  for CSRF handling — planned as a follow-up chunk after 4.8 (brief
  exists). **(6)** the authenticated header shows no user identity — the
  JWT carries only `userId`/`role` and no `/me` endpoint exists.
- Record edits, applied pre-approval (4.7 §2 pattern; taxonomy: operative
  file): checklist 4.8 line rewritten to this Q&A-expanded scope (route
  skeleton, logout, `FRONT_END_URL`); 4.9/4.10 lines gain "replace
  placeholder page from 4.8" parentheticals.

**Boundaries.** The guard never talks to the backend — it reads only the
store; server-side 401/403 remain the real enforcement (ADR 0003). The
JWT is decoded client-side for routing/display only; a tampered
localStorage payload changes what the browser shows, never what the API
permits.

## 3. Out of scope
- Real content for the three placeholder pages — 4.9 (my-requests, team)
  and 4.10 (dashboard) own them.
- `FormField`/shared-component extraction — 4.11; the login form uses
  plain markup until then.
- `formatDate` util — created by the first chunk that renders a date
  (frontend.md); this chunk renders none.
- Displaying the logged-in user's name — the JWT carries only
  `userId`/`role` and no `/me` endpoint exists; header shows no identity.
  Known limitation, not new surface.
- `?redirect=` return-to-intended-URL machinery and a dedicated 403 page
  (§8 Q3 — both rejected).
- Refresh tokens / revocation (4.2 §8 Q5, Known Limitations).
- Any backend change beyond the one `.env.example` line.

## 4. Design
- **Guard matrix** (one global `beforeEach`; effective auth =
  `isAuthenticated`, whose expiry check makes the guard proactive — §8 Q4):
  | Route | Unauthenticated | Authed, role allowed | Authed, role mismatch |
  |---|---|---|---|
  | no `meta.requiresRole` (public: `/login`) | allow | — | redirect `roleHome(role)` (§8 Q3) |
  | `requiresRole: "any"` | redirect `/login` | allow | — (no mismatch possible) |
  | `requiresRole: <Role>` | redirect `/login` | allow | redirect `roleHome(role)` |
  `/` and the catch-all `/:pathMatch(.*)*` redirect through the same
  landing rule (authed → `roleHome`, else `/login`) — derived from §8
  Q3's "always land on the role home", not separately asked; flag at
  review if wrong.
- **Expired-token handling, two halves (§8 Q4):** proactive — the store
  getter treats `exp * 1000 <= Date.now()` as unauthenticated, so
  navigation with a stale token redirects to `/login`; reactive — a 401
  `UNAUTHORIZED` from any API call fires the unauthorized handler (logout
  + `/login`). The code filter is what keeps a wrong password from
  looking like session expiry: both are 401s, only `UNAUTHORIZED` means
  "your token is bad" (frozen code inventory, 4.7 §6). Decode failure (malformed or
  undecodable token) ⇒ unauthenticated, state cleared — same handling as
  expiry. `exp` is NOT stored in state: the `isAuthenticated` getter
  decodes the persisted token on each check — one source of truth, the
  token itself.
- **Login flow:** `LoginPage` calls `store.login`; on success routes to
  `roleHome(store.role)`; on `ApiError` renders `error.message` from the
  envelope (D10 — client.ts already normalizes), submit disabled while
  pending. No client-side email-format validation — the backend 400/401
  messages are the contract's wording (4.7).
- **Persistence:** the plugin persists the whole auth state to
  localStorage (the store is lint's one allowed persistence point);
  rehydration restores the session across refresh. Tampering yields UI
  drift only (see §2 Boundaries).
- **JWT payload type:** `{ userId: string; role: Role; exp: number }` —
  structural mirror of backend `JwtPayload` (spec 4.2 §5) plus the `exp`
  claim `jsonwebtoken` adds; duplicated by design, no shared package
  exists between the two workspaces.

## 5. Contracts
Route table (paths and meta are the frozen contract 4.9/4.10 build on —
§8 Q1, UI-ish path style):
| Path | Name | `meta.requiresRole` | Component |
|---|---|---|---|
| `/login` | `login` | — (public) | `LoginPage` |
| `/my-requests` | `my-requests` | `"Requester"` | `MyRequestsPage` |
| `/team` | `team` | `"any"` | `TeamPage` |
| `/dashboard` | `dashboard` | `"Validator"` | `DashboardPage` |
| `/`, `/:pathMatch(.*)*` | — | — | redirect per §4 landing rule |

```ts
// src/types.ts
export type Role = "Requester" | "Validator";

// src/stores/auth.ts (shapes; ADR 0005 style)
state: { token: string | null; role: Role | null; userId: string | null }
isAuthenticated: boolean            // token present AND exp in the future;
                                    // decodes the token on each check — exp
                                    // is never stored in state (§4)
login(email: string, password: string): Promise<void>   // throws ApiError
logout(): void

// src/api/auth.ts
export const login = (email: string, password: string): Promise<string>  // raw JWT

// src/api/client.ts (addition)
export const setUnauthorizedHandler = (handler: () => void): void
// fires on ApiError { status: 401, code: "UNAUTHORIZED" } only

// src/router/roleHome.ts
export const roleHome = (role: Role): string
// "Requester" → "/my-requests", "Validator" → "/dashboard"

// vue-router module augmentation
interface RouteMeta { requiresRole?: Role | "any" }
```

## 6. Acceptance criteria
Seeded users (4.1b): `alice.requester@demo.test` / `carla.validator@demo.test`,
password `Demo1234!`. Every criterion is an observable postcondition
(browser URL, rendered text, localStorage, or response header).

1. **Invariant — no protected route reachable unauthenticated:** with
   empty storage, navigating to any route carrying `meta.requiresRole`
   lands on `/login`. Verified at minimum with: `/my-requests`, `/team`,
   `/dashboard`, `/`, and one unknown path.
2. Login as Requester → URL is `/my-requests`; as Validator →
   `/dashboard`. (Kills a wrong or constant `roleHome` mapping.)
3. Logged-in Requester navigating to `/dashboard` ends at `/my-requests`;
   logged-in Validator navigating to `/my-requests` ends at `/dashboard`.
   (Kills a guard that checks authentication but not role.)
4. Both roles can reach `/team` and its heading renders. (Kills `"any"`
   mishandled as a specific role.)
5. A logged-in user navigating to `/login` ends at their `roleHome`.
   (Kills a guard that skips public routes entirely.)
6. Refresh on a protected page: still on that page, still authenticated.
   (Kills missing persistence registration.)
7. Wrong password: stays on `/login`, renders "Invalid email or password"
   from the envelope, and does **not** trigger the unauthorized handler.
   (Kills an unfiltered 401 handler — the reactive path firing on
   `INVALID_CREDENTIALS`.)
8. Expired token in storage — mint via a one-off node script calling
   `jsonwebtoken` directly:
   `jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: "-1h" })`,
   signed with the real secret (backend `signJwt` can't mint this — it
   hardcodes 24 h; the same script serves criterion 9's setup; exact
   command recorded in §9 per §7): navigating to a protected route lands
   on `/login` with store cleared — no API call needed. (Kills a missing
   proactive check.)
9. Valid-`exp` but invalidly-signed token in storage — flip one
   character in the **signature segment** (third dot-separated part of
   the JWT): guard admits it, the page's first API call 401s, and the
   app auto-logs-out to `/login`. Signature, not payload, deliberately:
   a corrupted payload fails the client-side decode and lands on the
   proactive path; a corrupted signature keeps the payload decodable
   with a valid `exp`, so the guard admits it and only the server's
   signature check can reject it — which is the reactive path this
   criterion exists to prove. (Kills a missing reactive handler; proves
   the two halves cover each other.)
10. Logout click: localStorage auth state cleared, URL `/login`, browser
    Back does not re-enter the protected page. (Kills logout that clears
    memory but not persistence, or skips redirect.)
11. No role selector exists anywhere in the UI (US-1) — login form is
    email + password + submit only.
12. `backend/.env.example` contains `dev_FRONT_END_URL`; with it set and
    backend restarted, `curl -i` shows
    `Access-Control-Allow-Origin: http://localhost:5173` and the frontend
    still logs in end-to-end. (Kills a documented-but-wrong variable
    name.)
13. `tsc --noEmit` (frontend) and `npm run lint` (frontend) pass; no new
    lint suppressions.
14. Checklist record edits (§2) are in place: the 4.8 line names the
    expanded scope, and the 4.9/4.10 lines carry the placeholder-
    replacement parentheticals. (4.7 §6.12 pattern — record edits are
    acceptance-checked, not assumed.)

## 7. Testing requirements
Derived from §6 only. Manual browser verification with per-criterion
results recorded in §9 (transcript pattern of 4.6/4.7 §9). TDD §8 defines
no frontend unit layer and marks Playwright E2E as first-cut (D6) —
automated E2E is not this chunk; the Phase 5 matrix (business rules) is
untouched by this chunk. Criteria 8–9 use a script-minted token (§6.8's
`jsonwebtoken` one-off) and a doctored one — commands recorded in §9.

### Files touched (advisory)
`frontend/package.json` (+2 deps), `frontend/src/main.ts`,
`frontend/src/types.ts`, `frontend/src/stores/auth.ts`,
`frontend/src/api/auth.ts`, `frontend/src/api/client.ts`,
`frontend/src/router/index.ts`, `frontend/src/router/roleHome.ts`,
`frontend/src/pages/{LoginPage,MyRequestsPage,TeamPage,DashboardPage}.vue`,
`frontend/src/components/AppHeader.vue`, `frontend/src/App.vue`,
delete `frontend/src/components/HelloWorld.vue`, `backend/.env.example`,
`docs/known-limitations-draft.md` (entries 5–6, §2),
`docs/travelfactory-assignment-checklist.md` (record edits, §2).

## 8. Q&A
**Q1 — Route skeleton: full table now or minimal?** → **(a) Full final
route table with placeholder pages**, UI-ish paths (`/my-requests`, not
`/requests/mine`). Guards are only testable against the real role matrix,
and paths + meta are the contract 4.9/4.10 inherit — deciding them here
means later chunks never reopen router wiring.

**Q2 — Meta convention for "any authenticated" vs public?** →
`requiresRole: "any"` for authenticated-either-role; **absent meta =
public**. Mirrors backend `requireRole('any')` (ADR 0003) — one
vocabulary across both stacks.

**Q3 — Guard redirect behavior?** → **Always land on the role home**;
authenticated-but-wrong-role redirects to the user's own role home. No
`?redirect=` round-trip, no 403 page. Raised during Q&A: "if you're
authenticated, why would you end up in the wrong role?" — resolved:
authentication (valid JWT) and authorization (role claim inside it) are
distinct checks; a logged-in Requester can request `/dashboard` via URL
bar or bookmark. The guard handles that case as UX; the backend 403 is
the enforcement (ADR 0003).

**Q4 — Expired/invalid token handling?** → **Reactive and proactive**:
decode `exp` so an expired token counts as logged out at navigation time,
plus auto-logout on API 401 `UNAUTHORIZED`. Both halves specified in §4;
§6.8/§6.9 verify each half independently.

**Q5 — Logout in scope?** → **Yes — logout belongs to this spec, since
this is authentication.** Follow-up (same session): exposed as a header
button + store action, no literal `/logout` route — a URL that exists
only for its side effect adds route-table surface with no user benefit.

**Q6 — `FRONT_END_URL` documentation?** → **Include in this spec.**
One line in `backend/.env.example`; narrows dev CORS from `*` to the
real dev origin **on actual responses only** — the dev server's
preflight response hardcodes `Access-Control-Allow-Origin: *` (verified
in package source), harmless while `withCredentials` is false. Satisfies
the CLAUDE.md every-variable-documented rule. Alias-prefix behavior
verified against CEF source (§2).

## 9. Implementation Results
_Append-only during build._

### Pre-code open-decisions pass (implementation-mode rule)
No contract-surface or reachable-behavior questions — §5/§4 pin the
surface. Pure internals decided during build, inventory below.

### Pure-internals inventory (derived: grep of module-scope declarations
in new/edited modules, per implementation-mode)
- `stores/auth.ts` — `JwtPayload`, `AuthState` (module-private
  interfaces); `readValidPayload(token)` — decode+expiry+null in one
  helper, the single validity definition; store action `syncFromToken()`
  (see mechanism note below).
- `api/client.ts` — `onUnauthorized` module-scope holder (mirror of
  `readToken`); handler default no-op.
- `router/index.ts` — `landingRedirect()` route-level redirect function
  implementing §4's landing rule for `/` and the catch-all;
  lazy-loaded page components (`() => import(...)`).
- `router/roleHome.ts` — `HOMES` record backing `roleHome`.
- `api/auth.ts` — `LoginResponse` private interface.
- `main.ts` — `pinia`/`app`/`auth` wiring consts.
- Store `login` throws a plain `Error` if a 200 response's token doesn't
  decode (backend/frontend JWT-format disagreement — broken deployment,
  not a user-facing state).
- Page styling: Tailwind utilities, slate palette; placeholders are an
  `<h1>` + one-line note.

### Mechanism note — why `syncFromToken` exists (§4 conformance)
Pinia getters are Vue computeds: they re-evaluate when reactive deps
(the token) change, and expiry is a change in *time*, not state — a
cached `true` could outlive `exp`. §4's "decodes the persisted token on
each check" is therefore implemented as a store action the guard (and
the landing redirect) runs before every navigation: fresh decode, clears
state on invalid/expired (§6.8), re-derives `role`/`userId` from a valid
token (one source of truth — a tampered persisted `role` self-heals to
the signed claim). The getter remains the reactive read for UI (header
`v-if`).

### Verification transcript (browser = Chrome pane at
http://localhost:5173; backend dev server :8888; seeded users 4.1b)
- R1 (§6.1): empty storage → `/my-requests`, `/dashboard`, `/team`, `/`,
  `/no-such-page` each land `/login`. ✓
- R2 (§6.11): login form renders email + password + submit only. ✓
- R3 (§6.7): alice + wrong password → stays `/login`, renders envelope
  message "Invalid email or password", storage empty, no
  handler-triggered redirect. ✓
- R4 (§6.2a): alice/Demo1234! → lands `/my-requests`, header visible,
  persisted state `token+role+userId` — **no `exp` key** (§4 pin
  observable in storage). ✓
- R5 (§6.3a): Requester → `/dashboard` lands `/my-requests`. ✓
- R6 (§6.5): Requester → `/login` lands `/my-requests`. ✓
- R7 (§6.4a): Requester → `/team` renders "Team Vacations". ✓
- R8 (§6.6): reload on `/team` → still `/team`, still authenticated. ✓
- R9 (§6.10): Log out click → `/login`, persisted token `null`, header
  gone; `history.back()` → `/login` (guard blocks re-entry). ✓
- R10 (§6.2b/§6.3b/§6.4b): carla/Demo1234! → `/dashboard`;
  → `/my-requests` lands `/dashboard`; → `/team` renders. ✓
- R11 (§6.8): expired token minted per §6.8 recipe —
  `cd backend && SECRET=$(grep '^dev_JWT_SECRET' .env | cut -d= -f2-)
  node -e "...jwt.sign({userId, role}, process.env.SECRET,
  {expiresIn:'-1h'})"` — planted in storage; navigation to
  `/my-requests` lands `/login`, store cleared, **zero** requests to
  :8888 during the load (proactive half, no server involvement). ✓
- R12 (§6.9): same script's valid token, one signature-segment char
  flipped, planted; navigation to `/my-requests` **admitted** (guard
  passed — isolates the reactive path exactly as §6.9's rationale says);
  API call through the real client → `ApiError 401 UNAUTHORIZED` →
  auto-logout, lands `/login`, store cleared. ✓ — *method note:*
  placeholder pages issue no API calls yet, so "the page's first API
  call" was made through the real module
  (`await import("/src/api/client.ts")` in the page context →
  `apiClient.get("/requests/mine")`) — real interceptor, real handler
  wiring; 4.9's pages will make this call natively.
- R13 (§6.12): **deviation — see below.** `.env.example` documents the
  variable ✓; header narrowing verified via shell-env restart
  (`FRONT_END_URL=http://localhost:5173 npm run dev` →
  `Access-Control-Allow-Origin: http://localhost:5173` on POST /login ✓);
  the `.env`-file route alone does not narrow it (stays `*`).
- R14 (§6.13): `npx vue-tsc -b` exit 0; `npm run lint` clean; no new
  suppressions. ✓
- §6.14: checklist record edits verified present (4.8 line + 4.9/4.10
  parentheticals, applied pre-approval). ✓

### Deviations & post-approval Q&A
1. **§6.12 / §2 CORS-narrowing claim partially falsified (framework
   timing).** CEF's `Response.ts` computes `defaultHeaders` at module
   scope; ES import hoisting evaluates it before `loadEnv()` runs, so
   the aliased `FRONT_END_URL` from `.env` arrives too late — locally
   the header is baked to `*` regardless. The alias copy itself works
   (verified in `aliasEnv.ts` source); on deployed Lambda the variable
   is effective because function-config env exists before module
   evaluation. **Q (post-approval): accept, work around via dev script,
   or preload env in index.ts? A: accept as limitation** — `.env.example`
   line stays as documentation (comment amended to state the local
   timing caveat honestly), dev CORS stays `*`, harmless while
   `withCredentials` is false (§8 Q6); no backend change, honoring §3.
2. **R12 method** (above): §6.9's "page's first API call" simulated
   through the real client module because placeholder pages make no API
   calls until 4.9 — the interceptor and handler wiring exercised are
   the production ones.
3. **`assets/hero.png` left in place** — referenced only by the deleted
   `HelloWorld.vue`; §2 scoped the removal to "route and component", so
   the now-orphaned asset was not deleted. Flagged for the human:
   trivial follow-up delete if wanted.
4. Backend `.env` (untracked, local) gained `dev_FRONT_END_URL` to
   attempt R13; kept — matches `.env.example`.
