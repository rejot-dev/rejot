import { z } from "zod";
import { ManifestPrinter } from "@rejot-dev/contract-tools/manifest/manifest-printer";
import { readManifest } from "@rejot-dev/contract-tools/manifest";
import { verifyManifests } from "@rejot-dev/contract/manifest";
import type { IRejotMcp, IFactory } from "@/rejot-mcp";
import type { McpState } from "@/state/mcp-state";
import { join } from "node:path";
import { ensurePathRelative } from "@/util/fs.util";

export class ManifestInfoTool implements IFactory {
  async initialize(_state: McpState): Promise<void> {
    // No state initialization needed
  }

  async register(mcp: IRejotMcp): Promise<void> {
    mcp.registerTool(
      "rejot_workspace_manifest_info",
      "Get information about the workspace's manifest.",
      {},
      async () => {
        mcp.state.assertIsInitialized();
        const output = ManifestPrinter.printSyncManifest(mcp.state.syncManifest);
        return {
          content: [{ type: "text", text: output.join("\n") }],
        };
      },
    );

    mcp.registerTool(
      "mcp_rejot_mcp_manifest_info",
      "Get information about a specific manifest",
      {
        relativeManifestFilePath: z.string(),
      },
      async ({ relativeManifestFilePath }) => {
        ensurePathRelative(relativeManifestFilePath);

        const manifestAbsoluteFilePath = join(
          mcp.state.workspaceDirectoryPath,
          relativeManifestFilePath,
        );

        try {
          const manifest = await readManifest(manifestAbsoluteFilePath);
          const errors = verifyManifests([manifest]);

          if (!errors.isValid) {
            const errorOutput = ManifestPrinter.printManifestErrors(errors);
            return {
              content: [{ type: "text", text: errorOutput.join("\n") }],
            };
          }

          const output = ManifestPrinter.printManifest(manifest);
          return {
            content: [{ type: "text", text: output.join("\n") }],
          };
        } catch (error) {
          if (error instanceof Error && "code" in error && error.code === "ENOENT") {
            return {
              content: [
                {
                  isError: true,
                  type: "text",
                  text: `Manifest file not found at ${manifestAbsoluteFilePath}.`,
                },
              ],
            };
          }
          throw error;
        }
      },
    );
  }
}
