import { z } from "zod";

import { createPostgresTransformation } from "@rejot/adapter-postgres";
import { createPublicSchema } from "@rejot/contract/public-schema";
import { createConsumerSchema } from "@rejot/contract/consumer-schema";

const ACCOUNTS_PUBLIC_SCHEMA_NAME = "accounts";

const accountsPublicSchema = createPublicSchema(ACCOUNTS_PUBLIC_SCHEMA_NAME, {
  source: { dataStoreSlug: "db-accounts", tables: ["accounts"] }, // "addresses"
  outputSchema: z.object({
    id: z.number(),
    email: z.string(),
    name: z.string(),
    // country: z.string().optional(),
    created_at: z.date(),
  }),
  transformation: createPostgresTransformation(
    "account",
    // TODO: multi table public schemas
    // "SELECT accounts.id, email, name, accounts.created_at, country FROM accounts LEFT JOIN addresses ON accounts.id = addresses.account_id WHERE accounts.id = $1",
    "SELECT accounts.id, email, name, accounts.created_atFROM accounts  WHERE id = $1",
  ),
  version: {
    major: 1,
    minor: 0,
  },
});

const accountsConsumerSchema = createConsumerSchema({
  sourceManifestSlug: "sync-a",
  publicSchema: {
    name: ACCOUNTS_PUBLIC_SCHEMA_NAME,
    majorVersion: 1,
  },
  destinationDataStoreSlug: "db-orders",
  transformations: [
    createPostgresTransformation(
      "destination_accounts",
      "INSERT INTO destination_accounts (id, email) VALUES ($1, $2)",
    ),
  ],
});

export default {
  accountsPublicSchema,
  accountsConsumerSchema,
};
