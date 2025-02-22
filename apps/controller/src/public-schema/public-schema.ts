import { z } from "zod";

export const SchemaDefinitionColumnSchema = z.object({
  columnName: z.string(),
  dataType: z.string(),
  isNullable: z.boolean(),
  default: z.string().nullable(),
});

export type SchemaDefinitionColumn = z.infer<typeof SchemaDefinitionColumnSchema>;

export const SchemaDefinitionSchema = z.array(SchemaDefinitionColumnSchema);

export type SchemaDefinition = z.infer<typeof SchemaDefinitionSchema>;
