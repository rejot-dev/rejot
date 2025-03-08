import { Command, Flags } from "@oclif/core";
import { PostgresSyncService } from "./postgres/postgres-sync-service.ts";

import { DEFAULT_PUBLICATION_NAME } from "./const.ts";
import { readSQLFile } from "./transforms.ts";
import logger, { setLogLevel, type LogLevel } from "./logger.ts";

const log = logger.createLogger("cli");
export default class SyncCommand extends Command {
  static override description = `Setup point-to-point sync between two data stores.\n
    Opens a replication slot in the source data store, transforms writes to the store using the public schema.
    These writes are then replicated to the destination data store and upserted using the consumer schema.`;

  static override examples = [
    '<%= config.bin %> --source-conn "postgresql://user:pass@host:port/db" --dest-conn "postgresql://user:pass@host:port/db" --public-schema ./public-schema.sql --consumer-schema ./consumer-schema.sql',
  ];

  static override flags = {
    "source-conn": Flags.string({
      description:
        "Connection string for the source database (format: postgresql://user[:pass]@host[:port]/db)",
      required: true,
    }),
    "dest-conn": Flags.string({
      description:
        "Connection string for the destination database (format: postgresql://user[:pass]@host[:port]/db)",
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
    "log-level": Flags.string({
      description: "Set the log level (error, warn, info, debug, trace)",
      options: ["error", "warn", "info", "debug", "trace"],
      default: "info",
    }),
  };

  static override args = {};

  public async run(): Promise<void> {
    const { args: _args, flags } = await this.parse(SyncCommand);

    const {
      "source-conn": sourceConn,
      "dest-conn": destConn,
      "public-schema": publicSchemaPath,
      "consumer-schema": consumerSchemaPath,
      "pg-publication-name": publicationName,
      "pg-create-publication": createPublication,
      "log-level": logLevel,
    } = flags;

    // Casting because oclif checks the values for us
    setLogLevel(logLevel as LogLevel);

    // Override console methods with custom logger to capture logs from libraries that are not using namespaced loggers
    const consoleLogger = logger.createLogger("console");
    console.log = consoleLogger.info.bind(logger);
    console.info = consoleLogger.info.bind(logger);
    console.warn = consoleLogger.warn.bind(logger);
    console.error = consoleLogger.error.bind(logger);
    console.debug = consoleLogger.debug.bind(logger);

    log.debug(`Public schema file: ${publicSchemaPath}`);
    log.debug(`Consumer schema file: ${consumerSchemaPath}`);

    // Read SQL files
    log.debug("Reading SQL transformation files...");
    const publicSchemaSQL = await readSQLFile(publicSchemaPath);
    const consumerSchemaSQL = await readSQLFile(consumerSchemaPath);
    log.info("SQL transformation files read successfully");

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
      log.info("\nReceived SIGINT, shutting down...");
      await syncService.stop();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      log.info("\nReceived SIGTERM, shutting down...");
      await syncService.stop();
      process.exit(0);
    });

    // Start the sync process
    try {
      await syncService.start();
    } catch (error) {
      log.error("Failed to start sync", error);
      await syncService.stop();
    }
  }
}
