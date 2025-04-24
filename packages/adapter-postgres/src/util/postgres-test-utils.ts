import { afterAll, afterEach, beforeAll, beforeEach, describe } from "bun:test";

import {
  parsePostgresConnectionString,
  PostgresClient,
  type PostgresConfig,
} from "./postgres-client.ts";

export interface DbTestContext {
  client: PostgresClient;
}

export function getTestConnectionConfig(): PostgresConfig {
  const connectionString = process.env["REJOT_SYNC_CLI_TEST_CONNECTION"];
  if (!connectionString) {
    throw new Error("REJOT_SYNC_CLI_TEST_CONNECTION is not set");
  }
  return parsePostgresConnectionString(connectionString);
}

export function getTestClient(): PostgresClient {
  return PostgresClient.fromConfig(getTestConnectionConfig());
}

// Auto rollback any writes that happend during tests
export function pgRollbackDescribe(name: string, fn: (ctx: DbTestContext) => void): void {
  let rollback: (() => Promise<void>) | null = null;
  let ancestorClient: PostgresClient | null = null;

  const context: DbTestContext = {
    client: null!,
  };

  describe(name, () => {
    beforeAll(async () => {
      ancestorClient = getTestClient();
    });

    beforeEach(async () => {
      const tx = await ancestorClient!.dangerousLeakyTx();
      context.client = tx.pc;
      await context.client.query("SELECT 1 as connection_test");
      rollback = tx.rollback;
    });

    afterEach(async () => {
      await rollback!();
    });

    afterAll(async () => {
      await ancestorClient!.end();
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
