// Just for testing purposes.

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

// const __dirname = dirname(fileURLToPath(import.meta.url));
// const projectRoot = resolve(__dirname, "../..");
const projectRoot = "/private/tmp/thing";

const transport = new StdioClientTransport({
  command: "bun",
  args: ["./index.ts", "--project", projectRoot],
});

const client = new Client({
  name: "example-client",
  version: "1.0.0",
});

await client.connect(transport);

console.log("connected");

// const result = await client.callTool({
//   name: "mcp_rejot_db_check_health",
//   arguments: {
//     connectionSlug: "data-destination-1",
//   },
// });

const result = await client.callTool({
  name: "rejot_manifest_connection_add_postgres",
  arguments: {
    manifestSlug: "wilco-postgres",
    newConnectionSlug: "wilco-postgres",
    postgresConnection: {
      connectionType: "postgres",
      host: "localhost",
      port: 5432,
      user: "postgres",
      password: "postgres",
      database: "postgres",
    },
  },
});

console.log("result");
console.dir(result, { depth: null });

await client.close();
