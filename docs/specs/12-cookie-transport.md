# Chunk record: 4.12 — Auth token transport, localStorage → httpOnly cookie

**Status:** implemented directly from brief — no /spec run, by explicit human
decision (2026-07-29). This file is the decision record the brief's §9
references point at; it is not an approved spec and claims no freeze
semantics.

## 1. Provenance

- Input: `cookie-auth-migration-brief.md` (human-authored, external to repo).
- Two workflow overrides, both human-decided before any code:
  1. **Spec process skipped** — implemented directly from the brief instead
     of running /spec Q&A to an approved spec (deviation from
     implementation-mode.md, owned by the human).
  2. **Scope gate overridden** — the brief gates this chunk on 4.9–4.11 and
     Phase 5 being green; they are not started. Proceeded anyway by decision.
- Scope: full migration, backend + frontend in one chunk (a backend-only half
  would leave the 4.8 frontend unable to authenticate).

## 2. Decisions (brief §8 + audit findings — each owned by the human)

1. **Cookie-only token read** in `verifyJwt`/`requireRole` — no
   `Authorization: Bearer` fallback. Both halves ship together, so no client
   ever needs the old surface; keeping it would keep the XSS-relevant
   surface alive.
2. **`expiresAt` (epoch ms) stays in the login body** — preserves 4.8's
   proactive/reactive two-halves expiry design, now fed by the response body
   instead of a decoded `exp`.
3. **Vite proxy shape: `/api` prefix + rewrite**, `baseURL` pinned to
   `/api`. Unambiguous — frontend routes and API paths can never collide
   (`/login` is both a page and an endpoint at root level).
4. **`POST /logout` is idempotent and unauthenticated** — always 200 + a
   clearing Set-Cookie. A logout that can fail is hostile UX; an expired
   session must still land logged-out. (Deviation from the brief's §3 sketch,
   which showed `requireRole("any")` — the idempotency recommendation it
   also contains won.)
5. **Stale 4.8-era `token` key in localStorage: stripped on hydration** —
   `pick` limits the persisted surface to the three new keys and
   `afterHydrate` forces an immediate rewrite, so storage is clean at app
   boot, not at the next state change.

## 3. Verify-first audit results (brief §9, checked against installed CEF)

- `Response(statusCode, body, headers, …)` merges custom headers over its
  defaults; the dev server writes response headers verbatim via a
  `setHeader` loop (collapses duplicate names — fine for the single
  Set-Cookie). ✓
- `event.headers.cookie` reaches handlers: Node lowercases the name, the
  dev mapper passes `req.headers` through untouched, `buildCommonEvent`
  returns CommonEvents unchanged. **New finding:** the mapper *parses*
  cookies (`extractCookiesFromHeaders`) then drops the result — the event
  has no `cookies` field, so hand-parsing the header in `auth/cookie.ts` is
  the only option, not a style choice. ✓
- Dev preflight hardcodes `Access-Control-Allow-Origin: *` (the `OPTIONS`
  branch of `dist/dev/requestListener.js`) — the Vite proxy is mandatory. ✓
- `pinia-plugin-persistedstate@4.7.1` exposes `pick`, `afterHydrate`, and
  `store.$persist()` (verified in its `index.d.ts`). ✓

## 4. Implementation notes & internals (§9-style inventory)

- `TOKEN_TTL_SECONDS = 86400` shared between `jwt.ts` (`expiresIn`) and
  `cookie.ts` (`Max-Age`) — one constant so token expiry and cookie lifetime
  cannot drift.
- `signJwt` returns `{ token, expiresAt }`, `expiresAt` read back off the
  signed token's `exp` claim (token stays the single source of truth; never
  computed from `Date.now() + ttl`).
- **`COOKIE_SECURE` env var** (new, documented in `.env.example`) gates the
  `Secure` attribute. The brief said "a prod-env check" without a mechanism;
  an explicit variable was chosen over guessing at alias names
  (`ALIAS === "production"` etc.). False locally — the dev server is plain
  http, where a Secure cookie is silently never stored.
- Security scheme renamed `bearerAuth` → `cookieAuth`
  (`type: apiKey, in: cookie, name: token`) — `http/bearer` would be a lie
  post-migration; all 7 endpoint refs updated, codegen re-run (17 refs
  verified).
- Store actions: `logout()` (POST /logout, then clear locally even on
  failure) vs `clearSession()` (local-only — used by the reactive 401 path
  and expiry sync, where the server already considers the session dead, and
  by criterion "expired session navigates with no API call").
- Known cosmetic internal: on first hydration over a 4.8-era localStorage,
  the plugin may patch the stale `token` string into the in-memory store
  object before `afterHydrate` rewrites storage. Nothing types it, reads it,
  or re-persists it; it dies with the tab.
- 4.8 §9 deviation 1 (`FRONT_END_URL`) ruled **superseded-as-moot locally,
  still accurate for deployment** — recorded in spec 4.8's amendment note.
  This chunk builds nothing for CORS and fixes nothing about it.

## 5. Amendments issued by this chunk

- spec 4.2 (bottom amendment): /login contract, verifyJwt cookie-only.
- ADR 0005 (amendment section): store holds `{ role, userId, expiresAt }`,
  no token.
- spec 4.8 (bottom amendment): decode-per-check deleted, Q5 logout
  inversion, FRONT_END_URL moot-locally ruling.
- known-limitations: entry 5 resolved; entries 7 (CSRF stance), 8 (proxy /
  same-origin production), 9 (API GW v2 `cookies` array) added.
- TDD §6 (amendment sentence: transport → httpOnly cookie), §7 (POST /logout
  row + /login row updated), §9 (ADR index gains 0006). *(Added post-brief —
  the brief's §2 table omitted these; flagged by the human.)*
- ADR 0003 (dated amendment): wrapper's token source is now the cookie;
  placement decision unchanged.
- **ADR 0006 (new):** the migration's own decision record — context (XSS-readable
  localStorage), decision (httpOnly + SameSite=Lax), consequences (CSRF
  stance, mandatory proxy, server-side logout), alternatives incl. the
  shipped-then-rejected localStorage design.
- technical-decisions-draft: D15 (cookie transport + mandatory dev proxy →
  ADR 0006).
- checklist: 4.12 chunk line (gate recorded as consciously overridden);
  Phase 6 gains the api-contract-draft disposition item — decision: mark the
  draft superseded-by-root.yaml with a one-line header during Phase 6
  cleanup; this migration deliberately does not port `/login`/`/logout` into
  the draft.

## 6. Acceptance criteria

Derived from brief §7 — verification transcript appended below after the
live run.

### Verification transcript — 2026-07-29 (Browser pane at localhost:5173,
backend dev server :8888, seeded DB; curl for transport-level checks)

1. **Cookie set correctly** — curl `POST /login` (alice): 200,
   `Set-Cookie: token=<jwt>; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400`,
   body exactly `{ role, userId, expiresAt }`. In-browser after UI login:
   `document.cookie` is `""`; `JSON.stringify(localStorage)` contains no JWT
   and no `token` key. ✓
2. **Guard matrix rerun** — unauthenticated `/my-requests` → `/login`;
   Requester login lands `/my-requests` (roleHome); Validator navigating
   Requester-only `/my-requests` → `/dashboard` (own home, no 403 page);
   Validator on `/team` (`any`) → stays. ✓
3. **Refresh keeps session** — reload on `/my-requests` stays on
   `/my-requests`, store re-hydrated valid. ✓
4. **Logout** — header button: store all-null, landed `/login`,
   authenticated probe after logout → 401 (cookie really deleted), Back →
   stays `/login`. Logout response: `Set-Cookie: token=; …; Max-Age=0`;
   `POST /logout` with no session → 200 (idempotent). ✓
5. **Proactive half** — persisted `expiresAt` edited to past, navigation to
   `/my-requests` → `/login`, store cleared, zero HTTP API calls
   (performance entries show only Vite-served source modules). ✓
6. **Reactive half** — real login, then cookie killed server-side with the
   store still future-valid; guard admits navigation; first API call through
   the app's own axios instance (dynamic import of `/src/api/client.ts`,
   same 4.8 R12 method — placeholder pages still make no calls) → 401
   UNAUTHORIZED → auto-logout: store cleared, `/login`. ✓
7. **4.2 regression on cookie transport** — no credential 401; valid cookie
   + right role 200; valid cookie + wrong role 403; garbage cookie 401;
   **old `Authorization: Bearer <valid jwt>` → 401** (cookie-only surface
   confirmed — this case kills a dual-read mutant). ✓
8. **Removal + hygiene** — grep: `setTokenProvider` and
   `jwt-decode`/`jwtDecode` absent from both workspaces' src and
   package.json; backend `tsc --noEmit` + lint clean; frontend `vue-tsc -b`
   + lint clean; codegen re-verified 17/17 refs. ✓
9. **Stale-storage purge** — planted 4.8-shape
   `{ token, role, userId }` in localStorage; after reload storage reads
   `{ role, userId, expiresAt: null }` — token key gone at boot, leftover
   facts inert (expiresAt null ⇒ unauthenticated). ✓
