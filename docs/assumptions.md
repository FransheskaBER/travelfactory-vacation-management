# Assumptions & Requirement Interpretations

Every ambiguity found in the assignment, with my resolution and rationale.
Referenced from README → Technical Decisions. Engineering decisions (how to build) live in `docs/adr/` — this file only covers what the requirements *mean*.

| # | Ambiguity | Resolution | Rationale |
|---|-----------|------------|-----------|
| A1 | "Team vacation planning available for two roles" — feature is underspecified | One shared page/component showing **approved** requests for all users, visible to both roles | Underspecified requirement, documented as an assumption. Approved-only avoids exposing pending/rejected details; a shared component demonstrates frontend reuse |
| A2 | Rule 1 says end date must be **after** start date — read literally, this forbids a one-day vacation | Relax to `end_date >= start_date`; both dates are inclusive calendar days, **date-only granularity (no timestamps)** | The literal wording forbids single-day requests, which no vacation system intends — it's sloppy wording, not a business decision. Timestamps would import a whole class of timezone/DST bugs the day-granular domain doesn't need |
| A3 | Rule 2: is an adjacent request that shares one boundary day an "overlap"? (e.g. Aug 21–25 and Aug 25–26) | Yes — sharing a day is a genuine overlap. Test: `newStart <= existingEnd AND newEnd >= existingStart` | With inclusive dates (A2), the shared day is requested off twice — the exact state Rule 2 prevents. The boundary answer is forced by A2, not a separate convention |
| A4 | Rule 2: which statuses block a new overlapping request? | **Pending and Approved block; Rejected does not** | Pending must block at submission: if two overlapping pendings could coexist, the validator could approve both, creating double-approved dates. Blocking at submission keeps approval a safe single-step operation. Rejected frees the dates so the employee can submit a corrected request |
| A5 | Rule 4: what is "today"? (reference clock / timezone) | Compare against **server date (UTC)**, enforced server-side inside the command. Frontend calendar hides past dates as UX only | The client can never enforce business rules — a date picker is bypassed with curl in seconds. UTC edge (Tel Aviv/Paris evening vs server date) noted in Known Limitations; production would use the business timezone (Europe/Paris) |
| A6 | Rule 4: is `start_date == today` allowed? | Yes — "past" means strictly before today | Requests "from today onward" are not in the past; forbidding same-day requests would be a new rule the assignment doesn't state |
| A7 | Rule 3 says approved requests "cannot be modified" — but the API surface contains **no edit or delete endpoint at all** | Requests are **immutable after creation** for all roles and all statuses. Correction path: ask the validator to reject, then submit a new request | Half of Rule 3 is enforced by omission — no modify operation exists for anyone. The rule therefore governs the operations that *do* exist: the approve/reject status transitions (A8). The reject-then-resubmit path works because Rejected doesn't block (A4) |
| A8 | Which status transitions are legal, and what does the API return for illegal ones? | State machine: **Pending → Approved** and **Pending → Rejected** only. Both terminal states frozen. Guard in both commands: `if (status !== 'Pending') → 409 Conflict` | Allowing only the two legal arrows (whitelist) enforces every illegal transition at once — no double-approve, no reject-after-approve, no un-reject. 409 because request and auth are valid but the resource's current state forbids the operation (vs 400/403) |
| A9 | Should employees be able to edit or cancel a request (esp. while Pending)? | **Out of scope.** No such endpoint exists in the assignment; listed in README under "what I'd do with more time" | Evaluation criterion is "requirements fully implemented," not exceeded. Editing a Rejected request in place would also rewrite the record a manager's rejection comment refers to, destroying the audit trail |
| A10 | Validator "filter by user" — mechanism unspecified | API filters by exact `user_id` (`?userId=`). UI: client-side type-ahead combobox over a validator-only `GET /users` list, displaying names | Names are neither unique nor stable, so the API contract uses the one permanent identifier. Type-ahead gives name-based UX without server-side search. The contract stays fixed at any scale — at large user counts only the combobox internals swap to a server-side name lookup |
| A11 | Pagination is mandated only for the validator dashboard — requester list too? | **Validator list only**, per spec. Requester's own list unpaginated; noted in Known Limitations | A requester's own request list is naturally small; paginating it adds unrequested UI work with no evaluation value |
| A12 | `comments` column semantics — thread? comment on approve? | Single comment string (not a thread), written **only on rejection**. Approve has no comment field | The schema provides one text column and the spec requires a comment only when rejecting; anything more is unrequested surface area |
| A13 | *(number intentionally left unused — skipped during drafting; documenting the gap rather than silently renumbering A14–A16 after they were already presented)* | — | — |
| A14 | "Team vacation planning" (A1) — what fields display, and in what UI form? | Approved-only, grouped-by-month list showing requester name + date range; `reason` excluded | `reason` may carry personal detail with no stated need for company-wide visibility (same privacy logic as A1's approved-only scoping). Full calendar-grid UI traded for a grouped list given the assignment's explicit "usability over visual creativity" priority — real added frontend complexity (month-navigation state, multi-day span calculation) the eval criteria don't reward |
| A15 | Validator dashboard — default sort order when none is specified? | Most recently submitted first (`created_at desc`) | Low-stakes UX default; easy to change later, doesn't affect the correctness of any business rule |
| A16 | Do US-2 (submit) / US-3 (list mine) require the Requester role specifically, or just "any authenticated user"? Only Rule 6 explicitly gates by role (approve/reject) | **Requester role specifically** | Not a schema constraint — nothing in the data model prevents a Validator's `user_id` from appearing on a `VacationRequest`; this is a deliberate policy choice. Opening this endpoint to any role would let a Validator submit their own request, and `assertPending()` only checks `status`, never `reviewer !== requester` — so a Validator could approve their own request with zero guard against it. Rather than build and test a self-approval check the assignment never asks for, this is resolved conservatively: Requester-only. See Known Limitations |

## Business rules (verbatim from assignment — numbering fixed, referenced by the Phase 5 verification matrix)

1. End date must be after start date. *(interpreted per A2)*
2. Vacation requests cannot overlap for the same user. *(per A3, A4)*
3. Approved requests cannot be modified. *(per A7, A8)*
4. Requests in the past are not allowed. *(per A5, A6)*
5. A rejected request must contain a rejection comment.
6. Only validators can approve or reject requests.

## Out of scope (deliberate — also in README "what I'd do with more time")

- Edit/cancel of requests in any status (A9)
- Comment on approval (A12)
- Pagination of requester's own list (A11)
- Business-timezone handling for "today" (A5 — UTC used)
- Full calendar-grid UI for team vacation planning (A14 — grouped list instead)
- `reason` field on the shared team-vacations view (A14 — excluded for privacy)
- Per-validator restriction on rejection-comment visibility — any validator can see any request's comment (decided in session; no field-level authorization built)
- A Validator submitting or self-approving their own vacation request — deliberately not built; see A16 and Known Limitations
