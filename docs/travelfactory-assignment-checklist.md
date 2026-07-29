# TravelFactory Technical Test — Master Checklist
 
**Assignment:** Vacation Management Interface (Full Stack Internship)
**Stack (mandated):** Vue.js · Node.js · PostgreSQL + TypeORM · Tailwind CSS · `commoneventframework` (CEF)
**My additions:** TypeScript everywhere · Vue 3 Composition API (`<script setup>`) · spec-driven AI workflow (Claude Code: `/spec` → approve → implement → `/spec-check`) · manual commits · feature branch + PR per chunk (merge commits, never squash)
**Their stated budget:** 2–3 h with AI. Real budget: spec + docs justify going over — scope-control, don't gold-plate.
 
> ⚠️ **This file stays OUT of the repo.** It contains candid strategy notes. If a process doc belongs in the repo, write a sanitized version. (Repo copy + assignment PDF: see Phase 0 urgent item.)
 
*Updated 2026-07-28 — verified against repo state on `main`. Changes: done items checked; seed script moved Phase 3 → 4.1b (depends on entities/migration + bcrypt); added repo-visibility item, api-contract-draft commit item, scaffold-cleanup items in Phase 6.*
 
---
 
## 🔒 Locked decisions (record these in README → Technical Decisions)
 
| # | Decision | Rationale |
|---|----------|-----------|
| D1 | "Team vacation planning available for two roles" = **one shared page/component showing approved requests for all users**, visible to both roles | Requirement is underspecified; documented as an assumption |
| D2 | Overlap rule enforced **app-level** (query inside `CreateVacationRequestCommand` handler) | Simple, testable. Race condition + Postgres exclusion-constraint fix noted in **Known Limitations** |
| D3 | **No role selection in UI.** Role lives in `users.role`, read server-side at login, embedded in JWT. Frontend routes based on JWT role | Client is never trusted to declare its own permissions |
| D4 | TypeScript on backend and frontend | CEF scaffolds TS; type safety across the stack |
| D5 | Domain **command bus + event dispatcher built on top of CEF** | CEF only routes transport (HTTP→handler). Commands/Events are the domain layer they're grading |
| D6 | Tests: unit tests on business rules first → a few functional endpoint tests → one E2E happy path | Business rules are in evaluation criteria; E2E is a bonus. Cut from the bottom if time runs out |
| D7 | Seeded users with **bcrypt-hashed** passwords | Plaintext seeds = instant code-quality fail |
 
*D8 onward (e.g. `synchronize: false`) live in `docs/technical-decisions-draft.md` — merge all into README at Phase 7.*
 
---
 
## Phase 0 — Process & logistics
 
- [x] Send "starting work" email to Laura *(done — July 26 reply)*
- [x] Create GitHub repo `travelfactory-vacation-management`
- [x] `git init`, first commit: repo + `.gitignore` (node_modules, dist, `.env`)
- [x] Add `.env.example` (never commit `.env`)
- [x] Commit convention: `type(scope): message` — **all commits manual, by me**
- [x] Claude Code workflow scaffolding committed: `CLAUDE.md`, `.claude/rules/`, `.claude/commands/` (`/spec`, `/spec-check`), `docs/specs/_template.md`
- [ ] 🔴 **URGENT — resolve repo visibility:** repo is currently **public** with the assignment PDF and this checklist committed. Either (a) flip private now, invite reviewer at completion, **or** (b) purge PDF from git history (`git filter-repo`) + remove/sanitize checklist. Option (a) is the 30-second stopgap; do it before the next commit
- [ ] ⚠️ Reminder set: **send completion email to Laura at the end** (Phase 8)
## Phase 1 — Requirements interrogation
 
- [x] Re-read assignment email top to bottom once more
- [x] Write `docs/assumptions.md`: every ambiguity + my resolution (D1–D3 + A-series)
- [x] Confirm the 6 business rules list verbatim in `docs/prd.md` (they're the grading spine — Phase 5)
- [x] Read the CEF README **in full** on npm; notes captured, scaffold verified against it
## Phase 2 — Spec docs *(done with mentor)*
 
- [x] `docs/prd.md` — what & why: users, roles, features per interface, business rules, out-of-scope
- [x] `docs/tdd.md` — how: architecture diagram, layering, data model + ERD, command catalog, event catalog, auth design, API contract
- [x] Draft full API surface as OpenAPI (`root_copy.yaml`)
- [ ] **Commit the draft to the repo as `docs/api-contract-draft.yaml`** — target contract; routes port into `backend/src/root.yaml` chunk by chunk, in lockstep with their handlers (never ahead — codegen imports every referenced handler)
- [x] Data model: `users`, `vacation_requests` per assignment schema — indexes decided (`vacation_requests.user_id`, `status`)
- [x] Command catalog: `LoginCommand`, `CreateVacationRequestCommand`, `ApproveVacationRequestCommand`, `RejectVacationRequestCommand`
- [x] Event catalog: `VacationRequestCreatedEvent`, `VacationRequestApprovedEvent`, `VacationRequestRejectedEvent`
- [x] Business-rules → enforcement-point matrix (Phase 5 table)
- [x] Auth design: JWT + role check placement in CEF → ADR 0003
- [x] ADRs 0001–0005 in `docs/adr/` (CEF layering, overlap enforcement, auth placement, shared pending guard, state management)
- [x] tdd.md broken into implementation-ready chunks (the 4.x list) + `docs/specs/_template.md`
## Phase 3 — Environment setup
 
- [x] Folder structure at repo root: `/backend` · `/frontend` · `/docs` · `README.md`
- [x] `docker-compose.yml` with Postgres
- [x] Backend: `cef-init` scaffold verified (`src/index.ts`, `src/root.yaml`, `src/handlers/`, `src/generated/`)
- [x] `npm run dev` → sample `/hello` route on localhost:8888 — CEF proven locally
- [x] TypeORM wired: shared `DataSource` in `src/db/dataSource.ts`, initialized once (Lambda-style lifecycle)
- [x] Frontend: Vue 3 + Vite + TS scaffold; Vue Router, Pinia, Axios, Tailwind v4 installed and wired in `main.ts`; `api/client.ts` stubbed
- [ ] Verify frontend dev server reaches backend (CORS configured) — **unverified, confirm before 4.8**
- [x] Commit checkpoint: scaffold, docker, CEF + Vue running
*Seed script moved to 4.1b — it inserts into tables that don't exist until 4.1's migration runs. Sequenced by data dependency, not topic.*
 
## Phase 4 — Spec-driven implementation (Claude Code, in dependency order)
 
Rule per chunk: **branch `feature/<chunk-slug>` → `/spec <chunk>` → Q&A answered with decisions (never "whatever you think") → spec approved + committed → implement from spec → `/spec-check` → deviations fixed or appended to Implementation Results → line-by-line review by me → manual commits → PR (merge commit) → next chunk.** Never accept a diff I can't explain.
 
- [x] 4.1 TypeORM entities + migration (`User`, `VacationRequest`): enums, FK relation, indexes (`user_id`, `status`); migration generated → hand-audited → run against dockerized Postgres *(done 2026-07-28 — PR #2 merged; spec docs/specs/1-entities-and-migration.md, all §6 criteria verified, /spec-check adjudications in §9)*
- [x] 4.1b Seed script *(moved from Phase 3 — depends on 4.1)*: install bcrypt; 2+ requesters, 1+ validator, bcrypt-hashed passwords (D7), sample requests in each status. **Seed running clean = 4.1's acceptance proof**
- [x] 4.2 Auth: install jsonwebtoken; login handler, JWT issue/verify, role guard mechanism, protected-route wiring in CEF (ADR 0003) *(done 2026-07-28 — PR #4 merged; spec docs/specs/2-auth.md, all §6 criteria verified, /spec-check caught the stale-registry false ✓ → D13 codegen fix + two new template rules, full trail in §9)*
- [x] 4.3 Command bus + event dispatcher core (small, hand-rolled, ~2 files — the architecture showcase, keep it readable)
- [x] 4.4 Domain commands + business-rule validation inside them (overlap check lives in `CreateVacationRequestCommand`) *(done 2026-07-28 — PR #6 merged; spec docs/specs/4-domain-commands.md, all §6 criteria verified, /spec-check adjudications in §9)*
- [x] 4.5 Domain events + at least one listener (structured logging on `VacationRequestApprovedEvent` — proves the pattern is real, not decorative) *(acceptance must require the listener's log line to appear — a wrong event class emits as a silent no-op, spec 4.3 §8 Q3)* *(done 2026-07-28 — PR #7 merged; spec docs/specs/5-domain-events.md, all §6 criteria verified incl. the log-line obligation, /spec-check adjudications + trend ruling in §9)*
- [ ] 4.6 REST endpoints ported into `root.yaml` (route + request/response schemas, spec 4.2 §9) + handlers: create request, list mine, list all (validator), team view (spec 4.6 §8 Q1), approve, reject, users list (A10, spec 4.6 §8 Q2) — *login shipped end-to-end in 4.2 (spec 4.2 §8 Q1), 4.6 only re-verifies it post-codegen*; full date validation (format + calendar) in the create parser (spec 4.6 §8 Q7); pagination on list-all; `npm run codegen` after every YAML edit; **revert 4.2's temp guard on `/hello/:name`** (requireRole wrap in `handlers/hello.ts` + the 401/403 entries in root.yaml — see spec 4.2 §8 Q9); *end-to-end listener proof inherited from 4.5: approve via HTTP must produce the structured listener log line in server output (spec 4.5 §6 — the HTTP surface 4.5 lacks)*
- [ ] 4.7 Input validation + consistent error format (`{ error: { code, message } }` via `DomainError` → `toErrorResponse` — one shape everywhere); `reason` normalization on create (trim, `""` → `null`) via shared `normalizeReason` — spec 4.4 §3 defers it here, layer ruling spec 4.7 §8 Q1; 500-char caps on `reason` + `comment` (parser 400s, trimmed-length counting) with varchar(500) migration + entity + root.yaml `maxLength` lockstep (spec 4.7 §8 Q4–Q6, Q8); error-message wording pass owned here, codes frozen (spec 4.4 §9 adjudication 1 — messages carry zero contract weight); `ROUTE_NOT_FOUND` routed through `errorResponse` (spec 4.7 §8 Q7); *date validation (format + calendar) lives in 4.6's parser (spec 4.6 §8 Q7) — boundary stated in spec 4.7 §2*
- [ ] 4.8 Frontend: auth flow (login page, token in Pinia store, route guards by role via `meta.requiresRole`)
- [ ] 4.9 Requester UI: request form, my-requests list with statuses, shared team-vacations view (D1); *request form's `reason` field carries `maxlength="500"` — inherited from 4.7's cap (spec 4.7 §3)*
- [ ] 4.10 Validator UI: dashboard, filter by status + user, pagination, approve action, reject action with **required comment**; *resolve `userId`/`reviewedBy` to names client-side via `GET /users` — the dashboard serves bare uuids by design (spec 4.6 §8 Q10)*; *reject-comment field carries `maxlength="500"` — inherited from 4.7's cap (spec 4.7 §3)*
- [ ] 4.11 Reusable components pass: extract StatusBadge, RequestTable/List, PaginationControls, FormField — no copy-pasted markup between the two interfaces
## Phase 5 — Business-rules verification matrix
 
Every rule: where enforced → unit test written → manually verified in UI.
 
| Rule | Enforced where | Test | UI check |
|------|---------------|------|----------|
| 1. End date after start date | input validation + command | ☐ | ☐ |
| 2. No overlap for same user | `CreateVacationRequestCommand` (D2) | ☐ | ☐ |
| 3. Approved requests immutable | command guard (`assertPending`, ADR 0004) | ☐ | ☐ |
| 4. No past-dated requests | input validation + command | ☐ | ☐ |
| 5. Rejection requires comment | `RejectVacationRequestCommand` + frontend form | ☐ | ☐ |
| 6. Only validators approve/reject | role guard on endpoints | ☐ | ☐ |
 
- [ ] Functional tests: login, create request (happy + each rule violation), approve, reject
- [ ] Functional test (envelope invariant tripwire): malformed body incl. JSON-valid non-object → 400 in the D10 envelope — if a CEF upgrade ever starts enforcing root.yaml request schemas, this goes red instead of the frontend interceptor going quiet (spec 4.2 §9)
- [ ] One E2E happy path: login as requester → submit → login as validator → approve → requester sees "Approved" *(cut first if out of time)*
## Phase 6 — Quality pass (AI-output audit)
 
- [ ] Read every file top to bottom — I can explain every line out loud
- [ ] Hunt AI failure modes: silent SDK error patterns (check every library's error contract), swallowed promises, `any` types, dead code, hallucinated CEF APIs (verify against actual README), evaluation-timing on every module-level hoisted expression — a per-call value silently promoted to per-process is a bug even when the diff "is just organization" (spec 4.4 §9 adjudication 2; same class as 4.2's JWT-secret-at-call-time)
- [ ] Enforceability pass: any prose rule in `.claude/rules/` that lint/tsc could enforce → migrate to lint config, demote prose to pointer (axios import ban, DataSource singleton, date util)
- [ ] Pagination correctness: total count (count query, not `data.length`), page boundaries, empty page, stable ordering
- [ ] Error paths: wrong password, expired token, requester hitting validator endpoint (403 not 500)
- [ ] **Scaffold cleanup:** delete `HelloWorld.vue`, `vue.svg`, `vite.svg`, default `frontend/README.md`; remove `handlers/hello.ts` + its route from `root.yaml` → rerun codegen
- [ ] No secrets in repo; `.env.example` complete; JWT secret from env
- [ ] Consistent formatting (Prettier/ESLint run clean)
- [ ] `cef-gen-handlers` rerun after final `root.yaml` state — registry in sync
- [ ] Spec-anchored check: every 4.x spec's Implementation Results section reflects reality — no silent deviations
## Phase 7 — Documentation
 
- [ ] `README.md`: project overview → architecture summary (with the layering diagram) → prerequisites → setup (docker, env, install, seed) → run (backend, frontend) → demo credentials → **Technical Decisions** (D1–D8+ + ADR links) → **Known Limitations** (from `docs/known-limitations-draft.md`, incl. D2 race-condition note) → what I'd do with more time
- [ ] ADRs finalized in `docs/adr/`
- [ ] Brief "approach" section: spec-driven AI workflow described honestly — spec docs + `docs/specs/` are in the repo as proof
## Phase 8 — Ship
 
- [ ] **Fresh-clone test:** clone into a clean folder, follow README exactly, app runs. If any step surprises me, fix the README
- [ ] Review commit history: tells a coherent story, no "fix", "wip", "asdf"; PR list reads as a work log
- [ ] Confirm visibility decision executed (Phase 0 urgent item) before sharing
- [ ] Push final state
- [ ] Re-read assignment email one last time against the repo — every deliverable line checked
- [ ] **Send completion email to Laura** (link to repo / invite if private, one-paragraph summary, offer to walk through it)
---
 
## Vue crib sheet (React → Vue 3, for reference during Phase 4)
 
| React | Vue 3 |
|-------|-------|
| Component function + JSX | SFC: `<template>` + `<script setup lang="ts">` |
| `useState` | `ref()` / `reactive()` |
| `useEffect` | `watch()` / `onMounted()` |
| Custom hooks | Composables (`useAuth()`) |
| Redux Toolkit | Pinia store |
| React Router | Vue Router (+ `beforeEach` guards for roles) |
| Props + callbacks | Props + `emit` |
| Conditional render `{x && ...}` | `v-if` / `v-show` |
| `.map()` in JSX | `v-for` with `:key` |
 
Watch for: JSX habits bleeding into templates (`className` → `class`, no curly-brace expressions — use `{{ }}` and directives).