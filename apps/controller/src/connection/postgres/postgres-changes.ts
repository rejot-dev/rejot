import { Client } from "pg";
import { tokens } from "typed-inject";

import { sql } from "@/connection/postgres/sql-tag.ts";
import { ConnectionError, ConnectionErrors } from "../connection.error.ts";
import type { IConnectionRepository } from "../connection-repository.ts";
import { PostgresReplicationListener } from "./postgres-replication-listener.ts";
import type { IChangesService } from "@/changes/changes-service.ts";
import type { IConsumerSchemaRepository } from "@/consumer-schema/consumer-schema-repository.ts";

const REJOT_SLOT_NAME = "rejot_slot";

export type ConnectionConfig = {
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

type StartResult =
  | {
      status: "started" | "already-started" | "terminated" | "stopped";
      slotInfo: SlotInfo;
    }
  | {
      status: "no-logical-replication";
    };

type StartParams = {
  organizationId: string;
  dataStoreSlug: string;
  config: ConnectionConfig;
  publicationName: string;
  listenForMs?: number;
};

export class PostgresChanges {
  static inject = tokens("connectionRepository", "changesService", "consumerSchemaRepository");

  #connectionRepository: IConnectionRepository;
  #changesService: IChangesService;
  #consumerSchemaRepository: IConsumerSchemaRepository;

  constructor(
    connectionRepository: IConnectionRepository,
    changesService: IChangesService,
    consumerSchemaRepository: IConsumerSchemaRepository,
  ) {
    this.#connectionRepository = connectionRepository;
    this.#changesService = changesService;
    this.#consumerSchemaRepository = consumerSchemaRepository;
  }

  async start({
    organizationId,
    dataStoreSlug,
    config,
    publicationName,
    listenForMs,
  }: StartParams): Promise<StartResult> {
    const connection = await this.#connectionRepository.findByOrganizationCode(
      organizationId,
      dataStoreSlug,
    );

    const client = new Client(config);
    await client.connect();

    if (!(await this.#hasSlot(client, REJOT_SLOT_NAME))) {
      const slotCreated = await this.#createSlot(client, REJOT_SLOT_NAME);

      if (!slotCreated) {
        return {
          status: "no-logical-replication",
        };
      }
    }

    const slotInfo = await this.#getSlotInfo(client, REJOT_SLOT_NAME);

    if (slotInfo.active) {
      return {
        status: "already-started",
        slotInfo,
      };
    }

    const listener = new PostgresReplicationListener(config, async (buffer) => {
      const transformations = await this.#changesService.getTransformationsForOperations({
        connectionId: connection.id,
        changes: {
          operations: buffer.operations.map((op) => ({
            ...op,
            table: `${op.tableSchema}.${op.table}`,
          })),
        },
      });

      // 1. Transform
      const transformedOperations = await Promise.all(
        transformations.flatMap(async ({ operation, transformation, publicSchemaId }) => {
          if (operation.type === "delete") {
            // TODO: Support delete. (Were filtered before.)
            throw new Error("Delete not supported");
          }

          const keyValues = operation.keyColumns.map((column) => operation.new[column]);

          const result = await client.query(transformation.details.sql, keyValues);

          if (result.rows.length !== 1) {
            throw new Error("Expected 1 row, got " + result.rows.length);
          }

          const obj: Record<string, unknown> = {};

          for (const column of operation.keyColumns) {
            obj[column] = operation.new[column];
          }

          return {
            obj: {
              // NOTE: Order matter A LOT here.
              ...obj,
              ...result.rows[0],
            },
            publicSchemaId,
          };
        }),
      );

      try {
        await Promise.all(
          transformedOperations.map(async ({ obj, publicSchemaId }) => {
            const consumerSchemas =
              await this.#consumerSchemaRepository.getByPublicSchemaId(publicSchemaId);

            for (const { transformations, connection } of consumerSchemas) {
              // Get transformation with highest version
              const latestTransformation = transformations.reduce((prev, current) => {
                return prev.majorVersion > current.majorVersion ? prev : current;
              });

              const connectionConfig = await this.#connectionRepository.findById(connection.id);

              if (!connectionConfig) {
                throw new Error("Connection not found");
              }

              const sinkClient = new Client(connectionConfig.config);
              await sinkClient.connect();

              try {
                await sinkClient.query(latestTransformation.details.sql, Object.values(obj));
              } finally {
                await sinkClient.end();
              }
            }
          }),
        );
        return true;
      } catch (error) {
        console.error("Error during changes processing.", error);
        return false;
      }
    });

    const listenerPromise = listener.start(publicationName);
    const timeoutPromise = listenForMs
      ? new Promise<"timeout">((resolve) => {
          setTimeout(() => resolve("timeout"), listenForMs);
        })
      : undefined;

    const success = await Promise.race([listenerPromise, timeoutPromise]);

    if (typeof success === "string") {
      await listener.stop();

      return {
        status: "stopped",
        slotInfo,
      };
    }

    if (!success) {
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

  async #createSlot(client: Client, slotName: string): Promise<boolean> {
    try {
      await client.query(sql`
        SELECT
          pg_create_logical_replication_slot(${slotName}, 'pgoutput')
      `);
      return true;
    } catch {
      return false;
    }
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
