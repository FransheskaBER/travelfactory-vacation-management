# ADR 0003: Authorization Placement — Role-Gating via Handler Wrappers

**Status:** Accepted

## Context

Every protected endpoint needs to verify two things before any domain logic runs: (1) is the caller authenticated (valid JWT), and (2) is the caller's role permitted for this specific endpoint. `inputParser`'s signature — `(event: CommonEvent) => any` — takes no parameter for "which role is required here," so embedding the check there would mean writing a separate, role-hardcoded parser per protected endpoint, duplicating the same JWT-verification logic each time. Endpoint-to-role mapping is also not uniform: most endpoints require one specific role, one endpoint requires only "any authenticated user, either role."

## Decision

Authorization is enforced by a parameterized wrapper function, `requireRole(role, handlerFn)`, applied at export time around each domain handler. The wrapper decodes and verifies the JWT from the request headers, checks the caller's role against the required role, and returns `403` immediately if it doesn't match — the wrapped domain handler is never invoked. `root.yaml`'s `x-handler` reference points at the wrapped export; CEF calls it exactly as it would call an unwrapped `HandlerFn`, with no awareness a wrapper exists underneath.

```ts
function requireRole(role: Role | 'any', fn: HandlerFn): HandlerFn {
  return async (input, event) => {
    const decoded = verifyJwt(event.headers?.authorization); // 401 if missing/invalid
    if (role !== 'any' && decoded.role !== role) {
      return new Response(403, { error: 'Forbidden' });
    }
    return fn({ ...input, actorId: decoded.userId }, event);
  };
}

export const createRequest      = requireRole('Requester', async (input, event) => { /* US-2 */ });
export const listMyRequests     = requireRole('Requester', async (input, event) => { /* US-3 */ });
export const listTeamVacations  = requireRole('any',       async (input, event) => { /* US-4 */ });
export const getDashboard       = requireRole('Validator', async (input, event) => { /* US-5 */ });
export const approveRequest     = requireRole('Validator', async (input, event) => { /* US-6 */ });
export const rejectRequest      = requireRole('Validator', async (input, event) => { /* US-7 */ });
```

**Endpoint-to-role mapping** (per the new assumption logged in `assumptions.md`, A16): US-2/US-3 require the Requester role specifically, not merely "authenticated" — the schema's one-role-per-user model means a Validator has no legitimate reason to submit or list "their own" vacation requests. US-4 is the only endpoint open to either role. US-5/US-6/US-7 require Validator, matching Rule 6.

## Consequences

**Benefits:**
- One JWT-verification implementation, reused everywhere — no duplicated decode/verify logic scattered across parsers or handlers.
- Domain handlers stay pure — they receive already-authenticated `actorId` context and never touch JWTs or headers directly, matching ADR 0001's boundary between domain logic and transport/security concerns.
- Per-endpoint role requirements are visible at a glance from the export list itself (`requireRole('Validator', ...)` reads as documentation), rather than buried inside each function body.
- Extends cleanly — a future role, or a future "any of these roles" case, is one new call site, not a rewritten parser per endpoint.

**Trade-offs:**
- CEF has no native middleware concept — this wrapper is entirely hand-rolled, not something the framework or its docs demonstrate. It has to be written, tested, and maintained as first-party code.
- The split between `inputParser`'s `400`s and the wrapper's `401`/`403`s is a convention this project invents, not one CEF enforces. A future contributor unfamiliar with this ADR could plausibly add an ad hoc role check inside a parser instead, silently reintroducing the exact duplication this pattern exists to avoid.

## Alternatives Considered

- **Auth/role check embedded inside `inputParser`** — rejected. The parser's signature carries no parameter for "which role is required here," so each protected endpoint would need its own hand-written parser with the role hardcoded inline, duplicating JWT-verification logic per endpoint — the same category of duplication `assertPending()` (ADR 0004) was extracted specifically to avoid.
- **A single shared "must be authenticated" check, with per-command role checks done manually inside each handler body** — rejected. Still requires JWT verification upstream of the handler (or duplicated inside each one), and pushes a cross-cutting concern into domain code — exactly the boundary ADR 0001 draws around handlers holding domain logic, not auth logic.

## Related ADRs

- Builds on the transport/domain boundary from ADR 0001.
- Complements the project decision that role is embedded in the JWT at login and the frontend never self-declares its own role — this ADR is the backend enforcement counterpart to that decision.

## Amendments

- **2026-07-28 (chunk 4.2):** Implemented per `docs/specs/2-auth.md`. Two refinements vs. the illustrative snippet above: error bodies use the project's `{ error: { code, message } }` envelope (D10), not the bare-string body shown; and `verifyJwt` returns a decoded payload or `null`, with the wrapper owning the 401/403 responses (the snippet's comment implied `verifyJwt` responded itself). The decision this ADR records is unchanged.
