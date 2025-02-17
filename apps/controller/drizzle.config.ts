import { defineConfig } from "drizzle-kit";
import { ConfigManager } from "./src/app-config/config.ts";

const getDrizzleConfig = () => {
  const config = new ConfigManager();

  const { host, port, user, password, database } = config.mainPostgresConnection;

  return defineConfig({
    out: "./drizzle",
    schema: "./src/postgres/schema.ts",
    dialect: "postgresql",
    dbCredentials: {
      url: `postgres://${user}:${password}@${host}:${port}/${database}`,
    },
    casing: "snake_case",
    verbose: config.drizzle.verbose,
  });
};

export default getDrizzleConfig();
