import { z } from "zod";
import { initManifest } from "@rejot-dev/contract-tools/manifest";
import type { IRejotMcp, IFactory } from "@/rejot-mcp";
import type { McpState } from "@/state/mcp-state";
import type { IWorkspaceService } from "@/workspace/workspace";
import { dirname, join } from "node:path";
import { ensurePathRelative } from "@/util/fs.util";

export class ManifestInitTool implements IFactory {
  readonly #workspaceService: IWorkspaceService;

  constructor(workspaceService: IWorkspaceService) {
    this.#workspaceService = workspaceService;
  }

  async initialize(_state: McpState): Promise<void> {
    // No state initialization needed
  }

  async register(mcp: IRejotMcp): Promise<void> {
    mcp.registerTool(
      "mcp_rejot_mcp_manifest_init",
      "Initialize a new manifest file at the specified path",
      {
        relativeManifestFilePath: z
          .string()
          .describe(
            "The path to the manifest file to create. Normally the file name is 'rejot-manifest.json'.",
          ),
        slug: z.string().describe("The slug for the manifest."),
      },
      async ({ relativeManifestFilePath, slug }) => {
        ensurePathRelative(relativeManifestFilePath);

        const manifestAbsoluteFilePath = join(mcp.state.projectDir, relativeManifestFilePath);

        try {
          await initManifest(manifestAbsoluteFilePath, slug);
          const { workspace, syncManifest } = await this.#workspaceService.initWorkspace(
            dirname(manifestAbsoluteFilePath),
          );

          mcp.state.setWorkspace(workspace);
          mcp.state.setSyncManifest(syncManifest);
          mcp.state.clearInitializationErrors();

          return {
            content: [
              { type: "text", text: `Created new manifest file at ${manifestAbsoluteFilePath}` },
              // TODO: Explain next steps here maybe.
            ],
          };
        } catch (error) {
          if (error instanceof Error && "code" in error && error.code === "EEXIST") {
            return {
              content: [
                {
                  isError: true,
                  type: "text",
                  text: `Manifest file already exists at ${manifestAbsoluteFilePath}. Use a different path or remove the existing file.`,
                },
              ],
            };
          }
          return {
            content: [
              {
                isError: true,
                type: "text",
                text: `Failed to create manifest: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
          };
        }
      },
    );
  }
}
