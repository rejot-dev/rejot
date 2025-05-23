import { z } from "zod";

import type { IWorkspaceService } from "@rejot-dev/contract-tools/manifest/manifest-workspace-resolver";

import type { IFactory } from "../../rejot-mcp.ts";
import type { IRejotMcp } from "../../rejot-mcp.ts";
import type { McpState } from "../../state/mcp-state.ts";

const CONNECTION_SLUG_DESCRIPTION =
  "The slug of the connection to get information about. This can be found in the connection array of the manifest.";

export class DbIntrospectionTool implements IFactory {
  #workspaceService: IWorkspaceService;

  constructor(workspaceService: IWorkspaceService) {
    this.#workspaceService = workspaceService;
  }

  async initialize(_state: McpState): Promise<void> {
    //
  }

  async register(mcp: IRejotMcp): Promise<void> {
    mcp.registerTool(
      "mcp_rejot_db_get_all_table_schemas",
      "Get schema information for all tables in the database",
      {
        connectionSlug: z.string().describe(CONNECTION_SLUG_DESCRIPTION),
        tableNamePattern: z
          .string()
          .optional()
          .describe("Regex pattern to match against table names."),
        tableNamesOnly: z
          .boolean()
          .optional()
          .describe("Only return table names, not schema information."),
      },
      async ({ connectionSlug, tableNamePattern, tableNamesOnly }) => {
        const { workspace } = await this.#workspaceService.resolveWorkspace(
          mcp.state.workspaceDirectoryPath,
        );

        try {
          const adapter = await mcp.state.ensureConnection(connectionSlug, workspace);

          const allSchemas = await adapter.introspectionAdapter.getAllTableSchemas(connectionSlug);

          // Convert the Map to an array of tables for easier formatting
          let tables = Array.from(allSchemas.values());

          // Filter tables by pattern if provided
          if (tableNamePattern) {
            const pattern = new RegExp(tableNamePattern);
            tables = tables.filter((schema) => pattern.test(schema.name));
          }

          // If tableNamesOnly is true, just return a list of table names
          if (tableNamesOnly) {
            return {
              content: [
                {
                  type: "text",
                  text: `Found ${tables.length} tables:\n\n${tables.map((schema) => `${schema.name}`).join("\n")}`,
                },
              ],
            };
          }

          return {
            content: [
              {
                type: "text",
                text: `Found ${tables.length} tables:

${tables
  .map(
    (schema) => `
Table: ${schema.name}
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
        const { workspace } = await this.#workspaceService.resolveWorkspace(
          mcp.state.workspaceDirectoryPath,
        );

        const adapter = await mcp.state.ensureConnection(connectionSlug, workspace);

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

    mcp.registerTool(
      "mcp_rejot_db_execute_queries",
      "Execute one or more SQL queries on a database connection",
      {
        connectionSlug: z.string().describe(CONNECTION_SLUG_DESCRIPTION),
        queries: z.array(z.string()).min(1).describe("Array of SQL queries to execute"),
        // This doesn't actually do anything, it's just for the LLM.
        allowWriteOperations: z
          .boolean()
          .default(false)
          .optional()
          .describe(
            "Allow write operations. DO NOT run write operations on any database without EXPLICIT USER permission.",
          ),
      },
      async ({ connectionSlug, queries }) => {
        const { workspace } = await this.#workspaceService.resolveWorkspace(
          mcp.state.workspaceDirectoryPath,
        );

        const adapter = await mcp.state.ensureConnection(connectionSlug, workspace);
        const results = await adapter.introspectionAdapter.executeQueries(connectionSlug, queries);

        return {
          content: [
            {
              type: "text",
              text: `Executed ${queries.length} ${queries.length === 1 ? "query" : "queries"}:

${results
  .map(
    (result, index) => `
Query ${index + 1}:
${queries[index]}

Results:
${JSON.stringify(result, null, 2)}
`,
  )
  .join("\n")}`,
            },
          ],
        };
      },
    );
  }
}
