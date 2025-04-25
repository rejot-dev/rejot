import { expect, test } from "bun:test";

import { appInjector } from "./injector.ts";

test("create app injector", () => {
  const injector = appInjector.createChildInjector();
  expect(injector).toBeDefined();
});
