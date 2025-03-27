import { z } from "zod";

import { createPostgresPublicSchemaTransformation } from "@rejot/adapter-postgres";
import { createPublicSchema } from "@rejot/contract/public-schema";

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

export default {
  testPublicSchema,
};
