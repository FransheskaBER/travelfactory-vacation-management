# Product Requirements Document — Vacation Management Interface

Scope: what is being built and why. Requirement *interpretations* and their rationale live in `assumptions.md`. Engineering *decisions* (how it's built) live in `docs/adr/`. This document does not duplicate either — it states the resulting requirements.

---

## 1. Overview

This document defines the requirements for the Vacation Management Interface: an internal system for employees to submit vacation requests and for managers to review, approve, or reject them. It replaces manual, ad-hoc tracking (email threads, spreadsheets) with a single source of truth for request status, approval history, and team availability.

---

## 2. Target Users / Roles

- **Requester** (any employee): submits vacation requests; views their own request history and status; views a shared calendar of approved requests across all employees.
- **Validator** (manager): reviews all requests on a dashboard, including who reviewed each one; filters by status (Pending, Approved, Rejected) and by user; paginated; approves or rejects; rejection requires a comment. Any validator can see any request's comment — no per-validator restriction.

---

## 3. Solution Overview

A two-interface web application: a Requester view for submitting and tracking vacation requests, and a Validator view for reviewing, filtering, and deciding on them. Authentication is role-based (JWT), enforced server-side — the frontend never self-declares permissions. The domain layer enforces all business rules (overlap, immutability, date validity) independent of the UI.

---

## 4. In Scope — Features per Interface

### 4.0 Authentication (shared prerequisite)

**US-1:** As an employee, I want to log in with my email and password, so that I can access only the interface and data permitted by my role.

Acceptance criteria:
- `POST /login` with email + password → JWT on success, `401` on invalid credentials.
- JWT encodes `user_id` and `role`; role is read server-side from `users.role` at login — never client-supplied.
- Protected routes: no/invalid token → `401`; valid token, wrong role → `403`.
- Frontend routing branches on the decoded JWT role. No role selector anywhere in the UI.

### 4.1 Requester Interface

**US-2:** As a Requester, I want to submit a vacation request with a start date, end date, and optional reason, so that my time off is recorded and routed for approval.

Acceptance criteria:
- Required: `start_date`, `end_date`. Optional: `reason`.
- Reject if `end_date < start_date` (single-day requests allowed: `end_date >= start_date`).
- Reject if `start_date` is strictly before today, checked server-side (UTC). Client-side date-picker restriction is UX only, not enforcement.
- Reject if the new range overlaps an existing **Pending or Approved** request for the same user; Rejected requests never block.
- On success: created with `status = Pending`.
- Emits `VacationRequestCreatedEvent` after commit, with a logging listener.
- All validation failures return the shared error shape `{ error: { code, message } }`.

**US-3:** As a Requester, I want to see a list of my own submitted requests with their current status, so that I can track what's pending, approved, or rejected.

Acceptance criteria:
- Scoped server-side to the authenticated user's `user_id` from the JWT — never a client-supplied param.
- Shows status, start/end dates, reason.
- Rejected entries include the rejection comment.
- Unpaginated (list is naturally small — scoped to one user).

**US-4:** As a Requester or Validator, I want to see a list of approved vacation requests across all employees, grouped by month, so that I can plan around teammates' time off.

Acceptance criteria:
- Approved only — Pending/Rejected never exposed here.
- Visible to both roles.
- Fields shown: requester name + date range only. No `reason` surfaced (privacy).
- Grouped under month headers, sorted chronologically — a grouped list, not a custom calendar-grid component (deliberate scope trade-off; the assignment prioritizes usability over visual creativity).
- No color-coding by requester.

### 4.2 Validator Interface

**US-5:** As a Validator, I want a paginated dashboard of all vacation requests, filterable by status and by user, so that I can efficiently review the team's requests.

Acceptance criteria:
- Validator-only endpoint — a Requester hitting it gets `403`.
- Returns requests across all employees.
- Filters: status (Pending, Approved, or Rejected) and user, combinable.
- Paginated at 10 per page; response includes total count for page controls; a page past the last result returns an empty array, not an error.
- Each row: requester name, date range, reason, status, and who reviewed it (blank for Pending).
- Default sort: most recently submitted first.

**US-6:** As a Validator, I want to approve a pending request, so that the employee's time off is confirmed.

Acceptance criteria:
- Only legal from `status = Pending`; any other status → `409 Conflict`.
- Sets `status = Approved`, records who approved it, updates the timestamp.
- Emits `VacationRequestApprovedEvent` after commit.

**US-7:** As a Validator, I want to reject a pending request with a required comment, so the employee knows why.

Acceptance criteria:
- Same Pending-only guard, same `409` on illegal transition.
- `comment` required in the body; missing/empty → `400`.
- Sets `status = Rejected`, stores the comment, records who rejected it, updates the timestamp.
- Emits `VacationRequestRejectedEvent` after commit.
- Comment visible to any validator afterward — no per-validator restriction.

---

## 5. Business Rules

1. End date must be after start date — relaxed to `end_date >= start_date`; both dates inclusive, date-only granularity.
2. Vacation requests cannot overlap for the same user — Pending and Approved block; Rejected does not.
3. Approved requests cannot be modified — enforced through a one-way status transition (Pending → Approved/Rejected only); both terminal states are frozen.
4. Requests in the past are not allowed — "past" means strictly before today, compared against server date (UTC).
5. A rejected request must contain a rejection comment.
6. Only validators can approve or reject requests.

*(Full rationale and resolved ambiguities for each rule are in `assumptions.md`.)*

---

## 6. Out of Scope

- Editing or cancelling a request in any status. Correction path: validator rejects, employee submits a new request.
- Comment on approval — comments exist only for rejection.
- Pagination of the requester's own request list — naturally small, scoped to one user.
- Business-timezone handling for "today" — UTC used instead of the company's local timezone.
- Full calendar-grid UI for team vacation planning — implemented as a grouped-by-month list instead.
- `reason` field on the shared team-vacations view — excluded for privacy; visible only on the requester's own list.
- Per-validator restriction on rejection-comment visibility — any validator can see any request's comment; no field-level authorization built.

---

## 7. Functional Definition of Done

Pass/fail criteria per business rule. Enforcement location, test coverage, and implementation detail live in `tdd.md` and the Phase 5 verification checklist — this table states outcomes, not mechanisms.

| Rule | Pass condition | Fail condition |
|---|---|---|
| 1. Date ordering | `end_date >= start_date` succeeds | `end_date < start_date` fails |
| 2. No overlap | Range overlapping an existing Rejected request succeeds | Range overlapping an existing Pending/Approved request for the same user fails |
| 3. Approved immutable | Approve/reject on a Pending request succeeds | Approve/reject on a non-Pending request fails |
| 4. No past dates | `start_date` today or later succeeds | `start_date` before today (server UTC) fails |
| 5. Rejection requires comment | Reject with a non-empty comment succeeds | Reject without a comment fails |
| 6. Validator-only actions | Validator calling approve/reject succeeds | Requester calling approve/reject fails with `403` |

This maps to the assignment's own evaluation categories (Code Quality, Architecture, Functionality, Database Design, Documentation) — Functionality is verified directly against this table.
