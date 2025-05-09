/* eslint-disable */
// Eslint wants to move the imports to the top of the file, which messes with the part/end comments */
import { z } from "zod";

import { createConsumerSchema } from "@rejot-dev/contract/consumer-schema";
import { createPublicSchema } from "@rejot-dev/contract/public-schema";

// part: publicSchemaTransformations
// part: publicSchemaTransformationsMultiTable
import { createPostgresPublicSchemaTransformations } from "@rejot-dev/adapter-postgres";
// end: publicSchemaTransformations
// end: publicSchemaTransformationsMultiTable

const myPublicSchema = createPublicSchema("my-public-schema", {
  source: { dataStoreSlug: "my-source-datastore" },
  outputSchema: z.object({
    id: z.string(),
    name: z.string(),
  }),
  config: {
    publicSchemaType: "postgres",
    // part: publicSchemaTransformations
    // ... in myPublicSchema
    transformations: createPostgresPublicSchemaTransformations(
      "insertOrUpdate",
      "my_table",
      `SELECT id, name FROM my_table WHERE id = $1`,
    ),
    // end: publicSchemaTransformations
  },
  version: {
    major: 1,
    minor: 0,
  },
});

const myMultiTablePublicSchema = createPublicSchema("my-multi-table-public-schema", {
  source: { dataStoreSlug: "my-source-datastore" },
  outputSchema: z.object({
    id: z.string(),
    name: z.string(),
  }),
  config: {
    publicSchemaType: "postgres",
    // part: publicSchemaTransformationsMultiTable
    // ... in myPublicSchema
    transformations: [
      ...createPostgresPublicSchemaTransformations(
        "insertOrUpdate",
        "accounts",
        `SELECT
            accounts.id,
            accounts.name,
            addresses.country
          FROM
            accounts
            JOIN addresses ON accounts.id = addresses.account_id
          WHERE
            accounts.id = $1`,
      ),
      ...createPostgresPublicSchemaTransformations(
        "insertOrUpdate",
        "addresses",
        `SELECT
            accounts.id,
            accounts.name,
            addresses.country
          FROM
            accounts
            JOIN addresses ON accounts.id = addresses.account_id
          WHERE
            addresses.id = $1`,
      ),
    ],
    // end: publicSchemaTransformationsMultiTable
  },
  version: {
    major: 1,
    minor: 0,
  },
});

const myConsumerSchema = createConsumerSchema("my-consumer-schema", {
  source: {
    manifestSlug: "my-manifest",
    publicSchema: {
      name: "my-public-schema",
      majorVersion: 1,
    },
  },
  config: {
    consumerSchemaType: "postgres",
    destinationDataStoreSlug: "my-destination-datastore",
    // part: consumerSchemaSql
    // ... in myConsumerSchema
    sql: "INSERT INTO destination_table (id, name) VALUES (:id, :name) ON CONFLICT (id) DO UPDATE SET name = :name",
    // end: consumerSchemaSql
  },
});

export default {
  myPublicSchema,
  myConsumerSchema,
  myMultiTablePublicSchema,
};
