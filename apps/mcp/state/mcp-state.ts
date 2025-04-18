import type { WorkspaceDefinition } from "@rejot-dev/contract-tools/manifest";
import type { SyncManifest } from "@rejot-dev/contract/sync-manifest";
import { WorkspaceNotInitializedError, CombinedRejotMcpError } from "./mcp-error";
import { getLogger } from "@rejot-dev/contract/logger";
import type { ReJotError } from "@rejot-dev/contract/error";
import { workspaceToSyncManifest } from "@rejot-dev/contract-tools/manifest/manifest-workspace-resolver";

const log = getLogger("mcp.state");

export type McpStateStatus = "uninitialized" | "initializing" | "ready" | "error";

export class McpState {
  readonly #workspaceDirectoryPath: string;
  #initializationErrors: ReJotError[] = [];

  // Core state
  #workspace: WorkspaceDefinition | undefined;

  constructor(workspaceDirectoryPath: string) {
    this.#workspaceDirectoryPath = workspaceDirectoryPath;
  }

  get workspaceDirectoryPath(): string {
    return this.#workspaceDirectoryPath;
  }

  get hasWorkspace(): boolean {
    return !!this.#workspace;
  }

  get workspace(): WorkspaceDefinition {
    if (!this.#workspace) {
      throw new WorkspaceNotInitializedError("McpState / Workspace not initialized").withHint(
        "A workspace has to be initialized first. By initiating the creation of a manifest.",
      );
    }
    return this.#workspace;
  }

  get syncManifest(): SyncManifest {
    return workspaceToSyncManifest(this.workspace);
  }

  get initializationErrors(): ReJotError[] {
    return this.#initializationErrors;
  }

  setInitializing(): void {
    this.#initializationErrors = [];
  }

  setWorkspace(workspace: WorkspaceDefinition): void {
    this.#workspace = workspace;
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
