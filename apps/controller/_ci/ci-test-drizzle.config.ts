import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle",
  schema: "./src/postgres/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: `postgres://postgres:postgres@localhost:5432/test`,
  },
  casing: "snake_case",
  verbose: true,
});
