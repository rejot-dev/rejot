// Just for testing purposes.

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "../..");

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

const listResult = await client.listResources();
const listTemplateResult = await client.listResourceTemplates();

console.dir(
  {
    listResult,
    listTemplateResult,
  },
  { depth: null },
);

await client.close();
