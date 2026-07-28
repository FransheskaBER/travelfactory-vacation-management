# TravelFactory Technical Test — Master Checklist

**Assignment:** Vacation Management Interface (Full Stack Internship) **Stack (mandated):** Vue.js · Node.js · PostgreSQL \+ TypeORM · Tailwind CSS · `commoneventframework` (CEF) **My additions:** TypeScript everywhere · Vue 3 Composition API (`<script setup>`) · spec-driven AI workflow (Cursor / Claude Code) · manual commits **Their stated budget:** 2–3 h with AI. Real budget: spec \+ docs justify going over — scope-control, don't gold-plate.

---

## 🔒 Locked decisions (record these in README → Technical Decisions)

| \# | Decision | Rationale |
| :---- | :---- | :---- |
| D1 | "Team vacation planning available for two roles" \= **one shared page/component showing approved requests for all users**, visible to both roles | Requirement is underspecified; documented as an assumption |
| D2 | Overlap rule enforced **app-level** (query inside `CreateVacationRequestCommand` handler) | Simple, testable. Race condition \+ Postgres exclusion-constraint fix noted in **Known Limitations** |
| D3 | **No role selection in UI.** Role lives in `users.role`, read server-side at login, embedded in JWT. Frontend routes based on JWT role | Client is never trusted to declare its own permissions |
| D4 | TypeScript on backend and frontend | CEF scaffolds TS; type safety across the stack |
| D5 | Domain **command bus \+ event dispatcher built on top of CEF** | CEF only routes transport (HTTP→handler). Commands/Events are the domain layer they're grading |
| D6 | Tests: unit tests on business rules first → a few functional endpoint tests → one E2E happy path | Business rules are in evaluation criteria; E2E is a bonus. Cut from the bottom if time runs out |
| D7 | Seeded users with **bcrypt-hashed** passwords | Plaintext seeds \= instant code-quality fail |

---

## Phase 0 — Process & logistics

- [x] Send "starting work" email to Laura *(done — July 26 reply)*  
- [x] Create GitHub repo `travelfactory-vacation-management` (private is fine — invite reviewer if asked)  
- [ ] `git init`, first commit: empty repo \+ this checklist \+ `.gitignore` (node\_modules, dist, `.env`)  
- [ ] Add `.env.example` (never commit `.env`)  
- [ ] Decide commit convention: `type(scope): message` — e.g. `feat(backend): add CreateVacationRequestCommand` — **all commits manual, by me**  
- [ ] ⚠️ Reminder set: **send completion email to Laura at the end** (Phase 8\)

## Phase 1 — Requirements interrogation

- [ ] Re-read assignment email top to bottom once more  
- [ ] Write `docs/assumptions.md`: every ambiguity \+ my resolution (D1–D3 above, plus anything new)  
- [ ] Confirm the 6 business rules list verbatim (they're the grading spine — Phase 5\)  
- [ ] Read the CEF README **in full** on npm; note anything that contradicts my mental model

## Phase 2 — Spec docs *(next session with mentor)*

- [ ] `docs/prd.md` — what & why: users, roles, features per interface, business rules, out-of-scope  
- [ ] `docs/tdd.md` — how: architecture diagram, layering (CEF transport → command bus → domain → TypeORM), data model \+ ERD, command catalog, event catalog, auth design, API contract  
- [ ] Draft `root.yaml` — the full API surface as OpenAPI (this doubles as API documentation)  
- [ ] Data model: `users`, `vacation_requests` per assignment schema — decide indexes (e.g. `vacation_requests.user_id`, status)  
- [ ] Command catalog: `LoginCommand`(?), `CreateVacationRequestCommand`, `ApproveVacationRequestCommand`, `RejectVacationRequestCommand`  
- [ ] Event catalog: `VacationRequestCreatedEvent`, `VacationRequestApprovedEvent`, `VacationRequestRejectedEvent`  
- [ ] Business-rules → enforcement-point matrix (fill Phase 5 table)  
- [ ] Auth design: where JWT verification \+ role check live in CEF (wrapper around handlers or inputParser stage) — this is ADR material  
- [ ] 3–5 short ADRs in `docs/adr/`: CEF layering, overlap enforcement, auth placement, state management choice, anything contested  
- [ ] Break tdd.md into **implementation-ready spec chunks** for Cursor/Claude Code (one chunk \= one commit-sized task)

## Phase 3 — Environment setup

- [ ] Folder structure at repo root:  
        
      /backend  
        
      /frontend  
        
      /docs        (prd.md, tdd.md, assumptions.md, adr/)  
        
      README.md  
        
- [ ] `docker-compose.yml` with Postgres (pinned version, volume, healthcheck)  
- [ ] Backend: `npx cef-init` inside `/backend` → verify scaffold (`src/index.ts`, `src/root.yaml`, `src/handlers/`, `src/generated/`)  
- [ ] `npm run dev` → hit the sample `/hello` route on localhost:8888 — **prove CEF runs locally before writing any real code**  
- [ ] Install \+ wire TypeORM: `DataSource` initialized **once** and reused across handler invocations (not per request) — Lambda-style lifecycle  
- [ ] Frontend: scaffold Vue 3 \+ Vite \+ TS in `/frontend`; add Vue Router, Pinia, Axios, Tailwind  
- [ ] Verify frontend dev server runs \+ can reach backend (CORS configured)  
- [ ] Seed script: 2+ requesters, 1+ validator, bcrypt passwords, a few sample requests in each status  
- [ ] Commit checkpoint: `chore: project scaffold, docker, CEF + Vue running`

## Phase 4 — Spec-driven implementation (Cursor / Claude Code, in dependency order)

Rule: **one spec chunk in → AI output reviewed line-by-line by me → commit manually → next chunk.** Never accept a diff I can't explain.

- [ ] 4.1 TypeORM entities \+ migration (`User`, `VacationRequest`)  
- [ ] 4.2 Auth: login handler, JWT issue/verify, role guard mechanism, protected-route wiring in CEF  
- [ ] 4.3 Command bus \+ event dispatcher core (small, hand-rolled, \~2 files — this is the architecture showcase, keep it readable)  
- [ ] 4.4 Domain commands \+ business-rule validation inside them (overlap check lives in `CreateVacationRequestCommand`)  
- [ ] 4.5 Domain events \+ at least one listener (even just structured logging on `VacationRequestApprovedEvent` — proves the pattern is real, not decorative)  
- [ ] 4.6 REST endpoints in `root.yaml` \+ handlers: auth, create request, list mine, list all (validator), approve, reject — pagination on list-all  
- [ ] 4.7 Input validation \+ consistent error format (shape: `{ error: { code, message } }` or similar — one shape everywhere)  
- [ ] 4.8 Frontend: auth flow (login page, token storage, route guards by role)  
- [ ] 4.9 Requester UI: request form, my-requests list with statuses, shared team-vacations view (D1)  
- [ ] 4.10 Validator UI: dashboard, filter by status \+ user, pagination, approve action, reject action with **required comment**  
- [ ] 4.11 Reusable components pass: extract StatusBadge, RequestTable/List, PaginationControls, FormField — no copy-pasted markup between the two interfaces

## Phase 5 — Business-rules verification matrix

Every rule: where enforced → unit test written → manually verified in UI.

| Rule | Enforced where | Test | UI check |
| :---- | :---- | :---- | :---- |
| 1\. End date after start date | input validation \+ command | ☐ | ☐ |
| 2\. No overlap for same user | `CreateVacationRequestCommand` (D2) | ☐ | ☐ |
| 3\. Approved requests immutable | command guard | ☐ | ☐ |
| 4\. No past-dated requests | input validation \+ command | ☐ | ☐ |
| 5\. Rejection requires comment | `RejectVacationRequestCommand` \+ frontend form | ☐ | ☐ |
| 6\. Only validators approve/reject | role guard on endpoints | ☐ | ☐ |

- [ ] Functional tests: login, create request (happy \+ each rule violation), approve, reject  
- [ ] One E2E happy path: login as requester → submit → login as validator → approve → requester sees "Approved" *(cut first if out of time)*

## Phase 6 — Quality pass (AI-output audit)

- [ ] Read every file top to bottom — I can explain every line out loud  
- [ ] Hunt AI failure modes: silent SDK error patterns (check every library's error contract), swallowed promises, `any` types, dead code, hallucinated CEF APIs (verify against actual README)  
- [ ] Pagination correctness: total count, page boundaries, empty page  
- [ ] Error paths: wrong password, expired token, requester hitting validator endpoint (403 not 500\)  
- [ ] No secrets in repo; `.env.example` complete; JWT secret from env  
- [ ] Consistent formatting (Prettier/ESLint run clean)  
- [ ] `cef-gen-handlers` rerun after final `root.yaml` state — registry in sync

## Phase 7 — Documentation

- [ ] `README.md`: project overview → architecture summary (with the layering diagram) → prerequisites → setup (docker, env, install, seed) → run (backend, frontend) → demo credentials → **Technical Decisions** (D1–D7 \+ ADR links) → **Known Limitations** (incl. D2 race-condition note) → what I'd do with more time  
- [ ] ADRs finalized in `docs/adr/`  
- [ ] Brief "approach" section: spec-driven AI workflow described honestly — spec docs are in the repo as proof

## Phase 8 — Ship

- [ ] **Fresh-clone test:** clone into a clean folder, follow README exactly, app runs. If any step surprises me, fix the README  
- [ ] Review commit history: tells a coherent story, no "fix", "wip", "asdf"  
- [ ] Push final state  
- [ ] Re-read assignment email one last time against the repo — every deliverable line checked  
- [ ] **Send completion email to Laura** (link to repo, one-paragraph summary, offer to walk through it)

---

## Vue crib sheet (React → Vue 3, for reference during Phase 4\)

| React | Vue 3 |
| :---- | :---- |
| Component function \+ JSX | SFC: `<template>` \+ `<script setup lang="ts">` |
| `useState` | `ref()` / `reactive()` |
| `useEffect` | `watch()` / `onMounted()` |
| Custom hooks | Composables (`useAuth()`) |
| Redux Toolkit | Pinia store |
| React Router | Vue Router (+ `beforeEach` guards for roles) |
| Props \+ callbacks | Props \+ `emit` |
| Conditional render `{x && ...}` | `v-if` / `v-show` |
| `.map()` in JSX | `v-for` with `:key` |

Watch for: my JSX habits bleeding into templates (`className` → `class`, no curly-brace expressions — use `{{ }}` and directives).  
