import { parseArgs } from "@std/cli/parse-args";
import { join } from "node:path";
import { RejotMcp } from "./rejot-mcp";
import { WorkspaceResources } from "./workspace/workspace.resources";
import { ManifestWorkspaceResolver } from "@rejot-dev/contract-tools/manifest";
import { DbIntrospectionTool } from "./tools/db-introspection/db-introspection.tool";
import { ManifestInfoTool } from "./tools/manifest/manifest-info.tool";
import { ManifestInitTool } from "./tools/manifest/manifest-init.tool";
import { setLogger, FileLogger } from "@rejot-dev/contract/logger";
import { WorkspaceService } from "../../packages/contract/workspace/workspace";
import { ManifestConnectionTool } from "./tools/manifest-connection/manifest-connection.tool";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Open the log file when starting up
const args = parseArgs(process.argv.slice(2));

if (!("project" in args)) {
  console.error("No project provided", args);
  process.exit(1);
}

const log = setLogger(new FileLogger(join(args.project, "mcp.log"), "DEBUG"));

const workspaceService = new WorkspaceService(new ManifestWorkspaceResolver());

const server = new McpServer(
  {
    name: "@rejot-dev/mcp",
    version: "0.0.7",
  },
  {
    instructions: `
This is the ReJot MCP server. ReJot provides a set of tools to facilitate micro-service
communication. As opposed to traditional approaches like REST APIs, ReJot operates on the database
layer.

In the ReJot manifest, teams define their database connection details, as well as the entities they
publish to other teams. These are called 'public schemas' and they're strongly tied to a version and
contract. Other teams can subscribe to these schemas using a consumer schema.

ALWAYS use the tools in this MCP to edit the manifest.

- In most cases it makes sense to get the workspace's manifest information first.
- If you do not know a connection's slug. Get the workspace manifest first.
- You don't have to check health before doing other operations.
      `,
  },
);

const rejotMcp = new RejotMcp(args.project, server, [
  new WorkspaceResources(workspaceService),
  new DbIntrospectionTool(),
  new ManifestInfoTool(),
  new ManifestInitTool(workspaceService),
  new ManifestConnectionTool(),
]);

rejotMcp
  .connect()
  .then(() => {})
  .catch((err) => {
    log.error(`Server error: ${err.message}`);
    log.logErrorInstance(err);
  });
