import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { parsePostgresConnectionString } from "@rejot-dev/adapter-postgres/postgres-client";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

interface ToolResponse {
  content: Array<{
    type: string;
    text: string;
    isError?: boolean;
  }>;
}

const isToolResponse = (obj: unknown): obj is ToolResponse => {
  if (typeof obj !== "object" || obj === null) return false;

  const response = obj as Record<string, unknown>;
  if (!Array.isArray(response.content)) return false;

  return response.content.every((item) => {
    if (typeof item !== "object" || item === null) return false;
    const content = item as Record<string, unknown>;
    return (
      typeof content.type === "string" &&
      typeof content.text === "string" &&
      (content.isError === undefined || typeof content.isError === "boolean")
    );
  });
};

describe("MCP Integration Tests", () => {
  let client: Client;
  let tmpDir: string;
  const MANIFEST_FILE = "rejot-manifest.json";

  const assertToolCall = async <T extends ToolResponse>(
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<T> => {
    const result = await client.callTool({
      name: toolName,
      arguments: args,
    });

    // Validate response structure
    expect(isToolResponse(result), "Response does not match ToolResponse structure").toBe(true);

    // After validation, we can safely assert the type
    const typedResult = result as ToolResponse;

    // Check that no content items have isError set to true
    typedResult.content.forEach(
      (item: { type: string; text: string; isError?: boolean }, index: number) => {
        expect(item.isError, `Error in response content[${index}]: ${item.text}`).toBeFalsy();
      },
    );

    return result as T;
  };

  beforeAll(async () => {
    // Create temporary directory
    tmpDir = await mkdtemp(join(tmpdir(), "mcp-integration-test-"));

    // Initialize client
    const transport = new StdioClientTransport({
      command: "bun",
      args: ["./index.ts", "--project", tmpDir],
    });

    client = new Client({
      name: "integration-test-client",
      version: "1.0.0",
    });

    await client.connect(transport);
  });

  afterAll(async () => {
    await client.close();
    await rm(tmpDir, { recursive: true, force: true });
  });

  // Ran only in Postgres test
  test.skipIf(process.env.REJOT_SYNC_CLI_TEST_CONNECTION === undefined)(
    "full MCP workflow",
    async () => {
      const connectionString = process.env.REJOT_SYNC_CLI_TEST_CONNECTION;
      if (!connectionString) {
        throw new Error("REJOT_SYNC_CLI_TEST_CONNECTION environment variable is required");
      }
      const pgConfig = parsePostgresConnectionString(connectionString);

      // Initialize project
      const initResult = await assertToolCall<ToolResponse>("mcp_rejot_mcp_manifest_init", {
        relativeManifestFilePath: MANIFEST_FILE,
        slug: "test-manifest",
      });
      expect(initResult.content[0].type).toBe("text");
      expect(initResult.content[0].text).toContain("Created new manifest file");

      // Add Postgres connection
      const connectionResult = await assertToolCall<ToolResponse>(
        "rejot_manifest_connection_add_postgres",
        {
          manifestSlug: "test-manifest",
          newConnectionSlug: "test-postgres",
          postgresConnection: {
            connectionType: "postgres",
            ...pgConfig,
          },
        },
      );
      expect(connectionResult.content[0].type).toBe("text");

      // Get manifest info
      const infoResult = await assertToolCall<ToolResponse>("mcp_rejot_mcp_manifest_info", {
        relativeManifestFilePath: MANIFEST_FILE,
      });
      expect(infoResult.content[0].type).toBe("text");
      expect(infoResult.content[0].text).toContain("test-postgres"); // Verify connection is listed in the manifest info

      // Check database health
      const healthResult = await assertToolCall<ToolResponse>("mcp_rejot_db_check_health", {
        connectionSlug: "test-postgres",
      });
      expect(healthResult.content[0].type).toBe("text");

      // Remove connection
      const removeResult = await assertToolCall<ToolResponse>("rejot_manifest_connection_remove", {
        manifestSlug: "test-manifest",
        connectionSlug: "test-postgres",
      });
      expect(removeResult.content[0].type).toBe("text");

      // Verify connection was removed
      const finalInfoResult = await assertToolCall<ToolResponse>("mcp_rejot_mcp_manifest_info", {
        relativeManifestFilePath: MANIFEST_FILE,
      });
      expect(finalInfoResult.content[0].type).toBe("text");
      expect(finalInfoResult.content[0].text).not.toContain("test-postgres"); // Verify connection is no longer listed
    },
  );
});
