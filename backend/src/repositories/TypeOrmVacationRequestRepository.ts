import { In, LessThanOrEqual, MoreThanOrEqual, Repository } from "typeorm";
import {
  VacationRequest,
  VacationRequestStatus,
} from "../entities/VacationRequest";
import { VacationRequestRepository } from "./VacationRequestRepository";

export class TypeOrmVacationRequestRepository
  implements VacationRequestRepository
{
  constructor(private readonly repo: Repository<VacationRequest>) {}

  // Inclusive-boundary intersection (A3): ranges overlap when
  // newStart <= existingEnd AND newEnd >= existingStart. Pending and
  // Approved block a new request; Rejected frees its dates (A4). Served by
  // the (user_id, status) composite index (TDD §2).
  findOverlapping(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<VacationRequest[]> {
    return this.repo.find({
      where: {
        userId,
        status: In([
          VacationRequestStatus.Pending,
          VacationRequestStatus.Approved,
        ]),
        startDate: LessThanOrEqual(endDate),
        endDate: MoreThanOrEqual(startDate),
      },
    });
  }

  findOneBy(id: string): Promise<VacationRequest | null> {
    return this.repo.findOneBy({ id });
  }

  save(request: VacationRequest): Promise<VacationRequest> {
    return this.repo.save(request);
  }
}
