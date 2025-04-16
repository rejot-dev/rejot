import type { IManifestWorkspaceResolver, Workspace } from "@rejot-dev/contract-tools/manifest";
import type { SyncManifest } from "@rejot-dev/contract/sync-manifest";
import { getLogger } from "@rejot-dev/contract/logger";
import { ReJotMcpError } from "@/state/mcp-error";

const log = getLogger("mcp.workspace");

export interface IWorkspaceService {
  initWorkspace(projectDir: string): Promise<{ workspace: Workspace; syncManifest: SyncManifest }>;
}

export class WorkspaceInitializationError extends ReJotMcpError {}

export class WorkspaceService implements IWorkspaceService {
  readonly #workspaceResolver: IManifestWorkspaceResolver;

  constructor(workspaceResolver: IManifestWorkspaceResolver) {
    this.#workspaceResolver = workspaceResolver;
  }

  async initWorkspace(
    projectDir: string,
  ): Promise<{ workspace: Workspace; syncManifest: SyncManifest }> {
    const workspace = await this.#workspaceResolver.resolveWorkspace({
      startDir: projectDir,
    });

    if (!workspace) {
      throw new WorkspaceInitializationError("No workspace found in project directory").withHint(
        "Create a new manifest if this is a new workspace",
      );
    }

    log.info("Workspace resolved", {
      rootPath: workspace.rootPath,
      ancestor: workspace.ancestor.path,
      children: workspace.children.map((c) => c.path),
    });

    try {
      const syncManifest = this.#workspaceResolver.workspaceToSyncManifest(workspace);

      return {
        workspace,
        syncManifest,
      };
    } catch (error) {
      // Handle sync manifest creation errors
      if (error instanceof Error) {
        throw new WorkspaceInitializationError("Failed to create sync manifest").withHint(
          error.message,
        );
      }

      throw new WorkspaceInitializationError(
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}
