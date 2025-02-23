import { Client } from "pg";
import { tokens } from "typed-inject";

import type { ConfigManager } from "@/app-config/config.ts";
import { PostgresConnectionManager } from "./postgres-connection-manager.ts";

import { sql } from "@/connection/postgres/sql-tag.ts";
import { ConnectionError, ConnectionErrors } from "../connection.error.ts";
import { LogicalReplicationService } from "pg-logical-replication";
import { RejotPgOutputPlugin } from "./rejot-pgoutput-plugin.ts";
import type { Message } from "pg-logical-replication/dist/output-plugins/pgoutput/pgoutput.types";

const REJOT_SLOT_NAME = "rejot_slot";

type ConnectionConfig = {
  type: "postgres";
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl: boolean;
};

type SlotInfo = {
  slotName: string;
  plugin: string;
  active: boolean;
  activePid: number | null;
  restartLsn: string;
  confirmedFlushLsn: string;
  twoPhase: boolean;
  inactiveSince: string;
};

type StartResult = {
  status: "started" | "already-started" | "terminated";
  slotInfo: SlotInfo;
};

export class PostgresChanges {
  static inject = tokens("config", "postgresConnectionManager");

  constructor(
    _configManager: ConfigManager,
    _postgresConnectionManager: PostgresConnectionManager,
  ) {}

  async start(config: ConnectionConfig, publicationName: string): Promise<StartResult> {
    const client = new Client(config);
    await client.connect();

    if (!(await this.#hasSlot(client, REJOT_SLOT_NAME))) {
      await this.#createSlot(client, REJOT_SLOT_NAME);
    }

    const slotInfo = await this.#getSlotInfo(client, REJOT_SLOT_NAME);

    if (slotInfo.active) {
      return {
        status: "already-started",
        slotInfo,
      };
    }

    const logicalReplicationService = new LogicalReplicationService(config, {
      acknowledge: {
        auto: false,
        timeoutSeconds: 0,
      },
    });

    logicalReplicationService.on("data", (lsn: string, log: Message) => {
      if (log.tag === "commit") {
        console.log("commit", lsn, log);
      }

      if (log.tag === "insert") {
        const change = {
          operation: log.tag,
          table: log.relation.name,
          schema: log.relation.schema,
          data: log.new,
        };

        console.log("change", change);
      } else if (log.tag === "update") {
        const change = {
          operation: log.tag,
          table: log.relation.name,
          schema: log.relation.schema,
          data: log.new,
        };

        console.log("change", change);
      } else if (log.tag === "delete") {
        const change = {
          operation: log.tag,
          table: log.relation.name,
          schema: log.relation.schema,
        };

        console.log("change", change);
      }
    });

    logicalReplicationService.on(
      "heartbeat",
      (lsn: string, timestamp: number, shouldRespond: boolean) => {
        console.log("heartbeat", lsn, timestamp, shouldRespond);
        logicalReplicationService.acknowledge(lsn);
      },
    );

    const plugin = new RejotPgOutputPlugin({
      protoVersion: 2,
      publicationNames: [publicationName],
    });

    console.log("subscribing to slot ", slotInfo);

    try {
      await logicalReplicationService.subscribe(plugin, REJOT_SLOT_NAME);
    } catch {
      return {
        status: "terminated",
        slotInfo,
      };
    }

    return {
      status: "started",
      slotInfo,
    };
  }

  async #hasSlot(client: Client, slotName: string) {
    const result = await client.query(sql`
      SELECT
        1
      FROM
        pg_replication_slots
      WHERE
        slot_name = ${slotName}
    `);
    return result.rows.length > 0;
  }

  async #createSlot(client: Client, slotName: string) {
    await client.query(sql`
      SELECT
        pg_create_logical_replication_slot(${slotName}, 'pgoutput')
    `);
  }

  async #getSlotInfo(client: Client, slotName: string): Promise<SlotInfo> {
    const result = await client.query(sql`
      SELECT
        slot_name,
        plugin,
        active,
        active_pid,
        restart_lsn,
        confirmed_flush_lsn,
        two_phase,
        inactive_since
      FROM
        pg_replication_slots
      WHERE
        slot_name = ${slotName}
    `);

    if (result.rows.length === 0) {
      throw new ConnectionError({
        ...ConnectionErrors.NOT_FOUND,
        context: { slotName },
      });
    }

    const row = result.rows[0];

    return {
      slotName: row.slot_name,
      plugin: row.plugin,
      active: row.active,
      activePid: row.active_pid,
      restartLsn: row.restart_lsn,
      confirmedFlushLsn: row.confirmed_flush_lsn,
      twoPhase: row.two_phase,
      inactiveSince: row.inactive_since,
    };
  }
}
