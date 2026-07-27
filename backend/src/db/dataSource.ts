import "reflect-metadata";
import { DataSource } from "typeorm";
import { getEnvValue } from "commoneventframework/dist/utils/getEnvValue";

let dataSource: DataSource | null = null;
let initPromise: Promise<DataSource> | null = null;

export const getDataSource = (): Promise<DataSource> => {
  if (!initPromise) {
    dataSource = new DataSource({
      type: "postgres",
      url: getEnvValue("DATABASE_URL"),
      synchronize: false,
      logging: true,
      entities: [],
    });
    initPromise = dataSource.initialize();
  }
  return initPromise;
};