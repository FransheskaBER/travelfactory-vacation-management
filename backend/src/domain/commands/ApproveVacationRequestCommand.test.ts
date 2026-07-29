import { beforeEach, describe, expect, it } from "vitest";
import { ApproveVacationRequestCommand } from "./ApproveVacationRequestCommand";
import { FakeVacationRequestRepository } from "../../repositories/FakeVacationRequestRepository";
import { VacationRequestStatus } from "../../entities/VacationRequest";
import { ConflictError } from "../../errors/DomainError";
import { expectDomainError, isoDaysFromToday } from "./testSupport";

/**
 * Phase 5 — Business Rule 3 (PRD §5), approve side:
 * "Approved requests cannot be modified — enforced through a one-way status
 * transition (Pending → Approved/Rejected only); both terminal states are
 * frozen." PRD §7: approve on a Pending request succeeds; approve on a
 * non-Pending request fails.
 */
describe("ApproveVacationRequestCommand", () => {
  let requests: FakeVacationRequestRepository;
  let command: ApproveVacationRequestCommand;

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
    command = new ApproveVacationRequestCommand({ requests });
  });

  describe("Rule 3 — one-way status transition", () => {
    it("approves a Pending request (Pending → Approved is an allowed transition)", async () => {
      const pending = seedWithStatus(VacationRequestStatus.Pending);

      const updated = await command.execute({ id: pending.id, actorId: validator });

      expect(updated.status).toBe(VacationRequestStatus.Approved);
      expect(requests.get(pending.id)?.status).toBe(VacationRequestStatus.Approved);
    });

    it("rejects approving an Approved request with REQUEST_NOT_PENDING (terminal state is frozen)", async () => {
      const approved = seedWithStatus(VacationRequestStatus.Approved);
      const before = { ...approved };

      await expectDomainError(
        command.execute({ id: approved.id, actorId: validator }),
        ConflictError,
        "REQUEST_NOT_PENDING"
      );

      expect(requests.get(approved.id)).toEqual(before);
    });

    it("rejects approving a Rejected request with REQUEST_NOT_PENDING (no Rejected → Approved path)", async () => {
      const rejected = seedWithStatus(VacationRequestStatus.Rejected);
      const before = { ...rejected };

      await expectDomainError(
        command.execute({ id: rejected.id, actorId: validator }),
        ConflictError,
        "REQUEST_NOT_PENDING"
      );

      expect(requests.get(rejected.id)).toEqual(before);
    });
  });
});
