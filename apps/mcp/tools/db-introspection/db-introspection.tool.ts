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

const CONNECTION_SLUG_DESCRIPTION =
  "The slug of the connection to get information about. This can be found in the connection array of the manifest.";

export class DbIntrospectionTool implements IFactory {
  #adapters: Map<ValidConnectionType, AdapterPair>;

  constructor() {
    this.#adapters = new Map();
  }

  async initialize(_state: McpState): Promise<void> {
    //
  }

  #getOrSetAdapter(connectionType: ValidConnectionType): AdapterPair {
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

    throw new AdapterNotFoundError(connectionType);
  }

  async #ensureConnection(connectionSlug: string, state: McpState): Promise<AdapterPair> {
    const manifestConnection = state.syncManifest.getConnectionBySlug(connectionSlug);
    if (!manifestConnection) {
      throw new ConnectionNotFoundError(connectionSlug);
    }

    const adapter = this.#getOrSetAdapter(manifestConnection.config.connectionType);
    const connection = adapter.connectionAdapter.getOrCreateConnection(
      connectionSlug,
      manifestConnection.config,
    );

    await connection.prepare();

    return adapter;
  }

  async register(mcp: IRejotMcp): Promise<void> {
    mcp.registerTool(
      "rejot_db_get_tables",
      "Get all tables from a database connection",
      {
        connectionSlug: z.string().describe(CONNECTION_SLUG_DESCRIPTION),
      },
      async ({ connectionSlug }) => {
        mcp.state.assertIsInitialized();

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

    mcp.registerTool(
      "mcp_rejot_db_get_table_schema",
      "Get schema information for a specific table",
      {
        connectionSlug: z.string().describe(CONNECTION_SLUG_DESCRIPTION),
        tableName: z.string(),
      },
      async ({ connectionSlug, tableName }) => {
        mcp.state.assertIsInitialized();

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
                text: `Table schema for ${tableName}:
Schema: ${schema.schema}
Name: ${schema.name}
Key Columns: ${schema.keyColumns.join(", ")}

Columns:
${schema.columns
  .map((col) => {
    let colInfo = `${col.columnName} (${col.dataType})${col.isNullable ? " NULL" : " NOT NULL"}`;
    if (col.columnDefault !== null) {
      colInfo += ` DEFAULT ${col.columnDefault}`;
    }
    if (col.foreignKey) {
      colInfo += `\n  -> FK ${col.foreignKey.constraintName}: references ${col.foreignKey.referencedTable}(${col.foreignKey.referencedColumnName})`;
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

    mcp.registerTool(
      "mcp_rejot_db_get_all_table_schemas",
      "Get schema information for all tables in the database",
      {
        connectionSlug: z.string().describe(CONNECTION_SLUG_DESCRIPTION),
      },
      async ({ connectionSlug }) => {
        mcp.state.assertIsInitialized();

        try {
          const adapter = await this.#ensureConnection(connectionSlug, mcp.state);

          const allSchemas = await adapter.introspectionAdapter.getAllTableSchemas(connectionSlug);

          // Convert the Map to an array of tables for easier formatting
          const tables = Array.from(allSchemas.values());

          return {
            content: [
              {
                type: "text",
                text: `Found ${tables.length} tables:

${tables
  .map(
    (schema) => `
Table: ${schema.schema}.${schema.name}
Key Columns: ${schema.keyColumns.join(", ")}

Columns:
${schema.columns
  .map((col) => {
    let colInfo = `${col.columnName} (${col.dataType})${col.isNullable ? " NULL" : " NOT NULL"}`;
    if (col.columnDefault !== null) {
      colInfo += ` DEFAULT ${col.columnDefault}`;
    }
    if (col.foreignKey) {
      colInfo += `\n  -> FK ${col.foreignKey.constraintName}: references ${col.foreignKey.referencedTable}(${col.foreignKey.referencedColumnName})`;
    }
    return colInfo;
  })
  .join("\n")}`,
  )
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
                text: `Error getting all table schemas: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
          };
        }
      },
    );

    mcp.registerTool(
      "mcp_rejot_db_check_health",
      "Check the health of a database connection",
      {
        connectionSlug: z.string().describe(CONNECTION_SLUG_DESCRIPTION),
      },
      async ({ connectionSlug }) => {
        mcp.state.assertIsInitialized();

        await this.#ensureConnection(connectionSlug, mcp.state);

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

  get name(): string {
    return "ConnectionNotFoundError";
  }

  get connectionSlug(): string {
    return this.#connectionSlug;
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

  toCallToolContent(): CallToolResult["content"] {
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
