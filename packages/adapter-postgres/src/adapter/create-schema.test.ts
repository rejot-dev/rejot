import { describe, expect, test } from "bun:test";

import { z } from "zod";

import { PublicSchemaSchema } from "@rejot-dev/contract/manifest";
import { createPublicSchema } from "@rejot-dev/contract/public-schema";

import {
  createPostgresPublicSchemaTransformations,
  PostgresPublicSchemaConfigBuilder,
} from "./index.ts";

describe("PostgresPublicSchemaConfigBuilder", () => {
  test("createPostgresPublicSchemaTransformations", () => {
    const onePersonSchema = createPublicSchema("one-person", {
      source: { dataStoreSlug: "main-connection" },
      outputSchema: z.object({
        id: z.number(),
        firstName: z.string(),
        lastName: z.string(),
        emails: z.array(z.string()),
      }),
      config: new PostgresPublicSchemaConfigBuilder()
        .addTransformation([
          ...createPostgresPublicSchemaTransformations("insertOrUpdate", "person", `SELECT`),
          ...createPostgresPublicSchemaTransformations("insertOrUpdate", "person_email", `SELECT`),
        ])
        .build(),
      version: {
        major: 1,
        minor: 0,
      },
    });

    const result = PublicSchemaSchema.safeParse(onePersonSchema);
    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });
});
