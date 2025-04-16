import { parseArgs } from "@std/cli/parse-args";
import { join } from "node:path";
import { RejotMcp } from "./rejot-mcp";
import { ProjectInitializer } from "./project/project";
import { ManifestWorkspaceResolver } from "@rejot-dev/contract-tools/manifest";
import { DbIntrospectionTool } from "./tools/db-introspection/db-introspection.tool";
import { ManifestInfoTool } from "./tools/manifest/manifest-info.tool";
import { setLogger, FileLogger } from "@rejot-dev/contract/logger";

const log = setLogger(new FileLogger(join(__dirname, "mcp.log")));

// Open the log file when starting up
const args = parseArgs(process.argv.slice(2));

if (!("project" in args)) {
  log.error("No project provided", args);
  process.exit(1);
}

const rejotMcp = new RejotMcp(args.project, log, [
  new ProjectInitializer(new ManifestWorkspaceResolver()),
  new DbIntrospectionTool(),
  new ManifestInfoTool(),
]);

rejotMcp
  .connect()
  .then(() => {})
  .catch((err) => {
    log.error("Server error", err);
  });
