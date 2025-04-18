import { z } from "zod";
import { initManifest, writeManifest } from "@rejot-dev/contract-tools/manifest";
import type { IRejotMcp, IFactory } from "@/rejot-mcp";
import type { McpState } from "@/state/mcp-state";
import { join } from "node:path";
import { ensurePathRelative } from "@/util/fs.util";
import type { SyncManifestSchema } from "@rejot-dev/contract/manifest";
import { getLogger } from "@rejot-dev/contract/logger";

const log = getLogger(import.meta.url);

export class ManifestInitTool implements IFactory {
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

        let createdManifest: z.infer<typeof SyncManifestSchema>;

        try {
          createdManifest = await initManifest(manifestAbsoluteFilePath, slug, {
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

        mcp.state.workspace.children.push({
          path: relativeManifestFilePath,
          manifest: createdManifest,
        });

        if (!mcp.state.workspace.ancestor.manifest.workspaces) {
          mcp.state.workspace.ancestor.manifest.workspaces = [];
        }

        if (!mcp.state.workspace.ancestor.manifest.workspaces.includes(relativeManifestFilePath)) {
          mcp.state.workspace.ancestor.manifest.workspaces.push(relativeManifestFilePath);
        }

        log.debug("updating workspace root manifest");

        await writeManifest(
          mcp.state.workspace.ancestor.manifest,
          join(mcp.state.workspace.rootPath, mcp.state.workspace.ancestor.path),
        );

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
