import { parseArgs } from "@std/cli/parse-args";

import { ManifestInfoTool } from "./tools/manifest/manifest-info.tool";
import { initLog, logError } from "./logging/log";
import { RejotMcp } from "./rejot-mcp";
import { ProjectInitializer } from "./project/project";
import { ManifestWorkspaceResolver } from "@rejot-dev/contract-tools/manifest";

initLog();

// Open the log file when starting up
const args = parseArgs(process.argv.slice(2));

if (!("project" in args)) {
  logError("No project provided", args);
  process.exit(1);
}

// Create instances of our initializers
const manifestInfoTool = new ManifestInfoTool();
const projectInitializer = new ProjectInitializer(new ManifestWorkspaceResolver());

const rejotMcp = new RejotMcp(args.project, [manifestInfoTool, projectInitializer]);

rejotMcp.connect().catch((err) => {
  logError(`Server error: ${err}`);
});
