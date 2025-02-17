import { drizzle } from "drizzle-orm/postgres-js";
import { schema } from "./schema.ts";
import { SqlFormattingLogger } from "./util/SqlFormattingLogger.ts";
import type { Disposable } from "typed-inject";
import type { ConfigManager } from "../app-config/config.ts";

export function connectPostgres({
  host,
  port,
  user,
  password,
  database,
  drizzleLogging,
}: {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  drizzleLogging: boolean;
}) {
  return drizzle({
    connection: {
      url: `postgres://${user}:${password}@${host}:${port}/${database}`,
    },
    schema,
    casing: "snake_case",
    logger: drizzleLogging ? new SqlFormattingLogger() : undefined,
  });
}

export type Postgres = ReturnType<typeof connectPostgres>;

let dbSingleton: Postgres | undefined;

export class PostgresManager implements Disposable {
  static inject = ["config"] as const;

  #config: ConfigManager;

  #db: Postgres | undefined;

  #activeTxForTesting: Postgres | undefined;

  constructor(config: ConfigManager) {
    this.#config = config;

    if (dbSingleton) {
      this.#db = dbSingleton;
    } else {
      this.connect();
    }
  }

  connect(): void {
    const { host, port, user, password, database } = this.#config.mainPostgresConnection;

    this.#db = connectPostgres({
      host,
      port,
      user,
      password,
      database,
      drizzleLogging: this.#config.drizzle.logging,
    });
    dbSingleton = this.#db;
  }

  get db(): Postgres {
    if (this.#activeTxForTesting) {
      return this.#activeTxForTesting;
    }

    if (!this.#db) {
      throw new Error("db is not connected");
    }

    return this.#db;
  }

  doNotUseSetActiveTxForTesting(tx: Postgres) {
    this.#activeTxForTesting = tx;
  }

  async dispose(): Promise<void> {
    console.log("dispose");
    if (!this.#db) {
      return;
    }

    await this.#db.$client.end();
    dbSingleton = undefined;
  }
}
