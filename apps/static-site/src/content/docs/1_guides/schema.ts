// schema.ts
import { z } from "zod";

import { createConsumerSchema } from "@rejot-dev/contract/consumer-schema";
import { createPublicSchema } from "@rejot-dev/contract/public-schema";

const myPublicSchema = createPublicSchema("my-public-schema", {
  source: { dataStoreSlug: "my-source-datastore", tables: ["my_table"] },
  outputSchema: z.object({
    id: z.string(),
    name: z.string(),
  }),
  transformations: [], // See next step
  version: {
    major: 1,
    minor: 0,
  },
});

const myConsumerSchema = createConsumerSchema({
  source: {
    manifestSlug: "my-manifest",
    publicSchema: {
      name: "my-public-schema",
      majorVersion: 1,
    },
  },
  destinationDataStoreSlug: "my-destination-datastore",
  transformations: [], // See next step
});

export default {
  myPublicSchema,
  myConsumerSchema,
};
