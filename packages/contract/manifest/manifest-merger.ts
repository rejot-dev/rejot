import { z } from "zod";

import { ConsumerSchemaSchema, PublicSchemaSchema, SyncManifestSchema } from "./manifest";

/** Represents the location context for a merge operation */
export interface MergeLocation {
  filePath: string;
  manifestSlug: string;
}

/** Base diagnostic information common to all merge diagnostics */
interface BaseMergeDiagnostic {
  /** The type/severity of the diagnostic */
  type: "info" | "warning" | "error";
  /** Optional hint information to help resolve the diagnostic */
  hint?: {
    /** Suggested actions to resolve the diagnostic */
    suggestions: string[];
  };
}

/** Diagnostic for when a public schema is overwritten */
interface PublicSchemaMergeDiagnostic extends BaseMergeDiagnostic {
  kind: "public_schema";
  /** Information about the new schema that is overwriting the old one */
  item: {
    /** Name of the schema */
    name: string;
    /** Version information */
    version: {
      major: number;
      minor?: number;
    };
    /** Path to the schema definition file */
    sourceDefinitionFile: string;
  };
}

/** Diagnostic for when a consumer schema is overwritten */
interface ConsumerSchemaMergeDiagnostic extends BaseMergeDiagnostic {
  kind: "consumer_schema";
  /** Information about the new schema that is overwriting the old one */
  item: {
    /** Name of the schema */
    name: string;
    /** Path to the schema definition file */
    sourceDefinitionFile: string;
  };
}

/** Diagnostic for when a connection is overwritten */
interface ConnectionMergeDiagnostic extends BaseMergeDiagnostic {
  kind: "connection";
  /** Information about the new connection that is overwriting the old one */
  item: {
    /** Slug of the connection */
    slug: string;
  };
}

/** Diagnostic for when a data store is overwritten */
interface DataStoreMergeDiagnostic extends BaseMergeDiagnostic {
  kind: "data_store";
  /** Information about the new data store that is overwriting the old one */
  item: {
    /** Slug of the connection this store uses */
    connectionSlug: string;
  };
}

/** Diagnostic for when an event store is overwritten */
interface EventStoreMergeDiagnostic extends BaseMergeDiagnostic {
  kind: "event_store";
  /** Information about the new event store that is overwriting the old one */
  item: {
    /** Slug of the connection this store uses */
    connectionSlug: string;
  };
}

/** Union type of all possible merge diagnostics */
export type MergeDiagnostic =
  | PublicSchemaMergeDiagnostic
  | ConsumerSchemaMergeDiagnostic
  | ConnectionMergeDiagnostic
  | DataStoreMergeDiagnostic
  | EventStoreMergeDiagnostic;

export interface MergedManifest {
  manifest: z.infer<typeof SyncManifestSchema>;
  diagnostics: MergeDiagnostic[];
}

export class ManifestMerger {
  /**
   * Merges a base manifest with additional manifests, where items in additional manifests
   * overwrite items in the base manifest.
   */
  static mergeManifests(
    baseManifest: z.infer<typeof SyncManifestSchema>,
    overwriteManifests: Partial<z.infer<typeof SyncManifestSchema>>[],
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
          kind: "connection",
          item: {
            slug: connection.slug,
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
          kind: "data_store",
          item: {
            connectionSlug: store.connectionSlug,
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

  static mergeEventStores(
    eventStores: z.infer<typeof SyncManifestSchema>["eventStores"],
    _location?: MergeLocation,
  ): {
    result: z.infer<typeof SyncManifestSchema>["eventStores"];
    diagnostics: MergeDiagnostic[];
  } {
    const diagnostics: MergeDiagnostic[] = [];
    const result: z.infer<typeof SyncManifestSchema>["eventStores"] = [];
    const seen = new Set<string>();

    for (const store of eventStores ?? []) {
      if (seen.has(store.connectionSlug)) {
        // Right now, event stores don't have any additional information so replacing it is a no-op.
        // This means it's unnecessary to add a diagnostic.
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
      if (!schema.definitionFile) {
        throw new Error(`Public schema '${schema.name}' is missing definitionFile`);
      }

      const key = `${schema.name}@${schema.version.major}`;
      const existing = schemaMap.get(key);

      if (existing) {
        diagnostics.push({
          type: "info",
          kind: "public_schema",
          item: {
            name: schema.name,
            version: {
              major: schema.version.major,
              minor: schema.version.minor,
            },
            sourceDefinitionFile: schema.definitionFile,
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
      if (!schema.definitionFile) {
        throw new Error(`Consumer schema '${schema.name}' is missing definitionFile`);
      }

      const existing = schemaMap.get(schema.name);

      if (existing) {
        diagnostics.push({
          type: "info",
          kind: "consumer_schema",
          item: {
            name: schema.name,
            sourceDefinitionFile: schema.definitionFile,
          },
        });
      }
      schemaMap.set(schema.name, schema);
    }

    return { result: Array.from(schemaMap.values()), diagnostics };
  }

  static getDiagnosticMessage(diagnostic: MergeDiagnostic): string {
    switch (diagnostic.kind) {
      case "public_schema":
        return `Public schema '${diagnostic.item.name}@${diagnostic.item.version.major}' was overwritten with new definition from ${diagnostic.item.sourceDefinitionFile}`;
      case "consumer_schema":
        return `Consumer schema '${diagnostic.item.name}' was overwritten with new definition from ${diagnostic.item.sourceDefinitionFile}`;
      case "connection":
        return `Connection '${diagnostic.item.slug}' was overwritten with new configuration`;
      case "data_store":
        return `Data store '${diagnostic.item.connectionSlug}' was overwritten with new configuration`;
      case "event_store":
        return `Event store '${diagnostic.item.connectionSlug}' was overwritten with new configuration`;
    }
  }
}
