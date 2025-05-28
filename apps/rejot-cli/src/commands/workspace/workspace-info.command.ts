import { verifyWorkspace } from "@rejot-dev/contract/workspace";
import { ManifestFileManager } from "@rejot-dev/contract-tools/manifest/manifest-file-manager";
import { ManifestPrinter } from "@rejot-dev/contract-tools/manifest/manifest-printer";
import { ManifestWorkspaceResolver } from "@rejot-dev/contract-tools/manifest/manifest-workspace-resolver";

import { Command, Flags } from "@oclif/core";

export class WorkspaceInfoCommand extends Command {
  static override id = "workspace info";
  static override description =
    "Display information about the current workspace configuration and diagnostics";

  static override examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --filename custom-manifest.json",
  ];

  static override flags = {
    filename: Flags.string({
      description: "Filename of the manifest file",
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(WorkspaceInfoCommand);

    // Use ManifestFileManager to find the workspace path
    const manifestFileManager = new ManifestFileManager();
    const workspaceFilePath = await manifestFileManager.findManifestPath(
      process.cwd(),
      flags.filename,
    );

    if (!workspaceFilePath) {
      this.error(
        `Workspace manifest file not found. Use '${this.config.bin} workspace init --slug <slug>' to create one.`,
      );
    }

    // Resolve the workspace
    const workspaceResolver = new ManifestWorkspaceResolver();
    const workspace = await workspaceResolver.resolveWorkspace({
      startDir: process.cwd(),
      filename: flags.filename,
    });

    if (!workspace) {
      this.error(
        `No workspace found. Use '${this.config.bin} workspace init --slug <slug>' to create one.`,
      );
    }

    // Print workspace information
    const workspaceInfo = ManifestPrinter.printWorkspace(workspace);
    for (const line of workspaceInfo) {
      this.log(line);
    }

    // Print diagnostics
    const diagnostics = verifyWorkspace(workspace);

    if (diagnostics.diagnostics.length > 0) {
      this.log("");
      const diagnosticOutput = ManifestPrinter.printManifestDiagnostics(diagnostics.diagnostics);
      for (const line of diagnosticOutput) {
        this.log(line);
      }
    }

    if (!diagnostics.isValid) {
      this.exit(1);
    }
  }
}
