import { Client } from "pg";
import {
  PostgresReplicationListener,
  type Operation,
  type TransactionBuffer,
} from "@rejot/sync/postgres";
import { DEFAULT_SLOT_NAME } from "../const.ts";
import { clientToConfig } from "../connections.ts";

type PostgresSyncServiceConfig = {
  sourceConn: string;
  destConn: string;
  publicSchemaSQL: string;
  consumerSchemaSQL: string;
  publicationName: string;
  createPublication: boolean;
};
export class PostgresSyncService {
  #sourceClient: Client;
  #destClient: Client;
  #publicSchemaSQL: string;
  #consumerSchemaSQL: string;
  #publicationName: string;
  #createPublication: boolean;
  #replicationListener: PostgresReplicationListener;

  constructor({
    sourceConn,
    destConn,
    publicSchemaSQL,
    consumerSchemaSQL,
    publicationName,
    createPublication,
  }: PostgresSyncServiceConfig) {
    this.#sourceClient = new Client(sourceConn);
    this.#destClient = new Client(destConn);
    this.#publicSchemaSQL = publicSchemaSQL;
    this.#consumerSchemaSQL = consumerSchemaSQL;
    this.#publicationName = publicationName;
    this.#createPublication = createPublication;
    this.#replicationListener = new PostgresReplicationListener(
      clientToConfig(this.#sourceClient),
      async (buffer) => this.#processTransactionBuffer(buffer),
    );
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
    if (this.#replicationListener) {
      try {
        await this.#replicationListener.stop();
      } catch (error) {
        console.error("Error stopping replication listener:", error);
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
      [DEFAULT_SLOT_NAME],
    );

    if (slotResult.rows.length === 0) {
      console.debug(`Creating replication slot '${DEFAULT_SLOT_NAME}'...`);
      try {
        await this.#sourceClient.query(
          `
          SELECT pg_create_logical_replication_slot($1, 'pgoutput')
        `,
          [DEFAULT_SLOT_NAME],
        );
        console.debug(`Replication slot '${DEFAULT_SLOT_NAME}' created successfully`);
      } catch (error) {
        throw new Error(`Failed to create replication slot: ${error}`);
      }
    } else {
      console.debug(`Replication slot '${DEFAULT_SLOT_NAME}' already exists`);
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
    // Start listening
    try {
      await this.#replicationListener.start(this.#publicationName);
      console.log(`Started listening for changes on slot '${DEFAULT_SLOT_NAME}'`);
    } catch (error) {
      throw new Error(`Failed to start replication: ${error}`);
    }
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
}
