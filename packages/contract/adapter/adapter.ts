import { z } from "zod";

import type { IDataSink, IDataSource, TransformedOperation, TableOperation } from "../sync/sync.ts";
import { type Cursor } from "../cursor/cursors";
import {
  ConnectionConfigSchema,
  ConsumerSchemaTransformationSchema,
  PublicSchemaTransformationSchema,
  type ConsumerSchemaSchema,
  type PublicSchemaSchema,
} from "../manifest/manifest.ts";
import type { IEventStore, TransformedOperationWithSource } from "../event-store/event-store.ts";

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

export interface IConnectionAdapter<
  TConnectionConfig extends z.infer<typeof ConnectionConfigSchema>,
  TSource extends IDataSource,
  TSink extends IDataSink,
  TEventStore extends IEventStore,
> {
  connectionType: TConnectionConfig["connectionType"];

  createSource(
    connectionSlug: string,
    connectionConfig: TConnectionConfig,
    options?: CreateSourceOptions,
  ): TSource;
  createSink(connectionSlug: string, connectionConfig: TConnectionConfig): TSink;
  createEventStore(connectionSlug: string, connectionConfig: TConnectionConfig): TEventStore;
}

export type AnyIConnectionAdapter = IConnectionAdapter<
  z.infer<typeof ConnectionConfigSchema>,
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
    operation: TransformedOperationWithSource,
    transformation: TTransformation,
  ): Promise<TransformedOperationWithSource>;
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
