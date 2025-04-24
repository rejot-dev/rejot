import { zodToJsonSchema } from "zod-to-json-schema";

import { SyncManifestSchema } from "./manifest/manifest.ts";

const SyncManifestJsonSchema = zodToJsonSchema(SyncManifestSchema);

// Bit hacky, but it works
const outputSchema =
  // @ts-expect-error its a hack
  SyncManifestJsonSchema["properties"]["publicSchemas"]["items"]["properties"]["outputSchema"];
if (outputSchema === undefined) {
  throw new Error("outputSchema is undefined, did the schema change?");
}

// @ts-expect-error its a hack
SyncManifestJsonSchema["properties"]["publicSchemas"]["items"]["properties"]["outputSchema"] = {
  $ref: "http://json-schema.org/draft-07/schema#",
};

console.log(JSON.stringify(SyncManifestJsonSchema, null, 2));
