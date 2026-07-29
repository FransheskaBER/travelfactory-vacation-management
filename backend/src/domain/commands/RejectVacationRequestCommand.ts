import { Command } from "../bus/CommandBus";
import { NotFoundError, ValidationError } from "../../errors/DomainError";
import { eventDispatcher } from "../events/EventDispatcher";
import { VacationRequestRejectedEvent } from "../events/VacationRequestRejectedEvent";
import {
  VacationRequest,
  VacationRequestStatus,
} from "../../entities/VacationRequest";
import { VacationRequestRepository } from "../../repositories/VacationRequestRepository";
import { assertPending } from "./assertPending";

export interface RejectVacationRequestInput {
  id: string;
  actorId: string; // verified validator id, merged by requireRole (spec 4.2 §4)
  comment: string;
}

export class RejectVacationRequestCommand
  implements Command<RejectVacationRequestInput, VacationRequest>
{
  constructor(private readonly deps: { requests: VacationRequestRepository }) {}

  async execute(input: RejectVacationRequestInput): Promise<VacationRequest> {
    const request = await this.deps.requests.findOneBy(input.id);
    if (!request) {
      throw new NotFoundError("REQUEST_NOT_FOUND", "Vacation request not found");
    }
    assertPending(request);

    // Rule 5 (§8 Q7): the trim defines validity, so the trimmed value is
    // also what gets stored.
    const comment = input.comment.trim();
    if (comment.length === 0) {
      throw new ValidationError(
        "COMMENT_REQUIRED",
        "comment must not be empty"
      );
    }

    request.status = VacationRequestStatus.Rejected;
    request.comments = comment;
    request.reviewedBy = input.actorId;
    const saved = await this.deps.requests.save(request);
    // Emitted only after save resolves — the commit point. Awaited, and
    // emit never rejects: listeners react, never gate (ADR 0001, spec 4.5 §4).
    await eventDispatcher.emit(new VacationRequestRejectedEvent(saved));
    return saved;
  }
}
