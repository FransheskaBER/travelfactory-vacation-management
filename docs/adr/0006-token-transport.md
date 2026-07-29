# ADR 0006: Token Transport — httpOnly Cookie, Migrated from localStorage

**Status:** Accepted

## Context

Chunks 4.2 and 4.8 shipped JWT auth with the token returned in the login body, persisted to localStorage by the Pinia persistence plugin, and attached to requests as `Authorization: Bearer` by an Axios interceptor. That design worked and was fully verified — but it left the token readable by any script that achieves XSS, and known-limitations entry 5 disclosed exactly that: a stolen token is a valid 24 h credential with no revocation path (D12), so the two limitations compound. The gap was known at 4.8 time and deliberately deferred with a written brief, making this a planned migration, not a correction of an oversight.

## Decision

Move the JWT into an httpOnly cookie; the client never sees or handles the token again.

- `POST /login` issues `Set-Cookie: token=<jwt>; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400` (+ `Secure` behind the `COOKIE_SECURE` env gate) and returns `{ role, userId, expiresAt }` in the body — the server must now hand over explicitly what the frontend used to decode for itself.
- `verifyJwt`/`requireRole` read the cookie only. The `Authorization: Bearer` surface is retired, not dual-read: both halves of the app migrated in one chunk, so no client ever needs the old surface, and keeping it would keep the XSS-relevant path alive.
- A backend `POST /logout` (unauthenticated, idempotent, always 200) clears the cookie — it exists only because JS cannot delete an httpOnly cookie, inverting 4.8 §8 Q5's "no /logout URL" decision, which assumed a client-readable token.
- The auth store keeps only `{ role, userId, expiresAt }` (ADR 0005 amendment) — non-secret display/routing facts whose tampering yields UI drift only; `requireRole` remains the enforcement boundary (ADR 0003).

## Consequences

**Benefits:**
- The XSS token-theft channel is closed structurally, not mitigated: no script in the page, injected or otherwise, can read the credential. Known-limitations 5 is resolved rather than disclosed.
- The frontend sheds machinery — the request interceptor, `setTokenProvider`, and the `jwt-decode` dependency are deleted outright; the browser attaches the credential itself.
- Session expiry handling keeps 4.8's proactive/reactive two-halves design unchanged in shape — `expiresAt` from the login body feeds the proactive check, the 401 interceptor stays the reactive backstop.

**Trade-offs:**
- Cookies auto-attach, so CSRF becomes possible in principle where header auth was structurally immune. Accepted with `SameSite=Lax` as the mitigation: it withholds the cookie on cross-site POSTs, and every mutating endpoint in this API is a POST. Production hardening (CSRF tokens, `SameSite=Strict`) is documented in known-limitations, not built.
- Credentialed requests forbid `Access-Control-Allow-Origin: *`, and CEF's dev server hardcodes exactly that in its preflight handler — so the Vite dev proxy (`/api` prefix → backend) is now mandatory infrastructure, not a convenience. Production must serve both halves from one origin or configure real CORS at the gateway.
- Logout requires a server round-trip. The store clears local state even when that call fails — an offline logout still logs this device out; the orphaned cookie dies at `Max-Age`.
- On real API Gateway v2, `Set-Cookie` must move to the Lambda result's `cookies` array — a known one-line deployment fix, recorded in known-limitations.

## Alternatives Considered

- **localStorage + `Authorization` header (the shipped 4.2/4.8 design)** — rejected, with production history: this project actually built, verified, and ran it before migrating away. Simpler transport, no CSRF surface, no proxy requirement — but any XSS yields an exfiltratable 24 h credential, and that risk class outweighs the added cookie machinery. The full working design is preserved in specs 4.2/4.8 and their amendment notes.
- **Dual-read (`Cookie` with `Authorization` fallback)** — rejected. Useful only during a staggered rollout; both halves shipped in one chunk, so the fallback would be permanent dead surface carrying the exact risk the migration removes.
- **Server-side sessions (cookie holding an opaque session id)** — rejected. Solves revocation (D12) as well, but requires session storage and lookup on every request — a second auth architecture replacing a working one, far beyond the assignment's scope. The JWT stays; only its transport changed.

## Related ADRs

- ADR 0003 (amended): `requireRole` wrapper placement unchanged; its token source is now the cookie.
- ADR 0005 (amended): the store no longer holds the token — only server-supplied session facts.

Record of the migration itself (decisions, audit, verification transcript): `docs/specs/12-cookie-transport.md`.
