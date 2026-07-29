import { apiClient } from "./client";
import type { TeamVacation, VacationRequest } from "../types";

/** POST /requests body. `reason` is sent as typed — ""/whitespace → null
 * is the server's normalizeReason (spec 4.7), never the client's. */
export interface CreateRequestInput {
  startDate: string;
  endDate: string;
  reason?: string;
}

/** POST /requests → 201 with the persisted entity. Throws ApiError on
 * rule violations (400/409) via the client interceptor. */
export const createRequest = async (
  input: CreateRequestInput
): Promise<VacationRequest> => {
  const response = await apiClient.post<VacationRequest>("/requests", input);
  return response.data;
};

/** GET /requests/mine — own requests, all statuses, createdAt DESC from
 * the server (spec 4.6 §5); rendered as received, no client re-sort. */
export const listMyRequests = async (): Promise<VacationRequest[]> => {
  const response = await apiClient.get<VacationRequest[]>("/requests/mine");
  return response.data;
};

/** GET /requests/team — approved-only, startDate ASC from the server;
 * month-grouping is the page's job (spec 4.9 §8 Q1). */
export const listTeamVacations = async (): Promise<TeamVacation[]> => {
  const response = await apiClient.get<TeamVacation[]>("/requests/team");
  return response.data;
};
