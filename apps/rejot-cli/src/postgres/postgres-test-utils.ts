import { describe, beforeEach, afterEach } from "bun:test";
import { Client } from "pg";

export interface DbTestContext {
  client: Client;
}

function getTestClient(): Client {
  const connectionString = process.env.REJOT_SYNC_CLI_TEST_CONNECTION;
  if (!connectionString) {
    throw new Error("REJOT_SYNC_CLI_TEST_CONNECTION is not set");
  }
  return new Client(connectionString);
}

// Auto rollback any writes that happend during tests
export function pgRollbackDescribe(name: string, fn: (ctx: DbTestContext) => void): void {
  const context: DbTestContext = {
    client: getTestClient(),
  };

  describe(name, () => {
    beforeEach(async () => {
      await context.client.connect();
      await context.client.query("SELECT 1 as connection_test");
      await context.client.query("BEGIN");
    });

    afterEach(async () => {
      await context.client.query("ROLLBACK");
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
