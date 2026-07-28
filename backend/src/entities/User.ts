import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from "typeorm";

export enum UserRole {
  Requester = "Requester",
  Validator = "Validator",
}

@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar" })
  name!: string;

  @Column({ type: "varchar", unique: true })
  email!: string;

  // bcrypt hash. select: false keeps it out of every query result unless a
  // query opts in with addSelect — the hash can never leak into a response
  // by accident (spec 4.1 §8 Q3).
  @Column({ type: "varchar", select: false })
  password!: string;

  @Column({ type: "enum", enum: UserRole, enumName: "user_role" })
  role!: UserRole;

  @CreateDateColumn({ name: "created_at", type: "timestamp" })
  createdAt!: Date;
}
