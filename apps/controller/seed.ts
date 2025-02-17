import { PostgresManager } from "./src/postgres/postgres.ts";
import { reset, seed } from "drizzle-seed";
import { schema } from "./src/postgres/schema.ts";
import process from "node:process";
import { ConfigManager } from "./src/app-config/config.ts";
if (import.meta.main) {
  const resetFlag = process.argv.includes("--reset");
  const seedFlag = process.argv.includes("--seed");

  const postgres = new PostgresManager(new ConfigManager());
  const db = postgres.db;

  if (resetFlag) {
    await reset(db, schema);
    console.log("Reset completed.");
  }

  if (seedFlag) {
    await seed(db, schema).refine((f) => {
      return {
        organization: {
          columns: {
            name: f.companyName(),
          },
          with: {
            apiKey: 1,
            project: 2,
          },
        },
        apiKey: {
          columns: {
            key: f.uuid(),
          },
        },
        project: {
          columns: {
            name: f.jobTitle(),
          },
          with: {
            syncEngine: 2,
          },
        },
        syncEngine: {
          columns: {
            slug: f.uuid(),
          },
        },
      };
    });
    console.log("Seed completed.");
  }

  if (!seedFlag && !resetFlag) {
    console.log("No --seed or --reset flag. Exiting.");
  }

  await postgres.dispose();
}
