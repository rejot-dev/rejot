/*global console*/
// @ts-check

import { join } from "node:path";
import { parseArgs } from "node:util";
import process from "node:process";

import { FileLogger, setLogger } from "@rejot-dev/contract/logger";

import { rejotMcp } from "../index";

const { values: argValues } = parseArgs({
  args: process.argv.slice(2),
  options: {
    project: {
      type: "string",
      short: "p",
    },
  },
});

if (!("project" in argValues) || !argValues.project) {
  console.error("Invalid usage. Use `rejot-mcp --project <path>` to specify the project.");

  console.info(`
To use the ReJot MCP server in your editor, you can add (something like) the following to the 
appropriate config file:

E.g. "<project-root>/.cursor/mcp.json"

{
  "mcpServers": {
    "rejot-mcp": {
      "command": "rejot-mcp",
      "args": ["--project", "."]
    }
  }
}

Note that not all editors automatically substitute the project root for the "." placeholder. You
might have to manually specify the absolute project root.

For more information, see the ReJot documentation at https://rejot.dev/docs/
`);

  process.exit(1);
}

const log = setLogger(new FileLogger(join(argValues.project, "mcp.log"), "DEBUG"));

rejotMcp
  .connect(argValues.project)
  .then(() => {})
  .catch((err) => {
    log.error(`Server error: ${err.message}`);
    log.logErrorInstance(err);
  });
