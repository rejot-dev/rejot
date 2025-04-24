import type { z } from "zod";

import type { ConnectionConfigSchema } from "../manifest/manifest.ts";

type OperationType = "insert" | "update" | "delete";

/**
 * Table operations, i.e. data mutations to a table used to generate a public schema.
 *
 * @TODO tableSchema is postgres specific and should be removed.
 */
export interface TableOperationBase {
  type: OperationType;
  keyColumns: string[];
  table: string;
  tableSchema: string;
}

export interface TableOperationInsert extends TableOperationBase {
  type: "insert";
  new: Record<string, unknown>;
}

export interface TableOperationUpdate extends TableOperationBase {
  type: "update";
  new: Record<string, unknown>;
}

export interface TableOperationDelete extends TableOperationBase {
  type: "delete";
  oldKeys: Record<string, unknown>;
}

export type TableOperation = TableOperationInsert | TableOperationUpdate | TableOperationDelete;

/** Public schema operations, i.e. data mutations after the public schema transformations have been applied */
export interface TransformedOperationBase {
  type: OperationType;
  keyColumns: string[];
}

export interface TransformedOperationInsert extends TransformedOperationBase {
  type: "insert";
  object: Record<string, unknown>;
}

export interface TransformedOperationUpdate extends TransformedOperationBase {
  type: "update";
  object: Record<string, unknown>;
}

export interface TransformedOperationDelete extends TransformedOperationBase {
  type: "delete";
  objectKeys: Record<string, unknown>;
}

export type TransformedOperation =
  | TransformedOperationInsert
  | TransformedOperationUpdate
  | TransformedOperationDelete;

export type Transaction = {
  /** Unique identifier of the transaction, should indicate position in the log and be monotonically increasing.
   *
   * @example the Postgres WAL's LSN
   */
  id: string;
  operations: TableOperation[];
  ack: (didConsume: boolean) => void;
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
   * Stop listening for changes.
   */
  stop(): Promise<void>;

  /**
   * Close the data source
   */
  close(): Promise<void>;

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
  applyTransformations(operation: TableOperation): Promise<TransformedOperation | null>;

  /**
   * Start iterating over transactions
   * @param abortSignal Signal to abort the iteration
   * @returns An async iterator for consuming transactions
   */
  startIteration(abortSignal: AbortSignal): AsyncIterator<Transaction>;
}

/**
 * Interface for a data sink that can be used to write data
 */
export interface IDataSink {
  connectionType: string;

  /**
   * Prepare the data sink for writing data
   */
  prepare(): Promise<void>;

  /**
   * Stop writing data and close connections
   */
  close(): Promise<void>;

  /**
   * Write data to the sink
   * @param operation The operation that generated the data
   */
  writeData(operation: TransformedOperation): Promise<void>;
}

// TODO(Wilco): Source/Sink should probably extend this.
export interface IConnection<TConnectionConfig extends z.infer<typeof ConnectionConfigSchema>> {
  slug: string;
  config: TConnectionConfig;

  prepare(): Promise<void>;
  close(): Promise<void>;
}
