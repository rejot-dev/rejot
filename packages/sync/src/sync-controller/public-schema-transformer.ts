import type { AnyIPublicSchemaTransformationAdapter } from "@rejot-dev/contract/adapter";
import { getLogger } from "@rejot-dev/contract/logger";
import { getPublicSchemasForDataStore } from "@rejot-dev/contract/manifest-helpers";
import type { Transaction, TransformedOperation } from "@rejot-dev/contract/sync";
import type { SyncManifest } from "@rejot-dev/contract/sync-manifest";

const log = getLogger(import.meta.url);

export class PublicSchemaTransformer {
  readonly #syncManifest: SyncManifest;
  readonly #publicSchemaTransformationAdapters: AnyIPublicSchemaTransformationAdapter[];

  constructor(
    syncManifest: SyncManifest,
    publicSchemaTransformationAdapters: AnyIPublicSchemaTransformationAdapter[],
  ) {
    this.#syncManifest = syncManifest;
    this.#publicSchemaTransformationAdapters = publicSchemaTransformationAdapters;
  }

  /**
   * Process a transaction and return the transformed operations.
   *
   * @param sourceDataStoreSlug - The slug of the data store to process the transaction for.
   * @param transaction - The transaction to process.
   * @returns The transformed operations.
   */
  async transformToPublicSchema(
    sourceDataStoreSlug: string,
    transaction: Transaction,
  ): Promise<TransformedOperation[]> {
    log.info(
      `Processing transaction ${transaction.id} with ${transaction.operations.length} operation(s) for data store '${sourceDataStoreSlug}'.`,
    );

    const transformedOperations: TransformedOperation[] = [];

    const publicSchemas = getPublicSchemasForDataStore(
      this.#syncManifest.manifests,
      sourceDataStoreSlug,
    );

    const publicSchemasByType = Object.groupBy(
      publicSchemas,
      (schema) => schema.config.publicSchemaType,
    );

    for (const [type, schemas] of Object.entries(publicSchemasByType)) {
      const transformationAdapter = this.#getTransformationAdapter(type);

      const ops = await transformationAdapter.applyPublicSchemaTransformation(
        sourceDataStoreSlug,
        transaction.operations,
        schemas,
      );

      transformedOperations.push(...ops);
    }

    return transformedOperations;
  }

  #getTransformationAdapter(transformationType: string): AnyIPublicSchemaTransformationAdapter {
    const transformationAdapter = this.#publicSchemaTransformationAdapters.find(
      (adapter) => adapter.transformationType === transformationType,
    );

    if (!transformationAdapter) {
      throw new Error(
        `No transformation adapter found for transformation type: ${transformationType}`,
      );
    }

    return transformationAdapter;
  }
}
