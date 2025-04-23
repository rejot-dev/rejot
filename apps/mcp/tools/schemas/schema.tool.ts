import { z } from "zod";

import { ConsumerSchemaSchema, PublicSchemaSchema } from "@rejot-dev/contract/manifest";
import { ManifestPrinter } from "@rejot-dev/contract-tools/manifest/manifest-printer";
import type { IWorkspaceService } from "@rejot-dev/contract-tools/manifest/manifest-workspace-resolver";

import type { IFactory, IRejotMcp } from "@/rejot-mcp";
import { McpState } from "@/state/mcp-state";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

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
      "rejot_find_public_schemas",
      "Find public schemas in the workspace that match a regex pattern",
      {
        namePattern: z.string().describe("Regex pattern to match against schema names"),
      },
      async ({ namePattern }) => {
        const { workspace } = await this.#workspaceService.resolveWorkspace(
          mcp.state.workspaceDirectoryPath,
        );

        const pattern = new RegExp(namePattern);
        const matchingSchemas: Array<{
          schema: z.infer<typeof PublicSchemaSchema>;
          manifestSlug: string;
          manifestPath: string;
        }> = [];

        // Check schemas in the ancestor manifest
        (workspace.ancestor.manifest.publicSchemas || []).forEach((schema) => {
          if (pattern.test(schema.name)) {
            matchingSchemas.push({
              schema,
              manifestSlug: workspace.ancestor.manifest.slug,
              manifestPath: workspace.ancestor.path,
            });
          }
        });

        // Check schemas in child manifests
        workspace.children.forEach((child) => {
          (child.manifest.publicSchemas || []).forEach((schema) => {
            if (pattern.test(schema.name)) {
              matchingSchemas.push({
                schema,
                manifestSlug: child.manifest.slug,
                manifestPath: child.path,
              });
            }
          });
        });

        if (matchingSchemas.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No public schemas found matching pattern '${namePattern}'.`,
              },
            ],
          };
        }

        const content: CallToolResult["content"] = [];

        // Add summary of found schemas
        content.push({
          type: "text",
          text: `Found ${matchingSchemas.length} public schema(s) matching pattern '${namePattern}':`,
        });

        for (const { schema, manifestSlug, manifestPath } of matchingSchemas) {
          content.push({
            type: "text",
            text: `\n## ${schema.name}@v${schema.version.major}.${schema.version.minor}`,
          });

          content.push({
            type: "text",
            text: `Manifest: ${manifestSlug} (${manifestPath})`,
          });

          // Print detailed schema information using ManifestPrinter
          const schemaDetails = ManifestPrinter.printPublicSchema([schema]);
          content.push({
            type: "text",
            text: schemaDetails.join("\n"),
          });
        }

        return { content };
      },
    );

    mcp.registerTool(
      "rejot_find_consumer_schemas",
      "Find consumer schemas in the workspace that match a regex pattern",
      {
        namePattern: z.string().describe("Regex pattern to match against schema names"),
      },
      async ({ namePattern }) => {
        const { workspace } = await this.#workspaceService.resolveWorkspace(
          mcp.state.workspaceDirectoryPath,
        );

        const pattern = new RegExp(namePattern);
        const matchingSchemas: Array<{
          schema: z.infer<typeof ConsumerSchemaSchema>;
          manifestSlug: string;
          manifestPath: string;
        }> = [];

        // Check schemas in the ancestor manifest
        (workspace.ancestor.manifest.consumerSchemas || []).forEach((schema) => {
          if (pattern.test(schema.name)) {
            matchingSchemas.push({
              schema,
              manifestSlug: workspace.ancestor.manifest.slug,
              manifestPath: workspace.ancestor.path,
            });
          }
        });

        // Check schemas in child manifests
        workspace.children.forEach((child) => {
          (child.manifest.consumerSchemas || []).forEach((schema) => {
            if (pattern.test(schema.name)) {
              matchingSchemas.push({
                schema,
                manifestSlug: child.manifest.slug,
                manifestPath: child.path,
              });
            }
          });
        });

        if (matchingSchemas.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No consumer schemas found matching pattern '${namePattern}'.`,
              },
            ],
          };
        }

        const content: CallToolResult["content"] = [];

        // Add summary of found schemas
        content.push({
          type: "text",
          text: `Found ${matchingSchemas.length} consumer schema(s) matching pattern '${namePattern}':`,
        });

        for (const { schema, manifestSlug, manifestPath } of matchingSchemas) {
          content.push({
            type: "text",
            text: `\n## ${schema.name}`,
          });

          content.push({
            type: "text",
            text: `Manifest: ${manifestSlug} (${manifestPath})`,
          });

          // Print detailed schema information using ManifestPrinter
          const schemaDetails = ManifestPrinter.printConsumerSchema([schema]);
          content.push({
            type: "text",
            text: schemaDetails.join("\n"),
          });
        }

        return { content };
      },
    );
  }
}
