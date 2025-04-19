import { CombinedRejotMcpError } from "./mcp-error";
import { getLogger } from "@rejot-dev/contract/logger";
import type { ReJotError } from "@rejot-dev/contract/error";

const log = getLogger("mcp.state");

export type McpStateStatus = "uninitialized" | "initializing" | "ready" | "error";

export class McpState {
  readonly #workspaceDirectoryPath: string;
  #initializationErrors: ReJotError[] = [];

  constructor(workspaceDirectoryPath: string) {
    this.#workspaceDirectoryPath = workspaceDirectoryPath;
  }

  get workspaceDirectoryPath(): string {
    return this.#workspaceDirectoryPath;
  }

  get initializationErrors(): ReJotError[] {
    return this.#initializationErrors;
  }

  setInitializing(): void {
    this.#initializationErrors = [];
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
