import { Command } from "../bus/CommandBus";
import { NotFoundError } from "../../errors/DomainError";
import { eventDispatcher } from "../events/EventDispatcher";
import { VacationRequestApprovedEvent } from "../events/VacationRequestApprovedEvent";
import {
  VacationRequest,
  VacationRequestStatus,
} from "../../entities/VacationRequest";
import { VacationRequestRepository } from "../../repositories/VacationRequestRepository";
import { assertPending } from "./assertPending";

export interface ApproveVacationRequestInput {
  id: string;
  actorId: string; // verified validator id, merged by requireRole (spec 4.2 §4)
}

export class ApproveVacationRequestCommand
  implements Command<ApproveVacationRequestInput, VacationRequest>
{
  constructor(private readonly deps: { requests: VacationRequestRepository }) {}

  async execute(input: ApproveVacationRequestInput): Promise<VacationRequest> {
    const request = await this.deps.requests.findOneBy(input.id);
    if (!request) {
      throw new NotFoundError("REQUEST_NOT_FOUND", "Vacation request not found");
    }
    assertPending(request);

    request.status = VacationRequestStatus.Approved;
    request.reviewedBy = input.actorId;
    const saved = await this.deps.requests.save(request);
    // Emitted only after save resolves — the commit point. Awaited, and
    // emit never rejects: listeners react, never gate (ADR 0001, spec 4.5 §4).
    await eventDispatcher.emit(new VacationRequestApprovedEvent(saved));
    return saved;
  }
}
