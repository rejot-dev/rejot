import { z } from "zod";
import { SyncManifestSchema, ConnectionSchema } from "@rejot-dev/contract/manifest";

type Manifest = z.infer<typeof SyncManifestSchema>;
type Connection = z.infer<typeof ConnectionSchema>;

export class ManifestPrinter {
  static printManifest(manifest: Manifest): string[] {
    const output: string[] = ["Manifest Configuration:\n"];

    output.push(...this.printConnections(manifest.connections));
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

  private static printDataStores(manifest: Manifest): string[] {
    const output: string[] = ["Data Stores (Replication Sources):"];

    if (manifest.dataStores.length === 0) {
      output.push("  No data stores configured");
      return output;
    }

    for (const ds of manifest.dataStores) {
      output.push(`  - Connection: ${ds.connectionSlug}`);
      output.push(`    Publication / slot: ${ds.publicationName ?? ""} / ${ds.slotName ?? ""}`);
    }

    return output;
  }

  private static printEventStores(manifest: Manifest): string[] {
    const output: string[] = ["Event Stores (Replication Targets):"];

    if (manifest.eventStores.length === 0) {
      output.push("  No event stores configured");
      return output;
    }

    for (const es of manifest.eventStores) {
      output.push(`  - Connection: ${es.connectionSlug}`);
    }

    return output;
  }
}
