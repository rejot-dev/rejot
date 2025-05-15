import path from "node:path";

import { verifyManifests } from "@rejot-dev/contract/manifest";
import { readManifest } from "@rejot-dev/contract-tools/manifest/manifest.fs";
import { ManifestPrinter } from "@rejot-dev/contract-tools/manifest/manifest-printer";

import { Command, Flags } from "@oclif/core";

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
    "<%= config.bin %> manifest datastore add --connection my-source --publication my_pub --slot my_rejot_slot",
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

      if (!manifest) {
        this.error(
          `Manifest file not found at ${manifestPath}. Use 'rejot-cli manifest init' to create one.`,
        );
      }

      const errors = verifyManifests([manifest]);

      if (!errors.isValid) {
        const errorOutput = ManifestPrinter.printManifestDiagnosticsSummary(errors.diagnostics);

        for (const line of errorOutput) {
          this.log(line);
        }
        this.exit(1);
      }

      // Use the ManifestPrinter for the main display
      const output = ManifestPrinter.printManifest(manifest);
      for (const line of output) {
        this.log(line);
      }

      // Print public and consumer schemas summary
      const schemaSummary = ManifestPrinter.printSchemasSummary(manifest);
      for (const line of schemaSummary) {
        this.log(line);
      }

      if (
        (manifest.connections ?? []).length === 0 &&
        (manifest.dataStores ?? []).length === 0 &&
        (manifest.eventStores ?? []).length === 0 &&
        (manifest.workspaces ?? []).length === 0
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
