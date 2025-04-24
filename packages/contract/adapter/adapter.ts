import { z } from "zod";

import { type Cursor } from "../cursor/cursors.ts";
import type { IEventStore, TransformedOperationWithSource } from "../event-store/event-store.ts";
import {
  ConnectionConfigSchema,
  type ConsumerSchemaSchema,
  ConsumerSchemaTransformationSchema,
  type DataStoreConfigSchema,
  type PublicSchemaSchema,
  PublicSchemaTransformationSchema,
} from "../manifest/manifest.ts";
import type {
  IConnection,
  IDataSink,
  IDataSource,
  TableOperation,
  TransformedOperation,
} from "../sync/sync.ts";

// Define ValidationResult interface at the contract level
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  publicSchemaName: string;
  consumerSchemaInfo: {
    sourceManifestSlug: string;
    destinationDataStore: string;
  };
}

export interface ValidationError {
  message: string;
  transformationIndex?: number;
  sql?: string;
  placeholders?: string[];
}

export interface CreateSourceOptions {
  publicationName?: string;
  slotName?: string;
}

export interface OperationTransformationPair<
  TTransformation extends z.infer<typeof ConsumerSchemaTransformationSchema>,
> {
  operation: TransformedOperationWithSource;
  transformations: TTransformation[];
}

export interface IConnectionAdapter<
  TConnectionConfig extends z.infer<typeof ConnectionConfigSchema>,
  TDataStoreConfig extends z.infer<typeof DataStoreConfigSchema>,
  TSource extends IDataSource,
  TSink extends IDataSink,
  TEventStore extends IEventStore,
> {
  connectionType: TConnectionConfig["connectionType"];

  createSource(
    connectionSlug: string,
    connectionConfig: TConnectionConfig,
    options: TDataStoreConfig,
  ): TSource;
  createSink(connectionSlug: string, connectionConfig: TConnectionConfig): TSink;
  createEventStore(connectionSlug: string, connectionConfig: TConnectionConfig): TEventStore;

  getOrCreateConnection(
    connectionSlug: string,
    connectionConfig: TConnectionConfig,
  ): IConnection<TConnectionConfig>;
}

export type AnyIConnectionAdapter = IConnectionAdapter<
  z.infer<typeof ConnectionConfigSchema>,
  z.infer<typeof DataStoreConfigSchema>,
  IDataSource,
  IDataSink,
  IEventStore
>;

export interface IPublicSchemaTransformationAdapter<
  TTransformation extends z.infer<typeof PublicSchemaTransformationSchema>,
> {
  transformationType: TTransformation["transformationType"];

  applyPublicSchemaTransformation(
    sourceDataStoreSlug: string,
    operation: TableOperation,
    transformation: TTransformation,
  ): Promise<TransformedOperation | null>;
}

export type AnyIPublicSchemaTransformationAdapter = IPublicSchemaTransformationAdapter<
  z.infer<typeof PublicSchemaTransformationSchema>
>;

export interface IConsumerSchemaTransformationAdapter<
  TTransformation extends z.infer<typeof ConsumerSchemaTransformationSchema>,
> {
  transformationType: TTransformation["transformationType"];
  connectionType: string;

  getCursors(destinationDataStoreSlug: string): Promise<Cursor[]>;

  applyConsumerSchemaTransformation(
    destinationDataStoreSlug: string,
    transactionId: string,
    operationTransformationPairs: OperationTransformationPair<TTransformation>[],
  ): Promise<TransformedOperationWithSource[]>;
}

export type AnyIConsumerSchemaTransformationAdapter = IConsumerSchemaTransformationAdapter<
  z.infer<typeof ConsumerSchemaTransformationSchema>
>;

export interface IConsumerSchemaValidationAdapter<
  TTransformation extends z.infer<typeof ConsumerSchemaTransformationSchema>,
> {
  transformationType: TTransformation["transformationType"];

  validateConsumerSchema(
    publicSchema: z.infer<typeof PublicSchemaSchema>,
    consumerSchema: z.infer<typeof ConsumerSchemaSchema>,
  ): Promise<ValidationResult>;
}

export type AnyIConsumerSchemaValidationAdapter = IConsumerSchemaValidationAdapter<
  z.infer<typeof ConsumerSchemaTransformationSchema>
>;

export interface Column {
  columnName: string;
  dataType: string;
  isNullable: boolean;
  columnDefault: string | null;
  foreignKey?: {
    constraintName: string;
    referencedTable: string;
    referencedColumnName: string;
  };
}

export interface Table {
  schema: string;
  name: string;
  columns: Column[];
  keyColumns: string[];
}

export interface IIntrospectionAdapter<
  TConnectionConfig extends z.infer<typeof ConnectionConfigSchema>,
> {
  connectionType: TConnectionConfig["connectionType"];

  checkHealth(
    connectionSlug: string,
  ): Promise<{ status: "healthy" | "unhealthy"; message?: string }>;
  getTables(connectionSlug: string): Promise<{ schema: string; name: string }[]>;
  getTableSchema(connectionSlug: string, tableName: string): Promise<Table>;
  getAllTableSchemas(connectionSlug: string): Promise<Map<string, Table>>;
  executeQueries(connectionSlug: string, queries: string[]): Promise<Record<string, unknown>[][]>;
}

export type AnyIIntrospectionAdapter = IIntrospectionAdapter<
  z.infer<typeof ConnectionConfigSchema>
>;
