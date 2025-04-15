import type { Workspace } from "@rejot-dev/contract-tools/manifest";
import type { SyncManifest } from "@rejot-dev/contract/sync-manifest";
import type { ManifestError } from "@rejot-dev/contract/manifest";
import { SyncManifestNotInitializedError as WorkspaceNotInitializedError } from "./mcp-error";

export type McpStateStatus = "uninitialized" | "initializing" | "ready" | "error";

export interface McpStateError {
  message: string;
  errors?: ManifestError[];
}

export class McpState {
  readonly projectDir: string;
  #status: McpStateStatus = "uninitialized";
  #error: McpStateError | undefined;

  // Core state
  #workspace: Workspace | undefined;
  #syncManifest: SyncManifest | undefined;

  constructor(projectDir: string) {
    this.projectDir = projectDir;
  }

  get status(): McpStateStatus {
    return this.#status;
  }

  get workspace(): Workspace {
    if (!this.#workspace) {
      throw new WorkspaceNotInitializedError("McpState / Workspace not initialized");
    }
    return this.#workspace;
  }

  get syncManifest(): SyncManifest {
    if (!this.#syncManifest) {
      throw new WorkspaceNotInitializedError("McpState / Sync manifest not initialized");
    }
    return this.#syncManifest;
  }

  get error(): McpStateError | undefined {
    return this.#error;
  }

  setInitializing(): void {
    this.#status = "initializing";
    this.#error = undefined;
  }

  setWorkspace(workspace: Workspace): void {
    this.#workspace = workspace;
  }

  setSyncManifest(syncManifest: SyncManifest): void {
    this.#syncManifest = syncManifest;
    this.#status = "ready";
  }

  setError(error: McpStateError): void {
    this.#error = error;
    this.#status = "error";
  }
}
