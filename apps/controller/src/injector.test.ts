import { test } from "bun:test";

import { assertExists } from "@std/assert/exists";
import { appInjector } from "./injector.ts";

test("create app injector", () => {
  const injector = appInjector.createChildInjector();
  assertExists(injector);
});
