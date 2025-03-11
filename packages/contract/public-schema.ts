import type { z } from "zod";

export type Transformation = {
  type: "postgresql";
  table: string;
  sql: string;
};

export type CreatePublicationOptions<T extends z.ZodSchema> = {
  source: {
    dataStoreSlug: string;
    tables: string[];
  };

  outputSchema: T;

  transformations: Transformation[];

  version: string;
};

export function createPublication<T extends z.ZodSchema>(
  publicationName: string,
  options: CreatePublicationOptions<T>,
): CreatePublicationOptions<T> & { name: string } {
  return {
    name: publicationName,
    ...options,
  };
}
