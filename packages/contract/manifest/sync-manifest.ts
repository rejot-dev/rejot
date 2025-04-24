import { z } from "zod";

import type { TransformedOperationWithSource } from "../event-store/event-store.ts";
import { getLogger } from "../logger/logger.ts";
import {
  type ConnectionConfigSchema,
  ConsumerSchemaSchema,
  type DataStoreConfigSchema,
  type PublicSchemaSchema,
  SyncManifestSchema,
} from "./manifest.ts";
import {
  getConnectionBySlugHelper,
  getConnectionsHelper,
  getConsumerSchemasForPublicSchemaHelper,
  getDataStoresHelper,
  getDestinationDataStoresHelper,
  getEventStoresHelper,
  getExternalConsumerSchemasHelper,
  getPublicSchemasForOperationHelper,
  getPublicSchemasHelper,
  getSourceDataStoresHelper,
} from "./manifest-helpers.ts";
import {
  type ExternalPublicSchemaReference,
  type VerificationResult,
  verifyManifests,
} from "./verify-manifest.ts";

const log = getLogger(import.meta.url);

type Manifest = z.infer<typeof SyncManifestSchema>;

export type Connection = {
  slug: string;
  config: z.infer<typeof ConnectionConfigSchema>;
};

export type DataStoreConfig = z.infer<typeof DataStoreConfigSchema>;

export type SourceDataStore = {
  sourceManifestSlug: string;
  connectionSlug: string;
  config: DataStoreConfig;
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

    const warnings = verificationResult.diagnostics.filter(
      (diagnostic) => diagnostic.severity === "warning",
    );

    const errors = verificationResult.diagnostics.filter(
      (diagnostic) => diagnostic.severity === "error",
    );

    if (warnings.length > 0) {
      log.user(`Found ${warnings.length} warning(s) in manifest configuration:`);
      for (const warning of warnings) {
        log.user(
          `  - ${warning.type}: ${warning.message} (in ${warning.location.manifestSlug}${warning.location.context ? `, ${warning.location.context}` : ""})`,
        );
      }
      log.user("");
    }

    if (errors.length > 0) {
      log.user(`Found ${errors.length} error(s) in manifest configuration:`);
      for (const error of errors) {
        log.user(
          `  - ${error.type}: ${error.message} (in ${error.location.manifestSlug}${error.location.context ? `, ${error.location.context}` : ""})`,
        );
      }
      log.user("");
      throw new Error(`Cannot sync: invalid manifest configuration.`);
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
    return getConnectionsHelper(this.#manifests);
  }

  get dataStores(): NonNullable<Manifest["dataStores"]> {
    return getDataStoresHelper(this.#manifests);
  }

  get eventStores(): NonNullable<Manifest["eventStores"]> {
    return getEventStoresHelper(this.#manifests);
  }

  getSourceDataStores(): SourceDataStore[] {
    return getSourceDataStoresHelper(this.#manifests);
  }

  getDestinationDataStores(): DestinationDataStore[] {
    return getDestinationDataStoresHelper(this.#manifests);
  }

  getConnectionBySlug(connectionSlug: string): Connection | undefined {
    return getConnectionBySlugHelper(this.#manifests, connectionSlug);
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
    return getExternalConsumerSchemasHelper(this.#manifests);
  }

  getConsumerSchemasForPublicSchema(
    operation: TransformedOperationWithSource,
  ): z.infer<typeof ConsumerSchemaSchema>[] {
    return getConsumerSchemasForPublicSchemaHelper(this.#manifests, operation);
  }

  getPublicSchemasForOperation(
    dataStoreSlug: string,
    operation: Operation,
  ): (z.infer<typeof PublicSchemaSchema> & { source: { manifestSlug: string } })[] {
    return getPublicSchemasForOperationHelper(this.#manifests, dataStoreSlug, operation);
  }

  getPublicSchemas(): (z.infer<typeof PublicSchemaSchema> & { manifestSlug: string })[] {
    return getPublicSchemasHelper(this.#manifests);
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
