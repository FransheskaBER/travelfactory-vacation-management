import { MigrationInterface, QueryRunner } from "typeorm";

// 4.7: parsers cap both free-text fields at 500 (post-trim), and the schema
// states the same bound so parser and column can never disagree. ALTER only,
// no USING/truncation — an existing over-limit row fails the migration
// loudly rather than being silently cut (spec 4.7 §4).
export class FreeTextLength1785318163979 implements MigrationInterface {
    name = 'FreeTextLength1785318163979'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "vacation_requests" ALTER COLUMN "reason" TYPE character varying(500)`);
        await queryRunner.query(`ALTER TABLE "vacation_requests" ALTER COLUMN "comments" TYPE character varying(500)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "vacation_requests" ALTER COLUMN "reason" TYPE character varying`);
        await queryRunner.query(`ALTER TABLE "vacation_requests" ALTER COLUMN "comments" TYPE character varying`);
    }

}
