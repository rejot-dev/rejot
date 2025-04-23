import { z } from "zod";

import { ConsumerSchemaSchema, PublicSchemaSchema, SyncManifestSchema } from "./manifest";

export interface MergedManifest {
  manifest: z.infer<typeof SyncManifestSchema>;
  diagnostics: MergeDiagnostic[];
}

export interface MergeDiagnostic {
  type: "info" | "warning" | "error";
  message: string;
  context: {
    schemaType?: "public" | "consumer";
    schemaName?: string;
    version?: {
      major: number;
      minor?: number;
    };
    connectionSlug?: string;
    storeType?: "data" | "event";
    originalLocation?: string;
  };
  location?: {
    filePath?: string;
    manifestSlug?: string;
  };
  hint?: {
    message?: string;
    suggestions?: string[];
  };
}

export class ManifestMerger {
  /**
   * Merges a base manifest with additional manifests, where items in additional manifests
   * overwrite items in the base manifest.
   */
  static mergeManifests(
    baseManifest: z.infer<typeof SyncManifestSchema>,
    overwriteManifests: z.infer<typeof SyncManifestSchema>[],
  ): MergedManifest {
    let allDiagnostics: MergeDiagnostic[] = [];
    const hasConnections = overwriteManifests.some(
      (m) => m.connections && m.connections.length > 0,
    );
    const hasDataStores = overwriteManifests.some((m) => m.dataStores && m.dataStores.length > 0);
    const hasEventStores = overwriteManifests.some(
      (m) => m.eventStores && m.eventStores.length > 0,
    );
    const hasPublicSchemas = overwriteManifests.some(
      (m) => m.publicSchemas && m.publicSchemas.length > 0,
    );
    const hasConsumerSchemas = overwriteManifests.some(
      (m) => m.consumerSchemas && m.consumerSchemas.length > 0,
    );

    // Get all workspaces and deduplicate
    const allWorkspaces = Array.from(
      new Set([
        ...(baseManifest.workspaces ?? []),
        ...overwriteManifests.flatMap((m) => m.workspaces ?? []),
      ]),
    );
    const hasWorkspaces = allWorkspaces.length > 0;

    const mergedManifest = { ...baseManifest };

    if (hasConnections) {
      const { result, diagnostics } = this.mergeConnections([
        ...(baseManifest.connections ?? []),
        ...overwriteManifests.flatMap((m) => m.connections ?? []),
      ]);
      mergedManifest.connections = result;
      allDiagnostics = [...allDiagnostics, ...diagnostics];
    }

    if (hasDataStores) {
      const { result, diagnostics } = this.mergeDataStores([
        ...(baseManifest.dataStores ?? []),
        ...overwriteManifests.flatMap((m) => m.dataStores ?? []),
      ]);
      mergedManifest.dataStores = result;
      allDiagnostics = [...allDiagnostics, ...diagnostics];
    }

    if (hasEventStores) {
      const { result, diagnostics } = this.mergeEventStores([
        ...(baseManifest.eventStores ?? []),
        ...overwriteManifests.flatMap((m) => m.eventStores ?? []),
      ]);
      mergedManifest.eventStores = result;
      allDiagnostics = [...allDiagnostics, ...diagnostics];
    }

    if (hasPublicSchemas) {
      const { result, diagnostics } = this.mergePublicSchemas([
        ...(baseManifest.publicSchemas ?? []),
        ...overwriteManifests.flatMap((m) => m.publicSchemas ?? []),
      ]);
      mergedManifest.publicSchemas = result;
      allDiagnostics = [...allDiagnostics, ...diagnostics];
    }

    if (hasConsumerSchemas) {
      const { result, diagnostics } = this.mergeConsumerSchemas([
        ...(baseManifest.consumerSchemas ?? []),
        ...overwriteManifests.flatMap((m) => m.consumerSchemas ?? []),
      ]);
      mergedManifest.consumerSchemas = result;
      allDiagnostics = [...allDiagnostics, ...diagnostics];
    }

    if (hasWorkspaces) {
      mergedManifest.workspaces = allWorkspaces;
    }

    return {
      manifest: mergedManifest,
      diagnostics: allDiagnostics,
    };
  }

  static mergeConnections(connections: z.infer<typeof SyncManifestSchema>["connections"]): {
    result: z.infer<typeof SyncManifestSchema>["connections"];
    diagnostics: MergeDiagnostic[];
  } {
    const diagnostics: MergeDiagnostic[] = [];
    const result: z.infer<typeof SyncManifestSchema>["connections"] = [];
    const seen = new Set<string>();

    for (const connection of connections ?? []) {
      if (seen.has(connection.slug)) {
        diagnostics.push({
          type: "info",
          message: `Connection '${connection.slug}' was overwritten with new configuration`,
          context: {
            connectionSlug: connection.slug,
          },
        });
        // Replace the existing connection
        const index = result.findIndex((c) => c.slug === connection.slug);
        result[index] = connection;
      } else {
        seen.add(connection.slug);
        result.push(connection);
      }
    }

    return { result, diagnostics };
  }

  static mergeDataStores(dataStores: z.infer<typeof SyncManifestSchema>["dataStores"]): {
    result: z.infer<typeof SyncManifestSchema>["dataStores"];
    diagnostics: MergeDiagnostic[];
  } {
    const diagnostics: MergeDiagnostic[] = [];
    const result: z.infer<typeof SyncManifestSchema>["dataStores"] = [];
    const seen = new Set<string>();

    for (const store of dataStores ?? []) {
      if (seen.has(store.connectionSlug)) {
        diagnostics.push({
          type: "info",
          message: `Data store '${store.connectionSlug}' was overwritten with new configuration`,
          context: {
            connectionSlug: store.connectionSlug,
            storeType: "data",
          },
        });
        // Replace the existing store
        const index = result.findIndex((ds) => ds.connectionSlug === store.connectionSlug);
        result[index] = store;
      } else {
        seen.add(store.connectionSlug);
        result.push(store);
      }
    }

    return { result, diagnostics };
  }

  static mergeEventStores(eventStores: z.infer<typeof SyncManifestSchema>["eventStores"]): {
    result: z.infer<typeof SyncManifestSchema>["eventStores"];
    diagnostics: MergeDiagnostic[];
  } {
    const diagnostics: MergeDiagnostic[] = [];
    const result: z.infer<typeof SyncManifestSchema>["eventStores"] = [];
    const seen = new Set<string>();

    for (const store of eventStores ?? []) {
      if (seen.has(store.connectionSlug)) {
        diagnostics.push({
          type: "info",
          message: `Event store '${store.connectionSlug}' was overwritten with new configuration`,
          context: {
            connectionSlug: store.connectionSlug,
            storeType: "event",
          },
        });
        // Replace the existing store
        const index = result.findIndex((es) => es.connectionSlug === store.connectionSlug);
        result[index] = store;
      } else {
        seen.add(store.connectionSlug);
        result.push(store);
      }
    }

    return { result, diagnostics };
  }

  static mergePublicSchemas(schemas: z.infer<typeof PublicSchemaSchema>[]): {
    result: z.infer<typeof PublicSchemaSchema>[];
    diagnostics: MergeDiagnostic[];
  } {
    const diagnostics: MergeDiagnostic[] = [];
    const schemaMap = new Map<string, z.infer<typeof PublicSchemaSchema>>();

    for (const schema of schemas ?? []) {
      const key = `${schema.name}@${schema.version.major}`;
      const existing = schemaMap.get(key);

      if (existing) {
        diagnostics.push({
          type: "info",
          message: `Public schema '${schema.name}@${schema.version.major}' was overwritten with new definition from ${schema.definitionFile ?? "unknown location"}`,
          context: {
            schemaType: "public",
            schemaName: schema.name,
            version: {
              major: schema.version.major,
              minor: schema.version.minor,
            },
            originalLocation: existing.definitionFile,
          },
        });
      }
      schemaMap.set(key, schema);
    }

    return { result: Array.from(schemaMap.values()), diagnostics };
  }

  static mergeConsumerSchemas(schemas: z.infer<typeof ConsumerSchemaSchema>[]): {
    result: z.infer<typeof ConsumerSchemaSchema>[];
    diagnostics: MergeDiagnostic[];
  } {
    const diagnostics: MergeDiagnostic[] = [];
    const schemaMap = new Map<string, z.infer<typeof ConsumerSchemaSchema>>();

    for (const schema of schemas ?? []) {
      const existing = schemaMap.get(schema.name);

      if (existing) {
        diagnostics.push({
          type: "info",
          message: `Consumer schema '${schema.name}' was overwritten with new definition from ${schema.definitionFile ?? "unknown location"}`,
          context: {
            schemaType: "consumer",
            schemaName: schema.name,
            version: {
              major: schema.publicSchema.majorVersion,
            },
            originalLocation: existing.definitionFile,
          },
        });
      }
      schemaMap.set(schema.name, schema);
    }

    return { result: Array.from(schemaMap.values()), diagnostics };
  }
}
