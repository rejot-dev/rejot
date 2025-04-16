import { parseArgs } from "@std/cli/parse-args";
import { join } from "node:path";
import { RejotMcp } from "./rejot-mcp";
import { WorkspaceResources } from "./workspace/workspace.resources";
import { ManifestWorkspaceResolver } from "@rejot-dev/contract-tools/manifest";
import { DbIntrospectionTool } from "./tools/db-introspection/db-introspection.tool";
import { ManifestInfoTool } from "./tools/manifest/manifest-info.tool";
import { ManifestInitTool } from "./tools/manifest/manifest-init.tool";
import { setLogger, FileLogger } from "@rejot-dev/contract/logger";
import { WorkspaceService } from "./workspace/workspace";
// Open the log file when starting up
const args = parseArgs(process.argv.slice(2));

if (!("project" in args)) {
  console.error("No project provided", args);
  process.exit(1);
}

const log = setLogger(new FileLogger(join(args.project, "mcp.log"), "DEBUG"));

const workspaceService = new WorkspaceService(new ManifestWorkspaceResolver());

const rejotMcp = new RejotMcp(args.project, log, [
  new WorkspaceResources(workspaceService),
  new DbIntrospectionTool(),
  new ManifestInfoTool(),
  new ManifestInitTool(workspaceService),
]);

rejotMcp
  .connect()
  .then(() => {})
  .catch((err) => {
    log.error(`Server error: ${err.message}`);

    if (err instanceof Error) {
      for (const stack of err.stack?.split("\n") ?? []) {
        log.error(stack);
      }
    }
  });
