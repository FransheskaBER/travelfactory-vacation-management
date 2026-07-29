import { beforeEach, describe, expect, it } from "vitest";
import { CreateVacationRequestCommand } from "./CreateVacationRequestCommand";
import { FakeVacationRequestRepository } from "../../repositories/FakeVacationRequestRepository";
import { VacationRequestStatus } from "../../entities/VacationRequest";
import { ConflictError, ValidationError } from "../../errors/DomainError";
import { expectDomainError, isoDaysFromToday } from "./testSupport";

/**
 * Phase 5 — Business Rules 1, 4, 2 (PRD §5), enforced by
 * CreateVacationRequestCommand. Expectations derive from the rule text and
 * the PRD §7 pass/fail table, not from the implementation.
 *
 * Rule 1: "End date must be after start date — relaxed to
 *   `end_date >= start_date`; both dates inclusive, date-only granularity."
 * Rule 4: "Requests in the past are not allowed — 'past' means strictly
 *   before today, compared against server date (UTC)."
 * Rule 2: "Vacation requests cannot overlap for the same user — Pending and
 *   Approved block; Rejected does not."
 */
describe("CreateVacationRequestCommand", () => {
  let requests: FakeVacationRequestRepository;
  let command: CreateVacationRequestCommand;

  const requester = "requester-1";

  beforeEach(() => {
    requests = new FakeVacationRequestRepository();
    command = new CreateVacationRequestCommand({ requests });
  });

  describe("Rule 1 — date ordering (end_date >= start_date)", () => {
    it("accepts end_date after start_date", async () => {
      const saved = await command.execute({
        actorId: requester,
        startDate: isoDaysFromToday(10),
        endDate: isoDaysFromToday(12),
      });

      expect(saved.startDate).toBe(isoDaysFromToday(10));
      expect(saved.endDate).toBe(isoDaysFromToday(12));
      expect(requests.get(saved.id)).toBeDefined();
    });

    it("accepts end_date equal to start_date (rule relaxed to >=)", async () => {
      const day = isoDaysFromToday(10);

      const saved = await command.execute({
        actorId: requester,
        startDate: day,
        endDate: day,
      });

      expect(requests.get(saved.id)).toBeDefined();
    });

    it("rejects end_date before start_date with INVALID_DATE_RANGE and writes nothing", async () => {
      await expectDomainError(
        command.execute({
          actorId: requester,
          startDate: isoDaysFromToday(10),
          endDate: isoDaysFromToday(9),
        }),
        ValidationError,
        "INVALID_DATE_RANGE"
      );

      expect(requests.count()).toBe(0);
    });
  });

  describe("Rule 4 — no requests in the past (strictly before today, UTC)", () => {
    it("accepts start_date of exactly today (today is not 'past')", async () => {
      const saved = await command.execute({
        actorId: requester,
        startDate: isoDaysFromToday(0),
        endDate: isoDaysFromToday(2),
      });

      expect(requests.get(saved.id)).toBeDefined();
    });

    it("rejects start_date of yesterday with START_DATE_IN_PAST and writes nothing", async () => {
      await expectDomainError(
        command.execute({
          actorId: requester,
          startDate: isoDaysFromToday(-1),
          endDate: isoDaysFromToday(2),
        }),
        ValidationError,
        "START_DATE_IN_PAST"
      );

      expect(requests.count()).toBe(0);
    });
  });

  describe("Rule 2 — no overlap for the same user (Pending/Approved block, Rejected does not)", () => {
    const seedExisting = (status: VacationRequestStatus, userId = requester) =>
      requests.seed({
        userId,
        startDate: isoDaysFromToday(10),
        endDate: isoDaysFromToday(14),
        status,
      });

    it("rejects a range overlapping an existing Pending request with OVERLAPPING_REQUEST", async () => {
      seedExisting(VacationRequestStatus.Pending);

      await expectDomainError(
        command.execute({
          actorId: requester,
          startDate: isoDaysFromToday(12),
          endDate: isoDaysFromToday(16),
        }),
        ConflictError,
        "OVERLAPPING_REQUEST"
      );

      expect(requests.count()).toBe(1);
    });

    it("rejects a range overlapping an existing Approved request with OVERLAPPING_REQUEST", async () => {
      seedExisting(VacationRequestStatus.Approved);

      await expectDomainError(
        command.execute({
          actorId: requester,
          startDate: isoDaysFromToday(12),
          endDate: isoDaysFromToday(16),
        }),
        ConflictError,
        "OVERLAPPING_REQUEST"
      );

      expect(requests.count()).toBe(1);
    });

    it("rejects a range that only touches an existing Pending request's boundary day (dates inclusive)", async () => {
      seedExisting(VacationRequestStatus.Pending);

      await expectDomainError(
        command.execute({
          actorId: requester,
          startDate: isoDaysFromToday(14),
          endDate: isoDaysFromToday(18),
        }),
        ConflictError,
        "OVERLAPPING_REQUEST"
      );
    });

    it("accepts a range overlapping an existing Rejected request (Rejected does not block)", async () => {
      seedExisting(VacationRequestStatus.Rejected);

      const saved = await command.execute({
        actorId: requester,
        startDate: isoDaysFromToday(12),
        endDate: isoDaysFromToday(16),
      });

      expect(requests.get(saved.id)).toBeDefined();
      expect(requests.count()).toBe(2);
    });

    it("accepts a range overlapping another user's Pending request (rule scoped to the same user)", async () => {
      seedExisting(VacationRequestStatus.Pending, "requester-2");

      const saved = await command.execute({
        actorId: requester,
        startDate: isoDaysFromToday(12),
        endDate: isoDaysFromToday(16),
      });

      expect(requests.get(saved.id)).toBeDefined();
    });

    it("accepts a disjoint range for the same user", async () => {
      seedExisting(VacationRequestStatus.Pending);

      const saved = await command.execute({
        actorId: requester,
        startDate: isoDaysFromToday(20),
        endDate: isoDaysFromToday(22),
      });

      expect(requests.get(saved.id)).toBeDefined();
    });
  });
});
