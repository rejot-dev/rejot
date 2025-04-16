import type { IRejotMcp, IFactory } from "@/rejot-mcp";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { type IManifestWorkspaceResolver } from "@rejot-dev/contract-tools/manifest";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import type { McpState } from "@/state/mcp-state";
import type { ManifestError } from "@rejot-dev/contract/manifest";
import { getLogger, type ILogger } from "@rejot-dev/contract/logger";

export class ProjectInitializer implements IFactory {
  readonly #workspaceResolver: IManifestWorkspaceResolver;
  readonly #logger: ILogger;

  constructor(workspaceResolver: IManifestWorkspaceResolver, logger: ILogger = getLogger()) {
    this.#workspaceResolver = workspaceResolver;
    this.#logger = logger;
  }

  async initialize(state: McpState): Promise<void> {
    this.#logger.info("initializeProject", {
      projectDir: state.projectDir,
    });

    // Resolve workspace
    const workspace = await this.#workspaceResolver.resolveWorkspace({
      startDir: state.projectDir,
    });

    this.#logger.info("Workspace resolved", {
      rootPath: workspace.rootPath,
      ancestor: workspace.ancestor.path,
      children: workspace.children.map((c) => c.path),
    });

    state.setWorkspace(workspace);

    // Create sync manifest
    try {
      const syncManifest = this.#workspaceResolver.workspaceToSyncManifest(workspace);
      state.setSyncManifest(syncManifest);
    } catch (error) {
      // Handle sync manifest creation errors
      if (error instanceof Error && "errors" in error) {
        state.setError({
          message: "Failed to create sync manifest",
          errors: (error as { errors: ManifestError[] }).errors,
        });
      } else {
        state.setError({
          message: error instanceof Error ? error.message : String(error),
        });
      }
      throw error;
    }
  }

  async register(mcp: IRejotMcp): Promise<void> {
    const workspace = mcp.state.workspace;

    const list = () => {
      const rootUri = `rejot://workspace/${workspace.ancestor.path}`;
      const rootResource = {
        name: `Root Manifest ('${workspace.ancestor.manifest.slug}'), URI: ${rootUri}`,
        uri: rootUri,
        description: `Root manifest for ${workspace.ancestor.manifest.slug}`,
      };

      const resources = [
        rootResource,
        ...workspace.children.map((c) => {
          const uri = `rejot://workspace/${c.path}`;

          this.#logger.info("child", {
            uri,
          });

          return {
            name: `Manifest ('${c.manifest.slug}'), URI: ${uri}`,
            uri,
            description: `Manifest for ${c.manifest.slug}`,
          };
        }),
      ];

      return { resources };
    };

    mcp.server.resource(
      "ReJot Manifests",
      new ResourceTemplate("rejot://workspace/{+path}", {
        list,
      }),
      async (uri) => {
        this.#logger.info("READ rejot://workspace/{+path}:", {
          uri,
        });

        // Extract the path from the URI
        const pathParam = uri.pathname.replace(/^\//, "");

        // Find the corresponding manifest (root or child)
        let manifestContent;
        let absolutePath;

        // Check if it's the root manifest
        if (pathParam === workspace.ancestor.path) {
          manifestContent = workspace.ancestor.manifest;
          absolutePath = join(workspace.rootPath, workspace.ancestor.path);
        } else {
          // Try to find it in children
          const childManifest = workspace.children.find((c) => c.path === pathParam);
          if (childManifest) {
            manifestContent = childManifest.manifest;
            absolutePath = join(workspace.rootPath, childManifest.path);
          }
        }

        if (!manifestContent) {
          throw new Error(`Manifest not found for path: ${pathParam}`);
        }

        // Read the file to get the actual JSON content with formatting preserved
        let rawContent = "";
        try {
          if (absolutePath) {
            rawContent = await readFile(absolutePath, "utf-8");
          } else {
            throw new Error("Could not determine absolute path");
          }
        } catch (_error) {
          // Fall back to the parsed manifest if we can't read the file
          rawContent = JSON.stringify(manifestContent, null, 2);
        }

        return {
          contents: [
            {
              uri: uri.href,
              text: rawContent,
            },
          ],
        };
      },
    );
  }
}
