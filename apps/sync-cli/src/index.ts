import { Command, Flags } from "@oclif/core";
import { SyncService } from "./sync.ts";
import fs from "node:fs/promises";
import { DEFAULT_PUBLICATION_NAME, DEFAULT_SLOT_NAME } from "./const.ts";

export default class SyncCommand extends Command {
  static override description = "Start a syncing between two datastores";

  static override examples = [
    '<%= config.bin %> --source-conn "postgresql://user:pass@host:port/db" --dest-conn "postgresql://user:pass@host:port/db" --public-schema ./public-schema.sql --consumer-schema ./consumer-schema.sql',
  ];

  static override flags = {
    "source-conn": Flags.string({
      description: "PostgreSQL connection string for the source database",
      required: true,
    }),
    "dest-conn": Flags.string({
      description: "PostgreSQL connection string for the destination database",
      required: true,
    }),
    "public-schema": Flags.string({
      description: "Path to the SQL file containing the public schema transformation",
      required: true,
    }),
    "consumer-schema": Flags.string({
      description: "Path to the SQL file containing the consumer schema transformation",
      required: true,
    }),
    "publication-name": Flags.string({
      description: `Name of the PostgreSQL publication to use (default: ${DEFAULT_PUBLICATION_NAME})`,
      default: DEFAULT_PUBLICATION_NAME,
    }),
    "create-publication": Flags.boolean({
      description: "Create the publication if it doesn't exist",
      default: true,
      allowNo: true,
    }),
    "slot-name": Flags.string({
      description: `Name of the PostgreSQL replication slot to use (default: ${DEFAULT_SLOT_NAME})`,
      default: DEFAULT_SLOT_NAME,
    }),
  };

  static override args = {};

  public async run(): Promise<void> {
    const { args: _args, flags } = await this.parse(SyncCommand);

    // Extract connection strings and schema files

    const {
      "source-conn": sourceConn,
      "dest-conn": destConn,
      "public-schema": publicSchemaPath,
      "consumer-schema": consumerSchemaPath,
      "publication-name": publicationName,
      "create-publication": createPublication,
      "slot-name": slotName,
    } = flags;

    this.log(`Starting sync process:`);
    this.log(`- Source connection: ${this.maskConnectionString(sourceConn)}`);
    this.log(`- Destination connection: ${this.maskConnectionString(destConn)}`);
    this.log(`- Public schema file: ${publicSchemaPath}`);
    this.log(`- Consumer schema file: ${consumerSchemaPath}`);

    // Read SQL files
    this.log("Reading SQL transformation files...");
    const publicSchemaSQL = await this.readSQLFile(publicSchemaPath);
    const consumerSchemaSQL = await this.readSQLFile(consumerSchemaPath);

    // Create and start sync service
    const syncService = new SyncService(
      sourceConn,
      destConn,
      publicSchemaSQL,
      consumerSchemaSQL,
      publicationName,
      createPublication,
      slotName,
    );

    // Set up signal handlers for graceful shutdown
    process.on("SIGINT", async () => {
      this.log("\nReceived SIGINT, shutting down...");
      await syncService.stop();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      this.log("\nReceived SIGTERM, shutting down...");
      await syncService.stop();
      process.exit(0);
    });

    // Start the sync process
    await syncService.start();

    // Keep the process running
    await new Promise(() => {});
  }

  private maskConnectionString(connString: string): string {
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

  private async readSQLFile(path: string): Promise<string> {
    try {
      return await fs.readFile(path, "utf-8");
    } catch (error) {
      throw new Error(`Failed to read SQL file at ${path}: ${error}`);
    }
  }
}
