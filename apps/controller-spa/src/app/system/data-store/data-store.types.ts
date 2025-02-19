import { z } from "zod";

export const dataStoreFormSchema = z.object({
  connectionSlug: z.string(),
  publicationName: z.string(),
  tables: z.array(z.string()).default([]),
});

export type DataStoreFormValues = z.infer<typeof dataStoreFormSchema>;

export type PostgresConnectionConfig = {
  type: "postgres";
  host: string;
  port: number;
  user: string;
  database: string;
};

export type ConnectionConfig = PostgresConnectionConfig;

export type Connection = {
  slug: string;
  config: ConnectionConfig;
};
