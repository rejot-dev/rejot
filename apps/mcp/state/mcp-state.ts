import type { Workspace } from "@rejot-dev/contract-tools/manifest";
import type { SyncManifest } from "@rejot-dev/contract/sync-manifest";
import { WorkspaceNotInitializedError, CombinedRejotMcpError } from "./mcp-error";
import { getLogger } from "@rejot-dev/contract/logger";
import type { ReJotError } from "@rejot-dev/contract/error";

const log = getLogger("mcp.state");

export type McpStateStatus = "uninitialized" | "initializing" | "ready" | "error";

export class McpState {
  readonly projectDir: string;
  #initializationErrors: ReJotError[] = [];

  // Core state
  #workspace: Workspace | undefined;
  #syncManifest: SyncManifest | undefined;

  constructor(projectDir: string) {
    this.projectDir = projectDir;
  }

  get hasWorkspace(): boolean {
    return !!this.#workspace;
  }

  get workspace(): Workspace {
    if (!this.#workspace) {
      throw new WorkspaceNotInitializedError("McpState / Workspace not initialized").withHint(
        "A workspace has to be initialized first. By initiating the creation of a manifest.",
      );
    }
    return this.#workspace;
  }

  get syncManifest(): SyncManifest {
    if (!this.#syncManifest) {
      throw new WorkspaceNotInitializedError("McpState / Sync manifest not initialized").withHint(
        "A sync manifest has to be initialized first. By initiating the creation of a manifest.",
      );
    }
    return this.#syncManifest;
  }

  get initializationErrors(): ReJotError[] {
    return this.#initializationErrors;
  }

  setInitializing(): void {
    this.#initializationErrors = [];
  }

  setWorkspace(workspace: Workspace): void {
    this.#workspace = workspace;
  }

  setSyncManifest(syncManifest: SyncManifest): void {
    this.#syncManifest = syncManifest;
  }

  addInitializationError(error: ReJotError): void {
    this.#initializationErrors.push(error);
  }

  clearInitializationErrors(): void {
    this.#initializationErrors = [];
  }

  assertIsInitialized(): void {
    if (this.#initializationErrors.length > 0) {
      log.warn("assertIsInitialized failed");
      throw new CombinedRejotMcpError(this.#initializationErrors);
    }
  }
}
