import type { Connection } from "./connection.data";

/**
 * Generates a PostgreSQL connection string from a Connection object
 * Format: postgres://user@host:port/database
 */
export function getPostgresConnectionString(connection: Connection): string {
  const { config } = connection;
  if (config.type !== "postgres") {
    throw new Error("Connection is not a PostgreSQL connection");
  }

  const { user, host, port, database } = config;
  return `postgres://${user}@${host}:${port}/${database}`;
}
