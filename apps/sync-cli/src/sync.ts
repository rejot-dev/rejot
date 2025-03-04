import { Client } from "pg";
import { LogicalReplicationService } from "pg-logical-replication";
import { RejotPgOutputPlugin } from "./rejot-pgoutput-plugin"; // TODO: consolidate with controller
import type {
  Message,
  MessageInsert,
  MessageUpdate,
  MessageDelete,
} from "pg-logical-replication/dist/output-plugins/pgoutput/pgoutput.types";

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
      tableSchema: string;
      keyColumns: string[];
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

export class SyncService {
  #sourceClient: Client;
  #destClient: Client;
  #publicSchemaSQL: string;
  #consumerSchemaSQL: string;
  #logicalReplicationService: LogicalReplicationService | null = null;
  #publicationName: string;
  #createPublication: boolean;
  #slotName: string;

  #transactionBuffer: Partial<TransactionBuffer> & { state: TransactionBufferState };

  constructor(
    sourceConn: string,
    destConn: string,
    publicSchemaSQL: string,
    consumerSchemaSQL: string,
    publicationName: string,
    createPublication: boolean,
    slotName: string,
  ) {
    this.#sourceClient = new Client(sourceConn);
    this.#destClient = new Client(destConn);
    this.#publicSchemaSQL = publicSchemaSQL;
    this.#consumerSchemaSQL = consumerSchemaSQL;
    this.#publicationName = publicationName;
    this.#createPublication = createPublication;
    this.#slotName = slotName;

    // Initialize empty transaction buffer
    this.#transactionBuffer = {
      state: "empty",
    };
  }

  async start(): Promise<void> {
    console.log("Initializing sync process...");

    try {
      // Connect to both databases
      await this.#sourceClient.connect();
      console.log("Connected to source database");

      await this.#destClient.connect();
      console.log("Connected to destination database");

      // Check if logical replication is enabled on source
      const hasLogicalReplication = await this.#checkLogicalReplication();
      if (!hasLogicalReplication) {
        throw new Error(
          "Logical replication is not enabled on the source database. Please set wal_level=logical",
        );
      }

      // Create replication slot if it doesn't exist
      await this.#ensureReplicationSlot();

      // Create publication if it doesn't exist
      await this.#ensurePublication();

      // Start listening for changes
      await this.#startReplication();

      console.log("Sync process started successfully");
    } catch (error) {
      console.error("Failed to start sync process:", error);
      await this.stop();
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this.#logicalReplicationService) {
      try {
        await this.#logicalReplicationService.stop();
      } catch (error) {
        console.error("Error stopping replication service:", error);
      }
    }

    try {
      if (this.#sourceClient) {
        await this.#sourceClient.end();
      }
    } catch (error) {
      console.error("Error disconnecting from source database:", error);
    }

    try {
      if (this.#destClient) {
        await this.#destClient.end();
      }
    } catch (error) {
      console.error("Error disconnecting from destination database:", error);
    }

    console.log("Sync process stopped");
  }

  async #checkLogicalReplication(): Promise<boolean> {
    const result = await this.#sourceClient.query(`
      SELECT name, setting FROM pg_settings WHERE name = 'wal_level'
    `);

    return result.rows.length > 0 && result.rows[0].setting === "logical";
  }

  async #ensureReplicationSlot(): Promise<void> {
    // Check if slot exists
    const slotResult = await this.#sourceClient.query(
      `
      SELECT slot_name FROM pg_replication_slots WHERE slot_name = $1
    `,
      [this.#slotName],
    );

    if (slotResult.rows.length === 0) {
      console.debug(`Creating replication slot '${this.#slotName}'...`);
      try {
        await this.#sourceClient.query(
          `
          SELECT pg_create_logical_replication_slot($1, 'pgoutput')
        `,
          [this.#slotName],
        );
        console.debug(`Replication slot '${this.#slotName}' created successfully`);
      } catch (error) {
        throw new Error(`Failed to create replication slot: ${error}`);
      }
    } else {
      console.debug(`Replication slot '${this.#slotName}' already exists`);
    }
  }

  async #ensurePublication(): Promise<void> {
    // Check if publication exists
    const pubResult = await this.#sourceClient.query(
      `
      SELECT pubname FROM pg_publication WHERE pubname = $1
    `,
      [this.#publicationName],
    );

    if (pubResult.rows.length === 0) {
      if (!this.#createPublication) {
        throw new Error(
          `Publication '${this.#publicationName}' does not exist and create-publication is set to false`,
        );
      }

      console.debug(`Creating publication '${this.#publicationName}'...`);
      try {
        await this.#sourceClient.query(`
          CREATE PUBLICATION ${this.#publicationName} FOR ALL TABLES
        `);
        console.debug(`Publication '${this.#publicationName}' created successfully`);
      } catch (error) {
        throw new Error(`Failed to create publication: ${error}`);
      }
    } else {
      console.debug(`Publication '${this.#publicationName}' already exists`);
    }
  }

  async #startReplication(): Promise<void> {
    // Create replication service
    this.#logicalReplicationService = new LogicalReplicationService(
      {
        host: this.#sourceClient.host,
        port: this.#sourceClient.port,
        user: this.#sourceClient.user,
        password: this.#sourceClient.password,
        database: this.#sourceClient.database,
        ssl: this.#sourceClient.ssl,
      },
      {
        acknowledge: {
          auto: false,
          timeoutSeconds: 0,
        },
      },
    );

    // Set up event handlers
    this.#logicalReplicationService.on("data", this.#onData.bind(this));
    this.#logicalReplicationService.on("error", this.#onError.bind(this));
    this.#logicalReplicationService.on("heartbeat", this.#onHeartbeat.bind(this));

    const plugin = new RejotPgOutputPlugin({
      protoVersion: 2,
      publicationNames: [this.#publicationName],
    });

    // Start listening
    try {
      await this.#logicalReplicationService.subscribe(plugin, this.#slotName);
      console.log(`Started listening for changes on slot '${this.#slotName}'`);
    } catch (error) {
      throw new Error(`Failed to start replication: ${error}`);
    }
  }

  async #onData(lsn: string, log: Message): Promise<void> {
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
        const processed = await this.#processTransactionBuffer(
          this.#transactionBuffer as TransactionBuffer,
        );

        if (processed) {
          console.log(
            "Transaction buffer processed, acknowledging.",
            this.#transactionBuffer.commitLsn,
            this.#transactionBuffer.commitEndLsn,
          );

          await this.#logicalReplicationService?.acknowledge(this.#transactionBuffer.commitEndLsn);

          this.#transactionBuffer = {
            state: "empty",
          };
        } else {
          console.log("Transaction buffer not processed, stopping listener.");
          await this.#logicalReplicationService?.stop();
        }
      } catch (error) {
        console.error("ERROR during processing of transaction buffer.", error);
        console.log("Stopping listener");
        await this.#logicalReplicationService?.stop();
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

  async #processTransactionBuffer(buffer: TransactionBuffer): Promise<boolean> {
    console.log(`Processing transaction ${buffer.xid} with ${buffer.operations.length} operations`);

    try {
      // Process each operation in the transaction
      for (const operation of buffer.operations) {
        if (operation.type === "delete") {
          // Skip delete operations for now
          continue;
        }

        // Apply public schema transformation
        const transformedData = await this.#applyPublicSchemaTransformation(operation);
        if (!transformedData) continue;

        // Apply consumer schema transformation and write to destination
        await this.#applyConsumerSchemaTransformation(transformedData);
      }

      return true;
    } catch (error) {
      console.error("Error processing transaction buffer:", error);
      return false;
    }
  }

  async #applyPublicSchemaTransformation(
    operation: Operation,
  ): Promise<Record<string, unknown> | null> {
    if (operation.type === "delete") {
      // Skip delete operations for now
      return null;
    }

    try {
      // Get key values for the operation
      const keyValues = operation.keyColumns.map((column) => operation.new[column]);

      // Execute the public schema transformation
      const result = await this.#sourceClient.query(this.#publicSchemaSQL, keyValues);

      if (result.rows.length !== 1) {
        console.warn(`Expected 1 row from public schema transformation, got ${result.rows.length}`);
        return null;
      }

      // Combine key columns with transformed data
      const transformedData: Record<string, unknown> = {};

      for (const column of operation.keyColumns) {
        transformedData[column] = operation.new[column];
      }

      return {
        ...transformedData,
        ...result.rows[0],
      };
    } catch (error) {
      console.error("Error applying public schema transformation:", error);
      return null;
    }
  }

  async #applyConsumerSchemaTransformation(data: Record<string, unknown>): Promise<void> {
    try {
      // Execute the consumer schema transformation
      await this.#destClient.query(this.#consumerSchemaSQL, Object.values(data));
      console.log("Successfully applied consumer schema transformation");
    } catch (error) {
      console.error("Error applying consumer schema transformation:", error);
    }
  }

  #onHeartbeat(lsn: string, timestamp: number, shouldRespond: boolean): void {
    if (this.#transactionBuffer.state === "empty" && shouldRespond) {
      console.log("Acknowledging heartbeat", lsn, timestamp);
      this.#logicalReplicationService?.acknowledge(lsn);
    }
  }

  #onError(error: Error): void {
    console.error("Replication error:", error);
  }
}

// Helper function to assert unreachable code paths
export function assertUnreachable(x: never): never {
  throw new Error(`Didn't expect to get here with value: ${x}`);
}
