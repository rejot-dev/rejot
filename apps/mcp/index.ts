import { parseArgs } from "@std/cli/parse-args";
import { join } from "node:path";
import { RejotMcp } from "./rejot-mcp";
import { WorkspaceResources } from "./workspace/workspace.resources";
import { ManifestWorkspaceResolver } from "@rejot-dev/contract-tools/manifest";
import { DbIntrospectionTool } from "./tools/db-introspection/db-introspection.tool";
import { ManifestInfoTool } from "./tools/manifest/manifest-info.tool";
import { WorkspaceTool } from "./workspace/workspace.tool";
import { setLogger, FileLogger } from "@rejot-dev/contract/logger";
import { WorkspaceService } from "../../packages/contract/workspace/workspace";
import { ManifestConnectionTool } from "./tools/manifest-connection/manifest-connection.tool";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ManifestInitTool } from "./tools/manifest/manifest-init.tool";
import { CollectTool } from "./collect/collect.tool";
import { VibeCollector } from "@rejot-dev/contract-tools/collect/vibe-collect";
import { SchemaCollector } from "@rejot-dev/contract/collect";

// Open the log file when starting up
const args = parseArgs(process.argv.slice(2));

if (!("project" in args)) {
  console.error("No project provided", args);
  process.exit(1);
}

const log = setLogger(new FileLogger(join(args.project, "mcp.log"), "DEBUG"));

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

ReJot has the concept of a 'workspace'. A workspace is a collection of manifests. A workspace can
and will usually contain multiple manifests. One root manifest defines the workspace, which will
contain relative path references to manifests in sub-directories.

In the ReJot manifest, teams define their database connection details, as well as the entities they
publish to other teams. These are called 'public schemas' and they're strongly tied to a version and
contract. Other teams can subscribe to these schemas using a consumer schema.

Some tips:
- ALWAYS use the tools in this MCP to edit the manifest.
- Obtain the workspace information first.
- If you do not know a connection's slug. Get the workspace manifest first.
- You don't have to check health before doing other operations.
      `,
  },
);

const workspaceService = new WorkspaceService(new ManifestWorkspaceResolver());
const vibeCollector = new VibeCollector(new SchemaCollector());

const rejotMcp = new RejotMcp(args.project, server, [
  new WorkspaceResources(workspaceService),
  new DbIntrospectionTool(workspaceService),
  new ManifestInfoTool(workspaceService),
  new WorkspaceTool(workspaceService),
  new ManifestConnectionTool(workspaceService),
  new ManifestInitTool(workspaceService),
  new CollectTool(workspaceService, vibeCollector),
]);

rejotMcp
  .connect()
  .then(() => {})
  .catch((err) => {
    log.error(`Server error: ${err.message}`);
    log.logErrorInstance(err);
  });
