import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { User } from "./User";

export enum VacationRequestStatus {
  Pending = "Pending",
  Approved = "Approved",
  Rejected = "Rejected",
}

// Composite index serves findOverlapping (user_id + status filter); leading
// user_id also covers queries with no status filter (TDD §2 Indexes).
@Entity("vacation_requests")
@Index("IDX_vacation_requests_user_id_status", ["userId", "status"])
export class VacationRequest {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ name: "user_id", type: "uuid" })
  userId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: "user_id" })
  requester!: User;

  // 'date' columns surface as 'YYYY-MM-DD' strings, not Date objects —
  // deliberate: date-only granularity per A2, no timezone math.
  @Column({ name: "start_date", type: "date" })
  startDate!: string;

  @Column({ name: "end_date", type: "date" })
  endDate!: string;

  @Column({ type: "varchar", length: 500, nullable: true })
  reason!: string | null;

  @Column({
    type: "enum",
    enum: VacationRequestStatus,
    enumName: "vacation_request_status",
    default: VacationRequestStatus.Pending,
  })
  status!: VacationRequestStatus;

  // Written only on rejection (A12).
  @Column({ type: "varchar", length: 500, nullable: true })
  comments!: string | null;

  // Who decided — deliberate extension of the assignment's schema (D11).
  @Column({ name: "reviewed_by", type: "uuid", nullable: true })
  reviewedBy!: string | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: "reviewed_by" })
  reviewer!: User | null;

  @CreateDateColumn({ name: "created_at", type: "timestamp" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamp" })
  updatedAt!: Date;
}
