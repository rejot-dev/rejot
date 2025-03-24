import { z } from "zod";
import { SyncManifestSchema, verifyManifests, type ManifestError } from "@rejot/contract/manifest";
import logger from "@rejot/contract/logger";
import type {
  AnyIConnectionAdapter,
  AnyIPublicSchemaTransformationAdapter,
} from "@rejot/contract/adapter";
import type { IDataSource, Transaction } from "@rejot/contract/sync";
import type { IPublicSchemaTransformationRepository } from "@rejot/contract/public-schema";
import { ManifestTransformationRepository } from "./manifest/manifest-transformation.repository";
import type { IEventStore, TransformedOperation } from "@rejot/contract/event-store";

const log = logger.createLogger("sync-manifest-controller");

type Manifest = z.infer<typeof SyncManifestSchema>;

export type SyncManifestControllerState = "initial" | "prepared" | "running" | "stopped";

export class SyncManifestController {
  readonly #manifests: Manifest[];
  readonly #connectionAdapters: AnyIConnectionAdapter[];
  readonly #sources: Map<string, IDataSource> = new Map();

  readonly #transformationRepository: IPublicSchemaTransformationRepository;
  readonly #publicSchemaTransformationAdapters: AnyIPublicSchemaTransformationAdapter[];
  readonly #eventStore: IEventStore;

  #state: SyncManifestControllerState = "initial";

  constructor(
    manifests: Manifest[],
    connectionAdapters: AnyIConnectionAdapter[],
    publicSchemaTransformationAdapters: AnyIPublicSchemaTransformationAdapter[],
    eventStore: IEventStore,
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
    this.#eventStore = eventStore;

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

    this.#state = "prepared";
    log.debug("SyncManifestController prepared");
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
      await Promise.all([
        ...Array.from(this.#sources.values()).map((source) => source.stop()),
        this.#eventStore.stop(),
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
}
