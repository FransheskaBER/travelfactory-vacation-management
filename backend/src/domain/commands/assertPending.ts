import { ConflictError } from "../../errors/DomainError";
import {
  VacationRequest,
  VacationRequestStatus,
} from "../../entities/VacationRequest";

/**
 * Rule 3's whitelist (A8): Pending → Approved and Pending → Rejected are the
 * only legal transitions, so refusing every action on a non-Pending request
 * enforces all illegal transitions at once. Shared by both reviewing
 * commands (ADR 0004).
 */
export function assertPending(request: VacationRequest): void {
  if (request.status !== VacationRequestStatus.Pending) {
    throw new ConflictError("REQUEST_NOT_PENDING", "Request is not pending");
  }
}
