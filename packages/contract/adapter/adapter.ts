import { z } from "zod";

import type { IDataSource, PublicSchemaOperation, TableOperation } from "../sync/sync.ts";
import { ConnectionConfigSchema, PublicSchemaTransformationSchema } from "../manifest/manifest.ts";

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
