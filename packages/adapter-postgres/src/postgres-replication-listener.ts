import { LogicalReplicationService } from "pg-logical-replication";
import type {
  Message,
  MessageInsert,
  MessageUpdate,
  MessageDelete,
} from "pg-logical-replication/dist/output-plugins/pgoutput/pgoutput.types";
import { RejotPgOutputPlugin } from "./pgoutput-plugin.ts";
import { assertUnreachable } from "./util/asserts.ts";
import type { Transaction } from "@rejot-dev/contract/sync";
import logger from "@rejot-dev/contract/logger";
import { AsyncQueue } from "./async-queue.ts";

type ConnectionConfig = {
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  ssl?: boolean;
};

type OperationType = "insert" | "update" | "delete";

export type Operation = {
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
      oldKeys: Record<string, unknown>;
    }
  | {
      type: "delete";
      table: string;
      keyColumns: string[];
      tableSchema: string;
      oldKeys: Record<string, unknown>;
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

export type TransactionBuffer = {
  commitLsn: string | null;
  commitEndLsn: string;
  commitTime: bigint;
  xid: number;
  operations: Operation[];
  relations: Map<number, Relation>;
};

type TransactionBufferState = "empty" | "begin";

type OnCommitCallback = (buffer: TransactionBuffer) => Promise<boolean>;

const log = logger.createLogger("postgres-replication-listener");

export class PostgresReplicationListener {
  #logicalReplicationService: LogicalReplicationService;
  #transactionBuffer: Partial<TransactionBuffer> & { state: TransactionBufferState };
  #onCommit?: OnCommitCallback;

  #isRunning = false;

  #config: ConnectionConfig;

  constructor(config: ConnectionConfig, onCommit?: OnCommitCallback) {
    this.#config = config;
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

  async start(publicationName: string, slotName: string): Promise<boolean> {
    const plugin = new RejotPgOutputPlugin({
      protoVersion: 2,
      publicationNames: [publicationName],
    });

    try {
      await this.#logicalReplicationService.subscribe(plugin, slotName);
      this.#isRunning = true;
    } catch (error) {
      throw new Error("Failed to subscribe to logical replication service", { cause: error });
    }

    return true;
  }
  async *startIteration(
    publicationName: string,
    slotName: string,
    abortSignal: AbortSignal,
  ): AsyncIterator<Transaction> {
    if (this.#isRunning) {
      throw new Error("PostgresReplicationListener is already running.");
    }

    const queue = new AsyncQueue<{
      buffer: TransactionBuffer;
      ackResolver: (value: boolean) => void;
      ackPromise: Promise<boolean>;
    }>();

    this.#onCommit = async (buffer) => {
      const { resolve: ackResolver, promise: ackPromise } = Promise.withResolvers<boolean>();

      queue.enqueue({
        buffer,
        ackResolver,
        ackPromise,
      });

      return ackPromise;
    };

    const plugin = new RejotPgOutputPlugin({
      protoVersion: 2,
      publicationNames: [publicationName],
    });

    // Subscribe but do not await, it never returns
    this.#logicalReplicationService.subscribe(plugin, slotName);

    abortSignal.addEventListener("abort", async () => {
      log.info("Abort signal received, stopping listener");
      await this.stop();
    });

    this.#isRunning = true;

    try {
      while (!abortSignal.aborted) {
        const { buffer, ackResolver } = await queue.dequeue();
        const { commitEndLsn, operations } = buffer;

        // Process operations to handle primary key changes
        const processedOperations = this.#processOperationsForPrimaryKeyChanges(operations);

        yield {
          id: commitEndLsn,
          operations: processedOperations,
          ack: ackResolver,
        };
      }
    } catch (error) {
      if (error instanceof Error && error.message === "pg-aborted") {
        return;
      }
      throw error;
    }
  }

  async stop(): Promise<void> {
    this.#isRunning = false;
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
        // Store the LSN we need for acknowledgment before any processing
        const commitEndLsn = this.#transactionBuffer.commitEndLsn;
        const transactionBuffer = { ...this.#transactionBuffer } as TransactionBuffer;

        let processed = true;
        if (this.#onCommit) {
          processed = await this.#onCommit(transactionBuffer);
        } else {
          throw new Error("No onCommit callback set");
        }

        if (processed) {
          console.log("transaction buffer processed, acknowledging.", commitEndLsn);
          await this.#logicalReplicationService.acknowledge(commitEndLsn);
          this.#transactionBuffer = {
            state: "empty",
          };
        } else {
          console.log("transaction buffer not processed, stopping listener.");
          await this.stop();
        }
      } catch (error) {
        console.error("ERROR during processing of onCommit transaction buffer.", error);
        console.log("stopping listener");
        await this.stop();
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
        oldKeys: log.key || {},
      };
    }

    if (log.tag === "delete") {
      return {
        type: "delete",
        table: log.relation.name,
        tableSchema: log.relation.schema,
        keyColumns: log.relation.keyColumns,
        oldKeys: log.key || {},
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
    if (error.message === "Connection terminated unexpectedly") {
      console.log(
        `Connection terminated unexpectedly, stopping listener. Database: ${this.#config.database}`,
      );
    }

    // TODO(Wilco): Handle errors gracefully.

    console.error("#onError", error);
  }

  /**
   * When the primary key changes in an update, we replace the the operation with an insert and
   * delete operation.
   *
   * TODO(Wilco): unsure if this is the best approach, but primary key updates should be uncommon
   *              in practice.
   *
   * @param operations The operations to process.
   * @returns The processed operations.
   */
  #processOperationsForPrimaryKeyChanges(operations: Operation[]): Operation[] {
    const result: Operation[] = [];

    for (const operation of operations) {
      if (operation.type === "update" && operation.keyColumns.length > 0) {
        const primaryKeyChanged = operation.keyColumns.some((column) => {
          if (!(column in operation.oldKeys)) {
            // If the column is not in oldKeys, it means that it wasn't changed.
            return false;
          }
          return operation.oldKeys[column] !== operation.new[column];
        });

        if (primaryKeyChanged) {
          // Create an insert operation with the new values
          result.push({
            type: "insert",
            table: operation.table,
            tableSchema: operation.tableSchema,
            keyColumns: operation.keyColumns,
            new: operation.new,
          });

          // Create a delete operation with the old primary key
          result.push({
            type: "delete",
            table: operation.table,
            tableSchema: operation.tableSchema,
            keyColumns: operation.keyColumns,
            oldKeys: operation.oldKeys,
          });
        } else {
          // No primary key change, add the original update
          result.push(operation);
        }
      } else {
        // Not an update or no primary keys, pass through unchanged
        result.push(operation);
      }
    }

    return result;
  }
}
