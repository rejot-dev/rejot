import { z } from "zod";

import type { AnyIPublicSchemaTransformationAdapter } from "@rejot-dev/contract/adapter";
import type { SyncManifest } from "../../../contract/manifest/sync-manifest";
import type { PublicSchemaTransformationSchema } from "@rejot-dev/contract/manifest";
import type { TransformedOperationWithSource } from "@rejot-dev/contract/event-store";
import type { Transaction } from "@rejot-dev/contract/sync";
import logger from "@rejot-dev/contract/logger";

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
        // Process each transformation in the array
        for (const transformation of publicSchema.transformations) {
          const transformationAdapter = this.#getTransformationAdapter(
            transformation.transformationType,
          );

          const transformedData = await transformationAdapter.applyPublicSchemaTransformation(
            dataStoreSlug,
            operation,
            transformation,
          );

          if (!transformedData) {
            continue;
          }

          if (transformedData.type === "delete") {
            transformedOperations.push({
              type: transformedData.type,
              sourceManifestSlug: publicSchema.source.manifestSlug,
              sourcePublicSchema: {
                name: publicSchema.name,
                version: {
                  major: publicSchema.version.major,
                  minor: publicSchema.version.minor,
                },
              },
              objectKeys: transformedData.objectKeys,
            });
          } else {
            transformedOperations.push({
              type: transformedData.type,
              sourceManifestSlug: publicSchema.source.manifestSlug,
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
