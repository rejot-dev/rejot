import { z } from "zod";

import { PostgresConnectionAdapter } from "@rejot-dev/adapter-postgres";
import { PostgresIntrospectionAdapter } from "@rejot-dev/adapter-postgres";
import type { AnyIConnectionAdapter, AnyIIntrospectionAdapter } from "@rejot-dev/contract/adapter";
import type { ReJotError } from "@rejot-dev/contract/error";
import { getLogger } from "@rejot-dev/contract/logger";
import type { ConnectionConfigSchema } from "@rejot-dev/contract/manifest";
import { getConnectionBySlugHelper } from "@rejot-dev/contract/manifest-helpers";
import type { WorkspaceDefinition } from "@rejot-dev/contract/workspace";

import { CombinedRejotMcpError, ReJotMcpError } from "./mcp-error";

const log = getLogger(import.meta.url);

export type McpStateStatus = "uninitialized" | "initializing" | "ready" | "error";

type ValidConnectionType = z.infer<typeof ConnectionConfigSchema>["connectionType"];

interface AdapterPair {
  connectionAdapter: AnyIConnectionAdapter;
  introspectionAdapter: AnyIIntrospectionAdapter;
}

export class McpState {
  readonly #workspaceDirectoryPath: string;
  #initializationErrors: ReJotError[] = [];

  #adapters: Map<ValidConnectionType, AdapterPair>;

  constructor(workspaceDirectoryPath: string) {
    this.#workspaceDirectoryPath = workspaceDirectoryPath;
    this.#adapters = new Map();
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

  async ensureConnection(
    connectionSlug: string,
    workspace: WorkspaceDefinition,
  ): Promise<AdapterPair> {
    const manifestConnection = getConnectionBySlugHelper(workspace, connectionSlug);
    if (!manifestConnection) {
      throw new ConnectionNotFoundError(connectionSlug);
    }

    const adapter = this.getOrSetAdapter(manifestConnection.config.connectionType);
    const connection = adapter.connectionAdapter.getOrCreateConnection(
      connectionSlug,
      manifestConnection.config,
    );

    await connection.prepare();

    return adapter;
  }

  getOrSetAdapter(connectionType: ValidConnectionType): AdapterPair {
    const adapter = this.#adapters.get(connectionType);
    if (adapter) {
      return adapter;
    }

    // TODO(Wilco): here we hardcode the construction of (Postgres) connection adapter. At some point
    //              in the future we should resolve this based on installed dependencies / manifest.

    if (connectionType === "postgres") {
      const postgresConnectionAdapter = new PostgresConnectionAdapter();
      const postgresIntrospectionAdapter = new PostgresIntrospectionAdapter(
        postgresConnectionAdapter,
      );
      const pair: AdapterPair = {
        connectionAdapter: postgresConnectionAdapter,
        introspectionAdapter: postgresIntrospectionAdapter,
      };
      this.#adapters.set("postgres", pair);
      return pair;
    }

    throw new AdapterNotFoundError(connectionType).withHint(
      "This is a user error. The ReJot manifest is using an adapter that the user has not installed.",
    );
  }
}

export class AdapterNotFoundError extends ReJotMcpError {
  #connectionType: ValidConnectionType;

  constructor(connectionType: ValidConnectionType) {
    super(`No adapter found for connection type: ${connectionType}`);
    this.#connectionType = connectionType;
  }

  get name(): string {
    return "AdapterNotFoundError";
  }

  get connectionType(): ValidConnectionType {
    return this.#connectionType;
  }
}

export class ConnectionNotFoundError extends ReJotMcpError {
  #connectionSlug: string;

  constructor(connectionSlug: string) {
    super(`Connection with slug ${connectionSlug} not found`);
    this.#connectionSlug = connectionSlug;
  }

  get name(): string {
    return "ConnectionNotFoundError";
  }

  get connectionSlug(): string {
    return this.#connectionSlug;
  }
}
