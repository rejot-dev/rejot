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

  async stop(): Promise<void> {
    await Promise.all(this.#sources.values().map((source) => source.stop()));
    await this.#eventStore.stop();

    this.#state = "stopped";
    log.debug("SyncManifestController stopped");
  }

  async start(): Promise<void> {
    if (this.#state !== "prepared") {
      throw new Error("SyncManifestController is not prepared, call prepare() first.");
    }

    this.#state = "running";

    for (const [slug, source] of this.#sources.entries()) {
      await source.subscribe((tx) => {
        return this.#processTransaction(slug, tx);
      });
    }
  }

  get manifests() {
    return this.#manifests;
  }

  async #processTransaction(dataStoreSlug: string, transaction: Transaction): Promise<boolean> {
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

    return this.#eventStore.write(transaction.id, transformedOperations);
  }
}
