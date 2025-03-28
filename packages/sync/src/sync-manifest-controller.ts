import { z } from "zod";
import {
  ConsumerSchemaSchema,
  SyncManifestSchema,
  verifyManifests,
  type ManifestError,
} from "@rejot/contract/manifest";
import { SchemaValidator } from "@rejot/contract/schema-validator";
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

import { type ISyncHTTPController } from "./sync-http-service/sync-http-service";
import { fetchRead } from "./sync-http-service/sync-http-service-fetch";
import type { ISyncServiceResolver } from "./sync-http-service/sync-http-resolver";

const log = logger.createLogger("sync-manifest-controller");

type Manifest = z.infer<typeof SyncManifestSchema>;

const POLLING_INTERVAL_MS = 5000;

export type SyncManifestControllerState = "initial" | "prepared" | "running" | "stopped";

export class SyncManifestController {
  readonly #abortController: AbortController;

  readonly #manifests: Manifest[];
  readonly #connectionAdapters: AnyIConnectionAdapter[];
  readonly #sources: Map<string, IDataSource> = new Map();

  readonly #transformationRepository: IPublicSchemaTransformationRepository;
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
    const verificationResult = verifyManifests(manifests, false);
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

    this.#abortController = new AbortController();
    this.#transformationRepository = new ManifestTransformationRepository(manifests);
    this.#syncServiceResolver = syncServiceResolver;
  }

  get state(): SyncManifestControllerState {
    return this.#state;
  }

  async prepare(): Promise<void> {
    if (this.#state !== "initial") {
      throw new Error("SyncManifestController is already prepared");
    }

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

      const source = adapter.createSource(connection.slug, connection.config, {
        publicationName,
        slotName,
      });

      this.#sources.set(connection.slug, source);
    }

    await this.#eventStore.prepare(this.#manifests);
    await Promise.all(this.#sources.values().map((source) => source.prepare()));

    await this.#syncHTTPService.start(async (cursors, limit) => {
      return this.#eventStore.read(cursors, limit);
    });

    this.#state = "prepared";
    log.debug("SyncManifestController prepared");
  }

  startPollingForConsumerSchemas() {
    const mySlugs = this.#manifests.map((manifest) => manifest.slug);
    const externalSlugToConsumerSchema = this.#manifests.flatMap((manifest) =>
      manifest.consumerSchemas
        .filter((consumer) => !mySlugs.includes(consumer.sourceManifestSlug))
        .map((consumer) => ({
          slug: consumer.sourceManifestSlug,
          consumerSchema: consumer,
        })),
    );

    if (externalSlugToConsumerSchema.length === 0) {
      log.info("No remote public schemas to poll for");
      return;
    }

    const consumersByRemoteSlug = externalSlugToConsumerSchema.reduce<
      Record<string, z.infer<typeof ConsumerSchemaSchema>[]>
    >((acc, { slug, consumerSchema }) => {
      if (!acc[slug]) {
        acc[slug] = [];
      }
      acc[slug].push(consumerSchema);
      return acc;
    }, {});

    log.debug(`Polling for remote public schemas every ${POLLING_INTERVAL_MS}ms`);
    this.#remotePollingTimer = setInterval(async () => {
      for (const [slug, consumerSchemas] of Object.entries(consumersByRemoteSlug)) {
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
          await this.consumeOperation(operation);
          // TODO: Keep track of consumption in the destination data store
        }
      }
    }, POLLING_INTERVAL_MS);
  }

  async *start(): AsyncIterable<TransformedOperation[]> {
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

        const transformedOps = await this.#processTransaction(slug, transaction);

        if (transformedOps) {
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
    return this.#manifests;
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
          dataStoreSlug,
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
          // Validate transformation result adheres to expected schema
          const validation = this.#schemaValidator.validate(publicSchema, transformedData.new);
          if (!validation.success) {
            throw new Error(
              `Invalid transformation result for public schema: ${validation.errors.join(", ")}`,
            );
          }

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
