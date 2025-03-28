import { Args, Command, Flags } from "@oclif/core";
import fs from "node:fs/promises";
import { z } from "zod";
import { SyncManifestSchema } from "@rejot/contract/manifest";
import logger, { setLogLevel, type LogLevel } from "@rejot/contract/logger";
import {
  PostgresConnectionAdapter,
  PostgresPublicSchemaTransformationAdapter,
  PostgresConsumerSchemaTransformationAdapter,
} from "@rejot/adapter-postgres";
import { SyncController } from "@rejot/sync/sync-controller-new";
import type {
  AnyIConnectionAdapter,
  AnyIConsumerSchemaTransformationAdapter,
  AnyIPublicSchemaTransformationAdapter,
} from "@rejot/contract/adapter";
<<<<<<< HEAD
import { type ISyncServiceResolver, createResolver } from "@rejot/sync/sync-http-resolver";
=======
import { SyncManifest } from "@rejot/sync/sync-manifest";
import { InMemoryMessageBus } from "@rejot/contract/message-bus";
>>>>>>> c217545 (Sync: rework)

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
    "api-port": Flags.integer({
      description: "Set the port for the sync HTTP service",
      default: 3000,
    }),
    hostname: Flags.string({
      description: "Set the hostname for the sync HTTP service",
      default: "localhost",
    }),
    resolver: Flags.string({
      description: "Set the resolver for the sync HTTP service",
      options: ["localhost", "env"],
      default: "localhost",
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
<<<<<<< HEAD
    const { "log-level": logLevel, hostname, "api-port": apiPort, resolver } = flags;
=======
    const { "log-level": logLevel, hostname: _hostname, "api-port": _apiPort } = flags;
>>>>>>> c217545 (Sync: rework)

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
      const consumerTransformationAdapter = new PostgresConsumerSchemaTransformationAdapter(
        postgresAdapter,
      );

      const connectionAdapters: AnyIConnectionAdapter[] = [postgresAdapter];
      const publicSchemaTransformationAdapters: AnyIPublicSchemaTransformationAdapter[] = [
        transformationAdapter,
      ];
      const consumerSchemaTransformationAdapters: AnyIConsumerSchemaTransformationAdapter[] = [
        consumerTransformationAdapter,
      ];

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

<<<<<<< HEAD
      const httpController = new SyncHTTPController(hostname, apiPort);

      let syncServiceResolver: ISyncServiceResolver;
      if (resolver === "localhost") {
        syncServiceResolver = createResolver({ type: "localhost", apiPort });
      } else if (resolver === "env") {
        syncServiceResolver = createResolver({ type: "env" });
      } else {
        throw new Error(`Invalid resolver: ${resolver}`);
      }
=======
      // const httpController = new SyncHTTPController(hostname, apiPort);
      // const syncServiceResolver = new LocalhostResolver(apiPort);
>>>>>>> c217545 (Sync: rework)

      const eventStore = connectionAdapters
        .find((adapter) => adapter.connectionType === eventStoreConnection.config.connectionType)
        ?.createEventStore(eventStoreConnection.slug, eventStoreConnection.config);

      if (!eventStore) {
        throw new Error(
          `Event store connection '${eventStoreConfig.connectionSlug}' with connection type '${eventStoreConnection.config.connectionType}' not supported`,
        );
      }

      // There are four things we need to be doing:
      // 1. Listen for changes on source data stores and write them to an event store.
      // 2. Listen for changes on the event store and apply them to the consumer schemas.
      // 3. Expose an (HTTP) API to allow other sync services to obtain our public schemas
      // 4. Listen for changes on external sync services and apply them to the consumer schemas.

      // const syncController = new SyncManifestController(
      //   manifests,
      //   connectionAdapters,
      //   publicSchemaTransformationAdapters,
      //   consumerSchemaTransformationAdapters,
      //   eventStore,
      //   httpController,
      //   syncServiceResolver,
      // );

      const messageBus = new InMemoryMessageBus();

      const syncController = new SyncController(
        new SyncManifest(manifests),
        connectionAdapters,
        publicSchemaTransformationAdapters,
        consumerSchemaTransformationAdapters,
        messageBus,
        messageBus,
      );

      let shouldStop = false;
      // Set up signal handlers for graceful shutdown
      process.on("SIGINT", async () => {
        log.info("\nReceived SIGINT, shutting down...");
        await syncController.stop();
        await syncController.close();

        if (!shouldStop) {
          shouldStop = true;
        } else {
          process.exit(0);
        }
      });

      process.on("SIGTERM", async () => {
        log.info("\nReceived SIGTERM, killing...");
        await syncController.stop();
        process.exit(0);
      });

      // Start the sync process
      try {
        await syncController.prepare();
        log.info("Starting sync process...");
        await syncController.start();
        // syncController.startPollingForConsumerSchemas();

        // for await (const transformedOps of syncController.start()) {
        //   log.debug(`Processed ${transformedOps.length} operations`);
        // }

        log.info("Sync process completed");
      } catch (error) {
        log.error("Failed to start sync", error);
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
