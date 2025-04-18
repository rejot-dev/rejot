import { z } from "zod";

import {
  createPostgresConsumerSchemaTransformation,
  createPostgresPublicSchemaTransformation,
} from "@rejot-dev/adapter-postgres";
import { createPublicSchema } from "@rejot-dev/contract/public-schema";
import { createConsumerSchema } from "@rejot-dev/contract/consumer-schema";

const testPublicSchema = createPublicSchema("public-account", {
  source: { dataStoreSlug: "data-store-1", tables: ["account"] },
  outputSchema: z.object({
    id: z.number(),
    email: z.string(),
    name: z.string(),
  }),
  transformations: [
    createPostgresPublicSchemaTransformation(
      "account",
      "SELECT id, email, username as name FROM account WHERE id = $1",
    ),
    createPostgresPublicSchemaTransformation(
      "account_details",
      "SELECT id, details FROM account_details WHERE account_id = $1",
    ),
  ],
  version: {
    major: 1,
    minor: 0,
  },
});

const testConsumerSchema = createConsumerSchema({
  source: {
    manifestSlug: "default",
    publicSchema: {
      name: "public-account",
      majorVersion: 1,
    },
  },
  destinationDataStoreSlug: "data-destination-1",
  transformations: [
    createPostgresConsumerSchemaTransformation(
      `
        INSERT INTO users_destination 
          (id, full_name)
        VALUES 
          (:id, :email || ' ' || :name)
        ON CONFLICT (id) DO UPDATE
          SET full_name = :email || ' ' || :name
        ;
      `,
    ),
    createPostgresConsumerSchemaTransformation(
      "DELETE FROM users_destination WHERE id = :id",
      "delete",
    ),
  ],
});

export default {
  testPublicSchema,
  testConsumerSchema,
};
