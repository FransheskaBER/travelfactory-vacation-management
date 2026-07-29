import {
  VacationRequest,
  VacationRequestStatus,
} from "../entities/VacationRequest";
import { VacationRequestRepository } from "./VacationRequestRepository";

/**
 * In-memory VacationRequestRepository for Phase 5 unit tests (spec 4.4 §3
 * deferred this fake to Phase 5). `findOverlapping` mirrors the adapter's
 * specified semantics — same user, blocking statuses Pending/Approved,
 * inclusive-boundary intersection (spec 4.4 §4, assumptions A3/A4) — because
 * 'YYYY-MM-DD' strings compare lexicographically in date order.
 *
 * Test-only: no production module imports this file.
 */
export class FakeVacationRequestRepository implements VacationRequestRepository {
  private readonly rows = new Map<string, VacationRequest>();
  private sequence = 0;

  /** Insert a row directly, bypassing commands — for arranging existing state. */
  seed(row: {
    userId: string;
    startDate: string;
    endDate: string;
    status: VacationRequestStatus;
    comments?: string | null;
  }): VacationRequest {
    const request = new VacationRequest();
    request.id = `seeded-${++this.sequence}`;
    request.userId = row.userId;
    request.startDate = row.startDate;
    request.endDate = row.endDate;
    request.status = row.status;
    request.reason = null;
    request.comments = row.comments ?? null;
    request.reviewedBy = null;
    this.rows.set(request.id, request);
    return request;
  }

  /** Direct read for assertions, bypassing the port. */
  get(id: string): VacationRequest | undefined {
    return this.rows.get(id);
  }

  count(): number {
    return this.rows.size;
  }

  async findOverlapping(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<VacationRequest[]> {
    return [...this.rows.values()].filter(
      (row) =>
        row.userId === userId &&
        (row.status === VacationRequestStatus.Pending ||
          row.status === VacationRequestStatus.Approved) &&
        row.startDate <= endDate &&
        row.endDate >= startDate
    );
  }

  async findOneBy(id: string): Promise<VacationRequest | null> {
    return this.rows.get(id) ?? null;
  }

  async save(request: VacationRequest): Promise<VacationRequest> {
    if (!request.id) {
      request.id = `saved-${++this.sequence}`;
    }
    this.rows.set(request.id, request);
    return request;
  }
}
