import { Command, Flags } from "@oclif/core";
import path from "node:path";
import { readManifest } from "@rejot/contract/manifest.fs";
import { verifyManifests } from "@rejot/contract/manifest";

export class ManifestInfoCommand extends Command {
  static override id = "manifest";
  static override description = `Display and manage Rejot manifest file for configuring data synchronization.
  
  The manifest file defines:
  - Connections: Database connection details
  - Data Stores: Source databases for replication
  - Event Stores: Target databases for replication
  
  Use subcommands to manage each component:
  - manifest init: Create a new manifest file
  - manifest connection: Manage database connections
  - manifest datastore: Manage data stores (replication sources)
  - manifest eventstore: Manage event stores (replication targets)`;

  static override examples = [
    // View manifest
    "<%= config.bin %> manifest",
    "<%= config.bin %> manifest --manifest ./custom-manifest.json",
    // Other commands
    "<%= config.bin %> manifest init",
    '<%= config.bin %> manifest connection add --slug my-source --connection-string "postgresql://user:pass@host:5432/db"',
    "<%= config.bin %> manifest datastore add --connection my-source --publication my-pub",
    "<%= config.bin %> manifest eventstore add --connection my-target",
  ];

  static override flags = {
    manifest: Flags.string({
      description: "Path to manifest file",
      default: "./rejot-manifest.json",
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(ManifestInfoCommand);
    const manifestPath = path.resolve(flags.manifest);

    try {
      const manifest = await readManifest(manifestPath);

      const errors = verifyManifests([manifest]);

      if (!errors.isValid) {
        this.log("Manifest contains errors:");
        for (const error of errors.errors) {
          this.log(`  - ${error.message}`);
          if (error.hint) {
            this.log(`      Hint: ${error.hint.message}`);
            if (error.hint.suggestions) {
              this.log(`      Suggestions: ${error.hint.suggestions}`);
            }
          }
          this.log("");
        }
        this.exit(1);
      }

      // Pretty print the manifest
      this.log("Manifest Configuration:\n");

      // Print connections
      this.log("Connections:");
      if (manifest.connections.length === 0) {
        this.log("  No connections configured");
      } else {
        for (const conn of manifest.connections) {
          this.log(`  - ${conn.slug} (${conn.config.connectionType})`);
          switch (conn.config.connectionType) {
            case "postgres":
              this.log(`    Host: ${conn.config.host}:${conn.config.port}`);
              this.log(`    Database: ${conn.config.database}`);
              this.log(`    User: ${conn.config.user}`);
              this.log(
                `    string: postgres://${conn.config.user}@${conn.config.host}:${conn.config.port}/${conn.config.database}`,
              );
              break;
            case "in-memory":
              this.log(`    In-memory connection`);
              break;
          }
        }
      }
      this.log("");

      // Print data stores
      this.log("Data Stores (Replication Sources):");
      if (manifest.dataStores.length === 0) {
        this.log("  No data stores configured");
      } else {
        for (const ds of manifest.dataStores) {
          this.log(`  - Connection: ${ds.connectionSlug}`);
          this.log(`    Publication / slot: ${ds.publicationName ?? ""} / ${ds.slotName ?? ""}`);
        }
      }
      this.log("");

      // Print event stores
      this.log("Event Stores (Replication Targets):");
      if (manifest.eventStores.length === 0) {
        this.log("  No event stores configured");
      } else {
        for (const es of manifest.eventStores) {
          this.log(`  - Connection: ${es.connectionSlug}`);
        }
      }

      // Print help if no components are configured
      if (
        manifest.connections.length === 0 &&
        manifest.dataStores.length === 0 &&
        manifest.eventStores.length === 0
      ) {
        this.log("\nTo configure the manifest, use the following commands:");
        this.log("1. Add a connection:    rejot manifest connection add --slug my-db ...");
        this.log("2. Add a data store:    rejot manifest datastore add --connection my-db ...");
        this.log("3. Add an event store:  rejot manifest eventstore add --connection my-target");
      }
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        this.error(
          `Manifest file not found at ${manifestPath}. Use 'rejot manifest init' to create one.`,
        );
      }
      throw error;
    }
  }
}
