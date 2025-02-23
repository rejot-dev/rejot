import { LogicalReplicationService } from "pg-logical-replication";
import type {
  Message,
  MessageInsert,
  MessageUpdate,
  MessageDelete,
} from "pg-logical-replication/dist/output-plugins/pgoutput/pgoutput.types";
import type { ConnectionConfig } from "./postgres-changes.ts";
import { RejotPgOutputPlugin } from "./rejot-pgoutput-plugin.ts";
import { assertUnreachable } from "@/lib/assert.ts";

const REJOT_SLOT_NAME = "rejot_slot";

type OperationType = "insert" | "update" | "delete";

type Operation = {
  type: OperationType;
} & (
  | {
      type: "insert";
      table: string;
      tableSchema: string;
      keyColumns: string[];
      new: Record<string, unknown>;
    }
  | {
      type: "update";
      table: string;
      tableSchema: string;
      keyColumns: string[];
      new: Record<string, unknown>;
    }
  | {
      type: "delete";
      table: string;
      keyColumns: string[];
      tableSchema: string;
    }
);

type RelationColumn = {
  flags: number;
  name: string;
  typeOid: number;
  typeMod: number;
};

type Relation = {
  schema: string;
  name: string;
  keyColumns: string[];
  relationOid: number;
  columns: RelationColumn[];
};

type TransactionBuffer = {
  commitLsn: string | null;
  commitEndLsn: string;
  commitTime: bigint;
  xid: number;
  operations: Operation[];
  relations: Map<number, Relation>;
};

type TransactionBufferState = "empty" | "begin";

type OnCommitCallback = (buffer: TransactionBuffer) => Promise<boolean>;

export class PostgresReplicationListener {
  #logicalReplicationService: LogicalReplicationService;

  #transactionBuffer: Partial<TransactionBuffer> & { state: TransactionBufferState };
  #onCommit: OnCommitCallback;

  constructor(config: ConnectionConfig, onCommit: OnCommitCallback) {
    this.#logicalReplicationService = new LogicalReplicationService(config, {
      acknowledge: {
        auto: false,
        timeoutSeconds: 0,
      },
    });
    this.#onCommit = onCommit;

    this.#logicalReplicationService.on("data", this.#onData.bind(this));
    this.#logicalReplicationService.on("heartbeat", this.#onHeartbeat.bind(this));
    this.#logicalReplicationService.on("error", this.#onError.bind(this));

    // Initialize empty transaction buffer
    this.#transactionBuffer = {
      state: "empty",
    };
  }

  async start(publicationName: string): Promise<boolean> {
    const plugin = new RejotPgOutputPlugin({
      protoVersion: 2,
      publicationNames: [publicationName],
    });

    try {
      await this.#logicalReplicationService.subscribe(plugin, REJOT_SLOT_NAME);
    } catch {
      return false;
    }

    return true;
  }

  async stop(): Promise<void> {
    await this.#logicalReplicationService.stop();
  }

  async #onData(lsn: string, log: Message) {
    if (log.tag === "begin") {
      // Reset buffer at start of transaction
      this.#transactionBuffer = {
        state: "begin",
        commitLsn: log.commitLsn,
        commitEndLsn: lsn,
        commitTime: log.commitTime.valueOf(),
        xid: log.xid,
        operations: [],
        relations: new Map(),
      };
    } else if (log.tag === "commit") {
      if (this.#transactionBuffer.commitLsn !== log.commitLsn) {
        throw new Error("Commit LSN mismatch");
      }

      if (
        !this.#transactionBuffer.commitLsn ||
        !this.#transactionBuffer.commitEndLsn ||
        !this.#transactionBuffer.commitTime ||
        !this.#transactionBuffer.xid ||
        !this.#transactionBuffer.operations ||
        !this.#transactionBuffer.relations
      ) {
        throw new Error("Transaction buffer is missing required properties");
      }

      this.#transactionBuffer.commitTime = log.commitTime.valueOf();

      try {
        const processed = await this.#onCommit(this.#transactionBuffer as TransactionBuffer);

        if (processed) {
          console.log(
            "transaction buffer processed, acknowledging.",
            this.#transactionBuffer.commitLsn,
            this.#transactionBuffer.commitEndLsn,
          );

          await this.#logicalReplicationService.acknowledge(this.#transactionBuffer.commitEndLsn);

          this.#transactionBuffer = {
            state: "empty",
          };
        } else {
          console.log("transaction buffer not processed, stopping listener.");
          await this.#logicalReplicationService.stop();
        }
      } catch (error) {
        console.error("ERROR during processing of onCommit transaction buffer.", error);
        console.log("stopping listener");
        await this.#logicalReplicationService.stop();
      }
    } else if (log.tag === "relation") {
      if (!this.#transactionBuffer?.relations) {
        throw new Error("Got relation before begin.");
      }

      // Store relation info in the buffer
      this.#transactionBuffer.relations.set(log.relationOid, {
        schema: log.schema,
        name: log.name,
        keyColumns: log.keyColumns,
        relationOid: log.relationOid,
        columns: log.columns.map((column) => ({
          flags: column.flags,
          name: column.name,
          typeOid: column.typeOid,
          typeMod: column.typeMod,
        })),
      });
    } else if (log.tag === "insert" || log.tag === "update" || log.tag === "delete") {
      if (!this.#transactionBuffer?.operations) {
        throw new Error("Got operation before relation.");
      }

      // Handle DML operations (insert, update, delete)
      const operation = this.#createOperation(log);
      if (operation) {
        this.#transactionBuffer.operations.push(operation);
      }
    }
  }

  #createOperation(log: MessageInsert | MessageUpdate | MessageDelete): Operation {
    if (log.tag === "insert") {
      return {
        type: "insert",
        table: log.relation.name,
        tableSchema: log.relation.schema,
        keyColumns: log.relation.keyColumns,
        new: log.new,
      };
    }

    if (log.tag === "update") {
      return {
        type: "update",
        table: log.relation.name,
        tableSchema: log.relation.schema,
        keyColumns: log.relation.keyColumns,
        new: log.new,
      };
    }

    if (log.tag === "delete") {
      return {
        type: "delete",
        table: log.relation.name,
        tableSchema: log.relation.schema,
        keyColumns: log.relation.keyColumns,
      };
    }

    assertUnreachable(log);
  }

  #onHeartbeat(lsn: string, timestamp: number, shouldRespond: boolean) {
    if (this.#transactionBuffer.state === "empty" && shouldRespond) {
      console.log("acknowledging heartbeat", lsn, timestamp);
      this.#logicalReplicationService.acknowledge(lsn);
    }
  }

  #onError(error: Error) {
    console.error("error", error);
  }
}
