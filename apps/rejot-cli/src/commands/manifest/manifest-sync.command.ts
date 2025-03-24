import { Args, Command, Flags } from "@oclif/core";
import fs from "node:fs/promises";
import { z } from "zod";
import { SyncManifestSchema } from "@rejot/contract/manifest";
import logger, { setLogLevel, type LogLevel } from "@rejot/contract/logger";
import {
  PostgresConnectionAdapter,
  PostgresPublicSchemaTransformationAdapter,
} from "@rejot/adapter-postgres";
import { PostgresEventStore } from "@rejot/adapter-postgres/postgres-event-store";
import { SyncManifestController } from "@rejot/sync/sync-manifest-controller";

const log = logger.createLogger("cli");

export class ManifestSyncCommand extends Command {
  static override id = "manifest:sync";

  static override description = `Start syncing based on one or more manifest files.\n
    Opens replication slots in the source data stores, transforms writes using public schemas,
    and stores the events in the configured event store.`;

  static override examples = [
    "<%= config.bin %> manifest:sync ./rejot-manifest.json",
    "<%= config.bin %> manifest:sync ./manifest1.json ./manifest2.json",
  ];

  static override flags = {
    "log-level": Flags.string({
      description: "Set the log level (error, warn, info, debug, trace)",
      options: ["error", "warn", "info", "debug", "trace"],
      default: "info",
    }),
  };

  static override strict = false;

  static override args = {
    manifest: Args.string({
      description: "Path to manifest file(s)",
      required: true,
    }),
  };

  public async run(): Promise<void> {
    const { flags, argv } = await this.parse(ManifestSyncCommand);
    const { "log-level": logLevel } = flags;

    const manifestPaths = z.array(z.string()).parse(argv);

    // Set log level
    setLogLevel(logLevel as LogLevel);

    // Override console methods with custom logger
    const consoleLogger = logger.createLogger("console");
    console.log = consoleLogger.info.bind(logger);
    console.info = consoleLogger.info.bind(logger);
    console.warn = consoleLogger.warn.bind(logger);
    console.error = consoleLogger.error.bind(logger);
    console.debug = consoleLogger.debug.bind(logger);

    try {
      // Read and parse manifest files
      const manifests = await Promise.all(
        manifestPaths.map(async (path) => {
          const content = await fs.readFile(path, "utf-8");
          const json = JSON.parse(content);
          return SyncManifestSchema.parse(json);
        }),
      );

      log.info(`Successfully loaded ${manifests.length} manifest(s)`);

      // Create adapters
      const postgresAdapter = new PostgresConnectionAdapter();
      const transformationAdapter = new PostgresPublicSchemaTransformationAdapter(postgresAdapter);

      // Create event store from the first manifest's event store config
      // TODO: Support multiple event stores or validate they are the same
      const manifest = manifests[0];
      if (!manifest.eventStores?.[0]) {
        throw new Error("No event store configuration found in manifest");
      }

      const eventStoreConfig = manifest.eventStores[0];
      const eventStoreConnection = manifest.connections.find(
        ({ slug }) => slug === eventStoreConfig.connectionSlug,
      );

      if (!eventStoreConnection) {
        throw new Error(
          `Event store connection '${eventStoreConfig.connectionSlug}' not found in manifest`,
        );
      }

      const eventStore = PostgresEventStore.fromConnection(eventStoreConnection.config);

      // Create sync controller
      const syncController = new SyncManifestController(
        manifests,
        [postgresAdapter],
        [transformationAdapter],
        eventStore,
      );

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
        await syncController.start();
        log.info("Sync process started successfully");
      } catch (error) {
        log.error("Failed to start sync", error);
        await syncController.stop();
        this.exit(1);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        log.error("Invalid manifest file:", error.errors);
      } else {
        log.error(error);
      }
      this.exit(1);
    }
  }
}
