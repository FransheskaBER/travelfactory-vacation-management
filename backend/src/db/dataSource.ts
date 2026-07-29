import "reflect-metadata";
import { DataSource } from "typeorm";
import { loadEnv } from "commoneventframework";
import { getEnvValue } from "commoneventframework/dist/utils/getEnvValue";
import { User } from "../entities/User";
import { VacationRequest } from "../entities/VacationRequest";
import { InitialSchema1785239525809 } from "../migrations/1785239525809-InitialSchema";
import { FreeTextLength1785318163979 } from "../migrations/1785318163979-FreeTextLength";

let dataSource: DataSource | null = null;
let initPromise: Promise<DataSource> | null = null;

// gen_random_uuid() is built into Postgres ≥13 — avoids the legacy uuid-ossp
// extension that TypeORM would otherwise require for uuid defaults.
const UUID_EXTENSION = "pgcrypto" as const;

const ENTITIES = [User, VacationRequest];

/**
 * Returns the shared, initialized TypeORM DataSource.
 *
 * Built lazily on first call — never at module load — because DATABASE_URL only
 * exists after CEF's `await envReady` has resolved the alias-prefixed env vars.
 *
 * Caches the in-flight promise so concurrent requests share one connection, and
 * clears it on failure so a transient outage doesn't poison the warm container.
 */
export const getDataSource = (): Promise<DataSource> => {
  if (!initPromise) {
    dataSource = new DataSource({
      type: "postgres",
      url: getEnvValue("DATABASE_URL"),
      synchronize: false,
      logging: true,
      uuidExtension: UUID_EXTENSION,
      entities: ENTITIES,
    });

    initPromise = dataSource.initialize().catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
};

/**
 * DataSource for the TypeORM CLI only (migration:generate/run/revert/show) —
 * the CLI needs an exported DataSource instance and awaits exported promises.
 * The runtime never initializes this one.
 *
 * Relies on internal behavior verified against typeorm@1.1.0 and the installed
 * CEF dist (see spec 4.1 §4) — re-verify on any upgrade:
 * - the CLI's loadDataSource awaits every export, so a Promise<DataSource> works
 * - CEF's loadEnv fails soft when SSM is unreachable
 *
 * DATABASE_URL is read from process.env directly (not getEnvValue, which
 * throws) so this promise can never reject at import time — a missing URL
 * surfaces as a connection error only when the CLI calls initialize().
 */
export const cliDataSource: Promise<DataSource> = loadEnv().then(() => {
  if (!process.env.DATABASE_URL) {
    console.warn("DATABASE_URL is not set — CLI commands will fail to connect");
  }
  return new DataSource({
    type: "postgres",
    url: process.env.DATABASE_URL ?? "",
    synchronize: false,
    logging: true,
    uuidExtension: UUID_EXTENSION,
    entities: ENTITIES,
    migrations: [InitialSchema1785239525809, FreeTextLength1785318163979],
  });
});
