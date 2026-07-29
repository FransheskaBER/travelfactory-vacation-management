import { apiClient } from "./client";
import type {
  DashboardResult,
  TeamVacation,
  VacationRequest,
  VacationRequestStatus,
} from "../types";

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

/** GET /requests query params. Undefined fields are omitted from the
 * request entirely — the server's defaults (page 1, limit 10) and
 * unfiltered semantics are the contract (spec 4.10 §5); `limit` is
 * deliberately not sendable from here. */
export interface DashboardQuery {
  page?: number;
  status?: VacationRequestStatus;
  userId?: string;
}

/** GET /requests — validator dashboard, paginated + filterable,
 * createdAt DESC from the server (A15); rendered as received. */
export const listDashboard = async (
  query: DashboardQuery
): Promise<DashboardResult> => {
  const response = await apiClient.get<DashboardResult>("/requests", {
    params: query,
  });
  return response.data;
};

/** POST /requests/:id/approve — Pending only; 409 when the row was
 * already processed (A8's guard). */
export const approveRequest = async (id: string): Promise<VacationRequest> => {
  const response = await apiClient.post<VacationRequest>(
    `/requests/${id}/approve`
  );
  return response.data;
};

/** POST /requests/:id/reject — comment sent as typed; trimming and
 * Rule 5's emptiness check are the server's (spec 4.7), never the
 * client's. */
export const rejectRequest = async (
  id: string,
  comment: string
): Promise<VacationRequest> => {
  const response = await apiClient.post<VacationRequest>(
    `/requests/${id}/reject`,
    { comment }
  );
  return response.data;
};
