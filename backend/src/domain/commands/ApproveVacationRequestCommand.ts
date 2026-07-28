import { Command } from "../bus/CommandBus";
import { NotFoundError } from "../../errors/DomainError";
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
    return this.deps.requests.save(request);
  }
}
