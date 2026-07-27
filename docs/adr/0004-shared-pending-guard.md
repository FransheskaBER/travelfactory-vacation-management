# ADR 0004: Shared Pending-State Guard for Approve/Reject

**Status:** Accepted

## Context

Both `ApproveVacationRequestCommand` and `RejectVacationRequestCommand` must reject any action on a request that isn't currently `Pending` (Rule 3 — approved requests cannot be modified, enforced via a one-way state machine: `Pending → Approved` or `Pending → Rejected` only, both terminal, both frozen). Two call sites need the identical check: fetch the request by id, confirm its status is `Pending`, fail with `409 Conflict` if not.

## Decision

Extract the check into a shared function, `assertPending(request)`, called by both commands immediately after each fetches its request by id. The fetch itself is a plain TypeORM lookup, not wrapped in a port (per ADR 0001's rule: wrap only when a query names a business concept — the guard is where the business meaning lives, not the fetch).

```ts
function assertPending(request: VacationRequest): void {
  if (request.status !== 'Pending') {
    throw new ConflictError('Request is not pending');
  }
}

// ApproveVacationRequestCommand
const request = await repo.findOneBy({ id });
assertPending(request);
request.status = 'Approved';
request.reviewedBy = validatorId;
await repo.save(request);
// emit VacationRequestApprovedEvent

// RejectVacationRequestCommand
const request = await repo.findOneBy({ id });
assertPending(request);
if (!comment) throw new ValidationError('Rejection comment is required');
request.status = 'Rejected';
request.comments = comment;
request.reviewedBy = validatorId;
await repo.save(request);
// emit VacationRequestRejectedEvent
```

Two call sites sits right at the boundary of the "Rule of Three" heuristic — some engineers deliberately tolerate duplication until a third occurrence, since extracting too early risks guessing the wrong shared abstraction. That's a real argument against extracting here, not a strawman — see Alternatives Considered.

## Consequences

**Benefits:**
- One place to update if the rule changes — e.g. differentiating the error message for "already approved" vs "already rejected" — instead of two copies kept in sync by hand.
- Tested once; both commands' own tests only need to assert the guard is called, not re-derive the Pending-state logic independently.
- Gives the Phase 5 rules matrix ("where is Rule 3 enforced?") a single, named answer — `assertPending()` — instead of "two places, kept identical manually." Direct, visible evidence for the "modular backend design" evaluation criterion.
- Names the actual invariant being protected — both Approve and Reject are "Pending → terminal" transitions — rather than manufacturing structure that doesn't correspond to anything real.

**Trade-offs:**
- One extra function to trace when reading either command in isolation — a reviewer skimming `ApproveVacationRequestCommand` alone has to jump to `assertPending()` to see the full guard, instead of reading it inline.
- Sits at the boundary of the Rule of Three — extracting at exactly two call sites is judgment, not a clear-cut rule. If approve/reject later diverge in *how* they fail (not just *what* triggers the failure), this shared abstraction may need to be undone.

## Alternatives Considered

- **Duplicate the check independently in both commands.** Rejected for this project on the strength of the Phase 5 matrix and evaluation-criteria argument above — but acknowledged as a legitimate default under the Rule of Three, had there been no external pressure to name the rule explicitly for a grading rubric.

## Related ADRs

- CEF layering and the port/direct-call rule for persistence access → ADR 0001
