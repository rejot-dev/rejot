interface TransformedOperationBase {
  operation: "insert" | "update" | "delete";

  sourceDataStoreSlug: string;
  sourcePublicSchema: {
    name: string;
    version: {
      major: number;
      minor: number;
    };
  };
}

export interface TransformedOperationInsert extends TransformedOperationBase {
  operation: "insert";
  object: Record<string, unknown>;
}

export interface TransformedOperationUpdate extends TransformedOperationBase {
  operation: "update";
  object: Record<string, unknown>;
}

export interface TransformedOperationDelete extends TransformedOperationBase {
  operation: "delete";
}

export type TransformedOperation =
  | TransformedOperationInsert
  | TransformedOperationUpdate
  | TransformedOperationDelete;

export interface IEventStore {
  /**
   * Prepare the data store for reading/writing, e.g. opening a connection.
   */
  prepare(): Promise<void>;

  stop(): Promise<void>;

  write(transactionId: string, ops: TransformedOperation[]): Promise<boolean>;
}
