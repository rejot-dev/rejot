import { getConfig } from "./app-config/config.ts";
import server from "./api-server/index.ts";
import { appInjector } from "./injector.ts";
const { apiPort } = getConfig();
console.log(`Starting server on port ${apiPort}`);

const postgresChangelogListener = appInjector.resolve("postgresChangelogListener");

postgresChangelogListener.verifyConnections();

// Deno.serve({ port: apiPort }, server.fetch);
// Bun.serve({ port: apiPort }, server.fetch);

export default server;