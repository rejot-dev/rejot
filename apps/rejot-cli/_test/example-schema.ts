import { z } from "zod";

import { createPostgresTransformation } from "@rejot/contract/postgres";
import { createPublicSchema } from "@rejot/contract/public-schema";

const testPublicSchema = createPublicSchema("test", {
  source: { dataStoreSlug: "test", tables: ["test"] },
  outputSchema: z.object({
    id: z.string(),
    name: z.string(),
  }),
  transformations: [
    createPostgresTransformation("test", "SELECT id, name FROM test WHERE id = $1;"),
  ],
  version: {
    major: 1,
    minor: 0,
  },
});

export default {
  testPublicSchema,
};
