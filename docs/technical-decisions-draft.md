
# Technical Decisions — Draft Log
 
Running scratchpad for decisions made during Phase 3/4 mentoring sessions. Not the final README — copy/adapt these into `docs/prd.md` or `README.md`'s **Technical Decisions** section, in your own words, before submission. Keep this file updated as we go so nothing gets lost between sessions.
 
Format matches the D1–D7 table already in `travelfactory-assignment-checklist.md` — continue numbering from there.
 
| # | Decision | Rationale |
|---|----------|-----------|
| D8 | TypeORM `DataSource` config uses `synchronize: false` | `synchronize: true` auto-alters the live schema on every startup by diffing entities against the database — convenient, but it can't distinguish a renamed column from a dropped-and-added one, risking silent data loss with no audit trail. `synchronize: false` forces explicit, reviewable TypeORM migrations instead: versioned files committed to git, each stating exactly what changed and why. No production-oriented codebase should run with `synchronize: true`, even pre-launch — the habit matters more than the immediate risk, since there's no real data yet to lose. |
| D9 | Entry point deviates from the CEF README template: all error paths go through `toErrorResponse` instead of `new Response(500, err)` | `backend/src/index.ts` follows the README's recommended entry-point pattern (`const envReady = loadEnv()` before the `HandlerRegistry` import, then `await envReady` → `await setLambdaContext(context)` → `buildCommonEvent` → route resolution, dev server behind `--local`) except in error handling. The README's catch block returns `new Response(500, err as object)`, which serializes the raw thrown error to the client — stack traces, SQL fragments, or connection strings could end up in an API response. Its handler-not-found branch has the same problem: it returns `` `Handler "${routeConfig.handler}" not found` `` to the client, exposing internal `file#function` refs. Both paths now route through `errors/toErrorResponse.ts`: known `DomainError` subclasses map to their proper status (400/404/409) with their safe message; anything else is logged server-side and returned as a fixed `500 INTERNAL_ERROR` with a generic message. Deliberate deviation — the README is a minimal quick-start, not a security baseline. |
| D10 | Uniform error envelope `{ error: { code, message } }` on every non-2xx response | The README template mixes shapes: `{ error: "Route not found" }` (plain string) on 404, a raw serialized error on 500. One fixed envelope means the frontend's Axios interceptor can read `error.code` on any failure without per-endpoint special cases, and machine-readable codes (`ROUTE_NOT_FOUND`, `INTERNAL_ERROR`, domain codes) stay stable even if human-readable messages are reworded. The envelope is produced in exactly two places — the 404 branch in `index.ts` and `toErrorResponse` — so it can't drift. |
| D11 | `vacation_requests.reviewed_by` (nullable FK → `users.id`) — a deliberate extension beyond the assignment's given schema | The assignment's `VacationRequests` schema records the decision (`status`, `comments`) but not the decider — yet its own validator dashboard requirement shows "who reviewed it" per row (`prd.md`, dashboard fields). `reviewed_by` is written only by the approve/reject commands (`request.reviewedBy = validatorId`, ADR 0004), giving every decision an audit trail. Nullable and never required on insert, so the given schema remains a strict subset: nothing removed, renamed, or repurposed. |
 
---
 
## Notes for later entries
 
Things likely to become D11, D12, etc. as Phase 4 progresses — flag these when we hit them:
 
- Where JWT verification + role check live in the CEF request lifecycle (inputParser vs handler)
- First TypeORM migration: what it contains, why hand-written vs auto-generated