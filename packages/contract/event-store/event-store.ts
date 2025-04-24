import type { Cursor, PublicSchemaReference } from "../cursor/cursors.ts";
import type { OperationMessage } from "../message-bus/message-bus.ts";

interface TransformedOperationWithSourceBase {
  type: "insert" | "update" | "delete";

  sourceManifestSlug: string;
  sourcePublicSchema: {
    name: string;
    version: {
      major: number;
      minor: number;
    };
  };
}

export interface TransformedOperationWithSourceInsert extends TransformedOperationWithSourceBase {
  type: "insert";
  object: Record<string, unknown>;
}

export interface TransformedOperationWithSourceUpdate extends TransformedOperationWithSourceBase {
  type: "update";
  object: Record<string, unknown>;
}

export interface TransformedOperationWithSourceDelete extends TransformedOperationWithSourceBase {
  type: "delete";
  objectKeys: Record<string, unknown>;
}

export type TransformedOperationWithSource =
  | TransformedOperationWithSourceInsert
  | TransformedOperationWithSourceUpdate
  | TransformedOperationWithSourceDelete;

export interface IEventStore {
  /**
   * Prepare the data store for reading/writing, e.g. opening a connection.
   */
  prepare(): Promise<void>;

  stop(): Promise<void>;

  close(): Promise<void>;

  write(transactionId: string, ops: TransformedOperationWithSource[]): Promise<boolean>;

  /**
   * Get the last written transaction id for each schema
   */
  tail(schemas: PublicSchemaReference[]): Promise<Cursor[]>;

  /**
   * Read the event store from the given cursors.
   *
   * @param cursors - The cursors for each schema to read from
   * @param limit - The maximum number of operations to read per schema
   * @returns The operations read from the event store
   */
  read(cursors: Cursor[], limit?: number): Promise<OperationMessage[]>;
}

export { InMemoryEventStore } from "./in-memory-event-store";
