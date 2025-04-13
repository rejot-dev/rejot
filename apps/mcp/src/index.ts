import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { PostgresConnectionSchema } from "@rejot-dev/adapter-postgres/schemas";
import fs from "node:fs";
import path from "node:path";
import { registerManifestInfoTool } from "./tools/manifest/manifest-info.tool";

const server = new McpServer({
  name: "@rejot-dev/mcp",
  version: "0.0.7",
});

const logFilePath = path.join(__dirname, "server.log");

function appendToLog(message: string) {
  const logMessage = `${new Date().toISOString()} - ${message}\n`;
  fs.appendFileSync(logFilePath, logMessage);
}

// Open the log file when starting up
fs.writeFileSync(logFilePath, "Server Log Start\n", { flag: "w" });
appendToLog(`current working directory: ${process.cwd()}`);

registerManifestInfoTool(server);

server.tool(
  "connect",
  "",
  {
    postgresConfig: PostgresConnectionSchema.optional(),
  },

  async ({ postgresConfig }) => {
    if (!postgresConfig) {
      appendToLog("No postgres config provided");
      return {
        content: [{ type: "text", text: "No postgres config provided" }],
      };
    }

    appendToLog(`Connecting to postgres: ${postgresConfig.host}:${postgresConfig.port}`);

    return {
      content: [
        {
          type: "text",
          text: "Connected to postgres",
        },
      ],
    };
  },
);

async function runServer() {
  const transport = new StdioServerTransport();
  appendToLog("Server starting");
  await server.connect(transport);
  appendToLog("Server connected");
}

runServer().catch((err) => {
  appendToLog(`Server error: ${err}`);
});
