import { LogicalReplicationService } from "pg-logical-replication";
import type {
  Message,
  MessageDelete,
  MessageInsert,
  MessageUpdate,
} from "pg-logical-replication/dist/output-plugins/pgoutput/pgoutput.types";

import { getLogger } from "@rejot-dev/contract/logger";
import type { Transaction } from "@rejot-dev/contract/sync";

import { AsyncQueue, AsyncQueueAbortedError } from "./async-queue.ts";
import { RejotPgOutputPlugin } from "./pgoutput-plugin.ts";
import { assertUnreachable } from "./util/asserts.ts";

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

type QueueItem = {
  buffer: TransactionBuffer;
  ackResolver: (value: boolean) => void;
  ackPromise: Promise<boolean>;
};

const log = getLogger(import.meta.url);

export class PostgresReplicationListener {
  #logicalReplicationService: LogicalReplicationService;
  #transactionBuffer: Partial<TransactionBuffer> & { state: TransactionBufferState };
  #onCommit?: OnCommitCallback;

  #isRunning = false;

  #config: ConnectionConfig;

  #asyncQueue?: AsyncQueue<QueueItem>;

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

    log.info("PostgresReplicationListener initialized", { database: config.database });
  }

  async start(publicationName: string, slotName: string): Promise<boolean> {
    const plugin = new RejotPgOutputPlugin({
      protoVersion: 2,
      publicationNames: [publicationName],
    });

    try {
      await this.#logicalReplicationService.subscribe(plugin, slotName);
      this.#isRunning = true;
      log.info("Successfully subscribed to replication slot", { publicationName, slotName });
    } catch (error) {
      log.error("Failed to subscribe to replication slot", { publicationName, slotName, error });
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

    this.#asyncQueue = new AsyncQueue<QueueItem>(abortSignal);

    this.#onCommit = async (buffer) => {
      const { resolve: ackResolver, promise: ackPromise } = Promise.withResolvers<boolean>();

      this.#asyncQueue!.enqueue({
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
        const { buffer, ackResolver } = await this.#asyncQueue!.dequeue();
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
      if (error instanceof AsyncQueueAbortedError) {
        return;
      }
      throw error;
    }

    log.debug("PostgresReplicationListener iteration completed.");
  }

  async stop(): Promise<void> {
    this.#isRunning = false;
    await this.#logicalReplicationService.stop();
    this.#asyncQueue?.abort();
  }

  async #onData(lsn: string, message: Message) {
    if (message.tag === "begin") {
      // Reset buffer at start of transaction
      this.#transactionBuffer = {
        state: "begin",
        commitLsn: message.commitLsn,
        commitEndLsn: lsn,
        commitTime: message.commitTime.valueOf(),
        xid: message.xid,
        operations: [],
        relations: new Map(),
      };
    } else if (message.tag === "commit") {
      if (this.#transactionBuffer.commitLsn !== message.commitLsn) {
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

      this.#transactionBuffer.commitTime = message.commitTime.valueOf();

      try {
        // Store the LSN we need for acknowledgment before any processing
        const commitEndLsn = this.#transactionBuffer.commitEndLsn;
        const transactionBuffer = { ...this.#transactionBuffer } as TransactionBuffer;

        let processed = true;
        if (this.#onCommit) {
          processed = await this.#onCommit(transactionBuffer);
        } else {
          log.error("No onCommit callback set");
          throw new Error("No onCommit callback set");
        }

        if (processed) {
          log.debug("Transaction buffer processed, acknowledging", { commitEndLsn });
          await this.#logicalReplicationService.acknowledge(commitEndLsn);
          this.#transactionBuffer = {
            state: "empty",
          };
        } else {
          log.warn("Transaction buffer not processed, stopping listener", { commitEndLsn });
          await this.stop();
        }
      } catch (error) {
        log.error("Error processing transaction buffer", { error });
        log.info("Stopping listener due to error");
        await this.stop();
      }
    } else if (message.tag === "relation") {
      if (!this.#transactionBuffer?.relations) {
        throw new Error("Got relation before begin.");
      }

      // Store relation info in the buffer
      this.#transactionBuffer.relations.set(message.relationOid, {
        schema: message.schema,
        name: message.name,
        keyColumns: message.keyColumns,
        relationOid: message.relationOid,
        columns: message.columns.map((column) => ({
          flags: column.flags,
          name: column.name,
          typeOid: column.typeOid,
          typeMod: column.typeMod,
        })),
      });
    } else if (message.tag === "insert" || message.tag === "update" || message.tag === "delete") {
      if (!this.#transactionBuffer?.operations) {
        throw new Error("Got operation before relation.");
      }

      // Handle DML operations (insert, update, delete)
      const operation = this.#createOperation(message);
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
      log.debug("Acknowledging heartbeat", { lsn, timestamp });
      this.#logicalReplicationService.acknowledge(lsn);
    }
  }

  #onError(error: Error) {
    if (error.message.includes("Connection terminated unexpectedly")) {
      log.error("Database server closed the connection", {
        database: this.#config.database,
      });
    } else {
      log.error("Database connection error", {
        database: this.#config.database,
      });
      log.logErrorInstance(error);
    }

    this.stop();
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
            return false;
          }
          return operation.oldKeys[column] !== operation.new[column];
        });

        if (primaryKeyChanged) {
          log.debug("Primary key change detected, splitting update into insert/delete", {
            table: operation.table,
            oldKeys: operation.oldKeys,
            newKeys: operation.keyColumns.reduce(
              (acc, col) => ({ ...acc, [col]: operation.new[col] }),
              {},
            ),
          });

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
          result.push(operation);
        }
      } else {
        result.push(operation);
      }
    }

    return result;
  }
}
