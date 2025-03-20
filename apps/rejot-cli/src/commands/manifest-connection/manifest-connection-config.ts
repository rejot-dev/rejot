import { Flags } from "@oclif/core";

export const connectionFlags = {
  manifest: Flags.string({
    description: "Path to manifest file",
    default: "./rejot-manifest.json",
  }),
  "connection-string": Flags.string({
    description: "Connection string (format: postgresql://user[:pass]@host[:port]/db)",
    required: false,
    exclusive: ["type", "host", "port", "user", "password", "database"],
  }),
  type: Flags.string({
    description: "Connection type (required if not using connection-string)",
    options: ["postgres"],
    required: false,
  }),
  host: Flags.string({
    description: "Host address (required if not using connection-string)",
    required: false,
  }),
  port: Flags.integer({
    description: "Port number (required if not using connection-string)",
    required: false,
  }),
  user: Flags.string({
    description: "Username (required if not using connection-string)",
    required: false,
  }),
  password: Flags.string({
    description: "Password (required if not using connection-string)",
    required: false,
  }),
  database: Flags.string({
    description: "Database name (required if not using connection-string)",
    required: false,
  }),
};

export interface ConnectionConfig {
  connectionType: "postgres";
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export function parseConnectionString(connectionString: string): ConnectionConfig {
  try {
    const url = new URL(connectionString);

    if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
      throw new Error("Connection string must start with postgresql:// or postgres://");
    }

    const port = parseInt(url.port || "5432", 10);
    if (isNaN(port)) {
      throw new Error("Invalid port number in connection string");
    }

    const database = url.pathname.slice(1); // Remove leading slash
    if (!database) {
      throw new Error("Database name is required in connection string");
    }

    if (!url.hostname) {
      throw new Error("Host is required in connection string");
    }

    if (!url.username) {
      throw new Error("Username is required in connection string");
    }

    if (!url.password) {
      throw new Error("Password is required in connection string");
    }

    return {
      connectionType: "postgres",
      host: url.hostname,
      port,
      user: url.username,
      password: url.password,
      database,
    };
  } catch (error) {
    throw new Error(
      `Invalid connection string: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export function parseConnectionFlags(flags: {
  "connection-string"?: string;
  type?: string;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
}): ConnectionConfig {
  if (flags["connection-string"]) {
    return parseConnectionString(flags["connection-string"]);
  }

  // Use individual parameters
  if (
    !flags.type ||
    !flags.host ||
    !flags.port ||
    !flags.user ||
    !flags.password ||
    !flags.database
  ) {
    throw new Error(
      "When not using --connection-string, all connection fields are required: --type, --host, --port, --user, --password, --database",
    );
  }

  return {
    connectionType: "postgres",
    host: flags.host,
    port: flags.port,
    user: flags.user,
    password: flags.password,
    database: flags.database,
  };
}
