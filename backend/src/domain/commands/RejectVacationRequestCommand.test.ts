import { beforeEach, describe, expect, it } from "vitest";
import { RejectVacationRequestCommand } from "./RejectVacationRequestCommand";
import { FakeVacationRequestRepository } from "../../repositories/FakeVacationRequestRepository";
import { VacationRequestStatus } from "../../entities/VacationRequest";
import { ConflictError, ValidationError } from "../../errors/DomainError";
import { expectDomainError, isoDaysFromToday } from "./testSupport";

/**
 * Phase 5 — Business Rules 3 (reject side) and 5 (PRD §5), enforced by
 * RejectVacationRequestCommand.
 *
 * Rule 3: "Approved requests cannot be modified — enforced through a one-way
 *   status transition (Pending → Approved/Rejected only); both terminal
 *   states are frozen."
 * Rule 5: "A rejected request must contain a rejection comment."
 */
describe("RejectVacationRequestCommand", () => {
  let requests: FakeVacationRequestRepository;
  let command: RejectVacationRequestCommand;

  const validator = "validator-1";

  const seedWithStatus = (status: VacationRequestStatus) =>
    requests.seed({
      userId: "requester-1",
      startDate: isoDaysFromToday(10),
      endDate: isoDaysFromToday(14),
      status,
    });

  beforeEach(() => {
    requests = new FakeVacationRequestRepository();
    command = new RejectVacationRequestCommand({ requests });
  });

  describe("Rule 3 — one-way status transition", () => {
    it("rejects a Pending request (Pending → Rejected is an allowed transition)", async () => {
      const pending = seedWithStatus(VacationRequestStatus.Pending);

      const updated = await command.execute({
        id: pending.id,
        actorId: validator,
        comment: "Team is at capacity that week",
      });

      expect(updated.status).toBe(VacationRequestStatus.Rejected);
      expect(requests.get(pending.id)?.status).toBe(VacationRequestStatus.Rejected);
    });

    it("refuses rejecting an Approved request with REQUEST_NOT_PENDING (terminal state is frozen)", async () => {
      const approved = seedWithStatus(VacationRequestStatus.Approved);
      const before = { ...approved };

      await expectDomainError(
        command.execute({
          id: approved.id,
          actorId: validator,
          comment: "Trying to reject an approved request",
        }),
        ConflictError,
        "REQUEST_NOT_PENDING"
      );

      expect(requests.get(approved.id)).toEqual(before);
    });

    it("refuses rejecting a Rejected request with REQUEST_NOT_PENDING (terminal state is frozen)", async () => {
      const rejected = seedWithStatus(VacationRequestStatus.Rejected);
      const before = { ...rejected };

      await expectDomainError(
        command.execute({
          id: rejected.id,
          actorId: validator,
          comment: "Second rejection attempt",
        }),
        ConflictError,
        "REQUEST_NOT_PENDING"
      );

      expect(requests.get(rejected.id)).toEqual(before);
    });
  });

  describe("Rule 5 — a rejected request must contain a rejection comment", () => {
    it("rejects with a non-empty comment and stores it on the request", async () => {
      const pending = seedWithStatus(VacationRequestStatus.Pending);

      const updated = await command.execute({
        id: pending.id,
        actorId: validator,
        comment: "Overlaps with the audit period",
      });

      expect(updated.status).toBe(VacationRequestStatus.Rejected);
      expect(updated.comments).toBe("Overlaps with the audit period");
    });

    it("refuses an empty comment with COMMENT_REQUIRED and leaves the request Pending", async () => {
      const pending = seedWithStatus(VacationRequestStatus.Pending);

      await expectDomainError(
        command.execute({ id: pending.id, actorId: validator, comment: "" }),
        ValidationError,
        "COMMENT_REQUIRED"
      );

      expect(requests.get(pending.id)?.status).toBe(VacationRequestStatus.Pending);
    });

    it("refuses a whitespace-only comment with COMMENT_REQUIRED (blank contains no comment)", async () => {
      const pending = seedWithStatus(VacationRequestStatus.Pending);

      await expectDomainError(
        command.execute({ id: pending.id, actorId: validator, comment: "   " }),
        ValidationError,
        "COMMENT_REQUIRED"
      );

      expect(requests.get(pending.id)?.status).toBe(VacationRequestStatus.Pending);
    });
  });
});
