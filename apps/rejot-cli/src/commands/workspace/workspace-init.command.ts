import path from "node:path";

import { initManifest } from "@rejot-dev/contract-tools/manifest";

import { Command, Flags } from "@oclif/core";

export class WorkspaceInitCommand extends Command {
  static override id = "workspace init";
  static override description = "Initialize a new ReJot workspace";

  static override examples = [
    "<%= config.bin %> <%= command.id %> --slug myorg",
    "<%= config.bin %> <%= command.id %> --slug myorg --filename custom-manifest.json",
  ];

  static override flags = {
    filename: Flags.string({
      description: "Filename of the workspace manifest file",
      default: "rejot-manifest.json",
    }),
    slug: Flags.string({
      description: "The slug for the workspace (typically follows @organization/ format)",
      required: true,
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(WorkspaceInitCommand);
    const manifestPath = path.resolve(flags.filename);
    const { slug } = flags;

    try {
      await initManifest(manifestPath, slug);
      this.log(`Created new workspace at ${manifestPath}`);
      this.log("\nNext steps:");
      this.log(
        `1. Add a connection:    ${this.config.bin} manifest connection add --slug my-db ...`,
      );
      this.log(
        `2. Add a data store:    ${this.config.bin} manifest datastore add --connection my-db ...`,
      );
      this.log(
        `3. Add sub-manifests:   Edit the manifest and add relative paths to other manifest files in the 'workspaces' array`,
      );
      this.log(`4. View workspace info: ${this.config.bin} workspace info`);
    } catch (error) {
      if (error instanceof Error) {
        if ("code" in error && error.code === "EEXIST") {
          this.error(
            `Workspace manifest file already exists at ${manifestPath}. Use a different path or remove the existing file.`,
          );
        }
        this.error(`Failed to create workspace: ${error.message}`);
      }
      throw error;
    }
  }
}
