import { z } from "zod";

export const SchemaDefinition = z.array(
  z.object({
    columnName: z.string(),
    dataType: z.string(),
    isNullable: z.boolean(),
    columnDefault: z.string().nullable(),
    tableSchema: z.string(),
  }),
);

export type SchemaDefinition = z.infer<typeof SchemaDefinition>;
