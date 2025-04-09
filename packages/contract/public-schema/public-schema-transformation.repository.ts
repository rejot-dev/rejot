import type { TableOperation } from "@rejot-dev/contract/sync";
import { z } from "zod";
import { PublicSchemaSchema } from "../manifest/manifest.ts";

export interface IPublicSchemaTransformationRepository {
  getPublicSchemasForOperation(
    dataStoreSlug: string,
    operation: TableOperation,
  ): Promise<z.infer<typeof PublicSchemaSchema>[]>;
}
