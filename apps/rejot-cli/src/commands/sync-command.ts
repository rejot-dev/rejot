import fs from "node:fs/promises";

import { DEFAULT_PUBLICATION_NAME } from "@rejot-dev/adapter-postgres/consts";
import { getLogger, setLogLevel } from "@rejot-dev/contract/logger";
import { LegacySyncController } from "@rejot-dev/sync/legacy-sync-controller";

import { Command, Flags } from "@oclif/core";

import { createSourceAndSink, parseConnectionString } from "../factory.ts";
import { SUPPORTED_SINK_SCHEMES, SUPPORTED_SOURCE_SCHEMES } from "../rejot-cli-consts.ts";

const log = getLogger(import.meta.url);

export default class SyncCommand extends Command {
  static override id = "sync";

  static override description = `Setup point-to-point sync between two data stores.\n
    Opens a replication slot in the source data store, transforms writes to the store using the public schema.
    These writes are then replicated to the sink data store and upserted using the consumer schema.`;

  static override examples = [
    '<%= config.bin %> --source "postgresql://user:pass@host:port/db" --sink "postgresql://user:pass@host:port/db" --public-schema ./public-schema.sql --consumer-schema ./consumer-schema.sql',
    '<%= config.bin %> --source "postgresql://user:pass@host:port/db" --sink "stdout://" --public-schema ./public-schema.sql',
    '<%= config.bin %> --source "postgresql://user:pass@host:port/db" --sink "file:///path/to/output.json" --public-schema ./public-schema.sql',
    '<%= config.bin %> --source "postgresql://user:pass@host:port/db" --sink "file:///path/to/output.json" --public-schema ./public-schema.sql --backfill-from "id > 100" --backfill-primary-key "public.table.id:id"',
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
    "backfill-primary-key": Flags.string({
      multiple: true,
      description:
        "Mapping of source table primary key to that same column in the public schema, potentially aliased (format: schema.table_name.column_name[:alias])",
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

  private parseBackfillPrimaryKeys(backfillPrimaryKeys: string[]) {
    // Parses cli argument for backfill primary keys into BackfillSource
    // Doesn't support tables with more than one primary key
    // Examples:
    //  With a column alias:
    //   "public.table.id:aliased_id" -> {tableRef: public.table, primaryKeyAliases: {"id": "aliased_id"}}
    //  Without a column alias:
    //   "public.table.id" -> {tableRef: public.table, primaryKeyAliases: {"id": "id"}}

    return backfillPrimaryKeys.map((key) => {
      const [tableRef, maybeAlias] = key.split(":");
      const columnName = tableRef.split(".").pop();
      if (!columnName) {
        throw new Error(`Invalid backfill-primary-key: ${key}`);
      }
      const alias = maybeAlias || columnName;
      return { tableRef, primaryKeyAliases: new Map([[columnName, alias]]) };
    });
  }

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
    "backfill-from"?: string;
    "backfill-primary-key"?: string[];
  }): void {
    const {
      source,
      sink,
      "consumer-schema": consumerSchemaPath,
      "backfill-from": backfillFrom,
      "backfill-primary-key": backfillPrimaryKeys,
    } = flags;

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
    if (backfillFrom && !backfillPrimaryKeys) {
      this.error("backfill-primary-key is required when using backfill-from");
    }
    if (!backfillFrom && backfillPrimaryKeys) {
      this.error("backfill-from is required when using backfill-primary-key");
    }
  }

  public async run(): Promise<void> {
    const { args: _args, flags } = await this.parse(SyncCommand);

    const {
      source: sourceConnection,
      sink: sinkConnection,
      "public-schema": publicSchemaPath,
      "consumer-schema": consumerSchemaPath,
      "pg-publication-name": publicationName,
      "pg-create-publication": createPublication,
      "log-level": logLevel,
      "backfill-primary-key": backfillPrimaryKeys,
      "backfill-from": backfillFrom,
    } = flags;

    this.validateInputs(flags);

    setLogLevel(logLevel);

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
      sourceConnection,
      sinkConnection,
      publicSchemaSQL,
      consumerSchemaSQL,
      {
        publicationName,
        createPublication,
      },
    );

    // Create sync controller
    const syncController = new LegacySyncController({
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
      await syncController.prepare();
      const syncProcess = syncController.start();

      if (backfillFrom) {
        // TODO: hacky af?
        const backfillSql = publicSchemaSQL.replace("id = $1", backfillFrom);

        if (backfillPrimaryKeys) {
          const backfillSources = this.parseBackfillPrimaryKeys(backfillPrimaryKeys);
          log.debug("Basing backfill on primary keys", backfillSources);
          await syncController.startBackfill(backfillSources, backfillSql);
        }
      }

      await syncProcess;
    } catch (error) {
      log.error("Failed to start sync", error);
      await syncController.stop();
      this.exit(1);
    }
  }
}
