import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1785239525809 implements MigrationInterface {
    name = 'InitialSchema1785239525809'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."user_role" AS ENUM('Requester', 'Validator')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" character varying NOT NULL, "email" character varying NOT NULL, "password" character varying NOT NULL, "role" "public"."user_role" NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."vacation_request_status" AS ENUM('Pending', 'Approved', 'Rejected')`);
        await queryRunner.query(`CREATE TABLE "vacation_requests" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "start_date" date NOT NULL, "end_date" date NOT NULL, "reason" character varying, "status" "public"."vacation_request_status" NOT NULL DEFAULT 'Pending', "comments" character varying, "reviewed_by" uuid, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_e8ca8afb59b9a4350c339b66843" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_vacation_requests_user_id_status" ON "vacation_requests"  ("user_id", "status") `);
        await queryRunner.query(`ALTER TABLE "vacation_requests" ADD CONSTRAINT "FK_74443281944f02ae8e386fa07b8" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "vacation_requests" ADD CONSTRAINT "FK_e4c5d725413f4d0939f77fad972" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "vacation_requests" DROP CONSTRAINT "FK_e4c5d725413f4d0939f77fad972"`);
        await queryRunner.query(`ALTER TABLE "vacation_requests" DROP CONSTRAINT "FK_74443281944f02ae8e386fa07b8"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_vacation_requests_user_id_status"`);
        await queryRunner.query(`DROP TABLE "vacation_requests"`);
        await queryRunner.query(`DROP TYPE "public"."vacation_request_status"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."user_role"`);
    }

}
