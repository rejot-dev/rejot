import { z } from "zod";

import {
  createPostgresConsumerSchemaTransformation,
  createPostgresPublicSchemaTransformation,
} from "@rejot/adapter-postgres";
import { createPublicSchema } from "@rejot/contract/public-schema";
import { createConsumerSchema } from "@rejot/contract/consumer-schema";

const testPublicSchema = createPublicSchema("public-account", {
  source: { dataStoreSlug: "data-store-1", tables: ["account"] },
  outputSchema: z.object({
    id: z.number(),
    email: z.string(),
    name: z.string(),
  }),
  transformation: createPostgresPublicSchemaTransformation(
    "account",
    "SELECT id, email, username as name FROM account WHERE id = $1",
  ),
  version: {
    major: 1,
    minor: 0,
  },
});

const testConsumerSchema = createConsumerSchema({
  sourceManifestSlug: "default",
  publicSchema: {
    name: "public-account",
    majorVersion: 1,
  },
  destinationDataStoreSlug: "data-destination-1",
  transformations: [
    createPostgresConsumerSchemaTransformation(
      `
        INSERT INTO users_destination 
          (id, full_name)
        VALUES 
          ($1, $2 || ' ' || $3)
        ON CONFLICT (id) DO UPDATE
          SET full_name = $2 || ' ' || $3
        ;
      `,
    ),
  ],
});

export default {
  testPublicSchema,
  testConsumerSchema,
};
