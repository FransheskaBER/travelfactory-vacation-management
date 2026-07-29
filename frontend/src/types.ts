/** The two exclusive roles (PRD; assumptions.md A16 — no dual-role users). */
export type Role = "Requester" | "Validator";

/** Mirrors the backend status enum (root.yaml VacationRequest.status). */
export type VacationRequestStatus = "Pending" | "Approved" | "Rejected";

/**
 * Wire shape of root.yaml's VacationRequest schema. Dates are date-only
 * strings (YYYY-MM-DD, A2); createdAt/updatedAt are ISO date-times.
 * `comments` (plural) matches the entity column — it holds the single
 * rejection comment (A12).
 */
export interface VacationRequest {
  id: string;
  userId: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  status: VacationRequestStatus;
  comments: string | null;
  reviewedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/** GET /requests/team element — exactly these three keys, no reason (A14). */
export interface TeamVacation {
  requesterName: string;
  startDate: string;
  endDate: string;
}

/** GET /users element — id + name only, the privacy boundary (A10). */
export interface UserSummary {
  id: string;
  name: string;
}

/**
 * GET /requests envelope (root.yaml). `total` is the post-filter count;
 * `limit` echoes the server's page size — the client renders page math
 * from these fields, never from a hardcoded 10 (spec 4.10 §4).
 */
export interface DashboardResult {
  data: VacationRequest[];
  total: number;
  page: number;
  limit: number;
}
