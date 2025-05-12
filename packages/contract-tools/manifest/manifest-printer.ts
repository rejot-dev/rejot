import { z } from "zod";

import { JsonSchemaPrinter } from "@rejot-dev/contract/json-schema";
import {
  ConnectionSchema,
  type ConsumerSchemaConfigSchema,
  type ConsumerSchemaSchema,
  type DataStoreConfigSchema,
  type EventStoreSchema,
  type ManifestDiagnostic,
  type PublicSchemaConfigSchema,
  type PublicSchemaSchema,
  SyncManifestSchema,
} from "@rejot-dev/contract/manifest";
import type { SyncManifest } from "@rejot-dev/contract/sync-manifest";
import type { WorkspaceDefinition } from "@rejot-dev/contract/workspace";

type Manifest = z.infer<typeof SyncManifestSchema>;
type Connection = z.infer<typeof ConnectionSchema>;

export class ManifestPrinter {
  static printSyncManifest(syncManifest: SyncManifest): string[] {
    const output: string[] = ["Sync Manifest Configuration:\n"];

    // Print all sections using the new getters
    output.push(...this.printConnections(syncManifest.connections));
    output.push("");
    output.push(...this.printDataStores({ dataStores: syncManifest.dataStores } as Manifest));
    output.push("");
    output.push(...this.printEventStores({ eventStores: syncManifest.eventStores } as Manifest));
    output.push("");

    // Print external references if any
    output.push("External Schema References:");
    const externalRefs = syncManifest.getExternalSchemaReferences();
    if (externalRefs.length === 0) {
      output.push("  No external schema references");
    } else {
      for (const ref of externalRefs) {
        output.push(`  - External Manifest: ${ref.manifestSlug}`);
        output.push(
          `    Schema Name: ${ref.publicSchema.name} (v${ref.publicSchema.majorVersion})`,
        );
        output.push(`    Referenced By: ${ref.referencedBy.manifestSlug}`);
      }
    }

    return output;
  }

  static printManifest(manifest: Manifest): string[] {
    const output: string[] = ["Manifest Configuration:\n"];

    output.push(...this.printConnections(manifest.connections ?? []));
    output.push("");
    output.push(...this.printDataStores(manifest));
    output.push("");
    output.push(...this.printEventStores(manifest));

    return output;
  }

  private static printConnections(connections: Connection[]): string[] {
    const output: string[] = ["Connections:"];

    if (connections.length === 0) {
      output.push("  No connections configured");
      return output;
    }

    for (const conn of connections) {
      output.push(`  - ${conn.slug} (${conn.config.connectionType})`);
      switch (conn.config.connectionType) {
        case "postgres":
          output.push(`    Host: ${conn.config.host}:${conn.config.port}`);
          output.push(`    Database: ${conn.config.database}`);
          output.push(`    User: ${conn.config.user}`);
          output.push(
            `    string: postgres://${conn.config.user}@${conn.config.host}:${conn.config.port}/${conn.config.database}`,
          );
          break;
        case "in-memory":
          output.push(`    In-memory connection`);
          break;
      }
    }

    return output;
  }

  static printDataStores(manifest: Manifest): string[] {
    const output: string[] = ["Data Stores (Replication Sources):"];

    if ((manifest.dataStores ?? []).length === 0) {
      output.push("  No data stores configured");
      return output;
    }

    for (const ds of manifest.dataStores ?? []) {
      output.push(`  - Connection: ${ds.connectionSlug}`);
      if (ds.config) {
        output.push(this.printDataStoreConfig(ds.config));
      } else {
        output.push("    (Sink only)");
      }
    }

    return output;
  }

  private static printDataStoreConfig(config: z.infer<typeof DataStoreConfigSchema>): string {
    switch (config.connectionType) {
      case "postgres":
        return `    Publication / slot: ${config.publicationName} / ${config.slotName}`;
      case "in-memory":
        return `    In-memory connection`;
    }
  }

  private static printEventStores({
    eventStores,
  }: {
    eventStores?: z.infer<typeof EventStoreSchema>[];
  }): string[] {
    const output: string[] = ["Event Stores (Replication Targets):"];

    if ((eventStores ?? []).length === 0) {
      output.push("  No event stores configured");
      return output;
    }

    for (const es of eventStores ?? []) {
      output.push(`  - Connection: ${es.connectionSlug}`);
    }

    return output;
  }

  static printWorkspace(workspace: WorkspaceDefinition): string[] {
    const output: string[] = ["Workspace Configuration:\n"];

    // Print ancestor manifest info
    output.push(`Root Path: ${workspace.rootPath}`);
    output.push(`Ancestor Manifest: ${workspace.ancestor.manifest.slug}`);
    output.push(`  Path: ${workspace.ancestor.path}\n`);

    // Print all connections from ancestor
    const connections = [
      ...(workspace.ancestor.manifest.connections ?? []),
      ...workspace.children.flatMap((child) => child.manifest.connections ?? []),
    ];
    output.push(...this.printConnections(connections));
    output.push("");

    // Print all data stores from ancestor and children
    const dataStores = [
      ...(workspace.ancestor.manifest.dataStores ?? []),
      ...workspace.children.flatMap((child) => child.manifest.dataStores ?? []),
    ];
    output.push(...this.printDataStores({ dataStores } as Manifest));
    output.push("");

    // Event stores
    const eventStores = [
      ...(workspace.ancestor.manifest.eventStores ?? []),
      ...workspace.children.flatMap((child) => child.manifest.eventStores ?? []),
    ];
    output.push(...this.printEventStores({ eventStores }));
    output.push("");

    // Print schemas summary
    output.push(...this.printSchemasSummaryFromWorkspace(workspace));
    output.push("");

    // Print child manifests
    output.push("Child Manifests:");
    if (workspace.children.length === 0) {
      output.push("  No child manifests found");
    } else {
      for (const child of workspace.children) {
        output.push(`  - ${child.manifest.slug}`);
        output.push(`    Path: ${child.path}`);
      }
    }

    return output;
  }

  static printSchemasSummaryFromWorkspace(workspace: WorkspaceDefinition): string[] {
    const output: string[] = ["Schema Summary:"];

    // Collect all schemas from ancestor and children with their manifest slugs
    const publicSchemas = [
      ...(workspace.ancestor.manifest.publicSchemas ?? []).map((schema) => ({
        schema,
        manifestSlug: workspace.ancestor.manifest.slug,
      })),
      ...workspace.children.flatMap((child) =>
        (child.manifest.publicSchemas ?? []).map((schema) => ({
          schema,
          manifestSlug: child.manifest.slug,
        })),
      ),
    ];

    const consumerSchemas = [
      ...(workspace.ancestor.manifest.consumerSchemas ?? []).map((schema) => ({
        schema,
        manifestSlug: workspace.ancestor.manifest.slug,
      })),
      ...workspace.children.flatMap((child) =>
        (child.manifest.consumerSchemas ?? []).map((schema) => ({
          schema,
          manifestSlug: child.manifest.slug,
        })),
      ),
    ];

    // Print public schemas summary
    output.push(...this.printPublicSchemasSummary(publicSchemas, 1));

    // Print consumer schemas summary
    output.push(...this.printConsumerSchemasSummary(consumerSchemas, 1));

    return output;
  }

  static printPublicSchemasSummary(
    publicSchemas: Array<{ schema: z.infer<typeof PublicSchemaSchema>; manifestSlug: string }>,
    indentLevel: number = 0,
  ): string[] {
    const indent = " ".repeat(indentLevel * 2);
    const output: string[] = [`${indent}Public Schemas:`];

    if (publicSchemas.length === 0) {
      output.push(`${indent}  No public schemas defined`);
    } else {
      for (const { schema, manifestSlug } of publicSchemas) {
        const definitionInfo = schema.definitionFile
          ? ` (defined in ${schema.definitionFile})`
          : "";
        output.push(
          `${indent}  - ${schema.name}@v${schema.version.major}.${schema.version.minor} [manifestSlug: ${manifestSlug}]${definitionInfo}`,
        );
      }
    }

    return output;
  }

  static printConsumerSchemasSummary(
    consumerSchemas: Array<{ schema: z.infer<typeof ConsumerSchemaSchema>; manifestSlug: string }>,
    indentLevel: number = 0,
  ): string[] {
    const indent = " ".repeat(indentLevel * 2);
    const output: string[] = [`${indent}Consumer Schemas:`];

    if (consumerSchemas.length === 0) {
      output.push(`${indent}  No consumer schemas defined`);
    } else {
      for (const { schema, manifestSlug } of consumerSchemas) {
        const definitionInfo = schema.definitionFile
          ? ` (defined in ${schema.definitionFile})`
          : "";
        output.push(`${indent}  - ${schema.name} [manifestSlug: ${manifestSlug}]${definitionInfo}`);
      }
    }

    return output;
  }

  static printSchemasSummary(manifest: Manifest): string[] {
    const output: string[] = [];
    const manifestSlug = manifest.slug;

    // Print public schemas summary
    output.push("\nPublic Schemas:");
    if ((manifest.publicSchemas ?? []).length === 0) {
      output.push("  No public schemas defined");
    } else {
      for (const schema of manifest.publicSchemas ?? []) {
        const definitionInfo = schema.definitionFile
          ? ` (defined in ${schema.definitionFile})`
          : "";
        output.push(
          `  - ${schema.name}@v${schema.version.major}.${schema.version.minor} [${manifestSlug}]${definitionInfo}`,
        );
      }
    }

    // Print consumer schemas summary
    output.push("\nConsumer Schemas:");
    if ((manifest.consumerSchemas ?? []).length === 0) {
      output.push("  No consumer schemas defined");
    } else {
      for (const schema of manifest.consumerSchemas ?? []) {
        const definitionInfo = schema.definitionFile
          ? ` (defined in ${schema.definitionFile})`
          : "";
        output.push(
          `  - ${schema.name}@v${schema.publicSchema.majorVersion} [${manifestSlug}]${definitionInfo}`,
        );
        output.push(
          `    Source: ${schema.publicSchema.name} from ${schema.sourceManifestSlug || "local manifest"}`,
        );
      }
    }

    return output;
  }

  static printManifestDiagnosticsSummary(diagnostics: ManifestDiagnostic[]): string[] {
    const output: string[] = [];

    const warnings = diagnostics.filter((diagnostic) => diagnostic.severity === "warning");

    const errors = diagnostics.filter((diagnostic) => diagnostic.severity === "error");

    if (warnings.length > 0) {
      output.push(`Found ${warnings.length} warning(s) in manifest configuration:`);
      for (const warning of warnings) {
        output.push(
          `  - ${warning.type}: ${warning.message} (in ${warning.location.manifestSlug}${warning.location.context ? `, ${warning.location.context}` : ""})`,
        );
      }
      output.push("");
    }

    if (errors.length > 0) {
      output.push(`Found ${errors.length} error(s) in manifest configuration:`);
      for (const error of errors) {
        output.push(
          `  - ${error.type}: ${error.message} (in ${error.location.manifestSlug}${error.location.context ? `, ${error.location.context}` : ""})`,
        );
      }
      output.push("");
    }

    return output;
  }

  static printPublicSchema(
    publicSchemas: Array<z.infer<typeof PublicSchemaSchema>>,
    options?: {
      header?: boolean;
      includeSourceTables?: boolean;
    },
  ): string[] {
    const { header = true, includeSourceTables = false } = options ?? {};

    const output: string[] = [];

    if (header) {
      output.push("Public Schemas:");
    }

    if (publicSchemas.length === 0) {
      output.push("  No public schemas defined");
      return output;
    }

    for (const publicSchema of publicSchemas) {
      output.push(
        `  - ${publicSchema.name} (v${publicSchema.version.major}.${publicSchema.version.minor})`,
      );

      if (includeSourceTables) {
        const sourceTables = publicSchema.config.transformations.map((t) => t.table);
        output.push("    Source Tables:");
        if (sourceTables.length === 0) {
          output.push("      No source tables defined");
        } else {
          for (const table of sourceTables) {
            output.push(`        - ${table}`);
          }
        }
      }

      output.push(`    Source connection/data store: ${publicSchema.source.dataStoreSlug}`);

      output.push(`    Output Schema:`);
      output.push(...JsonSchemaPrinter.printJsonSchema(publicSchema.outputSchema, 3));

      output.push(...this.printPublicSchemaConfig(publicSchema.config, 4));

      if (publicSchema.definitionFile) {
        output.push(`    Definition File: ${publicSchema.definitionFile}`);
      }

      output.push(""); // Add a blank line between schemas
    }

    return output;
  }

  static printConsumerSchema(
    consumerSchemas: z.infer<typeof ConsumerSchemaSchema>[],
    options?: {
      header?: boolean;
    },
  ): string[] {
    const { header = true } = options ?? {};

    const output: string[] = [];

    if (header) {
      output.push("Consumer Schemas:");
    }

    if (consumerSchemas.length === 0) {
      output.push("  No consumer schemas defined");
      return output;
    }

    for (const consumerSchema of consumerSchemas) {
      output.push(`  - ${consumerSchema.name}`);
      output.push("    Source:");
      if (consumerSchema.sourceManifestSlug) {
        output.push(`      Source Manifest: ${consumerSchema.sourceManifestSlug}`);
      }
      output.push(
        `      Public Schema: ${consumerSchema.publicSchema.name} (v${consumerSchema.publicSchema.majorVersion}.x)`,
      );

      output.push(...this.printConsumerSchemaConfig(consumerSchema.config, 4));

      if (consumerSchema.definitionFile) {
        output.push(`    Definition File: ${consumerSchema.definitionFile}`);
      }

      output.push(""); // Add a blank line between schemas
    }

    return output;
  }

  private static printPublicSchemaConfig(
    config: z.infer<typeof PublicSchemaConfigSchema>,
    indentLevel: number,
  ): string[] {
    const indent = " ".repeat(indentLevel * 2);
    const output: string[] = [];

    output.push(`${indent}- Type: ${config.publicSchemaType}`);
    if (config.publicSchemaType === "postgres") {
      for (const transformation of config.transformations) {
        output.push(
          `${indent}  Runs on change of table: ${transformation.table} (${transformation.operation})`,
        );
        output.push(`${indent}  SQL: ${transformation.sql}`);
      }
    }

    return output;
  }

  private static printConsumerSchemaConfig(
    config: z.infer<typeof ConsumerSchemaConfigSchema>,
    indentLevel: number,
  ): string[] {
    const indent = " ".repeat(indentLevel * 2);
    const output: string[] = [];

    output.push(`${indent}- Type: ${config.consumerSchemaType}`);
    if (config.consumerSchemaType === "postgres") {
      output.push(`${indent}  Destination Data Store: ${config.destinationDataStoreSlug}`);
      output.push(`${indent}  INSERT/UPDATE SQL: ${config.sql}`);
      if (config.deleteSql) {
        output.push(`${indent}  DELETE SQL: ${config.deleteSql}`);
      }
    }

    return output;
  }

  static printManifestDiagnostic(diagnostic: ManifestDiagnostic): string[] {
    const output: string[] = [];

    // Print the diagnostic type and message
    output.push(`- ${diagnostic.type}:`);
    output.push(`  Message: ${diagnostic.message}`);

    // Print location information
    output.push(`  Location:`);
    output.push(`    Manifest: ${diagnostic.location.manifestSlug}`);
    if (diagnostic.location.context) {
      output.push(`    Context: ${diagnostic.location.context}`);
    }

    // Print hint if available
    if (diagnostic.hint) {
      output.push(`  Hint:`);
      output.push(`    ${diagnostic.hint.message}`);
      if (diagnostic.hint.suggestions) {
        output.push(`    Suggestions: ${diagnostic.hint.suggestions}`);
      }
    }

    return output;
  }

  static printManifestDiagnostics(diagnostics: ManifestDiagnostic[]): string[] {
    if (diagnostics.length === 0) {
      return ["No diagnostics found"];
    }

    const output: string[] = ["Manifest Diagnostics:"];

    for (const diagnostic of diagnostics) {
      output.push(...this.printManifestDiagnostic(diagnostic).map((line) => `  ${line}`));
    }

    return output;
  }

  // Versions without manifested schema (direct schema arrays)
  static printPublicSchemasList(publicSchemas: z.infer<typeof PublicSchemaSchema>[]): string[] {
    const output: string[] = ["\nPublic Schemas:"];

    if (publicSchemas.length === 0) {
      output.push("  No public schemas defined");
    } else {
      for (const schema of publicSchemas) {
        const definitionInfo = schema.definitionFile
          ? ` (defined in ${schema.definitionFile})`
          : "";
        output.push(
          `  - ${schema.name}@v${schema.version.major}.${schema.version.minor}${definitionInfo}`,
        );
      }
    }

    return output;
  }

  static printConsumerSchemasList(
    consumerSchemas: z.infer<typeof ConsumerSchemaSchema>[],
  ): string[] {
    const output: string[] = ["\nConsumer Schemas:"];

    if (consumerSchemas.length === 0) {
      output.push("  No consumer schemas defined");
    } else {
      for (const schema of consumerSchemas) {
        const definitionInfo = schema.definitionFile
          ? ` (defined in ${schema.definitionFile})`
          : "";
        output.push(`  - ${schema.name}${definitionInfo}`);
      }
    }

    return output;
  }
}
