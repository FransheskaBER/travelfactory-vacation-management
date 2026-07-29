# TravelFactory — Vacation Management

## Overview

An internal vacation management app. Employees with the **Requester** role
submit vacation requests and track their status; employees with the
**Validator** role review, approve, or reject them — rejection requires a
comment. Both roles share a team view of approved vacations. The stack is
Vue 3 + TypeScript + Pinia + Tailwind on the frontend, and Node +
TypeScript + CEF (`commoneventframework`) + TypeORM + PostgreSQL on the
backend.

## Architecture

CEF handles transport; a hand-rolled domain layer handles everything else.
Handlers only parse input and shape the response; all business rules live in
command classes under [backend/src/domain/commands](backend/src/domain/commands).
This keeps the six business rules testable without HTTP. Domain events fire
only after a successful commit; listeners react, they never gate.

```
HTTP request
  → route         backend/src/root.yaml (the API contract)
  → inputParser   shape-only validation, no DB access
  → requireRole   JWT verify + role gate (backend/src/auth)
  → handler       thin: builds the command (backend/src/handlers)
  → command       business rules (CreateVacationRequestCommand,
                  ApproveVacationRequestCommand, RejectVacationRequestCommand)
  → repository    backend/src/repositories → TypeORM entity → PostgreSQL

after commit:
  command → event (VacationRequestCreatedEvent, VacationRequestApprovedEvent,
                   VacationRequestRejectedEvent) → listeners (logging)
```

Every command execution passes through one dispatch point, the CommandBus
([backend/src/domain/bus](backend/src/domain/bus)). Events live in
[backend/src/domain/events](backend/src/domain/events). The full design
narrative is in [docs/tdd.md](docs/tdd.md); individual decisions are in
[docs/adr](docs/adr).

## Prerequisites

- Node 22 (developed and tested on 22.20)
- npm (ships with Node)
- Docker with Compose (provides PostgreSQL 16.4 — no local Postgres install
  needed)

## Setup

Start the database:

```bash
docker compose up -d
```

The first run pulls the Postgres image, which can take a minute.

Set up the backend — install, environment, schema, demo data:

```bash
cd backend
npm install
cp .env.example .env
npm run migration:run
npm run seed
```

The seed wipes and recreates demo data, so it is safe to run again at any
time.

## Run

Backend (port 8888):

```bash
cd backend
npm run dev
```

Frontend (port 5173):

```bash
cd frontend
npm install
npm run dev
```

Then open http://localhost:5173.

The frontend needs no `.env` for local dev. Vite proxies `/api` to the
backend on port 8888. The proxy is mandatory, not a convenience: the auth
cookie only flows on same-origin requests, because credentialed CORS forbids
the wildcard origin CEF's dev server sends. Copy
`frontend/.env.example` only to override the defaults.

## Demo credentials

All seeded users share the password `Demo1234!`.

| Email                      | Password    | Role      |
| -------------------------- | ----------- | --------- |
| alice.requester@demo.test  | `Demo1234!` | Requester |
| bob.requester@demo.test    | `Demo1234!` | Requester |
| carla.validator@demo.test  | `Demo1234!` | Validator |

## Technical Decisions

One line per decision. The full form — alternative, reasoning, cost — is in
[docs/technical-decisions.md](docs/technical-decisions.md).

- **D1** — The team vacation view is one shared page of approved requests, visible to both roles.
- **D2** — The overlap rule is enforced in the create command, not the database; the race window is limitation 1.
- **D3** — No role selection in the UI; role comes from the database at login and travels in the JWT.
- **D4** — TypeScript on both ends, strict mode, `any` banned.
- **D5** — A command bus and event dispatcher sit on top of CEF; CEF only routes transport.
- **D6** — Tests were built unit-first, then functional; the E2E happy path was cut for time.
- **D7** — Seeded passwords are bcrypt-hashed; the plaintext appears only in this README.
- **D8** — TypeORM runs with `synchronize: false`; schema changes are explicit migrations.
- **D9** — Every error path routes through one translator instead of CEF's raw-error template, so internals never leak to clients.
- **D10** — Every non-2xx response has one shape: `{ error: { code, message } }`.
- **D11** — Schema divergence from the assignment's column list: `vacation_requests.reviewed_by` (nullable FK) records who decided; additive only.
- **D12** — One JWT with 24 h expiry and no refresh token; the revocation gap is limitation 4.
- **D13** — Codegen calls CEF's generator function directly and verifies the output, because the documented CLI silently no-ops.
- **D14** — The command bus is a thin executor, not a registry; commands stay self-executing.
- **D15** — JWT in an httpOnly `SameSite=Lax` cookie instead of localStorage: injected scripts cannot read httpOnly cookies, closing the XSS token-theft channel.

## Known Limitations

One line each. Scenarios and the fixes I would apply are in
[docs/known-limitations.md](docs/known-limitations.md).

1. The overlap check is read-then-write, so two concurrent submissions can both pass it.
2. A Validator cannot request vacation for themselves — every user holds exactly one role.
3. Nothing guards against validator self-approval; today the scope choice in limitation 2 prevents it, not a check.
4. A stolen token stays valid until its 24 h expiry; there is no revocation.
5. Resolved: the token was XSS-readable in localStorage before the httpOnly-cookie migration.
6. The logged-in header shows no name or email; no `/me` endpoint exists.
7. CSRF protection is `SameSite=Lax` only; production would add CSRF tokens.
8. Dev traffic must ride the Vite proxy; production must be same-origin or configure credentialed CORS.
9. On real API Gateway v2 the `Set-Cookie` header must move to the `cookies` array — a one-line deployment fix.
10. A cross-month vacation appears only under its start month in the team view.
11. The FormField combobox does not re-sync its display text if the model is written programmatically.

## My Approach (AI workflow)

This project was built spec-first with Claude Code. For each implementation
chunk I wrote a spec in [docs/specs](docs/specs) — scope, acceptance
criteria, and a Q&A section where every open decision got an answer from me,
not the model — and approved it before any code. Claude Code then implemented
against the approved spec. I verified by reading every changed file in full,
not by trusting diff summaries. Deviations discovered during implementation
are recorded in each spec's Implementation Results section rather than
silently absorbed. One process gate was consciously overridden: the cookie
migration ran directly from its written brief without a fresh spec cycle, and
[docs/specs/12-cookie-transport.md](docs/specs/12-cookie-transport.md)
records that decision and its verification.

## What I'd Do With More Time

- Close the overlap race with a Postgres `EXCLUDE` constraint on user + date
  range, so the database enforces Rule 2 regardless of timing.
- Replace the 24 h token with short-lived access tokens and rotated,
  DB-backed refresh tokens.
- Add one browser-level E2E test: requester submits, validator approves,
  requester sees "Approved".
- Add `GET /me` and show the logged-in user's name in the header.
- Harden CSRF beyond `SameSite=Lax` with per-request tokens.
