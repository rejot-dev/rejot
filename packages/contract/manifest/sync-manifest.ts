import { z } from "zod";
import {
  SyncManifestSchema,
  ConsumerSchemaSchema,
  type ConnectionConfigSchema,
  type PublicSchemaSchema,
} from "./manifest";
import {
  verifyManifests,
  type ManifestError,
  type ExternalPublicSchemaReference,
  type VerificationResult,
} from "./verify-manifest";
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

export interface SyncManifestOptions {
  checkPublicSchemaReferences?: boolean;
}

export class SyncManifest {
  readonly #manifests: Manifest[];
  readonly #externalSchemaReferences: ExternalPublicSchemaReference[];

  constructor(manifests: Manifest[], options: SyncManifestOptions = {}) {
    const verificationResult: VerificationResult = verifyManifests(
      manifests,
      options.checkPublicSchemaReferences,
    );

    if (verificationResult.errors.length > 0) {
      const errorMessages = verificationResult.errors
        .map(
          (error: ManifestError) =>
            `${error.type}: ${error.message} (in ${error.location.manifestSlug}${error.location.context ? `, ${error.location.context}` : ""})`,
        )
        .join("\n");
      throw new Error(`Invalid manifest configuration:\n${errorMessages}`);
    }

    this.#manifests = manifests;
    this.#externalSchemaReferences = verificationResult.externalReferences;

    log.info(`SyncManifest initialized with ${manifests.length} manifests`);
    if (this.#externalSchemaReferences.length > 0) {
      log.info(`Identified ${this.#externalSchemaReferences.length} external schema references.`);
    }
  }

  get manifests(): Manifest[] {
    return this.#manifests;
  }

  get connections(): Connection[] {
    return this.#manifests.flatMap((manifest) => manifest.connections ?? []);
  }

  get dataStores(): NonNullable<Manifest["dataStores"]> {
    return this.#manifests.flatMap((manifest) => manifest.dataStores ?? []);
  }

  get eventStores(): NonNullable<Manifest["eventStores"]> {
    return this.#manifests.flatMap((manifest) => manifest.eventStores ?? []);
  }

  getSourceDataStores(): SourceDataStore[] {
    const dataStores = this.#manifests
      .flatMap((manifest) =>
        (manifest.dataStores ?? []).map((ds) => ({
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
          (manifest.consumerSchemas ?? []).map((cs) => cs.destinationDataStoreSlug),
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
    const connection = this.connections.find((connection) => connection.slug === connectionSlug);

    if (!connection) {
      return undefined;
    }

    return {
      slug: connection.slug,
      config: connection.config,
    };
  }

  get hasUnresolvedExternalReferences(): boolean {
    return this.#externalSchemaReferences.length > 0;
  }

  /**
   * Get the consumer schemas that reference external manifests.
   *
   * @returns A map where keys are the slugs of external manifests, and values are arrays
   *          of consumer schemas (from the loaded manifests) that reference those external manifests.
   * @throws Error if the internal state is inconsistent (e.g., referenced manifest or schema not found).
   */
  getExternalConsumerSchemas(): Record<string, z.infer<typeof ConsumerSchemaSchema>[]> {
    // If we have no manifests loaded, return an empty result
    if (this.#manifests.length === 0) {
      return {};
    }

    // Get all the manifests' slugs for easy checking
    const loadedManifestSlugs = new Set(this.#manifests.map((m) => m.slug));

    // Collect all consumer schemas that reference external manifests
    const result: Record<string, z.infer<typeof ConsumerSchemaSchema>[]> = {};

    // Loop through all manifests and identify consumer schemas referencing external manifests
    for (const manifest of this.#manifests) {
      for (const consumerSchema of manifest.consumerSchemas ?? []) {
        // Check if the sourceManifestSlug references a manifest not in our loaded set
        if (!loadedManifestSlugs.has(consumerSchema.sourceManifestSlug)) {
          // This is a reference to an external manifest
          if (!result[consumerSchema.sourceManifestSlug]) {
            result[consumerSchema.sourceManifestSlug] = [];
          }

          result[consumerSchema.sourceManifestSlug].push(consumerSchema);
        }
      }
    }

    return result;
  }

  getConsumerSchemasForPublicSchema(
    operation: TransformedOperationWithSource,
  ): z.infer<typeof ConsumerSchemaSchema>[] {
    return this.#manifests.flatMap((manifest) =>
      (manifest.consumerSchemas ?? []).filter(
        (consumerSchema) => consumerSchema.publicSchema.name === operation.sourcePublicSchema.name,
      ),
    );
  }

  getPublicSchemasForOperation(
    dataStoreSlug: string,
    operation: Operation,
  ): (z.infer<typeof PublicSchemaSchema> & { source: { manifestSlug: string } })[] {
    return this.#manifests.flatMap((manifest) =>
      (manifest.publicSchemas ?? [])
        .filter((schema) => {
          const dataStore = (manifest.dataStores ?? []).find(
            (ds) => ds.connectionSlug === dataStoreSlug,
          );
          return (
            dataStore &&
            schema.source.dataStoreSlug === dataStoreSlug &&
            schema.source.tables.includes(operation.table)
          );
        })
        .map(({ name, source, transformations, version, outputSchema }) => ({
          name,
          source: {
            ...source,
            manifestSlug: manifest.slug,
          },
          transformations,
          version,
          outputSchema,
        })),
    );
  }

  getPublicSchemas(): (z.infer<typeof PublicSchemaSchema> & { manifestSlug: string })[] {
    return this.#manifests.flatMap((manifest) =>
      (manifest.publicSchemas ?? []).map((schema) => ({
        ...schema,
        manifestSlug: manifest.slug,
      })),
    );
  }

  /**
   * Get the list of identified external schema references.
   * These are consumer schemas that reference a public schema in a manifest
   * not provided during the initialization of this SyncManifest instance.
   */
  getExternalSchemaReferences(): ExternalPublicSchemaReference[] {
    return this.#externalSchemaReferences;
  }
}
