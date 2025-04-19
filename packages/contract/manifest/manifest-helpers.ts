import { z } from "zod";
import type { SyncManifestSchema, ConsumerSchemaSchema, PublicSchemaSchema } from "./manifest";
import type { TransformedOperationWithSource } from "@rejot-dev/contract/event-store";
import type { Connection, SourceDataStore, DestinationDataStore, Operation } from "./sync-manifest";
import type { WorkspaceDefinition } from "@rejot-dev/contract-tools/manifest";

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

export function workspaceToManifests(workspace: WorkspaceDefinition): Manifest[] {
  return [workspace.ancestor.manifest, ...workspace.children.map((child) => child.manifest)];
}

export function getConnectionBySlugHelper(
  manifestsOrWorkspace: Manifest[] | WorkspaceDefinition,
  connectionSlug: string,
): Connection | undefined {
  const manifests = Array.isArray(manifestsOrWorkspace)
    ? manifestsOrWorkspace
    : workspaceToManifests(manifestsOrWorkspace);

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

/**
 * Merges multiple manifests into a single manifest.
 * @param baseManifest The complete base manifest that will be used as the foundation
 * @param partialManifests Additional partial manifests to merge. These can be incomplete.
 * The order of precedence for the partial manifests is:
 * - First partial manifest has precedence over second
 * - Second has precedence over third, etc.
 *
 * For schemas with the same name and major version, the one with the highest minor version wins.
 */
export function mergeManifests(
  baseManifest: Manifest,
  ...partialManifests: Partial<Manifest>[]
): Manifest {
  const manifests = [baseManifest, ...partialManifests];

  // Only merge arrays if at least one manifest has them
  const hasConnections = manifests.some((m) => m.connections && m.connections.length > 0);
  const hasDataStores = manifests.some((m) => m.dataStores && m.dataStores.length > 0);
  const hasEventStores = manifests.some((m) => m.eventStores && m.eventStores.length > 0);
  const hasPublicSchemas = manifests.some((m) => m.publicSchemas && m.publicSchemas.length > 0);
  const hasConsumerSchemas = manifests.some(
    (m) => m.consumerSchemas && m.consumerSchemas.length > 0,
  );

  // Get all workspaces and deduplicate
  const allWorkspaces = Array.from(new Set(manifests.flatMap((m) => m.workspaces ?? [])));
  const hasWorkspaces = allWorkspaces.length > 0;

  return {
    ...baseManifest,
    ...(hasConnections && {
      connections: mergeArraysUnique(
        manifests.map((m) => m.connections ?? []),
        "slug",
      ),
    }),
    ...(hasDataStores && {
      dataStores: mergeArraysUnique(
        manifests.map((m) => m.dataStores ?? []),
        "connectionSlug",
      ),
    }),
    ...(hasEventStores && {
      eventStores: mergeArraysUnique(
        manifests.map((m) => m.eventStores ?? []),
        "connectionSlug",
      ),
    }),
    ...(hasPublicSchemas && {
      publicSchemas: mergePublicSchemas(manifests.map((m) => m.publicSchemas ?? [])),
    }),
    ...(hasConsumerSchemas && {
      consumerSchemas: mergeConsumerSchemas(manifests.map((m) => m.consumerSchemas ?? [])),
    }),
    ...(hasWorkspaces && {
      workspaces: allWorkspaces,
    }),
  };
}

/**
 * Merges arrays of objects based on a unique key property.
 * Earlier items in the array take precedence over later ones.
 */
function mergeArraysUnique<T extends { [key: string]: unknown }>(
  arrays: T[][],
  uniqueKey: keyof T,
): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const array of arrays) {
    for (const item of array) {
      const key = String(item[uniqueKey]);
      if (!seen.has(key)) {
        seen.add(key);
        result.push(item);
      }
    }
  }

  return result;
}

/**
 * Merges public schemas from multiple manifests.
 * For schemas with the same name and major version, the one with the highest minor version wins.
 */
export function mergePublicSchemas(
  schemasArrays: z.infer<typeof PublicSchemaSchema>[][],
): z.infer<typeof PublicSchemaSchema>[] {
  const schemaMap = new Map<string, z.infer<typeof PublicSchemaSchema>>();

  for (const schemas of schemasArrays) {
    for (const schema of schemas) {
      const key = `${schema.name}@${schema.version.major}`;

      const existing = schemaMap.get(key);
      if (!existing) {
        schemaMap.set(key, schema);
        continue;
      }

      if (schema.version.minor > existing.version.minor) {
        schemaMap.set(key, schema);
      }
    }
  }

  return Array.from(schemaMap.values());
}

/**
 * Merges consumer schemas from multiple manifests.
 * For schemas with the same name and major version, the one with the highest minor version wins.
 */
export function mergeConsumerSchemas(
  schemasArrays: z.infer<typeof ConsumerSchemaSchema>[][],
): z.infer<typeof ConsumerSchemaSchema>[] {
  const schemaMap = new Map<string, z.infer<typeof ConsumerSchemaSchema>>();

  for (const schemas of schemasArrays) {
    for (const schema of schemas) {
      // For consumer schemas, we only care about the name and major version from the public schema reference
      const key = `${schema.publicSchema.name}@${schema.publicSchema.majorVersion}`;

      const existing = schemaMap.get(key);
      if (!existing) {
        schemaMap.set(key, schema);
        continue;
      }

      // For consumer schemas, we take the first one since they don't have minor versions
      // This maintains the precedence order of the input manifests
    }
  }

  return Array.from(schemaMap.values());
}
