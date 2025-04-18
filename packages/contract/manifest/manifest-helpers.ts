import { z } from "zod";
import type { SyncManifestSchema, ConsumerSchemaSchema, PublicSchemaSchema } from "./manifest";
import type { TransformedOperationWithSource } from "@rejot-dev/contract/event-store";
import type { Connection, SourceDataStore, DestinationDataStore, Operation } from "./sync-manifest";

type Manifest = z.infer<typeof SyncManifestSchema>;

// Helper functions extracted from SyncManifest

export function getConnectionsHelper(manifests: Manifest[]): Connection[] {
  return manifests.flatMap((manifest) => manifest.connections ?? []);
}

export function getDataStoresHelper(manifests: Manifest[]): NonNullable<Manifest["dataStores"]> {
  return manifests.flatMap((manifest) => manifest.dataStores ?? []);
}

export function getEventStoresHelper(manifests: Manifest[]): NonNullable<Manifest["eventStores"]> {
  return manifests.flatMap((manifest) => manifest.eventStores ?? []);
}

export function getConnectionBySlugHelper(
  manifests: Manifest[],
  connectionSlug: string,
): Connection | undefined {
  const connections = getConnectionsHelper(manifests);
  const connection = connections.find((connection) => connection.slug === connectionSlug);

  if (!connection) {
    return undefined;
  }

  return {
    slug: connection.slug,
    config: connection.config,
  };
}

export function getSourceDataStoresHelper(manifests: Manifest[]): SourceDataStore[] {
  const dataStores = manifests
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
        // TODO: Type predicate only checks for publicationName and slotName but asserts a type
        //       that includes more properties
      } => Boolean(ds.publicationName && ds.slotName),
    );

  return dataStores.map((ds) => {
    const connection = getConnectionBySlugHelper(manifests, ds.connectionSlug);
    if (!connection) {
      // This error should ideally be caught during verification, but keep for safety
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

export function getDestinationDataStoresHelper(manifests: Manifest[]): DestinationDataStore[] {
  const slugs = Array.from(
    new Set(
      manifests.flatMap((manifest) =>
        (manifest.consumerSchemas ?? []).map((cs) => cs.destinationDataStoreSlug),
      ),
    ),
  );

  return slugs.map((connectionSlug) => {
    const connection = getConnectionBySlugHelper(manifests, connectionSlug);
    if (!connection) {
      // This error should ideally be caught during verification, but keep for safety
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

export function getExternalConsumerSchemasHelper(
  manifests: Manifest[],
): Record<string, z.infer<typeof ConsumerSchemaSchema>[]> {
  if (manifests.length === 0) {
    return {};
  }

  const loadedManifestSlugs = new Set(manifests.map((m) => m.slug));
  const result: Record<string, z.infer<typeof ConsumerSchemaSchema>[]> = {};

  for (const manifest of manifests) {
    for (const consumerSchema of manifest.consumerSchemas ?? []) {
      if (!loadedManifestSlugs.has(consumerSchema.sourceManifestSlug)) {
        if (!result[consumerSchema.sourceManifestSlug]) {
          result[consumerSchema.sourceManifestSlug] = [];
        }
        result[consumerSchema.sourceManifestSlug].push(consumerSchema);
      }
    }
  }

  return result;
}

export function getConsumerSchemasForPublicSchemaHelper(
  manifests: Manifest[],
  operation: TransformedOperationWithSource,
): z.infer<typeof ConsumerSchemaSchema>[] {
  return manifests.flatMap((manifest) =>
    (manifest.consumerSchemas ?? []).filter(
      (consumerSchema) => consumerSchema.publicSchema.name === operation.sourcePublicSchema.name,
    ),
  );
}

export function getPublicSchemasForOperationHelper(
  manifests: Manifest[],
  dataStoreSlug: string,
  operation: Operation,
): (z.infer<typeof PublicSchemaSchema> & { source: { manifestSlug: string } })[] {
  return manifests.flatMap((manifest) =>
    (manifest.publicSchemas ?? [])
      .filter((schema) => {
        const dataStore = (manifest.dataStores ?? []).find(
          (ds) => ds.connectionSlug === dataStoreSlug,
        );
        // Ensure dataStore exists and matches the source slug, and the operation table is included
        return (
          dataStore &&
          schema.source.dataStoreSlug === dataStore.connectionSlug && // Match dataStoreSlug correctly
          schema.source.tables.includes(operation.table)
        );
      })
      .map(({ name, source, transformations, version, outputSchema }) => ({
        name,
        source: {
          ...source,
          manifestSlug: manifest.slug, // Add manifest slug to the source
        },
        transformations,
        version,
        outputSchema,
      })),
  );
}

export function getPublicSchemasHelper(
  manifests: Manifest[],
): (z.infer<typeof PublicSchemaSchema> & { manifestSlug: string })[] {
  return manifests.flatMap((manifest) =>
    (manifest.publicSchemas ?? []).map((schema) => ({
      ...schema,
      manifestSlug: manifest.slug,
    })),
  );
}
