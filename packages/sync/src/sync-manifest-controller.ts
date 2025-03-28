import { z } from "zod";
import { SyncManifestSchema } from "@rejot/contract/manifest";
import logger from "@rejot/contract/logger";
import type {
  AnyIConnectionAdapter,
  AnyIConsumerSchemaTransformationAdapter,
  AnyIPublicSchemaTransformationAdapter,
} from "@rejot/contract/adapter";
import type { IDataSink, IDataSource, Transaction } from "@rejot/contract/sync";
import type { IEventStore, TransformedOperationWithSource } from "@rejot/contract/event-store";
import { SyncManifest } from "./manifest/sync-manifest";

import { type ISyncHTTPController } from "./sync-http-service/sync-http-service";
import { fetchRead } from "./sync-http-service/sync-http-service-fetch";
import type { ISyncServiceResolver } from "./sync-http-service/sync-http-resolver";
import { SchemaValidator } from "@rejot/contract/schema-validator";

const log = logger.createLogger("sync-manifest-controller");

type Manifest = z.infer<typeof SyncManifestSchema>;

const POLLING_INTERVAL_MS = 500;

export type SyncManifestControllerState = "initial" | "prepared" | "running" | "stopped";

export class SyncManifestController {
  readonly #abortController: AbortController;
  readonly #syncManifest: SyncManifest;
  readonly #connectionAdapters: AnyIConnectionAdapter[];

  readonly #sources: Map<string, IDataSource> = new Map();
  readonly #sinks: Map<string, IDataSink> = new Map();

  readonly #publicSchemaTransformationAdapters: AnyIPublicSchemaTransformationAdapter[];
  readonly #consumerSchemaTransformationAdapters: AnyIConsumerSchemaTransformationAdapter[];
  readonly #eventStore: IEventStore;
  readonly #syncHTTPService: ISyncHTTPController;
  readonly #syncServiceResolver: ISyncServiceResolver;

  #remotePollingTimer: Timer | null = null;

  #state: SyncManifestControllerState = "initial";

  #schemaValidator: SchemaValidator = new SchemaValidator();

  constructor(
    manifests: Manifest[],
    connectionAdapters: AnyIConnectionAdapter[],
    publicSchemaTransformationAdapters: AnyIPublicSchemaTransformationAdapter[],
    consumerSchemaTransformationAdapters: AnyIConsumerSchemaTransformationAdapter[],
    eventStore: IEventStore,
    syncHTTPController: ISyncHTTPController,
    syncServiceResolver: ISyncServiceResolver,
  ) {
    this.#syncManifest = new SyncManifest(manifests);
    this.#connectionAdapters = connectionAdapters;
    this.#publicSchemaTransformationAdapters = publicSchemaTransformationAdapters;
    this.#consumerSchemaTransformationAdapters = consumerSchemaTransformationAdapters;
    this.#eventStore = eventStore;
    this.#syncHTTPService = syncHTTPController;

    this.#abortController = new AbortController();
    this.#syncServiceResolver = syncServiceResolver;

    log.info(`SyncManifestController initialized with ${manifests.length} manifests`);
  }

  get state(): SyncManifestControllerState {
    return this.#state;
  }

  async prepare(): Promise<void> {
    if (this.#state !== "initial") {
      throw new Error("SyncManifestController is already prepared");
    }

    const sourceDataStores = this.#syncManifest.getSourceDataStores();
    const destinationDataStores = this.#syncManifest.getDestinationDataStores();

    for (const { connectionSlug, publicationName, slotName, connection } of sourceDataStores) {
      const adapter = this.#connectionAdapters.find(
        (adapter) => adapter.connectionType === connection.config.connectionType,
      );

      if (!adapter) {
        throw new Error(
          `No adapter found for connection type: ${connection.config.connectionType}`,
        );
      }

      const source = adapter.createSource(connectionSlug, connection.config, {
        publicationName,
        slotName,
      });

      this.#sources.set(connectionSlug, source);
    }

    for (const { connectionSlug, connection } of destinationDataStores) {
      const adapter = this.#connectionAdapters.find(
        (adapter) => adapter.connectionType === connection.config.connectionType,
      );

      if (!adapter) {
        throw new Error(
          `No adapter found for connection type: ${connection.config.connectionType}`,
        );
      }

      const sink = adapter.createSink(connectionSlug, connection.config);
      this.#sinks.set(connectionSlug, sink);
    }

    await Promise.all([
      ...Array.from(this.#sinks.values()).map((sink) => sink.prepare()),
      ...Array.from(this.#sources.values()).map((source) => source.prepare()),
      this.#eventStore.prepare(this.#syncManifest.manifests),
    ]);

    await this.#syncHTTPService.start(async (cursors, limit) => {
      return this.#eventStore.read(cursors, limit);
    });

    this.#state = "prepared";
    log.debug("SyncManifestController prepared");
  }

  startPollingForConsumerSchemas() {
    const externalConsumerSchemas = this.#syncManifest.getExternalConsumerSchemas();

    if (Object.keys(externalConsumerSchemas).length === 0) {
      log.info("No remote public schemas to poll for");
      return;
    }

    log.debug(`Polling for remote public schemas every ${POLLING_INTERVAL_MS}ms`);
    this.#remotePollingTimer = setInterval(async () => {
      for (const [slug, consumerSchemas] of Object.entries(externalConsumerSchemas)) {
        const host = this.#syncServiceResolver.resolve(slug);

        const response = await fetchRead(host, false, {
          publicSchemas: consumerSchemas.map((consumer) => ({
            name: consumer.publicSchema.name,
            version: {
              major: consumer.publicSchema.majorVersion,
            },
            cursor: null, // Start from beginning
          })),
        });

        log.trace(`received ${response.operations.length} operations from remote ${slug}`);

        // TODO: Multiple operations in a single transaction could trigger the same consumer
        //       multiple times. We need to de-dupe.
        for (const operation of response.operations) {
          await this.#consumeEventStoreOperation(slug, operation);
          // TODO: Keep track of consumption in the destination data store
        }
      }
    }, POLLING_INTERVAL_MS);
  }

  async *start(): AsyncIterable<TransformedOperationWithSource[]> {
    if (this.#state === "stopped") {
      return;
    }

    if (this.#state !== "prepared") {
      throw new Error("SyncManifestController is not prepared, call prepare() first.");
    }

    this.#state = "running";

    const sourceIterators = Array.from(this.#sources.entries()).map(([slug, source]) => ({
      slug,
      iterator: source.startIteration(this.#abortController.signal),
    }));

    while (this.#state === "running") {
      try {
        // Wait for any source to produce a transaction
        const results = await Promise.race(
          sourceIterators.map(async ({ slug, iterator }) => {
            const result = await iterator.next();
            if (result.done) {
              return { slug, result: null };
            }
            return { slug, result: result.value };
          }),
        );

        const { slug, result: transaction } = results;
        if (!transaction) {
          log.warn(`Source '${slug}' stopped iterating.`);
          await this.stop();
          break;
        }

        const transformedOps = await this.#applyPublicSchemasToTransaction(slug, transaction);
        const wroteToEventStore = await this.#eventStore.write(transaction.id, transformedOps);

        if (wroteToEventStore) {
          transaction.ack(true);
          yield transformedOps;
        } else {
          log.warn(`Failed to write transaction ${transaction.id} to event store.`);
          transaction.ack(false);
          await this.stop();
          break;
        }
      } catch (error) {
        console.error("Error processing transaction:", error);
        throw error;
      }
    }
  }

  get manifests() {
    return this.#syncManifest.manifests;
  }

  async stop() {
    this.#abortController.abort();

    // Clean up when aborted or done
    if (this.#remotePollingTimer) {
      clearInterval(this.#remotePollingTimer);
    }

    await Promise.all([
      ...Array.from(this.#sources.values()).map(async (source) => {
        await source.stop();
        await source.close();
      }),
      ...Array.from(this.#sinks.values()).map(async (sink) => {
        await sink.close();
      }),
      this.#eventStore.stop(),
      this.#syncHTTPService.stop(),
    ]);

    this.#state = "stopped";
  }

  /**
   * Process a transaction and return the transformed operations.
   *
   * @param dataStoreSlug - The slug of the data store to process the transaction for.
   * @param transaction - The transaction to process.
   * @returns The transformed operations.
   */
  async #applyPublicSchemasToTransaction(
    dataStoreSlug: string,
    transaction: Transaction,
  ): Promise<TransformedOperationWithSource[]> {
    log.info(
      `Processing transaction ${transaction.id} with ${transaction.operations.length} operation(s) for data store '${dataStoreSlug}'.`,
    );

    const transformedOperations: TransformedOperationWithSource[] = [];

    // A transaction can have many operations (insert, update, delete) on arbitrary tables.
    for (const operation of transaction.operations) {
      const source = this.#sources.get(dataStoreSlug);
      if (!source) {
        throw new Error(`No source found for data store '${dataStoreSlug}'`);
      }

      // There might be zero or more relevant public schemas for a operation in a given table.
      const publicSchemas = this.#syncManifest.getPublicSchemasForOperation(
        dataStoreSlug,
        operation,
      );

      for (const publicSchema of publicSchemas) {
        const transformationAdapter = this.#publicSchemaTransformationAdapters.find(
          (adapter) =>
            adapter.transformationType === publicSchema.transformation.transformationType,
        );

        if (!transformationAdapter) {
          throw new Error(
            `No transformation adapter found for transformation type: ${publicSchema.transformation.transformationType}`,
          );
        }

        const transformedData = await transformationAdapter.applyPublicSchemaTransformation(
          dataStoreSlug,
          operation,
          publicSchema.transformation,
        );

        if (transformedData.type === "delete") {
          transformedOperations.push({
            type: transformedData.type,
            sourceDataStoreSlug: dataStoreSlug,
            sourcePublicSchema: {
              name: publicSchema.name,
              version: {
                major: publicSchema.version.major,
                minor: publicSchema.version.minor,
              },
            },
          });
        } else {
          // Validate transformation result adheres to expected schema
          const validation = this.#schemaValidator.validate(publicSchema, transformedData.object);
          if (!validation.success) {
            throw new Error(
              `Invalid transformation result for public schema: ${validation.errors.join(", ")}`,
            );
          }

          transformedOperations.push({
            type: transformedData.type,
            sourceDataStoreSlug: dataStoreSlug,
            sourcePublicSchema: {
              name: publicSchema.name,
              version: {
                major: publicSchema.version.major,
                minor: publicSchema.version.minor,
              },
            },
            object: transformedData.object,
          });
        }
      }
    }

    return transformedOperations;
  }

  async #consumeEventStoreOperation(
    destinationDataStoreSlug: string,
    operation: TransformedOperationWithSource,
  ) {
    const consumerSchemas = this.#syncManifest.getConsumerSchemasForPublicSchema(operation);

    for (const consumerSchema of consumerSchemas) {
      const transformationAdapter = this.#consumerSchemaTransformationAdapters.find(
        (adapter) =>
          adapter.transformationType === consumerSchema.transformations[0].transformationType, // TODO: multiple?
      );

      if (!transformationAdapter) {
        throw new Error(
          `No transformation adapter found for transformation type: ${consumerSchema.transformations[0].transformationType}`,
        );
      }

      await transformationAdapter.applyConsumerSchemaTransformation(
        destinationDataStoreSlug,
        operation,
        consumerSchema.transformations[0],
      );
    }
  }
}
