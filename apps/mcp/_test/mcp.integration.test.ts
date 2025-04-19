import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { parsePostgresConnectionString } from "@rejot-dev/adapter-postgres/postgres-client";
import { mkdtemp, rm, mkdir, cp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
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

const expectContentErrorFree = (content: ToolResponse["content"]) => {
  content.forEach((item, index) => {
    expect(item.isError, `Error in response content[${index}]: ${item.text}`).toBeFalsy();
  });
};

describe.skipIf(!process.env.REJOT_SYNC_CLI_TEST_CONNECTION)("MCP Integration Tests", () => {
  let client: Client;
  let tmpDir: string;
  let testSuccess = false;
  let pgConfig: ReturnType<typeof parsePostgresConnectionString>;

  const assertToolCall = async (
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<ToolResponse> => {
    const result = await client.callTool({
      name: toolName,
      arguments: args,
    });

    // Validate response structure
    expect(isToolResponse(result), "Response does not match ToolResponse structure").toBe(true);

    // After validation, we can safely assert the type
    const typedResult = result as ToolResponse;

    return typedResult;
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

    // Parse connection string if available
    const connectionString = process.env.REJOT_SYNC_CLI_TEST_CONNECTION;
    if (connectionString) {
      pgConfig = parsePostgresConnectionString(connectionString);
    }
  });

  afterAll(async () => {
    await client.close();

    if (testSuccess) {
      await rm(tmpDir, { recursive: true, force: true });
    } else {
      const logFilePath = join(tmpDir, "mcp.log");
      console.log("Tmp directory used:", tmpDir);
      console.log("Log file:", logFilePath);
    }
  });

  describe("Workspace Setup", () => {
    test("should initialize workspace", async () => {
      const initResult = await assertToolCall("rejot_workspace_init", {
        slug: "@test-org/",
      });
      expectContentErrorFree(initResult.content);
      expect(initResult.content[0].type).toBe("text");
      expect(initResult.content[0].text).toContain("Workspace initialized successfully");
    });

    test("should create sub-manifest", async () => {
      // Create a subdirectory for the sub-manifest
      const subDir = "services";
      await mkdir(join(tmpDir, subDir));

      const subManifestResult = await assertToolCall("rejot_manifest_init", {
        relativeManifestFilePath: join(subDir, "rejot-manifest.json"),
        slug: "@test-org/service1",
      });
      expectContentErrorFree(subManifestResult.content);
      expect(subManifestResult.content[0].type).toBe("text");
      expect(subManifestResult.content[0].text).toContain("Created new manifest file");

      // Verify manifests are listed
      const infoResult = await assertToolCall("rejot_workspace_info", {});
      expectContentErrorFree(infoResult.content);
      expect(infoResult.content[0].type).toBe("text");
      expect(infoResult.content[0].text).toContain("@test-org/"); // Root manifest
      expect(infoResult.content[0].text).toContain("@test-org/service1"); // Sub manifest
    });
  });

  describe("Database Connection", () => {
    test("should add and verify postgres connection", async () => {
      if (!pgConfig) {
        throw new Error("REJOT_SYNC_CLI_TEST_CONNECTION environment variable is required");
      }

      const connectionResult = await assertToolCall("rejot_manifest_connection_add_postgres", {
        manifestSlug: "@test-org/service1",
        newConnectionSlug: "test-postgres",
        postgresConnection: {
          connectionType: "postgres",
          ...pgConfig,
        },
      });
      expectContentErrorFree(connectionResult.content);
      expect(connectionResult.content[0].type).toBe("text");
    });

    test("verify connection is listed", async () => {
      const infoResult = await assertToolCall("rejot_workspace_info", {});
      expectContentErrorFree(infoResult.content);
      expect(infoResult.content[0].text).toContain("test-postgres");
    });

    test("check health of postgres connection", async () => {
      const healthResult = await assertToolCall("mcp_rejot_db_check_health", {
        connectionSlug: "test-postgres",
      });
      expectContentErrorFree(healthResult.content);
      expect(healthResult.content[0].type).toBe("text");
    });
  });

  describe("Schema Management", () => {
    test("should collect schemas", async () => {
      // Create test directory and copy example schema
      const subDir = "services";
      const testDir = join(tmpDir, subDir, "_test");
      await mkdir(testDir);
      await cp(
        join(dirname(new URL(import.meta.url).pathname), "mcp-integration-test-example-schema.ts"),
        join(testDir, "mcp-integration-test-example-schema.ts"),
      );

      const collectResult = await assertToolCall("rejot_collect_schemas", {
        write: true,
      });
      expectContentErrorFree(collectResult.content);
      expect(collectResult.content[0].type).toBe("text");
    });
  });

  describe("Cleanup", () => {
    test("should remove connection", async () => {
      const removeResult = await assertToolCall("rejot_manifest_connection_remove", {
        manifestSlug: "@test-org/service1",
        connectionSlug: "test-postgres",
      });
      expectContentErrorFree(removeResult.content);
      expect(removeResult.content[0].type).toBe("text");

      // Verify connection was removed
      const finalInfoResult = await assertToolCall("rejot_workspace_info", {});
      expectContentErrorFree(finalInfoResult.content);
      expect(finalInfoResult.content[0].text).toContain("@test-org/"); // Root manifest still there
      expect(finalInfoResult.content[0].text).toContain("@test-org/service1"); // Sub manifest still there
      expect(finalInfoResult.content[0].text).not.toContain("test-postgres"); // Verify connection is no longer listed

      testSuccess = true;
    });
  });
});
