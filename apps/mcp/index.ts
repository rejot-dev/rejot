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
- Schemas are defined in code. E.g. in TypeScript files. 
- The collect command will scan the  workspace to find these schemas and add them to the manifest. 
- You SHALL NEVER edit schemas in the manifest file directly.
- You MUST modify the underlying source which is referenced by the 'definitionFile' property. 
- Run the collect command to update the manifest after editing the source.

## Rules
- NEVER update the manifest file directly.
- DO NOT check connection health unless you think something is wrong.
- NEVER use the ReJot CLI.
- DO NOT run write operations on any database without EXPLICIT USER permission.
- Call as FEW tools as possible.
- When a specific table is mentioned, use GET TABLE SCHEMA directly without other tools.

<use_cases>
  <use_case>
    <title>Help the user set up database connections.</title>
    <steps>
      1. Find database credentials in the user's codebase.
      2. Use add connection tool.
      3. Check the connection's health.
    </steps>
  </use_case>

  <use_case>
    <title>Validate public/consumer schemas transformations.</title>
    <steps>
      1. Use the find schema tool to find the schema in the workspace.
      2. Use the get table schemas tool to figure out if the tables referenced in the schema exist.
      3. Insert real parameters into the transformation query and run it using the query tool.
    </steps>
    <example_questions>
      <question>Will this [public/consumer] schema work?</question>
    </example_questions>
    <example_answers>
      <answer>No, because the table [table_name] does not exist.</answer>
      <answer>Possibly, there are no rows in the table.</answer>
      <answer>Yes, I ran an example query with [id] and it returned the following: [rows]</answer>
    </example_answers>
    <rules>
      <rule>When asked about a schema DO NOT answer questions about anything else.</rule>
    </rules>
  </use_case>

  <use_case>
    <title>Configure a data store to be usable in syncing.</title>
    <steps>
      1. Use the data store help tool to figure out the necessary configuration.
      2. Use the query tool to modify the configuration as necessary.
    </steps>
  </use_case>

</use_cases>
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
