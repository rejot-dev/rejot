import { join } from "node:path";

import { getLogger } from "@rejot-dev/contract/logger";
import { initManifest } from "@rejot-dev/contract-tools/manifest";
import { mergeAndUpdateManifest } from "@rejot-dev/contract-tools/manifest/manifest.fs";
import type { IWorkspaceService } from "@rejot-dev/contract-tools/manifest/manifest-workspace-resolver";
import { z } from "zod";

import type { IFactory, IRejotMcp } from "@/rejot-mcp";
import type { McpState } from "@/state/mcp-state";
import { ensurePathRelative } from "@/util/fs.util";

const log = getLogger(import.meta.url);

export class ManifestInitTool implements IFactory {
  #workspaceService: IWorkspaceService;

  constructor(workspaceService: IWorkspaceService) {
    this.#workspaceService = workspaceService;
  }

  async initialize(_state: McpState): Promise<void> {
    // No state initialization needed
  }

  async register(mcp: IRejotMcp): Promise<void> {
    mcp.registerTool(
      "rejot_manifest_init",
      "Initialize a new manifest file at the specified path. Used for sub-manifests.",
      {
        relativeManifestFilePath: z
          .string()
          .describe(
            "The path to the manifest file to create. Normally the file name is 'rejot-manifest.json'.",
          ),
        slug: z.string().describe("The slug for the manifest."),
      },
      async ({ relativeManifestFilePath, slug }) => {
        log.debug("rejot_manifest_init", { relativeManifestFilePath, slug });

        ensurePathRelative(relativeManifestFilePath);

        const manifestAbsoluteFilePath = join(
          mcp.state.workspaceDirectoryPath,
          relativeManifestFilePath,
        );

        try {
          await initManifest(manifestAbsoluteFilePath, slug, {
            workspace: false,
          });
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

          throw error;
        }

        const { workspace } = await this.#workspaceService.resolveWorkspace(
          mcp.state.workspaceDirectoryPath,
        );
        log.debug("updating workspace root manifest");

        await mergeAndUpdateManifest(join(workspace.rootPath, workspace.ancestor.path), [
          {
            workspaces: [relativeManifestFilePath],
          },
        ]);

        return {
          content: [
            {
              type: "text",
              text: `Created new manifest file at ${relativeManifestFilePath} and updated the workspace (root manifest).`,
            },
            // TODO: Explain next steps here maybe.
          ],
        };
      },
    );
  }
}
