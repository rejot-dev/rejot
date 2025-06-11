import { z } from "zod";

import {
  PostgresConnectionAdapter,
  PostgresConsumerSchemaTransformationAdapter,
  PostgresPublicSchemaTransformationAdapter,
} from "@rejot-dev/adapter-postgres";
import type {
  AnyIConnectionAdapter,
  AnyIConsumerSchemaTransformationAdapter,
  AnyIPublicSchemaTransformationAdapter,
} from "@rejot-dev/contract/adapter";
import type { IEventStore } from "@rejot-dev/contract/event-store";
import { InMemoryEventStore } from "@rejot-dev/contract/event-store";
import { EventStoreMessageBus } from "@rejot-dev/contract/event-store-message-bus";
import { ConsoleLogger, getLogger, setLogger } from "@rejot-dev/contract/logger";
import { SyncManifestSchema } from "@rejot-dev/contract/manifest";
import type { ISubscribeMessageBus } from "@rejot-dev/contract/message-bus";
import { SyncManifest } from "@rejot-dev/contract/sync-manifest";
import { ManifestWorkspaceResolver } from "@rejot-dev/contract-tools/manifest/manifest-workspace-resolver";
import { ExternalSyncMessageBus } from "@rejot-dev/sync/external-sync-message-bus";
import { SyncController } from "@rejot-dev/sync/sync-controller-new";
import { createResolver, type ISyncServiceResolver } from "@rejot-dev/sync/sync-http-resolver";
import { SyncHTTPController } from "@rejot-dev/sync/sync-http-service";

import { Args, Command, Flags } from "@oclif/core";

const log = getLogger(import.meta.url);

export class ManifestSyncCommand extends Command {
  static override id = "manifest sync";

  static override description = `Start syncing based on one or more manifest files.\n
    Opens replication slots in the source data stores, transforms writes using public schemas,
    and stores the events in the configured event store.`;

  static override examples = [
    "<%= config.bin %> <%= command.id %> ./rejot-manifest.json",
    "<%= config.bin %> <%= command.id %> ./manifest1.json ./manifest2.json",
  ];

  static override flags = {
    "log-level": Flags.string({
      description: "Set the log level (user, error, warn, info, debug, trace)",
      options: ["user", "error", "warn", "info", "debug", "trace"],
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
      options: ["localhost", "env"] as const,
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

  #getAdapters() {
    const postgresAdapter = new PostgresConnectionAdapter();
    const publicSchemaAdapter = new PostgresPublicSchemaTransformationAdapter(postgresAdapter);
    const consumerSchemaAdapter = new PostgresConsumerSchemaTransformationAdapter(postgresAdapter);

    return {
      connectionAdapters: [postgresAdapter] as AnyIConnectionAdapter[],
      publicSchemaAdapters: [publicSchemaAdapter] as AnyIPublicSchemaTransformationAdapter[],
      consumerSchemaAdapters: [consumerSchemaAdapter] as AnyIConsumerSchemaTransformationAdapter[],
    };
  }

  #createEventStore(
    manifests: z.infer<typeof SyncManifestSchema>[],
    connectionAdapters: AnyIConnectionAdapter[],
  ): IEventStore {
    const [eventStoreConfig] = manifests.flatMap((manifest) => manifest.eventStores ?? []);
    if (!eventStoreConfig) {
      log.warn(
        "No event store configuration found in manifest, falling back to in-memory event store.",
      );
      return new InMemoryEventStore();
    }

    const connections = manifests.flatMap((manifest) => manifest.connections ?? []);
    const eventStoreConnection = connections.find(
      (conn) => conn.slug === eventStoreConfig.connectionSlug,
    );

    if (!eventStoreConnection) {
      throw new Error(
        `Event store connection '${eventStoreConfig.connectionSlug}' not found in manifest`,
      );
    }

    const eventStore = connectionAdapters
      .find((adapter) => adapter.connectionType === eventStoreConnection.config.connectionType)
      ?.createEventStore(eventStoreConnection.slug, eventStoreConnection.config);

    if (!eventStore) {
      throw new Error(
        `Event store connection '${eventStoreConfig.connectionSlug}' with connection type '${eventStoreConnection.config.connectionType}' not supported`,
      );
    }

    return eventStore;
  }

  public async run(): Promise<void> {
    const { flags, argv } = await this.parse(ManifestSyncCommand);
    const { "log-level": logLevel, hostname: hostname, "api-port": apiPort, resolver } = flags;

    const manifestPaths = z.array(z.string()).parse(argv);

    setLogger(new ConsoleLogger(logLevel.toUpperCase()));
    const workspaceResolver = new ManifestWorkspaceResolver();

    try {
      // Read and parse manifest files
      const manifests = (
        await Promise.all(
          manifestPaths.flatMap(async (path) => {
            const workspace = await workspaceResolver.resolveWorkspace({
              startDir: process.cwd(),
              filename: path,
            });

            if (!workspace) {
              log.warn(`No workspace/manifests found in ${path}`);
              return [];
            }

            const allManifests = [workspace.ancestor, ...workspace.children];
            return allManifests;
          }),
        )
      ).flat();

      log.info(`Successfully loaded ${manifests.length} manifest(s)`);

      const syncManifest = new SyncManifest(manifests, {
        checkPublicSchemaReferences: false,
      });

      // Create adapters
      const { connectionAdapters, publicSchemaAdapters, consumerSchemaAdapters } =
        this.#getAdapters();

      // Create event store from the first manifest's event store config
      const eventStore = this.#createEventStore(syncManifest.manifests, connectionAdapters);

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

      // const messageBus = new InMemoryMessageBus();
      const eventStoreMessageBus = new EventStoreMessageBus(eventStore);

      const subscribeMessageBuses: ISubscribeMessageBus[] = [eventStoreMessageBus];

      if (syncManifest.hasUnresolvedExternalReferences) {
        let syncServiceResolver: ISyncServiceResolver;
        if (resolver === "localhost") {
          syncServiceResolver = createResolver({ type: "localhost", apiPort });
        } else if (resolver === "env") {
          syncServiceResolver = createResolver({ type: "env" });
        } else {
          throw new Error(`Invalid resolver: ${resolver}`);
        }

        const externalSyncMessageBus = new ExternalSyncMessageBus(
          syncManifest,
          syncServiceResolver,
        );

        subscribeMessageBuses.push(externalSyncMessageBus);

        log.info(`Listening for changes on external sync services`);
      } else {
        log.info("No external sync services to listen to.");
      }

      const syncController = new SyncController(
        syncManifest,
        connectionAdapters,
        publicSchemaAdapters,
        consumerSchemaAdapters,
        eventStoreMessageBus,
        subscribeMessageBuses,
      );

      if (hostname && apiPort) {
        const httpController = new SyncHTTPController(
          { hostname, port: apiPort },
          syncController,
          eventStore,
        );
        syncController.startServingHTTPEndpoints(httpController);
      }

      let shouldKill = false;
      // Set up signal handlers for graceful shutdown
      process.on("SIGINT", async () => {
        if (!shouldKill) {
          shouldKill = true;
        } else {
          process.exit(0);
        }

        log.info("\nReceived SIGINT, shutting down...");
        await syncController.stop();
        await syncController.close();
        log.info("SIGINT Handled.");
      });

      process.on("SIGTERM", async () => {
        log.info("\nReceived SIGTERM, killing...");
        await syncController.stop();
        await syncController.close();
        process.exit(0);
      });

      // Start the sync process
      try {
        await syncController.prepare();
        log.info("Starting sync process...");
        await syncController.start();
        log.info("Sync process completed");
      } catch (error) {
        log.error("An error occurred during syncing.");
        log.logErrorInstance(error);
        this.exit(1);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        log.user("Manifest file format is invalid.");
        log.logErrorInstance(error);
      } else {
        throw error;
      }
      this.exit(1);
    }
  }
}
