import { parseArgs } from "@std/cli/parse-args";

import { defaultLogger, initLog, logError } from "./logging/log";
import { RejotMcp } from "./rejot-mcp";
import { ProjectInitializer } from "./project/project";
import { ManifestWorkspaceResolver } from "@rejot-dev/contract-tools/manifest";
import { DbIntrospectionTool } from "./tools/db-introspection/db-introspection.tool";
import { ManifestInfoTool } from "./tools/manifest/manifest-info.tool";

initLog();

// Open the log file when starting up
const args = parseArgs(process.argv.slice(2));

if (!("project" in args)) {
  logError("No project provided", args);
  process.exit(1);
}

const rejotMcp = new RejotMcp(args.project, defaultLogger, [
  new ProjectInitializer(new ManifestWorkspaceResolver()),
  new DbIntrospectionTool(),
  new ManifestInfoTool(),
]);

rejotMcp
  .connect()
  .then(() => {})
  .catch((err) => {
    logError(`Server error: ${err}`);
  });
