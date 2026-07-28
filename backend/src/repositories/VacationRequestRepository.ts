import { VacationRequest } from "../entities/VacationRequest";

/**
 * The one persistence port commands depend on (spec 4.4 §8 Q2). It names a
 * new concept only for the query that encodes a business rule —
 * `findOverlapping` (ADR 0001/0002); `findOneBy` and `save` keep TypeORM's
 * own names and are delegated untouched by the adapter. A single interface
 * so Phase 5 unit tests fake exactly one thing (TDD §8).
 */
export interface VacationRequestRepository {
  findOverlapping(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<VacationRequest[]>;
  findOneBy(id: string): Promise<VacationRequest | null>;
  save(request: VacationRequest): Promise<VacationRequest>;
}
