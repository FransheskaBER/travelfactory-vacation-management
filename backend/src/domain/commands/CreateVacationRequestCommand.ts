import { Command } from "../bus/CommandBus";
import { ConflictError, ValidationError } from "../../errors/DomainError";
import { eventDispatcher } from "../events/EventDispatcher";
import { VacationRequestCreatedEvent } from "../events/VacationRequestCreatedEvent";
import {
  VacationRequest,
  VacationRequestStatus,
} from "../../entities/VacationRequest";
import { VacationRequestRepository } from "../../repositories/VacationRequestRepository";

export interface CreateVacationRequestInput {
  actorId: string; // verified requester id, merged by requireRole (spec 4.2 §4)
  startDate: string; // 'YYYY-MM-DD'
  endDate: string; // 'YYYY-MM-DD'
  reason?: string | null;
}

// 'YYYY-MM-DD' strings sort lexicographically in chronological order, so
// plain string comparison is the entire date engine (spec 4.1 §5 note).
// "Today" is the server's UTC date (A5) — the parser owns format, this
// command owns meaning (spec 4.4 §8 Q6).
const todayUtc = (): string => new Date().toISOString().slice(0, 10);

export class CreateVacationRequestCommand
  implements Command<CreateVacationRequestInput, VacationRequest>
{
  constructor(private readonly deps: { requests: VacationRequestRepository }) {}

  async execute(input: CreateVacationRequestInput): Promise<VacationRequest> {
    // Rule 1 (A2): inclusive range, so equal dates — a one-day vacation —
    // are legal; only an inverted range is not.
    if (input.endDate < input.startDate) {
      throw new ValidationError(
        "INVALID_DATE_RANGE",
        "endDate must not be before startDate"
      );
    }

    // Rule 4 (A5/A6): "past" means strictly before today — starting today
    // is allowed.
    if (input.startDate < todayUtc()) {
      throw new ValidationError(
        "START_DATE_IN_PAST",
        "startDate must not be in the past"
      );
    }

    // Rule 2 (A3/A4): checked last so invalid input never costs a query.
    const overlapping = await this.deps.requests.findOverlapping(
      input.actorId,
      input.startDate,
      input.endDate
    );
    if (overlapping.length > 0) {
      throw new ConflictError(
        "OVERLAPPING_REQUEST",
        "An overlapping vacation request already exists"
      );
    }

    const request = new VacationRequest();
    request.userId = input.actorId;
    request.startDate = input.startDate;
    request.endDate = input.endDate;
    request.reason = input.reason ?? null;
    // Explicit rather than left to the DB default: the returned entity must
    // be complete without a reload (spec 4.4 §4).
    request.status = VacationRequestStatus.Pending;
    const saved = await this.deps.requests.save(request);
    // Emitted only after save resolves — the commit point. Awaited, and
    // emit never rejects: listeners react, never gate (ADR 0001, spec 4.5 §4).
    await eventDispatcher.emit(new VacationRequestCreatedEvent(saved));
    return saved;
  }
}
