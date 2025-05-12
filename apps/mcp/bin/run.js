#!/usr/bin/env node
/*global console*/
/*global URL*/
// @ts-check

import { readFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { FileLogger, isValidLogLevel, setLogger } from "@rejot-dev/contract/logger";
import { rejotMcp } from "@rejot-dev/mcp";

const { values: argValues } = parseArgs({
  args: process.argv.slice(2),
  options: {
    project: {
      type: "string",
      short: "p",
    },
    version: {
      type: "boolean",
      short: "v",
    },
    "log-level": {
      type: "string",
      default: "DEBUG",
    },
  },
});

if (argValues.version) {
  const path = fileURLToPath(new URL("../package.json", import.meta.url));
  const packageJson = JSON.parse(readFileSync(path, "utf-8"));
  console.log(packageJson.version);
  process.exit(0);
}

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

const logLevel = isValidLogLevel(argValues["log-level"]) ? argValues["log-level"] : "DEBUG";
const log = setLogger(new FileLogger(join(argValues.project, "mcp.log"), logLevel));

rejotMcp
  .connect(argValues.project)
  .then(() => {})
  .catch((err) => {
    log.error(`Server error: ${err.message}`);
    log.logErrorInstance(err);
  });
