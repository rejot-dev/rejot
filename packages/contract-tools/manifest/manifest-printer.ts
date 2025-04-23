import { z } from "zod";

import { JsonSchemaPrinter } from "@rejot-dev/contract/json-schema";
import {
  ConnectionSchema,
  type ConsumerSchemaSchema,
  ConsumerSchemaTransformationSchema,
  type DataStoreConfigSchema,
  type ManifestDiagnostic,
  type PublicSchemaSchema,
  PublicSchemaTransformationSchema,
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
      output.push(this.printDataStoreConfig(ds.config));
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

  private static printEventStores(manifest: Manifest): string[] {
    const output: string[] = ["Event Stores (Replication Targets):"];

    if ((manifest.eventStores ?? []).length === 0) {
      output.push("  No event stores configured");
      return output;
    }

    for (const es of manifest.eventStores ?? []) {
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
    output.push(...this.printPublicSchemasSummary(publicSchemas));

    // Print consumer schemas summary
    output.push(...this.printConsumerSchemasSummary(consumerSchemas));

    return output;
  }

  static printPublicSchemasSummary(
    publicSchemas: Array<{ schema: z.infer<typeof PublicSchemaSchema>; manifestSlug: string }>,
  ): string[] {
    const output: string[] = ["\nPublic Schemas:"];

    if (publicSchemas.length === 0) {
      output.push("  No public schemas defined");
    } else {
      for (const { schema, manifestSlug } of publicSchemas) {
        const definitionInfo = schema.definitionFile
          ? ` (defined in ${schema.definitionFile})`
          : "";
        output.push(
          `  - ${schema.name}@v${schema.version.major}.${schema.version.minor} [manifestSlug: ${manifestSlug}]${definitionInfo}`,
        );
      }
    }

    return output;
  }

  static printConsumerSchemasSummary(
    consumerSchemas: Array<{ schema: z.infer<typeof ConsumerSchemaSchema>; manifestSlug: string }>,
  ): string[] {
    const output: string[] = ["\nConsumer Schemas:"];

    if (consumerSchemas.length === 0) {
      output.push("  No consumer schemas defined");
    } else {
      for (const { schema, manifestSlug } of consumerSchemas) {
        const definitionInfo = schema.definitionFile
          ? ` (defined in ${schema.definitionFile})`
          : "";
        output.push(`  - ${schema.name} [manifestSlug: ${manifestSlug}]${definitionInfo}`);
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

  static printManifestErrors(errors: {
    errors: Array<{ message: string; hint?: { message: string; suggestions?: string } }>;
  }): string[] {
    const output: string[] = ["Manifest contains errors:"];

    for (const error of errors.errors) {
      let message = `  - ${error.message}`;
      if (error.hint) {
        message += `\n      Hint: ${error.hint.message}`;
        if (error.hint.suggestions) {
          message += `\n      Suggestions: ${error.hint.suggestions}`;
        }
      }
      output.push(message);
    }

    return output;
  }

  static printPublicSchema(publicSchemas: Array<z.infer<typeof PublicSchemaSchema>>): string[] {
    const output: string[] = ["Public Schemas:"];

    if (publicSchemas.length === 0) {
      output.push("  No public schemas defined");
      return output;
    }

    for (const publicSchema of publicSchemas) {
      output.push(
        `  - ${publicSchema.name} (v${publicSchema.version.major}.${publicSchema.version.minor})`,
      );

      output.push("    Source Tables:");
      if (publicSchema.source.tables.length === 0) {
        output.push("      No source tables defined");
      } else {
        for (const table of publicSchema.source.tables) {
          output.push(`        - ${table}`);
        }
      }

      output.push(`    Output Schema:`);
      output.push(...JsonSchemaPrinter.printJsonSchema(publicSchema.outputSchema, 3));

      output.push("    Transformations:");
      for (const transformation of publicSchema.transformations) {
        output.push(...this.printPublicSchemaTransformation(transformation, 4));
      }

      if (publicSchema.definitionFile) {
        output.push(`    Definition File: ${publicSchema.definitionFile}`);
      }

      output.push(""); // Add a blank line between schemas
    }

    return output;
  }

  static printConsumerSchema(consumerSchemas: z.infer<typeof ConsumerSchemaSchema>[]): string[] {
    const output: string[] = ["Consumer Schemas:"];

    if (consumerSchemas.length === 0) {
      output.push("  No consumer schemas defined");
      return output;
    }

    for (const consumerSchema of consumerSchemas) {
      output.push(`  - ${consumerSchema.name}`);
      output.push("    Source:");
      if (consumerSchema.sourceManifestSlug) {
        output.push(`      External Manifest: ${consumerSchema.sourceManifestSlug}`);
      }
      output.push(
        `      Public Schema: ${consumerSchema.publicSchema.name} (v${consumerSchema.publicSchema.majorVersion})`,
      );

      output.push(`    Destination Data Store: ${consumerSchema.destinationDataStoreSlug}`);

      output.push("    Transformations:");
      for (const transformation of consumerSchema.transformations) {
        output.push(...this.printConsumerSchemaTransformation(transformation, 4));
      }

      if (consumerSchema.definitionFile) {
        output.push(`    Definition File: ${consumerSchema.definitionFile}`);
      }

      output.push(""); // Add a blank line between schemas
    }

    return output;
  }

  private static printPublicSchemaTransformation(
    transform: z.infer<typeof PublicSchemaTransformationSchema>,
    indentLevel: number,
  ): string[] {
    const indent = " ".repeat(indentLevel * 2);
    const output: string[] = [];

    output.push(`${indent}- Type: ${transform.transformationType}`);
    if (transform.transformationType === "postgresql") {
      output.push(`${indent}  Table: ${transform.table}`);
      output.push(`${indent}  SQL: ${transform.sql}`);
    }

    return output;
  }

  private static printConsumerSchemaTransformation(
    transform: z.infer<typeof ConsumerSchemaTransformationSchema>,
    indentLevel: number,
  ): string[] {
    const indent = " ".repeat(indentLevel * 2);
    const output: string[] = [];

    output.push(`${indent}- Type: ${transform.transformationType}`);
    if (transform.transformationType === "postgresql") {
      if (transform.whenOperation) {
        output.push(`${indent}  When: ${transform.whenOperation}`);
      }
      output.push(`${indent}  SQL: ${transform.sql}`);
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
