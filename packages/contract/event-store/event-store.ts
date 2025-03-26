import type { z } from "zod";
import type { SyncManifestSchema } from "../manifest/manifest";

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

export interface SchemaCursor {
  schema: PublicSchemaReference;
  cursor: string | null;
}

export interface IEventStore {
  /**
   * Prepare the data store for reading/writing, e.g. opening a connection.
   */
  prepare(manifests: z.infer<typeof SyncManifestSchema>[]): Promise<void>;

  stop(): Promise<void>;

  write(transactionId: string, ops: TransformedOperation[]): Promise<boolean>;

  /**
   * Get the last written transaction id for each schema
   */
  tail(schemas: PublicSchemaReference[]): Promise<SchemaCursor[]>;

  /**
   * Read the event store from the given cursors.
   *
   * @param cursors - The cursors for each schema to read from
   * @param limit - The maximum number of operations to read per schema
   * @returns The operations read from the event store
   */
  read(cursors: SchemaCursor[], limit: number): Promise<TransformedOperation[]>;
}
