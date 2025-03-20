type OperationType = "insert" | "update" | "delete";

// Table operations, i.e. data mutations to a table used to generate a public schema
export type TableOperation = {
  type: OperationType;
} & (
  | {
      type: "insert";
      keyColumns: string[];
      table: string;
      tableSchema: string;
      new: Record<string, unknown>;
    }
  | {
      type: "update";
      keyColumns: string[];
      table: string;
      tableSchema: string;
      new: Record<string, unknown>;
    }
  | {
      type: "delete";
      keyColumns: string[];
      table: string;
      tableSchema: string;
    }
);

// Public schema operations, i.e. data mutations after the public schema transformations have been applied
export type PublicSchemaOperation = {
  type: OperationType;
} & (
  | {
      type: "insert";
      keyColumns: string[];
      new: Record<string, unknown>;
    }
  | {
      type: "update";
      keyColumns: string[];
      new: Record<string, unknown>;
    }
  | {
      type: "delete";
      keyColumns: string[];
    }
);

export type Transaction = {
  id: string;
  operations: TableOperation[];
};

/**
 * Interface for a data source that can be used to read data
 */
export interface IDataSource {
  /**
   * Prepare the data source for subscription
   */
  prepare(): Promise<void>;

  /**
   * Stop listening for changes and close connections
   */
  stop(): Promise<void>;

  /**
   * Start listening for changes
   * @param onData Callback function to handle data changes
   */
  subscribe(onData: (transaction: Transaction) => Promise<boolean>): Promise<void>;

  /**
   * Write a watermark to the data source
   * @param watermark The watermark to write
   */
  writeWatermark(watermark: "low" | "high", backfillId: string): Promise<void>;

  /**
   * Execute query to get backfill records
   * @param sql The SQL query to use for the backfill
   * @param values The values to bind to the query
   */
  getBackfillRecords(sql: string, values?: unknown[]): Promise<Record<string, unknown>[]>;

  /**
   * Apply a transformations to the data
   * @param operation The operation to transform
   * @returns The transformed data
   */
  applyTransformations(operation: TableOperation): Promise<PublicSchemaOperation | null>;
}

/**
 * Interface for a data sink that can be used to write data
 */
export interface IDataSink {
  /**
   * Prepare the data sink for writing data
   */
  prepare(): Promise<void>;

  /**
   * Stop writing data and close connections
   */
  stop(): Promise<void>;

  /**
   * Write data to the sink
   * @param operation The operation that generated the data
   */
  writeData(operation: PublicSchemaOperation): Promise<void>;
}
