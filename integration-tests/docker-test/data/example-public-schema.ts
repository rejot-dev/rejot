import { z } from "zod";

import {
  createPostgresPublicSchemaTransformations,
  PostgresPublicSchemaConfigBuilder,
} from "@rejot-dev/adapter-postgres";
import { createPublicSchema } from "@rejot-dev/contract/public-schema";

const testPublicSchema = createPublicSchema("publish-account", {
  source: { dataStoreSlug: "source" },
  outputSchema: z.object({
    id: z.number(),
    emails: z.array(z.string()),
    firstName: z.string(),
    lastName: z.string(),
  }),
  config: new PostgresPublicSchemaConfigBuilder()
    .addTransformation(
      createPostgresPublicSchemaTransformations(
        "insertOrUpdate",
        "account",
        `SELECT 
          a.id, 
          (
            SELECT ARRAY_AGG(e.email) 
            FROM account_emails e 
            WHERE e.account_id = a.id
          ) as emails,
          a.first_name as "firstName",
          a.last_name as "lastName"
        FROM 
          account a WHERE a.id = :id`,
      ),
    )
    .build(),
  version: { major: 1, minor: 0 },
});

export default {
  testPublicSchema,
};
