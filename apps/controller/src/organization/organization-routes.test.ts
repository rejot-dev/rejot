import { expect, test } from "bun:test";

import { testClient } from "hono/testing";
import { createInjector } from "typed-inject";

import { MockAuthenticationMiddleware } from "@/_test/mock-authentication.middleware.ts";

import type { OrganizationEntity } from "./organization-repository.ts";
import { OrganizationRoutes } from "./organization-routes.ts";
import type { CreateOrganization, IOrganizationService } from "./organization-service.ts";

class MockOrganizationService implements IOrganizationService {
  createOrganization({ name }: CreateOrganization): Promise<OrganizationEntity> {
    return Promise.resolve({
      id: 1,
      code: "ORG_1",
      name,
    });
  }

  getOrganization(code: string): Promise<OrganizationEntity> {
    return Promise.resolve({
      id: 1,
      code,
      name: "Test Organization",
    });
  }

  createOrganizationForClerkUserId(
    organization: CreateOrganization,
    _clerkUserId: string,
  ): Promise<OrganizationEntity> {
    return Promise.resolve({
      id: 1,
      code: "ORG_1",
      name: organization.name,
    });
  }

  getOrganizationsByClerkUserId(_clerkUserId: string): Promise<OrganizationEntity[]> {
    return Promise.resolve([
      {
        id: 1,
        code: "ORG_1",
        name: "Test Organization",
      },
    ]);
  }

  clerkUserCanAccessOrganizations(
    _clerkUserId: string,
    _organizationIds: string[],
  ): Promise<boolean> {
    return Promise.resolve(true);
  }
}

test("createOrganization route test", async () => {
  const organizationRoutes = createInjector()
    .provideClass("organizationService", MockOrganizationService)
    .provideClass("authenticationMiddleware", MockAuthenticationMiddleware)
    .injectClass(OrganizationRoutes);

  const routes = organizationRoutes.routes;
  const client = testClient(routes);

  const createOrganizationResponse = await client["organizations"].$post({
    json: {
      name: "Test Organization",
    },
  });

  expect(createOrganizationResponse.ok).toBe(true);
  if (!createOrganizationResponse.ok) {
    throw new Error("Failed to create organization");
  }

  const createOrganizationBody = await createOrganizationResponse.json();
  expect(createOrganizationBody.code).toBe("ORG_1");

  const getOrganizationResponse = await client["organizations"].$get({
    param: {
      organizationId: "ORG_1",
    },
  });

  expect(getOrganizationResponse.ok).toBe(true);
  if (!getOrganizationResponse.ok) {
    throw new Error("Failed to get organization");
  }

  const [getOrganizationBody] = await getOrganizationResponse.json();
  expect(getOrganizationBody.code).toBe("ORG_1");
});
