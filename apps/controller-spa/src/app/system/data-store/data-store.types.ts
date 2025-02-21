import { z } from "zod";

export const dataStoreFormSchema = z.object({
  connectionSlug: z.string(),
  publicationName: z.string(),
  tables: z.array(z.string()).default([]),
});

export type DataStoreFormValues = z.infer<typeof dataStoreFormSchema>;
