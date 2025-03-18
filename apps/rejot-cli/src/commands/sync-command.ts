import { Command, Flags } from "@oclif/core";
import fs from "node:fs/promises";

import {
  DEFAULT_PUBLICATION_NAME,
  SUPPORTED_SINK_SCHEMES,
  SUPPORTED_SOURCE_SCHEMES,
} from "../const.ts";
import logger, { setLogLevel, type LogLevel } from "../logger.ts";
import { createSourceAndSink, parseConnectionString } from "../factory.ts";
import { SyncController } from "../sync-controller.ts";

const log = logger.createLogger("cli");
export default class SyncCommand extends Command {
  static override id = "sync";

  static override description = `Setup point-to-point sync between two data stores.\n
    Opens a replication slot in the source data store, transforms writes to the store using the public schema.
    These writes are then replicated to the sink data store and upserted using the consumer schema.`;

  static override examples = [
    '<%= config.bin %> --source "postgresql://user:pass@host:port/db" --sink "postgresql://user:pass@host:port/db" --public-schema ./public-schema.sql --consumer-schema ./consumer-schema.sql',
    '<%= config.bin %> --source "postgresql://user:pass@host:port/db" --sink "stdout://" --public-schema ./public-schema.sql',
    '<%= config.bin %> --source "postgresql://user:pass@host:port/db" --sink "file:///path/to/output.json" --public-schema ./public-schema.sql',
  ];

  static override flags = {
    source: Flags.string({
      description:
        "Connection string for the source database (format: postgresql://user[:pass]@host[:port]/db)",
      required: true,
    }),
    sink: Flags.string({
      description:
        "Connection string for the sink (formats: postgresql://user[:pass]@host[:port]/db, stdout://, file:///path/to/file)",
      required: true,
      default: "stdout://",
    }),
    "backfill-from": Flags.string({
      description: "SQL Condition to start backfill from (e.g. 'id > 100')",
      required: false,
    }),
    "public-schema": Flags.string({
      description: "Path to the SQL file containing the public schema transformation",
      required: true,
    }),
    "consumer-schema": Flags.string({
      description:
        "Path to the SQL file containing the consumer schema transformation (required for postgresql sink)",
      required: false,
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

  /**
   * Validates the input flags and connection strings
   * @param flags Command flags
   * @throws Error if validation fails
   */
  private validateInputs(flags: {
    source: string;
    sink: string;
    "consumer-schema"?: string;
  }): void {
    const { source, sink, "consumer-schema": consumerSchemaPath } = flags;

    const sourceConnection = parseConnectionString(source);
    if (!SUPPORTED_SOURCE_SCHEMES.includes(sourceConnection.scheme)) {
      this.error(
        `Invalid source connection scheme: ${sourceConnection.scheme}, supported schemes: ${SUPPORTED_SOURCE_SCHEMES.join(
          ", ",
        )}`,
      );
    }

    const sinkConnection = parseConnectionString(sink);
    if (!SUPPORTED_SINK_SCHEMES.includes(sinkConnection.scheme)) {
      this.error(
        `Invalid sink connection scheme: ${sinkConnection.scheme}, supported schemes: ${SUPPORTED_SINK_SCHEMES.join(
          ", ",
        )}`,
      );
    }
    if (sinkConnection.scheme === "postgresql" && !consumerSchemaPath) {
      this.error("Consumer schema is required for PostgreSQL sink");
    }
  }

  public async run(): Promise<void> {
    const { args: _args, flags } = await this.parse(SyncCommand);

    const {
      source: sourceConn,
      sink: sinkConn,
      "backfill-from": backfillFrom,
      "public-schema": publicSchemaPath,
      "consumer-schema": consumerSchemaPath,
      "pg-publication-name": publicationName,
      "pg-create-publication": createPublication,
      "log-level": logLevel,
    } = flags;

    this.validateInputs(flags);

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
    if (consumerSchemaPath) {
      log.debug(`Consumer schema file: ${consumerSchemaPath}`);
    }

    // Read SQL files
    log.debug("Reading SQL transformation files...");
    const publicSchemaSQL = await fs.readFile(publicSchemaPath, "utf-8");

    // Read consumer schema SQL if provided
    let consumerSchemaSQL: string | undefined = undefined;
    if (consumerSchemaPath) {
      consumerSchemaSQL = await fs.readFile(consumerSchemaPath, "utf-8");
    }

    log.info("SQL transformation file(s) read successfully");

    const { source, sink } = createSourceAndSink(
      sourceConn,
      sinkConn,
      publicSchemaSQL,
      consumerSchemaSQL,
      {
        publicationName,
        createPublication,
      },
    );

    // Create sync controller
    const syncController = new SyncController({
      source,
      sink,
    });

    // Set up signal handlers for graceful shutdown
    process.on("SIGINT", async () => {
      log.info("\nReceived SIGINT, shutting down...");
      await syncController.stop();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      log.info("\nReceived SIGTERM, shutting down...");
      await syncController.stop();
      process.exit(0);
    });

    // Start the sync process
    try {
      const syncProcess = syncController.start();

      if (backfillFrom) {
        // TODO: hacky af?
        const backfillSql = publicSchemaSQL.replace("id = $1", backfillFrom);
        await syncController.startBackfill(backfillSql, ["id"]);
      }

      await syncProcess;
    } catch (error) {
      log.error("Failed to start sync", error);
      await syncController.stop();
      this.exit(1);
    }
  }
}
