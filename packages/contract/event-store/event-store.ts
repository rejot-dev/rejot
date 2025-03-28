import type { z } from "zod";
import type { SyncManifestSchema } from "../manifest/manifest";

interface TransformedOperationWithSourceBase {
  type: "insert" | "update" | "delete";

  sourceDataStoreSlug: string;
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
}

export interface PublicSchemaReference {
  name: string;
  version: {
    major: number;
  };
}

export type TransformedOperationWithSource =
  | TransformedOperationWithSourceInsert
  | TransformedOperationWithSourceUpdate
  | TransformedOperationWithSourceDelete;

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

  write(transactionId: string, ops: TransformedOperationWithSource[]): Promise<boolean>;

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
  read(cursors: SchemaCursor[], limit: number): Promise<TransformedOperationWithSource[]>;
}
