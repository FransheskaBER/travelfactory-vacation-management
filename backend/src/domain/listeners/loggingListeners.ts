import { VacationRequest } from "../../entities/VacationRequest";
import { eventDispatcher } from "../events/EventDispatcher";
import { VacationRequestApprovedEvent } from "../events/VacationRequestApprovedEvent";
import { VacationRequestCreatedEvent } from "../events/VacationRequestCreatedEvent";
import { VacationRequestRejectedEvent } from "../events/VacationRequestRejectedEvent";

// One single-line JSON object per event (spec 4.5 §5). The field set is
// frozen: only structured, validated, non-free-text values — free text of
// any author (`reason`, `comments`) never crosses into a log line; the
// requestId points at the governed store where that text lives (§8 Q9).
const logLine = (
  event: string,
  request: VacationRequest,
  fields: Record<string, string | null>
): void => {
  console.info(
    JSON.stringify({
      event,
      requestId: request.id,
      userId: request.userId,
      ...fields,
    })
  );
};

// Called once from index.ts at startup — explicit registration, never an
// import side effect (spec 4.5 §8 Q5). Error isolation lives in the
// dispatcher, not here (spec 4.3 §4).
export function registerLoggingListeners(): void {
  eventDispatcher.subscribe(VacationRequestCreatedEvent, ({ request }) => {
    logLine("VacationRequestCreated", request, {
      startDate: request.startDate,
      endDate: request.endDate,
    });
  });
  eventDispatcher.subscribe(VacationRequestApprovedEvent, ({ request }) => {
    logLine("VacationRequestApproved", request, {
      reviewedBy: request.reviewedBy,
    });
  });
  eventDispatcher.subscribe(VacationRequestRejectedEvent, ({ request }) => {
    logLine("VacationRequestRejected", request, {
      reviewedBy: request.reviewedBy,
    });
  });
}
