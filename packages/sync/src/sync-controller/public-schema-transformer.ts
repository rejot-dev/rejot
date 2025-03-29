import { z } from "zod";

import type { AnyIPublicSchemaTransformationAdapter } from "@rejot/contract/adapter";
import type { SyncManifest } from "../../../contract/manifest/sync-manifest";
import type { PublicSchemaTransformationSchema } from "@rejot/contract/manifest";
import type { TransformedOperationWithSource } from "@rejot/contract/event-store";
import type { Transaction } from "@rejot/contract/sync";
import logger from "@rejot/contract/logger";

const log = logger.createLogger("public-schema-transformer");

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
   * @param dataStoreSlug - The slug of the data store to process the transaction for.
   * @param transaction - The transaction to process.
   * @returns The transformed operations.
   */
  async transformToPublicSchema(
    dataStoreSlug: string,
    transaction: Transaction,
  ): Promise<TransformedOperationWithSource[]> {
    log.info(
      `Processing transaction ${transaction.id} with ${transaction.operations.length} operation(s) for data store '${dataStoreSlug}'.`,
    );

    const transformedOperations: TransformedOperationWithSource[] = [];

    // A transaction can have many operations (insert, update, delete) on arbitrary tables.
    for (const operation of transaction.operations) {
      // There might be zero or more relevant public schemas for a operation in a given table.
      const publicSchemas = this.#syncManifest.getPublicSchemasForOperation(
        dataStoreSlug,
        operation,
      );

      for (const publicSchema of publicSchemas) {
        const transformationAdapter = this.#getTransformationAdapter(
          publicSchema.transformation.transformationType,
        );

        const transformedData = await transformationAdapter.applyPublicSchemaTransformation(
          dataStoreSlug,
          operation,
          publicSchema.transformation,
        );

        if (transformedData.type === "delete") {
          transformedOperations.push({
            type: transformedData.type,
            sourceManifestSlug: publicSchema.source.manifestSlug,
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
            type: transformedData.type,
            sourceManifestSlug: publicSchema.source.manifestSlug,
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

  #getTransformationAdapter(
    transformationType: z.infer<typeof PublicSchemaTransformationSchema>["transformationType"],
  ) {
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
