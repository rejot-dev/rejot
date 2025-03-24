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

export interface PublicSchemaReference {
  name: string;
  version: {
    major: number;
  };
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

  /**
   * Get the last written transaction id
   */
  tail(publicSchemas: string[]): Promise<string | null>;

  /**
   * Read the event store from the given transaction id.
   *
   * @param fromTransactionId - The transaction id to start reading from.
   * @param limit - The maximum number of operations to read.
   * @returns The operations read from the event store.
   */
  read(
    schemas: PublicSchemaReference[],
    fromTransactionId: string | null,
    limit: number,
  ): Promise<TransformedOperation[]>;
}
