// schemas.ts
import { z } from "zod";

import {
  createPostgresConsumerSchemaTransformation,
  createPostgresPublicSchemaTransformation,
} from "@rejot-dev/adapter-postgres";
import { createConsumerSchema } from "@rejot-dev/contract/consumer-schema";
import { createPublicSchema } from "@rejot-dev/contract/public-schema";

// Public schema definition for api_key table
const apiKeyPublicSchema = createPublicSchema("my-public-schema", {
  source: { dataStoreSlug: "my-db", tables: ["api_key"] },
  outputSchema: z.object({
    id: z.string(),
    api_key: z.string(),
  }),
  transformations: [
    createPostgresPublicSchemaTransformation(
      "api_key",
      `SELECT id, key AS "api_key" FROM api_key WHERE id = $1`,
    ),
  ],
  version: {
    major: 1,
    minor: 0,
  },
});

// Consumer schema that writes to target_table
const apiKeyConsumerSchema = createConsumerSchema("my-consumer-schema", {
  source: {
    manifestSlug: "my-sync-project",
    publicSchema: {
      name: "my-public-schema",
      majorVersion: 1,
    },
  },
  destinationDataStoreSlug: "my-db",
  transformations: [
    createPostgresConsumerSchemaTransformation(
      `INSERT INTO target_table (id, api_key) VALUES (:id, :api_key)
       ON CONFLICT (id) DO UPDATE SET api_key = :api_key`,
    ),
  ],
});

export default {
  apiKeyPublicSchema,
  apiKeyConsumerSchema,
};
