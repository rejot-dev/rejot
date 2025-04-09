import { z } from "zod";
import {
  SyncManifestSchema,
  ConsumerSchemaSchema,
  verifyManifests,
  type ManifestError,
  type ConnectionConfigSchema,
  type PublicSchemaSchema,
} from "@rejot-dev/contract/manifest";
import logger from "@rejot-dev/contract/logger";
import type { TransformedOperationWithSource } from "@rejot-dev/contract/event-store";

const log = logger.createLogger("sync-manifest");

type Manifest = z.infer<typeof SyncManifestSchema>;

export type Connection = {
  slug: string;
  config: z.infer<typeof ConnectionConfigSchema>;
};

export type SourceDataStore = {
  sourceManifestSlug: string;
  connectionSlug: string;
  publicationName: string;
  slotName: string;
  connection: Connection;
};

export type DestinationDataStore = {
  connectionSlug: string;
  connection: Connection;
};

export type ExternalConsumerSchemas = Array<[string, z.infer<typeof ConsumerSchemaSchema>[]]>;

export type Operation = {
  table: string;
};

export type Purpose =
  /** Listens for changes in source data stores, and publishes them to an event store. */
  | "SOURCE_LISTENER"
  /** Listens for changes in an event store, and applies them to consumer schemas. */
  | "EVENT_STORE_LISTENER"
  /** Listens for changes in external sync services, and applies them to consumer schemas. */
  | "EXTERNAL_SYNC_LISTENER"
  /** Publishes an HTTP endpoint to allow others to sync from us. */
  | "EVENT_STORE_PUBLISHER";

interface SyncManifestOptions {
  checkPublicSchemaReferences?: boolean;
}

export class SyncManifest {
  readonly #manifests: Manifest[];

  constructor(manifests: Manifest[], options: SyncManifestOptions = {}) {
    const verificationResult = verifyManifests(manifests, options.checkPublicSchemaReferences);
    if (!verificationResult.isValid) {
      const errorMessages = verificationResult.errors
        .map(
          (error: ManifestError) =>
            `${error.type}: ${error.message} (in ${error.location.manifestSlug}${error.location.context ? `, ${error.location.context}` : ""})`,
        )
        .join("\n");
      throw new Error(`Invalid manifest configuration:\n${errorMessages}`);
    }

    this.#manifests = manifests;
    log.info(`SyncManifest initialized with ${manifests.length} manifests`);
  }

  get manifests(): Manifest[] {
    return this.#manifests;
  }

  getSourceDataStores(): SourceDataStore[] {
    const dataStores = this.#manifests
      .flatMap((manifest) =>
        manifest.dataStores.map((ds) => ({
          ...ds,
          sourceManifestSlug: manifest.slug,
        })),
      )
      .filter(
        (
          ds,
        ): ds is {
          connectionSlug: string;
          publicationName: string;
          slotName: string;
          sourceManifestSlug: string;
        } => Boolean(ds.publicationName && ds.slotName),
      );

    return dataStores.map((ds) => {
      const connection = this.getConnectionBySlug(ds.connectionSlug);
      if (!connection) {
        throw new Error(`Connection '${ds.connectionSlug}' not found in manifests`);
      }
      return {
        ...ds,
        connection: {
          slug: connection.slug,
          config: connection.config,
        },
      };
    });
  }

  getDestinationDataStores(): DestinationDataStore[] {
    const slugs = Array.from(
      new Set(
        this.#manifests.flatMap((manifest) =>
          manifest.consumerSchemas.map((cs) => cs.destinationDataStoreSlug),
        ),
      ),
    );

    return slugs.map((connectionSlug) => {
      const connection = this.getConnectionBySlug(connectionSlug);
      if (!connection) {
        throw new Error(`Connection '${connectionSlug}' not found in manifests`);
      }
      return {
        connectionSlug,
        connection: {
          slug: connection.slug,
          config: connection.config,
        },
      };
    });
  }

  getConnectionBySlug(connectionSlug: string): Connection | undefined {
    const connection = this.#manifests
      .flatMap((manifest) => manifest.connections)
      .find((connection) => connection.slug === connectionSlug);

    if (!connection) return undefined;

    return {
      slug: connection.slug,
      config: connection.config,
    };
  }

  /**
   * Get the consumer schemas for the external sync services.
   *
   * @returns A map of external sync service slugs to their consumer schemas. The consumer schemas
   *          contain a reference to the public schema we want to obtain.
   */
  getExternalConsumerSchemas(): Record<string, z.infer<typeof ConsumerSchemaSchema>[]> {
    const mySlugs = this.#manifests.map((manifest) => manifest.slug);
    const externalSlugToConsumerSchema = this.#manifests.flatMap((manifest) =>
      manifest.consumerSchemas
        .filter((consumer) => !mySlugs.includes(consumer.sourceManifestSlug))
        .map((consumer) => ({
          slug: consumer.sourceManifestSlug,
          consumerSchema: consumer,
        })),
    );

    return externalSlugToConsumerSchema.reduce<
      Record<string, z.infer<typeof ConsumerSchemaSchema>[]>
    >((acc, { slug, consumerSchema }) => {
      if (!acc[slug]) {
        acc[slug] = [];
      }
      acc[slug].push(consumerSchema);
      return acc;
    }, {});
  }

  getConsumerSchemasForPublicSchema(
    operation: TransformedOperationWithSource,
  ): z.infer<typeof ConsumerSchemaSchema>[] {
    return this.#manifests.flatMap((manifest) =>
      manifest.consumerSchemas.filter(
        (consumerSchema) => consumerSchema.publicSchema.name === operation.sourcePublicSchema.name,
      ),
    );
  }

  getPublicSchemasForOperation(
    dataStoreSlug: string,
    operation: Operation,
  ): (z.infer<typeof PublicSchemaSchema> & { source: { manifestSlug: string } })[] {
    return this.#manifests.flatMap((manifest) =>
      manifest.publicSchemas
        .filter((schema) => {
          const dataStore = manifest.dataStores.find((ds) => ds.connectionSlug === dataStoreSlug);
          return (
            dataStore &&
            schema.source.dataStoreSlug === dataStoreSlug &&
            schema.source.tables.includes(operation.table)
          );
        })
        .map(({ name, source, transformation, version, outputSchema }) => ({
          name,
          source: {
            ...source,
            manifestSlug: manifest.slug,
          },
          transformation,
          version,
          outputSchema,
        })),
    );
  }

  getPublicSchemas(): (z.infer<typeof PublicSchemaSchema> & { manifestSlug: string })[] {
    return this.#manifests.flatMap((manifest) =>
      manifest.publicSchemas.map((schema) => ({
        ...schema,
        manifestSlug: manifest.slug,
      })),
    );
  }
}
