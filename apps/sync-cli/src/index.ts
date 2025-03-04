import { Command, Flags } from "@oclif/core";
import { PostgresSyncService } from "./postgres/postgres-sync-service.ts";

import { DEFAULT_PUBLICATION_NAME } from "./const.ts";
import { readSQLFile } from "./connections.ts";
import { maskConnectionString } from "./connections.ts";

export default class SyncCommand extends Command {
  static override description = "Start syncing between two datastores";

  static override examples = [
    '<%= config.bin %> --source-conn "postgresql://user:pass@host:port/db" --dest-conn "postgresql://user:pass@host:port/db" --public-schema ./public-schema.sql --consumer-schema ./consumer-schema.sql',
  ];

  static override flags = {
    "source-conn": Flags.string({
      description: "Connection string for the source database",
      required: true,
    }),
    "dest-conn": Flags.string({
      description: "Connection string for the destination database",
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
    "pg-publication-name": Flags.string({
      description: `Name of the PostgreSQL publication to use (default: ${DEFAULT_PUBLICATION_NAME})`,
      default: DEFAULT_PUBLICATION_NAME,
    }),
    "pg-create-publication": Flags.boolean({
      description: "Create the PostgreSQL publication if it doesn't exist",
      default: true,
      allowNo: true,
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
      "pg-publication-name": publicationName,
      "pg-create-publication": createPublication,
    } = flags;

    this.log(`Starting sync process:`);
    this.log(`- Source connection: ${maskConnectionString(sourceConn)}`);
    this.log(`- Destination connection: ${maskConnectionString(destConn)}`);
    this.log(`- Public schema file: ${publicSchemaPath}`);
    this.log(`- Consumer schema file: ${consumerSchemaPath}`);

    // Read SQL files
    this.log("Reading SQL transformation files...");
    const publicSchemaSQL = await readSQLFile(publicSchemaPath);
    const consumerSchemaSQL = await readSQLFile(consumerSchemaPath);

    const syncService = new PostgresSyncService({
      sourceConn,
      destConn,
      publicSchemaSQL,
      consumerSchemaSQL,
      publicationName,
      createPublication,
    });

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
}
