import { z } from "zod";

import { type Cursor } from "../cursor/cursors.ts";
import type { IEventStore, TransformedOperationWithSource } from "../event-store/event-store.ts";
import {
  ConnectionConfigSchema,
  type ConsumerSchemaConfigSchema,
  type ConsumerSchemaSchema,
  type DataStoreConfigSchema,
  type PublicSchemaConfigSchema,
  type PublicSchemaSchema,
} from "../manifest/manifest.ts";
import type {
  IConnection,
  IDataSink,
  IDataSource,
  TableOperation,
  TransformedOperation,
} from "../sync/sync.ts";

export interface PublicSchemaValidationResult<T> {
  isValid: boolean;
  publicSchemaName: string;
  errors: PublicSchemaValidationError<T>[];
}

export interface PublicSchemaValidationError<T = unknown> {
  message: string;
  info: T;
}

export interface ConsumerSchemaValidationResult<T = unknown> {
  isValid: boolean;
  errors: ConsumerSchemaValidationError<T>[];
  publicSchemaName: string;
  consumerSchemaInfo: {
    sourceManifestSlug: string;
    destinationDataStore: string;
  };
}

export interface ConsumerSchemaValidationError<T> {
  message: string;
  info?: T;
}

export interface CreateSourceOptions {
  publicationName?: string;
  slotName?: string;
}

export interface OperationTransformationPair<
  TSchemaConfig extends z.infer<typeof ConsumerSchemaConfigSchema>,
> {
  operation: TransformedOperationWithSource;
  config: TSchemaConfig;
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
    dataStoreConfig: TDataStoreConfig,
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
  TSchemaConfig extends z.infer<typeof PublicSchemaConfigSchema>,
> {
  transformationType: TSchemaConfig["publicSchemaType"];

  applyPublicSchemaTransformation(
    sourceDataStoreSlug: string,
    operations: TableOperation[],
    publicSchemas: (Extract<z.infer<typeof PublicSchemaSchema>, { config: TSchemaConfig }> & {
      sourceManifestSlug: string;
    })[],
  ): Promise<TransformedOperation[]>;
}

export type AnyIPublicSchemaTransformationAdapter = IPublicSchemaTransformationAdapter<
  z.infer<typeof PublicSchemaConfigSchema>
>;

export interface IConsumerSchemaTransformationAdapter<
  TSchemaConfig extends z.infer<typeof ConsumerSchemaConfigSchema>,
> {
  transformationType: TSchemaConfig["consumerSchemaType"];
  connectionType: string;

  getCursors(destinationDataStoreSlug: string): Promise<Cursor[]>;

  applyConsumerSchemaTransformation(
    destinationDataStoreSlug: string,
    transactionId: string,
    operations: TransformedOperation[],
    consumerSchemas: Extract<z.infer<typeof ConsumerSchemaSchema>, { config: TSchemaConfig }>[],
    // operationTransformationPairs: OperationTransformationPair<TSchemaConfig>[],
  ): Promise<TransformedOperationWithSource[]>;
}

export type AnyIConsumerSchemaTransformationAdapter = IConsumerSchemaTransformationAdapter<
  z.infer<typeof ConsumerSchemaConfigSchema>
>;

export interface IConsumerSchemaValidationAdapter<
  TSchemaConfig extends z.infer<typeof ConsumerSchemaConfigSchema>,
  TErrorInfo,
> {
  transformationType: TSchemaConfig["consumerSchemaType"];

  validateConsumerSchema(
    publicSchema: z.infer<typeof PublicSchemaSchema>,
    consumerSchema: z.infer<typeof ConsumerSchemaSchema>,
  ): Promise<ConsumerSchemaValidationResult<TErrorInfo>>;
}

export type AnyIConsumerSchemaValidationAdapter = IConsumerSchemaValidationAdapter<
  z.infer<typeof ConsumerSchemaConfigSchema>,
  unknown
>;

export interface IPublicSchemaValidationAdapter<
  TSchemaConfig extends z.infer<typeof PublicSchemaConfigSchema>,
  TErrorInfo,
> {
  transformationType: TSchemaConfig["publicSchemaType"];

  validatePublicSchema(
    publicSchema: z.infer<typeof PublicSchemaSchema>,
  ): Promise<PublicSchemaValidationResult<TErrorInfo>>;
}

export type AnyIPublicSchemaValidationAdapter = IPublicSchemaValidationAdapter<
  z.infer<typeof PublicSchemaConfigSchema>,
  unknown
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
