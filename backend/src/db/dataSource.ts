import "reflect-metadata";
import { DataSource } from "typeorm";
import { getEnvValue } from "commoneventframework/dist/utils/getEnvValue";

let dataSource: DataSource | null = null;
let initPromise: Promise<DataSource> | null = null;

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
      entities: [],
    });

    initPromise = dataSource.initialize().catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
};
