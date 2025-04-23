import { join } from "node:path";

import { z } from "zod";

import { getLogger } from "@rejot-dev/contract/logger";
import { verifyManifests } from "@rejot-dev/contract/manifest";
import { workspaceToManifests } from "@rejot-dev/contract/manifest-helpers";
import { initManifest } from "@rejot-dev/contract-tools/manifest";
import { ManifestPrinter } from "@rejot-dev/contract-tools/manifest/manifest-printer";
import type { IWorkspaceService } from "@rejot-dev/contract-tools/manifest/manifest-workspace-resolver";

import type { IFactory, IRejotMcp } from "@/rejot-mcp";
import type { McpState } from "@/state/mcp-state";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

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

        const content: CallToolResult["content"] = [
          {
            type: "text",
            text: workspaceInfo.join("\n"),
          },
        ];

        const diagnostics = verifyManifests(workspaceToManifests(workspace));

        if (diagnostics.errors.length > 0) {
          content.push({
            type: "text",
            text: ManifestPrinter.printManifestDiagnostics(diagnostics.errors).join("\n"),
          });
          content.push({
            type: "text",
            text: "To fix these diagnostics, DO NOT edit the manifest. Update the underlying definition file and run collect.",
          });
        }

        return {
          content,
        };
      },
    );
  }
}
