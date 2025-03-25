import { z } from "zod";

import type { IDataSource, PublicSchemaOperation, TableOperation } from "../sync/sync.ts";
import {
  ConnectionConfigSchema,
  ConsumerSchemaTransformationSchema,
  PublicSchemaTransformationSchema,
} from "../manifest/manifest.ts";
import type { TransformedOperation } from "../event-store/event-store.ts";

import type { IEventStore } from "../event-store/event-store.ts";
export interface CreateSourceOptions {
  publicationName?: string;
  slotName?: string;
}

export interface IConnectionAdapter<
  TConnection extends z.infer<typeof ConnectionConfigSchema>,
  TSource extends IDataSource,
> {
  connectionType: TConnection["connectionType"];
  createSource(connection: TConnection, options?: CreateSourceOptions): TSource;
  createEventStore(connection: TConnection): IEventStore;
}

export type AnyIConnectionAdapter = IConnectionAdapter<
  z.infer<typeof ConnectionConfigSchema>,
  // z.infer<typeof PublicSchemaTransformationSchema>,
  IDataSource
>;

export interface IPublicSchemaTransformationAdapter<
  TTransformation extends z.infer<typeof PublicSchemaTransformationSchema>,
> {
  transformationType: TTransformation["transformationType"];

  applyPublicSchemaTransformation(
    operation: TableOperation,
    transformation: TTransformation,
  ): Promise<PublicSchemaOperation>;
}

export type AnyIPublicSchemaTransformationAdapter = IPublicSchemaTransformationAdapter<
  z.infer<typeof PublicSchemaTransformationSchema>
>;

export interface IConsumerSchemaTransformationAdapter<
  TTransformation extends z.infer<typeof ConsumerSchemaTransformationSchema>,
> {
  transformationType: TTransformation["transformationType"];

  applyConsumerSchemaTransformation(
    operation: TransformedOperation,
    transformation: TTransformation,
  ): Promise<TransformedOperation>;
}

export type AnyIConsumerSchemaTransformationAdapter = IConsumerSchemaTransformationAdapter<
  z.infer<typeof ConsumerSchemaTransformationSchema>
>;
