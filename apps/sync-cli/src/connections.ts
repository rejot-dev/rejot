import fs from "node:fs/promises";
import type { Client } from "pg";

export type ConnectionConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl: boolean;
};

export function maskConnectionString(connString: string): string {
  try {
    const url = new URL(connString);
    // Mask password if present
    if (url.password) {
      url.password = "****";
    }
    return url.toString();
  } catch {
    // If parsing fails, return a generic masked string
    return connString.replace(/:[^:@]+@/, ":****@");
  }
}

export async function readSQLFile(path: string): Promise<string> {
  try {
    return await fs.readFile(path, "utf-8");
  } catch (error) {
    throw new Error(`Failed to read SQL file at ${path}: ${error}`);
  }
}

export function clientToConfig(client: Client): ConnectionConfig {
  return {
    host: client.host,
    port: client.port,
    user: client.user || "postgres",
    password: client.password || "",
    database: client.database || "postgres",
    ssl: client.ssl,
  };
}
