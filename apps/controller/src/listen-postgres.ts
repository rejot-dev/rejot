import { appInjector } from "@/injector.ts";
import { ConfigManager } from "@/app-config/config.ts";
import { Client } from "pg";
import { LogicalReplicationService, PgoutputPlugin } from "pg-logical-replication";
import process from "node:process";

const configManager = appInjector.injectClass(ConfigManager);

const connectionConfig = configManager.mainPostgresConnection;

// const client = new Client(connectionConfig);

const logicalReplicationService = new LogicalReplicationService(connectionConfig, {
  acknowledge: {
    auto: false,
    timeoutSeconds: 0,
  },
});

class WilcoPlugin extends PgoutputPlugin {
  constructor(options: { protoVersion: 1 | 2; publicationNames: string[]; messages?: boolean }) {
    super(options);
  }

  override start(client: Client, slotName: string, lastLsn: string) {
    console.log("start", slotName, lastLsn);
    return super.start(client, slotName, lastLsn);
  }
}

const plugin = new WilcoPlugin({
  protoVersion: 2,
  publicationNames: ["rejot_pub_1"],
});

// Handle data events
logicalReplicationService.on("data", (lsn: string, log) => {
  if (log.tag === "update" || log.tag === "insert" || log.tag === "delete") {
    const change = {
      operation: log.tag,
      table: log.relation.name,
      schema: log.relation.schema,
      data: log.new,
      oldData: log.old,
    };

    console.log("change", change);

    console.log("acknowledging", lsn);
    logicalReplicationService.acknowledge(lsn);
  }
});

// Handle error events
logicalReplicationService.on("error", (err: Error) => {
  console.error("[ERROR] Logical replication error:", err);
});

logicalReplicationService.on(
  "heartbeat",
  (lsn: string, timestamp: number, shouldRespond: boolean) => {
    if (shouldRespond) {
      console.log("[HEARTBEAT]", {
        lsn,
        timestamp,
        shouldRespond,
      });

      // logicalReplicationService.acknowledge(lsn);
    }
  },
);

console.log("Subscribing to slot");

// Handle graceful shutdown on Ctrl+C
process.on("SIGINT", async () => {
  console.log("\nReceived SIGINT (Ctrl+C). Shutting down gracefully...");
  try {
    await logicalReplicationService.stop();
    console.log("Logical replication service stopped successfully");
  } catch (error) {
    console.error("Error during shutdown:", error);
  }
});

try {
  logicalReplicationService
    .subscribe(plugin, "wilco_slot_pgoutput_2")
    .then(() => {
      console.log("Subscribed to slot");
    })
    .catch((error) => {
      console.error("error happened", error);
    });
} catch (error) {
  console.error("error happened", error);
}

console.log("Subscribed to slot");
