import { VacationRequest } from "../../entities/VacationRequest";

// Announces an already-committed fact (ADR 0001). Carries the saved entity
// whole — listeners pick what they log (spec 4.5 §8 Q1).
export class VacationRequestApprovedEvent {
  constructor(readonly request: VacationRequest) {}
}
