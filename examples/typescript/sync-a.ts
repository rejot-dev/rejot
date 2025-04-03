import { z } from "zod";

import { createPostgresPublicSchemaTransformation } from "@rejot/adapter-postgres";
import { createPublicSchema } from "@rejot/contract/public-schema";

const accountsPublicSchemaV1 = createPublicSchema("accounts", {
  source: { dataStoreSlug: "db-accounts", tables: ["accounts"] }, // "addresses"
  outputSchema: z.object({
    id: z.string(), // account.id is BIGSERIAL in postgres, which can only be represented in JSON as string
    email: z.string(),
    name: z.string(),
    // country: z.string().optional(),
    created_at: z.date(),
  }),
  transformation: createPostgresPublicSchemaTransformation(
    "accounts",
    // TODO: multi table public schemas
    // "SELECT accounts.id, email, name, accounts.created_at, country FROM accounts LEFT JOIN addresses ON accounts.id = addresses.account_id WHERE accounts.id = $1",
    "SELECT id, email, name, created_at FROM accounts WHERE id = $1",
  ),
  version: {
    major: 1,
    minor: 0,
  },
});

const accountsPublicSchemaV2 = createPublicSchema("accounts", {
  source: { dataStoreSlug: "db-accounts", tables: ["accounts"] },
  outputSchema: z.object({
    id: z.string(),
    name: z.string(),
    created_at: z.date(),
  }),
  transformation: createPostgresPublicSchemaTransformation(
    "accounts",
    "SELECT id, name, created_at FROM accounts WHERE id = $1",
  ),
  version: {
    major: 2,
    minor: 0,
  },
});

export default {
  accountsPublicSchemaV1,
  accountsPublicSchemaV2,
};
