# Known Limitations

Real gaps in what is built, disclosed on purpose. This is distinct from the
"Out of Scope" list in [assumptions.md](assumptions.md), which covers
deliberate exclusions — these are limitations in things that exist.

Entry numbers are stable: ADRs and specs cite them by number. Entry 5 was
resolved mid-project and is kept in place so those citations still land.

## 1. Overlap-check race condition

- **What breaks:** Rule 2. Two overlapping requests for the same user can both
  be saved.
- **Scenario:** The same user submits two overlapping requests at nearly the
  same instant. Both `findOverlapping` checks run before either insert
  commits, so both pass. The check is read-then-write, not atomic.
- **Fix:** A Postgres `EXCLUDE` constraint on the user + date range — the
  database then rejects the second insert regardless of timing. Advisory locks
  and `SERIALIZABLE` isolation are compared in
  [ADR 0002](adr/0002-overlap-enforcement.md). At this project's traffic
  (single-user local testing) the window is unlikely to surface, but it is a
  real gap, not a theoretical one.

## 2. No dual-role support — a Validator cannot request vacation

- **What breaks:** A Validator has no way to submit a vacation request for
  themselves. This is structural, not unimplemented: every user holds exactly
  one role (assumption A16 in [assumptions.md](assumptions.md)).
- **Scenario:** The validator wants time off. No screen, route, or role lets
  them file the request.
- **Fix:** Dual-role users, or a separate approval chain for validators' own
  requests. Who approves a validator — another validator, an admin tier — is a
  genuine design question the assignment does not answer, so it stays open.

## 3. No guard against Validator self-approval

- **What breaks:** Nothing today — but only because of a scope choice, not a
  guard. `POST /requests` is restricted to Requesters (A16), so the conflict
  cannot currently arise.
- **Scenario:** If request creation were ever opened to Validators, one could
  approve their own request. `assertPending()` checks status only; nothing
  compares reviewer against requester.
- **Fix:** A `reviewer !== requester` check in the approve and reject
  commands, with its own error code and tests.

## 4. No token revocation or refresh

- **What breaks:** A stolen token cannot be invalidated.
- **Scenario:** A token leaks. It stays a valid credential for up to 24 hours
  (D12). There is no server-side session state to revoke it against.
- **Fix:** Short-lived access tokens with rotated, DB-backed refresh tokens.

## 5. JWT was XSS-readable in localStorage — resolved

Resolved by the httpOnly-cookie migration
([ADR 0006](adr/0006-token-transport.md), record in
[spec 12](specs/12-cookie-transport.md)). The token now travels only in an
`HttpOnly` cookie, unreadable by any script. What the store still persists —
`{ role, userId, expiresAt }` — are not secrets: tampering causes UI drift
only, and the backend's `requireRole` remains the enforcement. The trade this
bought is entry 7. The migration also purges the stale token key that the
earlier design left in browsers' localStorage.

## 6. Authenticated header shows no user identity

- **What breaks:** The logged-in header cannot show a name or email.
- **Scenario:** The JWT carries only `userId` and `role`, and no `/me`
  endpoint exists to resolve them into a display name.
- **Fix:** A `GET /me` endpoint returning name and email, fetched once after
  login.

## 7. CSRF stance: `SameSite=Lax` only

- **What breaks:** Cookies auto-attach to requests, so cross-site request
  forgery becomes possible in principle. The old header-based auth was
  structurally immune.
- **Scenario:** A malicious site fires a POST at the API from a logged-in
  victim's browser. `SameSite=Lax` withholds the cookie on cross-site POSTs,
  and every mutating endpoint in this API is a POST — so the attack fails
  under the current threat model.
- **Fix:** Per-request CSRF tokens or `SameSite=Strict` for production
  hardening. Documented here, not built.

## 8. Dev transport requires the Vite proxy

- **What breaks:** Direct cross-origin API calls from the dev frontend.
  Credentialed requests forbid `Access-Control-Allow-Origin: *`, and CEF's dev
  server hardcodes exactly that in its preflight handler.
- **Scenario:** Point the frontend straight at `localhost:8888` without the
  `/api` proxy — the preflight fails and the auth cookie never flows.
- **Fix:** In production, serve frontend and API from one origin, or configure
  real CORS with credentials at the gateway. Locally the mandatory proxy in
  `vite.config.ts` makes API calls same-origin, so CORS never applies.

## 9. `Set-Cookie` placement on real API Gateway v2

- **What breaks:** Cookie delivery on an actual AWS deployment.
- **Scenario:** Locally, CEF's dev server writes response headers verbatim and
  the cookie flows. On API Gateway v2, a Lambda result's cookies belong in the
  `cookies` array, not `headers` — the login cookie would be dropped.
- **Fix:** Move `Set-Cookie` into the result's `cookies` array. A one-line
  change at deployment time, not built here.

## 10. Cross-month vacations appear only under their start month

- **What breaks:** Scanability of the team view — the purpose US-4 states is
  planning around teammates.
- **Scenario:** An Aug 30 – Sep 3 vacation sits under the August header only.
  Someone scanning September misses it; the row's full date range is the only
  cross-month signal.
- **Fix:** Split spans across month groups, showing the row once per month it
  touches. That duplication complexity was declined with the calendar grid in
  A14, and the trade is disclosed here because it cuts against US-4's purpose.

## 11. FormField combobox never re-syncs display text from `modelValue`

- **What breaks:** Programmatic writes to the model don't update what the user
  sees. The combobox keeps its display text in internal state and only pushes
  values out.
- **Scenario:** A future "reset filters" button clears the model; the combobox
  keeps showing the stale selection. Invisible in current usage — the only
  clear path today is the user editing the input, which is the direction that
  works.
- **Fix:** A watcher on `modelValue` that re-derives the display text.
  Deliberately not done in chunk 4.11, whose mandate was reuse gap-closure
  with behavior-identical output.
