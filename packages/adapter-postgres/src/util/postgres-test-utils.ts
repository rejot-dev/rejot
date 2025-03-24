import { describe, beforeEach, afterEach, afterAll, beforeAll } from "bun:test";
import { Client } from "pg";
import { PostgresClient } from "./postgres-client.ts";

export interface DbTestContext {
  client: PostgresClient;
}

function getTestClient(): PostgresClient {
  const connectionString = process.env["REJOT_SYNC_CLI_TEST_CONNECTION"];
  if (!connectionString) {
    throw new Error("REJOT_SYNC_CLI_TEST_CONNECTION is not set");
  }
  return new PostgresClient(new Client(connectionString));
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
