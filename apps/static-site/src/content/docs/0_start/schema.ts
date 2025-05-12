// schemas.ts
import { z } from "zod";

import { createPostgresPublicSchemaTransformations } from "@rejot-dev/adapter-postgres";
import { createConsumerSchema } from "@rejot-dev/contract/consumer-schema";
import { createPublicSchema } from "@rejot-dev/contract/public-schema";

// Public schema definition for api_key table
const apiKeyPublicSchema = createPublicSchema("my-public-schema", {
  source: { dataStoreSlug: "my-db" },
  outputSchema: z.object({
    id: z.string(),
    api_key: z.string(),
  }),
  config: {
    publicSchemaType: "postgres",
    transformations: [
      ...createPostgresPublicSchemaTransformations(
        "insertOrUpdate",
        "api_key",
        `SELECT id, key AS "api_key" FROM api_key WHERE id = :id`,
      ),
    ],
  },
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
  config: {
    consumerSchemaType: "postgres",
    destinationDataStoreSlug: "my-db",
    sql: `INSERT INTO target_table (id, api_key) VALUES (:id, :api_key)
          ON CONFLICT (id) DO UPDATE SET api_key = :api_key`,
  },
});

export default {
  apiKeyPublicSchema,
  apiKeyConsumerSchema,
};
