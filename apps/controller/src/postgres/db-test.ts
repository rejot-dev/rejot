import { describe, beforeEach, afterEach } from "bun:test";
import { DrizzleError } from "drizzle-orm/errors";
import type { Postgres } from "./postgres";
import { createInjectionContainer } from "@/injector";

export interface DbTestContext {
  injector: ReturnType<typeof createInjectionContainer>;
  resolve: ReturnType<typeof createInjectionContainer>["resolve"];
  db: Postgres;
}

export function dbDescribe(name: string, fn: (ctx: DbTestContext) => void): void {
  const context: DbTestContext = {} as DbTestContext;

  describe("[db-test] " + name, () => {
    let testPromise: ReturnType<typeof Promise.withResolvers<void>> | null = null;

    beforeEach(async () => {
      context.injector = createInjectionContainer();
      context.resolve = context.injector.resolve.bind(context.injector);
      const postgresManager = context.injector.resolve("postgres");
      context.db = postgresManager.db;

      testPromise = Promise.withResolvers<void>();
      const beforeEachPromise = Promise.withResolvers<void>();

      try {
        await context.db.execute("SELECT 99 as test");
      } catch (error) {
        // Db connection not healthy
        beforeEachPromise.reject(error);
      }

      context.db
        .transaction(async (ormTx) => {
          if (!testPromise) {
            throw new Error("testPromise is not set");
          }

          // This is hacky, because a Tx is not a Postgres instance. It is very similar, but the
          // tx does not contain Postgres.js specific $client.
          context.db = ormTx as unknown as Postgres;
          postgresManager.doNotUseSetActiveTxForTesting(context.db);
          beforeEachPromise.resolve();
          await testPromise.promise;
          ormTx.rollback();
        })
        .catch((error) => {
          if (!(error instanceof DrizzleError && error.message.includes("Rollback"))) {
            throw error;
          }
        });

      await beforeEachPromise.promise;
    });

    afterEach(async () => {
      if (!testPromise) {
        throw new Error("testPromise is not set");
      }

      testPromise.resolve();
    });

    fn(context);
  });
}
