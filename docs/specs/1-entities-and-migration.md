# Spec: 4.1 — TypeORM entities and initial migration

**Status:** approved
> **Freeze rule:** Sections 1–8 freeze at human approval. Section 9 is
> append-only during implementation — deviations get recorded, never
> retro-edited into the plan.

## 1. Overview
Creates the `User` and `VacationRequest` TypeORM entities and the initial
migration that builds the schema: both tables, both Postgres enum types, the
two FKs to `users`, and the `(user_id, status)` composite index. Implements
TDD §2 (Data Model) exactly, under D8 (`synchronize: false`, migrations only).
Checklist item 4.1 — every later backend chunk depends on these entities.

## 2. Scope (in)
- `src/entities/User.ts` and `src/entities/VacationRequest.ts` (enums exported
  from the entity file they belong to)
- Register both entities in the runtime DataSource (`src/db/dataSource.ts`)
- New `cliDataSource` export in `src/db/dataSource.ts` for the TypeORM CLI (§8 Q1)
- npm scripts: `migration:generate`, `migration:run`, `migration:revert`,
  `migration:show` (§8 Q2)
- Initial migration in `src/migrations/`, generated via CLI against the
  dockerized Postgres, then hand-reviewed line by line against TDD §2

## 3. Out of scope
- Seed script (Phase 3 checklist item — separate task, needs bcrypt, D7)
- `VacationRequestRepository` port + `findOverlapping` adapter — chunk 4.4
  (ADR 0001, ADR 0002)
- Any change to `root.yaml`, handlers, or auth — chunks 4.2/4.6
- Postgres exclusion constraint for overlaps — rejected in ADR 0002,
  Known Limitations material
- Frontend types mirroring these entities — frontend chunks

## 4. Design
- **Naming.** Tables `users`, `vacation_requests`; snake_case column names set
  explicitly (`name: 'user_id'` etc.); camelCase entity properties
  (`reviewedBy`, `startDate`) matching ADR 0004's sample code.
- **Enums.** Native Postgres enum types with explicit names: `user_role` and
  `vacation_request_status`. TS `enum`s with string values (`UserRole`,
  `VacationRequestStatus`) so entity properties and later commands share one
  set of literals.
- **UUIDs.** `@PrimaryGeneratedColumn('uuid')` with `uuidExtension: 'pgcrypto'`
  on both DataSource configs, so defaults use `gen_random_uuid()` (built into
  Postgres ≥13) instead of requiring the legacy `uuid-ossp` extension.
- **Relations.** Two `@ManyToOne` links to `User`, named `requester`
  (`user_id`, not null) and `reviewer` (`reviewed_by`, nullable) per TDD §2.
  Scalar FK columns (`userId`, `reviewedBy`) are also mapped as plain columns
  so commands can set ids without loading a `User` (ADR 0004 sample does
  `request.reviewedBy = validatorId`). No eager loading; FK `onDelete` stays
  at the default NO ACTION — no delete operation exists anywhere (A7/A9).
  Note: `reviewed_by`/`reviewer` is a deliberate extension of the assignment's
  given schema (which has no such column) — rationale documented as **D11**
  in `docs/technical-decisions-draft.md`.
- **Password.** `select: false` (§8 Q3) — the hash never appears in query
  results unless a query opts in with `addSelect` (login command, chunk 4.2).
- **Index.** `@Index('IDX_vacation_requests_user_id_status', ['userId', 'status'])`
  on the entity, so `migration:generate` emits it (TDD §2 Indexes).
- **CLI DataSource (§8 Q1).** `src/db/dataSource.ts` gains
  `export const cliDataSource: Promise<DataSource>` = CEF's `loadEnv()`
  resolving, then `new DataSource(...)` — the CLI's `loadDataSource` awaits
  exported promises, and `loadEnv` fails soft on SSM, so importing this module
  at runtime stays harmless. Both facts are **internal behavior, not documented
  API**, verified by reading `typeorm@1.1.0` (`CommandUtils.loadDataSource`)
  and the installed CEF dist — re-verify both on any upgrade. package.json's
  `^1.1.0` range permits drift; the lockfile is the effective pin. Inside the `.then`, read `process.env.DATABASE_URL` directly
  (not `getEnvValue`, which throws) so the promise can never reject at
  import time; a missing URL surfaces as a clear connection error when the
  CLI calls `initialize()`. Runtime never initializes `cliDataSource`.
  The eslint `new DataSource()` ban and its single-file exemption stay untouched.
- **Migration registration (§8 Q2).** Migrations run only via npm scripts.
  `cliDataSource` lists migration classes by explicit import (no glob — one
  migration, and explicit imports survive bundling); the runtime DataSource
  registers entities only, no `migrations`, no `migrationsRun`.
- Migration is generated, then hand-reviewed; never edited once applied (D8).

## 5. Contracts

```ts
// src/entities/User.ts
export enum UserRole { Requester = 'Requester', Validator = 'Validator' }
export class User {
  id: string;            // uuid PK
  name: string;
  email: string;         // unique
  password: string;      // bcrypt hash; select: false
  role: UserRole;
  createdAt: Date;       // @CreateDateColumn → created_at
}

// src/entities/VacationRequest.ts
export enum VacationRequestStatus {
  Pending = 'Pending', Approved = 'Approved', Rejected = 'Rejected',
}
export class VacationRequest {
  id: string;                       // uuid PK
  userId: string;                   // user_id, FK → users.id, not null
  requester: User;                  // @ManyToOne via user_id
  startDate: string;                // 'date' column — TypeORM returns 'YYYY-MM-DD' strings
  endDate: string;                  // 'date' column, same
  reason: string | null;
  status: VacationRequestStatus;    // default Pending
  comments: string | null;          // rejection only (A12)
  reviewedBy: string | null;        // reviewed_by, FK → users.id, nullable
  reviewer: User | null;            // @ManyToOne via reviewed_by
  createdAt: Date;                  // created_at
  updatedAt: Date;                  // updated_at, @UpdateDateColumn
}
```

Note for later chunks: `date` columns surface as **strings**, not `Date` —
this is deliberate and matches A2's date-only granularity. Rule 1/4 checks in
chunk 4.4 compare `'YYYY-MM-DD'` strings.

`src/db/dataSource.ts` exports: `getDataSource(): Promise<DataSource>`
(unchanged behavior, now with entities registered) and
`cliDataSource: Promise<DataSource>`.

package.json scripts (all `typeorm-ts-node-commonjs <cmd> -d src/db/dataSource.ts`):
`migration:generate` (takes a path arg), `migration:run`, `migration:revert`,
`migration:show`.

## 6. Acceptance criteria
1. On a fresh Postgres (docker volume wiped), `npm run migration:run` creates
   `users`, `vacation_requests`, enum types `user_role` and
   `vacation_request_status`, both FKs, the composite index, and TypeORM's
   migrations table. Running it again is a no-op ("No pending migrations").
2. The applied schema matches TDD §2 column-for-column: types, nullability,
   `status` default `'Pending'`, `email` unique, `created_at` defaults,
   `updated_at` auto-updates.
3. `npm run migration:revert` cleanly drops everything the migration created
   (down path implemented and tested once).
4. After the migration is applied, running `migration:generate` again reports
   no schema changes — entities and migration are in sync.
5. `password` is absent from the result of a default `find` on `User`
   (`select: false` works).
6. `npm run dev` still boots and serves `/hello` — registering entities broke
   nothing at runtime, and no DataSource is initialized at module load.
7. `tsc --noEmit` and `npm run lint` pass; no `new DataSource()` outside
   `src/db/dataSource.ts`.

## 7. Testing requirements
No business rules exist in this chunk, so no unit tests are written for it
(TDD §8 puts entity-touching coverage in the chunk 4.4 integration tests).
Verification is executing §6 manually against the dockerized Postgres —
criteria 1–6 each checked once, results recorded in §9. Criterion 5 is checked
with a throwaway query via a `ts-node` one-liner or the CLI `query` command,
not committed test code.

### Files touched (advisory)
- `src/entities/User.ts` (new)
- `src/entities/VacationRequest.ts` (new)
- `src/migrations/<timestamp>-InitialSchema.ts` (generated)
- `src/db/dataSource.ts` (entities + `cliDataSource` export)
- `package.json` (four migration scripts)

## 8. Q&A
**Q1. The TypeORM CLI needs a file exporting a `DataSource` instance, but
eslint bans `new DataSource()` outside `src/db/dataSource.ts`. Where does the
CLI DataSource live?**
A: Same file, extra export — `cliDataSource` from `src/db/dataSource.ts`.
Lint rule and exemption untouched.

**Q2. How are migrations executed?**
A: Manual npm scripts only (`migration:generate/run/revert/show`). No
`migrationsRun` at boot; applying schema changes is an explicit README step.

**Q3. Should `User.password` be `select: false`?**
A: Yes. The login command (chunk 4.2) opts in explicitly with `addSelect`;
the hash can never leak into a response by accident.

## 9. Implementation Results
*(append-only during build)*

**2026-07-28 — implemented, all §6 criteria verified.**

- §6.1 ✓ — volume wiped (`docker compose down -v`), `migration:run` created
  both tables, both enum types, both FKs, the composite index, and the
  `migrations` table; second run: "No migrations are pending".
- §6.2 ✓ — generated SQL hand-reviewed against TDD §2 column-for-column;
  behavioral checks via throwaway script (not committed): `status` defaults
  to `Pending`, `created_at` populated by DB default, `updated_at` advanced
  on `save()`, `date` columns returned as `'YYYY-MM-DD'` strings.
- §6.3 ✓ — `migration:revert` dropped both tables and both enum types.
  Note: TypeORM's own `migrations` bookkeeping table survives revert — that's
  the CLI's ledger, not schema; expected.
- §6.4 ✓ — post-apply `migration:generate` reports "No changes in database
  schema were found"; no stray file created.
- §6.5 ✓ — `password` absent from default `find()`; retrievable via
  `addSelect` (returned the inserted value).
- §6.6 ✓ — `npm run dev` boots, `GET /hello` returns 200.
- §6.7 ✓ — `tsc --noEmit` and `npm run lint` both pass.

**Discoveries for later chunks (no deviations from §1–8):**

- The CLI itself runs `CREATE EXTENSION IF NOT EXISTS "pgcrypto"` when it
  connects — extension creation is *not* inside the migration file. Harmless:
  `gen_random_uuid()` is Postgres core since v13, so the migration works on a
  fresh clone's PG16 with or without the extension.
- CEF's alias resolution logs the full `DATABASE_URL` (credentials included)
  on every CLI invocation — fine for local dev creds, but worth remembering
  if real credentials ever appear in an environment. Candidate for the
  known-limitations draft, not fixed here (out of scope).
- Files touched matched the §7 advisory list exactly; migration filename is
  `1785239525809-InitialSchema.ts`, class `InitialSchema1785239525809`,
  registered in `cliDataSource` by explicit import per §4.

**2026-07-28 — /spec-check adjudication.** The audit flagged four
implemented-but-unspecified details; process failure acknowledged — each
should have been asked *before* implementation (implementation-mode rule).
Human ruled on all four:

1. `logging: true` on `cliDataSource` — **accepted as-is.** Mirrors runtime
   config; SQL visibility during migrations is a feature locally. Note for a
   later chunk: seed inserts through this DataSource will log their
   parameters (bcrypt hashes) — revisit if logging config ever matters.
2. `DATABASE_URL ?? ""` — **accepted, refined.** Kept the never-reject-at-
   import mechanism, added a `console.warn` inside the `.then` when the
   variable is missing, so a missing `.env` produces a named, early message
   instead of only a cryptic pg connection error at `initialize()`.
   Gates re-run after the change: tsc ✓ lint ✓ `migration:show` ✓.
3. Shared `ENTITIES` / `UUID_EXTENSION` consts — **accepted as-is.** Keeps
   the two DataSource configs incapable of entity-list drift, which would
   silently corrupt `migration:generate` diffs.
4. ORM-level `updated_at` (no DB trigger) — **accepted as-is**, inherent to
   the §5-specified `@UpdateDateColumn`. Standing constraint for chunk 4.4+:
   commands mutate `vacation_requests` only through ORM save/update paths,
   never raw SQL, or `updated_at` silently stops advancing.
