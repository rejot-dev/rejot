import { describe, beforeEach, afterEach, afterAll, beforeAll } from "bun:test";
import { PostgresClient } from "./postgres-client";
import { parse as parseConnectionString } from "pg-connection-string";

export interface DbTestContext {
  client: PostgresClient;
}

export function getTestClient(): PostgresClient {
  const connectionString = process.env["REJOT_SYNC_CLI_TEST_CONNECTION"];
  if (!connectionString) {
    throw new Error("REJOT_SYNC_CLI_TEST_CONNECTION is not set");
  }
  const config = parseConnectionString(connectionString);
  return new PostgresClient({
    host: config.host || "localhost",
    port: config.port ? parseInt(config.port) : 5432,
    user: config.user || "postgres",
    password: config.password || "",
    database: config.database || "postgres",
  });
}

// Auto rollback any writes that happend during tests
export function pgRollbackDescribe(name: string, fn: (ctx: DbTestContext) => void): void {
  const context: DbTestContext = {
    client: getTestClient(),
  };

  describe(name, () => {
    beforeAll(async () => {
      await context.client.connect();
    });

    beforeEach(async () => {
      await context.client.query("SELECT 1 as connection_test");
      await context.client.beginTransaction();
    });

    afterEach(async () => {
      await context.client.rollbackTransaction();
    });

    afterAll(async () => {
      await context.client.end();
    });

    fn(context);
  });
}

export function pgDescribe(name: string, fn: (ctx: DbTestContext) => void): void {
  const context: DbTestContext = {
    client: getTestClient(),
  };

  describe(name, () => {
    fn(context);
  });
}
