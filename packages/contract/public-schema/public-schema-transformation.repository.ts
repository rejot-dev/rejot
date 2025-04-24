import { z } from "zod";

import { PublicSchemaSchema } from "../manifest/manifest.ts";
import type { TableOperation } from "../sync/sync.ts";

export interface IPublicSchemaTransformationRepository {
  getPublicSchemasForOperation(
    dataStoreSlug: string,
    operation: TableOperation,
  ): Promise<z.infer<typeof PublicSchemaSchema>[]>;
}
