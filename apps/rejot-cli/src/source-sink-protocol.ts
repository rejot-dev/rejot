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

export type TransactionBuffer = {
  commitLsn: string | null;
  commitEndLsn: string;
  commitTime: bigint;
  xid: number;
  operations: Operation[];
  relations: Map<number, Relation>;
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
  subscribe(onData: (buffer: TransactionBuffer) => Promise<boolean>): Promise<void>;
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
   * @param data The data to write
   * @param operation The operation that generated the data
   */
  writeData(data: Record<string, unknown>, operation: Operation): Promise<void>;
}
