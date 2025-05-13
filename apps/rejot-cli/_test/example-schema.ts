import { z } from "zod";

import {
  createPostgresConsumerSchemaConfig,
  createPostgresPublicSchemaTransformations,
  PostgresPublicSchemaConfigBuilder,
} from "@rejot-dev/adapter-postgres";
import { createConsumerSchema } from "@rejot-dev/contract/consumer-schema";
import { createPublicSchema } from "@rejot-dev/contract/public-schema";

const testPublicSchema = createPublicSchema("public-account", {
  source: { dataStoreSlug: "default-postgres" },
  outputSchema: z.object({
    id: z.number(),
    email: z.string(),
    name: z.string(),
  }),
  config: new PostgresPublicSchemaConfigBuilder()
    .addTransformation(
      createPostgresPublicSchemaTransformations(
        "insertOrUpdate",
        "account",
        "SELECT id, email, username as name FROM account WHERE id = :id",
      ),
    )
    .build(),
  version: {
    major: 1,
    minor: 0,
  },
});

const testConsumerSchema = createConsumerSchema("consume-public-account", {
  source: {
    manifestSlug: "rejot",
    publicSchema: {
      name: "public-account",
      majorVersion: 1,
    },
  },
  config: createPostgresConsumerSchemaConfig(
    "default-postgres",
    `
      INSERT INTO users_destination 
        (id, full_name)
      VALUES 
        (:id, :email || ' ' || :name)
      ON CONFLICT (id) DO UPDATE
        SET full_name = :email || ' ' || :name
      ;
    `,
    {
      deleteSql: "DELETE FROM users_destination WHERE id = :id",
    },
  ),
});

export default {
  testPublicSchema,
  testConsumerSchema,
};
