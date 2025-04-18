import { z } from "zod";
import { initManifest } from "@rejot-dev/contract-tools/manifest";
import type { IRejotMcp, IFactory } from "@/rejot-mcp";
import type { McpState } from "@/state/mcp-state";
import { dirname, join } from "node:path";
import type { IWorkspaceService } from "@rejot-dev/contract/workspace";
import { ManifestPrinter } from "@rejot-dev/contract-tools/manifest/manifest-printer";
import { getLogger } from "@rejot-dev/contract/logger";

const log = getLogger(import.meta.url);

export class WorkspaceTool implements IFactory {
  readonly #workspaceService: IWorkspaceService;

  constructor(workspaceService: IWorkspaceService) {
    this.#workspaceService = workspaceService;
  }

  async initialize(_state: McpState): Promise<void> {
    // No state initialization needed
  }

  async register(mcp: IRejotMcp): Promise<void> {
    mcp.registerTool(
      "rejot_workspace_init",
      "Initialize a new ReJot workspace by creating a root manifest file.",
      {
        slug: z.string().describe("The slug for the root manifest (workspace). Usually `@org/`."),
        fileName: z.string().default("rejot-manifest.json"),
      },
      async ({ slug, fileName }) => {
        const manifestAbsoluteFilePath = join(mcp.state.workspaceDirectoryPath, fileName);

        try {
          await initManifest(manifestAbsoluteFilePath, slug, { workspace: true });
          log.info(`Workspace initialized successfully at ${manifestAbsoluteFilePath}`);

          const { workspace } = await this.#workspaceService.resolveWorkspace(
            dirname(manifestAbsoluteFilePath),
          );

          mcp.state.setWorkspace(workspace);
          mcp.state.clearInitializationErrors();

          return {
            content: [
              { type: "text", text: `Workspace initialized successfully` },
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
                  text: `Manifest/workspace file already exists at ${manifestAbsoluteFilePath}. Use a different path or remove the existing file.`,
                },
              ],
            };
          }
          throw error;
        }
      },
    );

    mcp.registerTool(
      "rejot_workspace_info",
      "Display information about the current workspace configuration.",
      {},
      async () => {
        log.debug("rejot_workspace_info", {
          workspaceDirectoryPath: mcp.state.workspaceDirectoryPath,
        });

        const { workspace } = await this.#workspaceService.resolveWorkspace(
          mcp.state.workspaceDirectoryPath,
        );
        const workspaceInfo = ManifestPrinter.printWorkspace(workspace);

        return {
          content: [
            {
              type: "text",
              text: workspaceInfo.join("\n"),
            },
          ],
        };
      },
    );
  }
}
