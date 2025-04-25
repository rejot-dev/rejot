import { test } from "bun:test";
import { expect } from "bun:test";

import { testClient } from "hono/testing";
import { createInjector } from "typed-inject";

import { AuthenticationRoutes } from "@/authentication/authentication.routes.ts";
import type { IAuthenticationService } from "@/authentication/authentication-service.ts";

class MockAuthenticationService implements IAuthenticationService {
  sendCode(email: string, code: string): Promise<void> {
    console.log("Sending code to", email, ":", code);
    return Promise.resolve();
  }

  validateUser(email: string): Promise<{ code: string }> {
    return Promise.resolve({
      code: email,
    });
  }
}

test("authentication routes test", () => {
  const authenticationRoutes = createInjector()
    .provideClass("authenticationService", MockAuthenticationService)
    .injectClass(AuthenticationRoutes);

  const routes = authenticationRoutes.routes;
  const honoClient = testClient(routes);

  expect(honoClient).toBeDefined();
});
