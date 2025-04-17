import type { IRejotMcp, IFactory } from "@/rejot-mcp";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import type { McpState } from "@/state/mcp-state";
import { getLogger } from "@rejot-dev/contract/logger";
import type { IWorkspaceService } from "./workspace";

const log = getLogger("mcp.workspace.resources");

export class WorkspaceResources implements IFactory {
  readonly #workspaceService: IWorkspaceService;

  constructor(workspaceService: IWorkspaceService) {
    this.#workspaceService = workspaceService;
  }

  async initialize(state: McpState): Promise<void> {
    const { workspace, syncManifest } = await this.#workspaceService.initWorkspace(
      state.projectDir,
    );

    log.info("WorkspaceResources initialized", {
      workspace,
    });

    state.setWorkspace(workspace);
    state.setSyncManifest(syncManifest);
  }

  async register(mcp: IRejotMcp): Promise<void> {
    const list = () => {
      if (!mcp.state.hasWorkspace) {
        return {
          resources: [],
        };
      }

      const workspace = mcp.state.workspace;

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

          log.info("child", {
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

    mcp.registerResource(
      "ReJot Manifests",
      new ResourceTemplate("rejot://workspace/{+path}", {
        list,
      }),
      async (uri) => {
        log.info("READ rejot://workspace/{+path}:", {
          uri,
        });

        const workspace = mcp.state.workspace;

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
