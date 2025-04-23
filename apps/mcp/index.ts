import { join } from "node:path";

import { SchemaCollector } from "@rejot-dev/contract/collect";
import { FileLogger, setLogger } from "@rejot-dev/contract/logger";
import { FileFinder } from "@rejot-dev/contract-tools/collect/file-finder";
import { VibeCollector } from "@rejot-dev/contract-tools/collect/vibe-collect";
import { ManifestWorkspaceResolver } from "@rejot-dev/contract-tools/manifest";
import { ManifestFileManager } from "@rejot-dev/contract-tools/manifest/manifest-file-manager";
import { WorkspaceService } from "@rejot-dev/contract-tools/manifest/manifest-workspace-resolver";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { parseArgs } from "@std/cli/parse-args";

import { CollectTool } from "./collect/collect.tool";
import { RejotMcp } from "./rejot-mcp";
import { DbIntrospectionTool } from "./tools/db-introspection/db-introspection.tool";
import { ManifestInfoTool } from "./tools/manifest/manifest-info.tool";
import { ManifestInitTool } from "./tools/manifest/manifest-init.tool";
import { ManifestConnectionTool } from "./tools/manifest-connection/manifest-connection.tool";
import { ManifestPostgresDataStoreTool } from "./tools/manifest-connection/manifest-pg-datastore.tool";
import { SchemasTool } from "./tools/schemas/schema.tool";
import { WorkspaceResources } from "./workspace/workspace.resources";
import { WorkspaceTool } from "./workspace/workspace.tool";

// Open the log file when starting up
const args = parseArgs(process.argv.slice(2));

if (!("project" in args)) {
  console.error("No project provided", args);
  process.exit(1);
}

const log = setLogger(new FileLogger(join(args["project"], "mcp.log"), "DEBUG"));

const server = new McpServer(
  {
    name: "@rejot-dev/mcp",
    version: "0.0.7",
  },
  {
    instructions: `
# ReJot MCP
This is the ReJot MCP server. ReJot provides a set of tools to facilitate micro-service
communication. As opposed to traditional approaches like REST APIs, ReJot operates on the database
layer. Replication is used to push data from the source to the consumer. We call this process
'syncing'.

## Definitions:
- Public Schema: a way to describe how a team wants to share data with other teams. It contains an
outputSchema which is a versioned contract for the data that will be shared. It also defines the
source of the underlying data, and a transformation to encapsulate the internal data model.
- Consumer Schema: a way to describe how a team wants to receive data from other teams. It contains
a reference to a public schema (versioned) which it directly relates to. It also contains
the destinationDataStoreSlug which is the data store that the consumer will write to. Again an 
arbitrary transformation is applied.
- Connection: a database configuration. Identified by a slug. In this MCP the connectionSlug is 
commonly used for database operations.
- Data Store: an instantiation of a connection. Identified by a connectionSlug. Other configuration
is specific to the underlying database.
- Manifest: a ReJot configuration file. Identified by a slug. It contains connections, data stores,
event stores and schemas. A team usually 'owns' a manifest. Teams will refer to each other's 
manifests using their slugs to be able to sync data. In production, a sync service will use a 
manifest. 
- Workspace: a collection of manifests. One root manifest defines the workspace, which will
contain relative path references to manifests in sub-directories.

## Working with Schemas
- Schemas are defined in code. E.g. in TypeScript files. The collect command will scan the 
workspace to find these schemas and add them to the manifest. To edit these schemas, you MUST change
the code directly. If you cannot edit text files, you must tell the user to do it manually.
- When you are asked to modify a schema, you MUST modify the source which is referenced by the
'definitionFile' property. After that you can run the collect command to update the manifest.

## Examples of what you can do:
- You will help the user set up database connections. Usually connections appear in a codebase or 
in environment variables/files.
- You can help validate if certain transformations will work by executing queries to the database
connections.
- You can help verify if a public or consumer schema is valid by checking if the tables it's reading
from and writing to exist.
- You can help setup the necessary configuration for data stores to work. Like creating replication
slots and publications in Postgres.
- Run transformation queries defined in schemas to see if they work properly.

## Some tips
- ALWAYS use the tools in this MCP to edit the manifest.
- Obtain the workspace information first.
- If you do not know a connection's slug. Get the workspace manifest first.
- You don't have to check health before doing other operations.
- When the users asks about the ReJot workspace, use the workspace info tool.

## Rules
- NEVER apply edits to a manifest directly.
- ALWAYS apply edits to the definitionFiles and use the tools in this MCP.
- DO NOT use the ReJot CLI. Use the tools in this MCP instead.
- DO NOT insert data into tables. ONLY do this when the user EXPLICITLY asks you to.
      `,
  },
);

const workspaceService = new WorkspaceService(new ManifestWorkspaceResolver());
const manifestFileManager = new ManifestFileManager();

const vibeCollector = new VibeCollector(
  new SchemaCollector(),
  new FileFinder(),
  manifestFileManager,
);

const rejotMcp = new RejotMcp(args["project"], server, [
  new WorkspaceResources(workspaceService),
  new DbIntrospectionTool(workspaceService),
  new ManifestInfoTool(),
  new WorkspaceTool(workspaceService),
  new ManifestConnectionTool(workspaceService),
  new ManifestInitTool(workspaceService),
  new CollectTool(workspaceService, vibeCollector),
  new ManifestPostgresDataStoreTool(workspaceService, manifestFileManager),
  new SchemasTool(workspaceService),
]);

rejotMcp
  .connect()
  .then(() => {})
  .catch((err) => {
    log.error(`Server error: ${err.message}`);
    log.logErrorInstance(err);
  });
