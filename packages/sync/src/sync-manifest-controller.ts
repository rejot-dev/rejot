import { z } from "zod";
import {
  ConsumerSchemaSchema,
  SyncManifestSchema,
  verifyManifests,
  type ManifestError,
} from "@rejot/contract/manifest";
import logger from "@rejot/contract/logger";
import type {
  AnyIConnectionAdapter,
  AnyIConsumerSchemaTransformationAdapter,
  AnyIPublicSchemaTransformationAdapter,
} from "@rejot/contract/adapter";
import type { IDataSource, Transaction } from "@rejot/contract/sync";
import type { IPublicSchemaTransformationRepository } from "@rejot/contract/public-schema";
import { ManifestTransformationRepository } from "./manifest/manifest-transformation.repository";
import type { IEventStore, TransformedOperation } from "@rejot/contract/event-store";

import { SyncHTTPController } from "./sync-http-service/sync-http-service";
import { fetchRead } from "./sync-http-service/sync-http-service-fetch";

const log = logger.createLogger("sync-manifest-controller");

type Manifest = z.infer<typeof SyncManifestSchema>;

const POLLING_INTERVAL_MS = 5000;

export type SyncManifestControllerState = "initial" | "prepared" | "running" | "stopped";

export class SyncManifestController {
  readonly #manifests: Manifest[];
  readonly #connectionAdapters: AnyIConnectionAdapter[];
  readonly #sources: Map<string, IDataSource> = new Map();

  readonly #transformationRepository: IPublicSchemaTransformationRepository;
  readonly #publicSchemaTransformationAdapters: AnyIPublicSchemaTransformationAdapter[];
  readonly #consumerSchemaTransformationAdapters: AnyIConsumerSchemaTransformationAdapter[];
  readonly #eventStore: IEventStore;
  readonly #syncHTTPService: SyncHTTPController;

  #remotePollingTimer: Timer | null = null;

  #state: SyncManifestControllerState = "initial";
  #slug: string;

  constructor(
    slug: string,
    manifests: Manifest[],
    connectionAdapters: AnyIConnectionAdapter[],
    publicSchemaTransformationAdapters: AnyIPublicSchemaTransformationAdapter[],
    consumerSchemaTransformationAdapters: AnyIConsumerSchemaTransformationAdapter[],
    eventStore: IEventStore,
    syncHTTPController: SyncHTTPController,
  ) {
    const verificationResult = verifyManifests(manifests);
    if (!verificationResult.isValid) {
      const errorMessages = verificationResult.errors
        .map(
          (error: ManifestError) =>
            `${error.type}: ${error.message} (in ${error.location.manifestSlug}${error.location.context ? `, ${error.location.context}` : ""})`,
        )
        .join("\n");
      throw new Error(`Invalid manifest configuration:\n${errorMessages}`);
    }

    log.info(`SyncManifestController initialized with ${manifests.length} manifests`);

    this.#manifests = manifests;
    this.#connectionAdapters = connectionAdapters;
    this.#publicSchemaTransformationAdapters = publicSchemaTransformationAdapters;
    this.#consumerSchemaTransformationAdapters = consumerSchemaTransformationAdapters;
    this.#eventStore = eventStore;
    this.#syncHTTPService = syncHTTPController;
    this.#slug = slug;
    this.#transformationRepository = new ManifestTransformationRepository(manifests);
  }

  get state(): SyncManifestControllerState {
    return this.#state;
  }

  async prepare(): Promise<void> {
    if (this.#state !== "initial") {
      throw new Error("SyncManifestController is already prepared");
    }

    log.info("SyncManifestController prepare");

    const dataStores = this.#manifests.flatMap((manifest) => manifest.dataStores);

    for (const { connectionSlug, publicationName, slotName } of dataStores) {
      const connection = this.#manifests
        .flatMap((manifest) => manifest.connections)
        .find((connection) => connection.slug === connectionSlug);

      if (!connection) {
        throw new Error(`Connection '${connectionSlug}' not found in manifests`);
      }

      const adapter = this.#connectionAdapters.find(
        (adapter) => adapter.connectionType === connection.config.connectionType,
      );

      if (!adapter) {
        throw new Error(
          `No adapter found for connection type: ${connection.config.connectionType}`,
        );
      }

      const source = adapter.createSource(connection.config, {
        publicationName,
        slotName,
      });

      this.#sources.set(connection.slug, source);
    }

    await this.#eventStore.prepare();
    await Promise.all(this.#sources.values().map((source) => source.prepare()));

    await this.#syncHTTPService.start(async (publicSchemas, fromTransactionId, limit) => {
      return this.#eventStore.read(publicSchemas, fromTransactionId, limit);
    });

    this.#state = "prepared";
    log.debug("SyncManifestController prepared");
  }

  startPollingForConsumerSchemas() {
    const myManifest = this.#manifests.find((manifest) => manifest.slug === this.#slug);
    if (!myManifest) {
      throw new Error(`Manifest '${this.#slug}' not found`);
    }

    // TODO: this should come from the destination data store
    // const consumerCursors = new Map(
    //   myManifest.consumerSchemas.map((remote) => [remote.publicSchema.name, 0]),
    // );
    log.debug(
      `Polling ${myManifest.consumerSchemas.map((c) => `${c.sourceManifestSlug}:${c.publicSchema.name}`).join(", ")} every ${POLLING_INTERVAL_MS}ms`,
    );

    const consumerSchemasBySourceManifestSlug = myManifest.consumerSchemas.reduce(
      (acc, consumer) => {
        if (!acc[consumer.sourceManifestSlug]) {
          acc[consumer.sourceManifestSlug] = [];
        }
        acc[consumer.sourceManifestSlug].push(consumer);
        return acc;
      },
      {} as Record<string, z.infer<typeof ConsumerSchemaSchema>[]>,
    );

    this.#remotePollingTimer = setInterval(async () => {
      for (const [slug, consumers] of Object.entries(consumerSchemasBySourceManifestSlug)) {
        console.log("slug", slug, "consumers", consumers);
        // TODO: method for getting the actual URI
        const host = `http://localhost:3000`;

        const response = await fetchRead(host, {
          publicSchemas: consumers.map((consumer) => ({
            name: consumer.publicSchema.name,
            version: {
              major: consumer.publicSchema.majorVersion,
            },
          })),
        });

        log.trace(
          `received ${response.operations.length} operations from remote ${slug}:${consumers.map((c) => c.publicSchema.name).join(", ")}`,
        );

        for (const operation of response.operations) {
          await this.consumeOperation(operation);
          // TODO: Keep track of consumption in the destination data store
        }
      }
    }, POLLING_INTERVAL_MS);
  }

  async *start(abortSignal: AbortSignal): AsyncIterable<TransformedOperation[]> {
    if (this.#state !== "prepared") {
      throw new Error("SyncManifestController is not prepared, call prepare() first.");
    }

    this.#state = "running";

    const childAbortController = new AbortController();

    abortSignal.addEventListener("abort", () => {
      childAbortController.abort();
    });

    try {
      const sourceIterators = Array.from(this.#sources.entries()).map(([slug, source]) => ({
        slug,
        iterator: source.startIteration(childAbortController.signal),
      }));

      while (!abortSignal.aborted) {
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
            childAbortController.abort();
            break;
          }

          const transformedOps = await this.#processTransaction(slug, transaction);

          if (transformedOps) {
            transaction.ack(true);
            yield transformedOps;
          } else {
            log.warn(`Failed to write transaction ${transaction.id} to event store.`);
            transaction.ack(false);
            childAbortController.abort();
            break;
          }
        } catch (error) {
          console.error("Error processing transaction:", error);
          throw error;
        }
      }
    } finally {
      // Clean up when aborted or done
      if (this.#remotePollingTimer) {
        clearInterval(this.#remotePollingTimer);
      }

      await Promise.all([
        ...Array.from(this.#sources.values()).map((source) => source.stop()),
        this.#eventStore.stop(),
        this.#syncHTTPService.stop(),
      ]);
      this.#state = "stopped";
    }
  }

  get manifests() {
    return this.#manifests;
  }

  /**
   * Process a transaction and return the transformed operations.
   *
   * @param dataStoreSlug - The slug of the data store to process the transaction for.
   * @param transaction - The transaction to process.
   * @returns The transformed operations. Returns NULL when the transactions were NOT persisted.
   */
  async #processTransaction(
    dataStoreSlug: string,
    transaction: Transaction,
  ): Promise<TransformedOperation[] | null> {
    log.info(
      `Processing transaction ${transaction.id} with ${transaction.operations.length} operation(s) for data store '${dataStoreSlug}'.`,
    );

    const transformedOperations: TransformedOperation[] = [];

    // A transaction can have many operations (insert, update, delete) on arbitrary tables.
    for (const operation of transaction.operations) {
      const source = this.#sources.get(dataStoreSlug);
      if (!source) {
        throw new Error(`No source found for data store '${dataStoreSlug}'`);
      }

      // There might be zero or more relevant public schemas for a operation in a given table.
      const publicSchemas = await this.#transformationRepository.getPublicSchemasForOperation(
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
          operation,
          publicSchema.transformation,
        );

        if (transformedData.type === "delete") {
          transformedOperations.push({
            operation: transformedData.type,
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
          transformedOperations.push({
            operation: transformedData.type,
            sourceDataStoreSlug: dataStoreSlug,
            sourcePublicSchema: {
              name: publicSchema.name,
              version: {
                major: publicSchema.version.major,
                minor: publicSchema.version.minor,
              },
            },
            object: transformedData.new,
          });
        }
      }
    }

    const didConsume = await this.#eventStore.write(transaction.id, transformedOperations);
    return didConsume ? transformedOperations : null;
  }

  async consumeOperation(operation: TransformedOperation) {
    const consumerSchemas = this.#manifests.flatMap((manifest) =>
      manifest.consumerSchemas.filter(
        (consumerSchema) => consumerSchema.publicSchema.name === operation.sourcePublicSchema.name,
      ),
    );

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
        operation,
        consumerSchema.transformations[0],
      );
    }
  }
}
