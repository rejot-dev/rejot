import { z } from "zod";

import { ManifestPrinter } from "@rejot-dev/contract-tools/manifest/manifest-printer";
import type { IWorkspaceService } from "@rejot-dev/contract-tools/manifest/manifest-workspace-resolver";

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import type { IFactory, IRejotMcp } from "../../rejot-mcp.ts";
import type { McpState } from "../../state/mcp-state.ts";

export class SchemasTool implements IFactory {
  #workspaceService: IWorkspaceService;

  constructor(workspaceService: IWorkspaceService) {
    this.#workspaceService = workspaceService;
  }

  async initialize(_state: McpState): Promise<void> {
    // No initialization needed
  }

  async register(mcp: IRejotMcp): Promise<void> {
    mcp.registerTool(
      "rejot_find_schemas",
      "Find public and consumer schemas in the workspace that match a regex pattern",
      {
        namePattern: z.string().describe("Regex pattern to match against schema names"),
      },
      async ({ namePattern }) => {
        const { workspace } = await this.#workspaceService.resolveWorkspace(
          mcp.state.workspaceDirectoryPath,
        );

        const pattern = new RegExp(namePattern);

        const publicSchemas = [
          ...(workspace.ancestor.manifest.publicSchemas || []),
          ...workspace.children.flatMap((child) => child.manifest.publicSchemas || []),
        ];

        const consumerSchemas = [
          ...(workspace.ancestor.manifest.consumerSchemas || []),
          ...workspace.children.flatMap((child) => child.manifest.consumerSchemas || []),
        ];

        const matchingPublicSchemas = publicSchemas
          .filter((schema) => pattern.test(schema.name))
          .map((schema) => ({
            schema,
            manifestSlug: workspace.ancestor.manifest.slug,
            manifestPath: workspace.ancestor.path,
            type: "public" as const,
          }));

        const matchingConsumerSchemas = consumerSchemas
          .filter((schema) => pattern.test(schema.name))
          .map((schema) => ({
            schema,
            manifestSlug: workspace.ancestor.manifest.slug,
            manifestPath: workspace.ancestor.path,
            type: "consumer" as const,
          }));

        const content: CallToolResult["content"] = [];

        if (matchingPublicSchemas.length === 0 && matchingConsumerSchemas.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No schemas found matching pattern '${namePattern}'.`,
              },
            ],
          };
        }

        // Add summary of found schemas
        content.push({
          type: "text",
          text: `Found ${matchingPublicSchemas.length + matchingConsumerSchemas.length} schema(s) matching pattern '${namePattern}':`,
        });

        // Add public schemas section if any found
        if (matchingPublicSchemas.length > 0) {
          const schemaDetails = ManifestPrinter.printPublicSchema(
            matchingPublicSchemas.map(({ schema }) => schema),
            {
              header: false,
            },
          );

          content.push({
            type: "text",
            text: `\n# Public Schemas (${matchingPublicSchemas.length})` + schemaDetails.join("\n"),
          });
        }

        // Add consumer schemas section if any found
        if (matchingConsumerSchemas.length > 0) {
          const schemaDetails = ManifestPrinter.printConsumerSchema(
            matchingConsumerSchemas.map(({ schema }) => schema),
            {
              header: false,
            },
          );

          content.push({
            type: "text",
            text:
              `\n# Consumer Schemas (${matchingConsumerSchemas.length})` + schemaDetails.join("\n"),
          });
        }

        return { content };
      },
    );
  }
}
