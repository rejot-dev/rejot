import type {
  IManifestWorkspaceResolver,
  WorkspaceDefinition,
} from "@rejot-dev/contract-tools/manifest";
import type { SyncManifest } from "@rejot-dev/contract/sync-manifest";
import { ReJotError } from "@rejot-dev/contract/error";

export interface IWorkspaceService {
  resolveWorkspace(
    projectDir: string,
  ): Promise<{ workspace: WorkspaceDefinition; syncManifest: SyncManifest }>;
}

export class WorkspaceInitializationError extends ReJotError {
  get name(): string {
    return "WorkspaceInitializationError";
  }
}

export class WorkspaceService implements IWorkspaceService {
  readonly #workspaceResolver: IManifestWorkspaceResolver;

  constructor(workspaceResolver: IManifestWorkspaceResolver) {
    this.#workspaceResolver = workspaceResolver;
  }

  async resolveWorkspace(
    projectDir: string,
  ): Promise<{ workspace: WorkspaceDefinition; syncManifest: SyncManifest }> {
    const workspace = await this.#workspaceResolver.resolveWorkspace({
      startDir: projectDir,
    });

    if (!workspace) {
      throw new WorkspaceInitializationError("No workspace found in project directory").withHint(
        "Create a new manifest if this is a new workspace",
      );
    }

    try {
      const syncManifest = this.#workspaceResolver.workspaceToSyncManifest(workspace);

      return {
        workspace,
        syncManifest,
      };
    } catch (error) {
      throw new WorkspaceInitializationError("Failed to create sync manifest", {
        cause: error,
      });
    }
  }
}
