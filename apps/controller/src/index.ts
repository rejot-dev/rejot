import { getConfig } from "./app-config/config.ts";
import server from "./api-server/index.ts";
import { appInjector } from "./injector.ts";
import * as Sentry from "@sentry/bun";

const { apiPort, sentry } = getConfig();

if (sentry?.enabled) {
  console.log("Sentry instumentation enabled");
  Sentry.init({
    dsn: sentry.dsn,
    tracesSampleRate: sentry.tracesSampleRate,
    environment: sentry.environment,
  });
}

console.log(`Starting server on port ${apiPort}`);

const postgresChangelogListener = appInjector.resolve("postgresChangelogListener");

postgresChangelogListener.verifyConnections();

export default server;
