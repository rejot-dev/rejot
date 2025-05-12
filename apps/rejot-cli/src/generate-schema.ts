import { generateCommandSchema } from "@rejot-dev/contract/cli-schema";

import { commands } from "./index.ts";

if (import.meta.main) {
  const schema = generateCommandSchema(commands);
  console.log(JSON.stringify(schema, null, 2));
}
