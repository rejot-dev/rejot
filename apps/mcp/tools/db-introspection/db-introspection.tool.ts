import { z } from "zod";
import type { IFactory } from "@/rejot-mcp";
import type { AnyIConnectionAdapter, AnyIIntrospectionAdapter } from "@rejot-dev/contract/adapter";
import type { IRejotMcp } from "@/rejot-mcp";
import { ConnectionConfigSchema } from "@rejot-dev/contract/manifest";
import type { McpState } from "@/state/mcp-state";
import { PostgresConnectionAdapter } from "@rejot-dev/adapter-postgres";
import { PostgresIntrospectionAdapter } from "@rejot-dev/adapter-postgres";
import { ReJotMcpError } from "@/state/mcp-error";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

type ValidConnectionType = z.infer<typeof ConnectionConfigSchema>["connectionType"];

interface AdapterPair {
  connectionAdapter: AnyIConnectionAdapter;
  introspectionAdapter: AnyIIntrospectionAdapter;
}

export class DbIntrospectionTool implements IFactory {
  #adapters: Map<ValidConnectionType, AdapterPair>;

  constructor() {
    this.#adapters = new Map();
  }

  async initialize(_state: McpState): Promise<void> {
    //
  }

  #getOrSetAdapter(connectionType: ValidConnectionType, state: McpState): AdapterPair {
    const adapter = this.#adapters.get(connectionType);
    if (adapter) {
      return adapter;
    }

    // TODO(Wilco): here we hardcode the construction of (Postgres) connection adapter. At some point
    //              in the future we should resolve this based on installed dependencies / manifest.

    if (connectionType === "postgres") {
      const postgresConnectionAdapter = new PostgresConnectionAdapter(state.syncManifest);
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

    throw new AdapterNotFoundError(connectionType);
  }

  async #ensureConnection(connectionSlug: string, state: McpState): Promise<AdapterPair> {
    const manifestConnection = state.syncManifest.getConnectionBySlug(connectionSlug);
    if (!manifestConnection) {
      throw new ConnectionNotFoundError(connectionSlug);
    }

    const adapter = this.#getOrSetAdapter(manifestConnection.config.connectionType, state);
    const connection = adapter.connectionAdapter.getOrCreateConnection(
      connectionSlug,
      manifestConnection.config,
    );

    await connection.prepare();

    return adapter;
  }

  async register(mcp: IRejotMcp): Promise<void> {
    mcp.registerTool(
      "mcp_rejot_db_get_tables",
      "Get all tables from a database connection",
      {
        connectionSlug: z.string(),
      },
      async ({ connectionSlug }) => {
        try {
          const adapter = await this.#ensureConnection(connectionSlug, mcp.state);

          const tables = await adapter.introspectionAdapter.getTables(connectionSlug);
          return {
            content: [
              {
                type: "text",
                text: `Found ${tables.length} tables:\n${tables.map((t) => `${t.schema}.${t.name}`).join("\n")}`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                isError: true,
                type: "text",
                text: `Error getting tables: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
          };
        }
      },
    );

    mcp.server.tool(
      "mcp_rejot_db_get_table_schema",
      "Get schema information for a specific table",
      {
        connectionSlug: z.string(),
        tableName: z.string(),
      },
      async ({ connectionSlug, tableName }) => {
        try {
          const adapter = await this.#ensureConnection(connectionSlug, mcp.state);

          const schema = await adapter.introspectionAdapter.getTableSchema(
            connectionSlug,
            tableName,
          );
          return {
            content: [
              {
                type: "text",
                text: `Table schema for ${tableName}:\n${schema
                  .map((col) => {
                    let colInfo = `${col.columnName} (${col.dataType})${col.isNullable ? " NULL" : " NOT NULL"}`;
                    if (col.columnDefault !== null) {
                      colInfo += ` DEFAULT ${col.columnDefault}`;
                    }
                    if (col.foreignKey) {
                      colInfo += `\n  -> FK ${col.foreignKey.constraintName}: references ${col.foreignKey.referencedTableSchema}.${col.foreignKey.referencedTableName}(${col.foreignKey.referencedColumnName})`;
                    }
                    return colInfo;
                  })
                  .join("\n")}`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                isError: true,
                type: "text",
                text: `Error getting table schema: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
          };
        }
      },
    );

    mcp.server.tool(
      "mcp_rejot_db_check_health",
      "Check the health of a database connection",
      {
        connectionSlug: z.string(),
      },
      async ({ connectionSlug }) => {
        try {
          const adapter = await this.#ensureConnection(connectionSlug, mcp.state);

          const health = await adapter.introspectionAdapter.checkHealth(connectionSlug);

          return {
            content: [
              {
                type: "text",
                text: `Connection health: ${health.status}${health.message ? `\nMessage: ${health.message}` : ""}`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                isError: true,
                type: "text",
                text: `Error checking health: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
          };
        }
      },
    );
  }
}

export class ConnectionNotFoundError extends ReJotMcpError {
  #connectionSlug: string;

  constructor(connectionSlug: string) {
    super(`Connection with slug ${connectionSlug} not found`);
    this.#connectionSlug = connectionSlug;
  }

  get connectionSlug(): string {
    return this.#connectionSlug;
  }

  toContent(): CallToolResult["content"] {
    return [
      {
        isError: true,
        type: "text",
        text: this.message,
      },
    ];
  }
}

export class AdapterNotFoundError extends ReJotMcpError {
  #connectionType: ValidConnectionType;

  constructor(connectionType: ValidConnectionType) {
    super(`No adapter found for connection type: ${connectionType}`);
    this.#connectionType = connectionType;
  }

  get connectionType(): ValidConnectionType {
    return this.#connectionType;
  }

  toContent(): CallToolResult["content"] {
    return [
      {
        isError: true,
        type: "text",
        text:
          this.message +
          "\nThis is a user error. The ReJot manifest is using an adapter that the user has not installed.",
      },
    ];
  }
}
