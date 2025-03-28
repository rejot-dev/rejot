import { z } from "zod";

import type { IDataSink, IDataSource, TransformedOperation, TableOperation } from "../sync/sync.ts";
import {
  ConnectionConfigSchema,
  ConsumerSchemaTransformationSchema,
  PublicSchemaTransformationSchema,
} from "../manifest/manifest.ts";
import type { TransformedOperationWithSource, IEventStore } from "../event-store/event-store.ts";

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
  ): Promise<TransformedOperation>;
}

export type AnyIPublicSchemaTransformationAdapter = IPublicSchemaTransformationAdapter<
  z.infer<typeof PublicSchemaTransformationSchema>
>;

export interface IConsumerSchemaTransformationAdapter<
  TTransformation extends z.infer<typeof ConsumerSchemaTransformationSchema>,
> {
  transformationType: TTransformation["transformationType"];

  applyConsumerSchemaTransformation(
    destinationDataStoreSlug: string,
    operation: TransformedOperationWithSource,
    transformation: TTransformation,
  ): Promise<TransformedOperationWithSource>;
}

export type AnyIConsumerSchemaTransformationAdapter = IConsumerSchemaTransformationAdapter<
  z.infer<typeof ConsumerSchemaTransformationSchema>
>;
