import { z } from "zod";
import {
  SyncManifestSchema,
  ConnectionSchema,
  type PublicSchemaSchema,
  type ConsumerSchemaSchema,
  type DataStoreConfigSchema,
} from "@rejot-dev/contract/manifest";
import type { SyncManifest } from "@rejot-dev/contract/sync-manifest";
import type { WorkspaceDefinition } from "./manifest-workspace-resolver";
import { JsonSchemaPrinter } from "@rejot-dev/contract/json-schema";

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
      if (publicSchema.transformations.length === 0) {
        output.push("      No transformations defined");
      } else {
        // TODO: Enhance transformation printing if needed
        output.push(`      ${publicSchema.transformations.length} transformation(s) configured`);
      }

      if (publicSchema.definitionFile) {
        output.push(`    Definition File: ${publicSchema.definitionFile}`);
      }

      output.push(""); // Add a blank line between schemas
    }

    return output;
  }

  static printConsumerSchema(
    consumerSchemas: Array<z.infer<typeof ConsumerSchemaSchema>>,
  ): string[] {
    const output: string[] = ["Consumer Schemas:"];

    if (consumerSchemas.length === 0) {
      output.push("  No consumer schemas defined");
      return output;
    }

    for (const consumerSchema of consumerSchemas) {
      output.push("  - Consumer Schema:"); // Indent each consumer schema
      output.push("    Source:");
      if (consumerSchema.sourceManifestSlug) {
        output.push(`      External Manifest: ${consumerSchema.sourceManifestSlug}`);
      }
      output.push(
        `      Public Schema: ${consumerSchema.publicSchema.name} (v${consumerSchema.publicSchema.majorVersion})`,
      );

      output.push(`    Destination Data Store: ${consumerSchema.destinationDataStoreSlug}`);

      output.push("    Transformations:");
      if (consumerSchema.transformations.length === 0) {
        output.push("      No transformations defined");
      } else {
        // TODO: Enhance transformation printing if needed
        output.push(`      ${consumerSchema.transformations.length} transformation(s) configured`);
      }

      if (consumerSchema.definitionFile) {
        output.push(`    Definition File: ${consumerSchema.definitionFile}`);
      }

      output.push(""); // Add a blank line between schemas
    }

    return output;
  }
}
