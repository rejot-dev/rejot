import { migrate } from "drizzle-orm/postgres-js/migrator";
import { PostgresManager } from "./postgres/postgres.ts";
import { ConfigManager } from "./app-config/config.ts";

async function runMigrations() {
  const manager = new PostgresManager(new ConfigManager());

  console.log("Starting Database Migrations");
  await migrate(manager.db, { migrationsFolder: "./drizzle" });
  console.log("Database Migrations Completed");

  await manager.dispose();
}

runMigrations();
