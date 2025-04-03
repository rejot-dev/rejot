import { createPostgresConsumerSchemaTransformation } from "@rejot/adapter-postgres";
import { createConsumerSchema } from "@rejot/contract/consumer-schema";

const accountsConsumerSchema = createConsumerSchema({
  sourceManifestSlug: "sync-a",
  publicSchema: {
    name: "accounts",
    majorVersion: 2,
  },
  destinationDataStoreSlug: "db-orders",
  transformations: [
    createPostgresConsumerSchemaTransformation(
      "INSERT INTO destination_accounts (id, email) VALUES ($1, $2)",
    ),
  ],
});

export default {
  accountsConsumerSchema,
};
