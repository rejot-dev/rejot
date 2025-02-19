import { testClient } from "hono/testing";
import { createInjector } from "typed-inject";
import { test, expect } from "bun:test";
import { assert } from "@std/assert/assert";

import type { ISystemService } from "./system-service.ts";
import { SystemRoutes } from "./system-routes.ts";
import type { SystemEntity } from "./system-repository.ts";
import { MockAuthenticationMiddleware } from "@/_test/mock-authentication.middleware.ts";
import type { CreateSystem } from "@rejot/api-interface-controller/system";
import type { SystemOverviewResponse } from "./system-service.ts";

class MockSystemService implements ISystemService {
  createSystem(organizationCode: string, { name, slug }: CreateSystem): Promise<SystemEntity> {
    return Promise.resolve({
      id: 1,
      code: "SYS_1",
      name,
      slug,
      organization: {
        id: 1,
        code: organizationCode,
        name: "Test Organization",
      },
    });
  }

  getSystem(organizationCode: string, systemSlug: string): Promise<SystemOverviewResponse> {
    return Promise.resolve({
      code: "SYS_1",
      name: "Test System",
      slug: systemSlug,
      organization: {
        code: organizationCode,
        name: "Test Organization",
      },
      dataStores: [],
    });
  }

  getSystems(_organizationCode: string): Promise<{ code: string; name: string; slug: string }[]> {
    return Promise.resolve([
      {
        code: "SYS_1",
        name: "Test System",
        slug: "test-system",
      },
    ]);
  }

  upsertDataStore(_params: {
    organizationId: string;
    systemSlug: string;
    connectionSlug: string;
    publicationName: string;
  }): Promise<{ connectionSlug: string; publicationName: string; publicationTables: string[] }> {
    return Promise.resolve({
      connectionSlug: "test-connection",
      publicationName: "test-publication",
      publicationTables: ["table1", "table2"],
    });
  }
}

test("System Routes - Create System", async () => {
  const systemRoutes = createInjector()
    .provideClass("systemService", MockSystemService)
    .provideClass("authenticationMiddleware", MockAuthenticationMiddleware)
    .injectClass(SystemRoutes);

  const routes = systemRoutes.routes;
  const client = testClient(routes);

  // Test creating a system
  const createSystemResponse = await client["/organizations/ORG_1/systems"].$post({
    param: {
      organizationId: "ORG_1",
    },
    json: {
      name: "Test System",
      slug: "test-system",
    },
  });

  assert(createSystemResponse.status === 201);
  const createSystemBody = await createSystemResponse.json();
  expect(createSystemBody.code).toBe("SYS_1");
});

test("System Routes - Create System - Invalid Slugs", async () => {
  const systemRoutes = createInjector()
    .provideClass("systemService", MockSystemService)
    .provideClass("authenticationMiddleware", MockAuthenticationMiddleware)
    .injectClass(SystemRoutes);

  const routes = systemRoutes.routes;
  const client = testClient(routes);

  const invalidSlugs = [
    "",
    3,
    "a b c",
    "Test-System",
    "test_system",
    "test--system",
    "-test-system",
    "test-system-",
    "test.system",
    "test/system",
    "test@system",
    "test$system",
    "test system",
    "test#system",
    "test&system",
    "test+system",
    "test=system",
    "test:system",
    "test;system",
    "test,system",
    "test?system",
    "test!system",
    "test*system",
    "test(system)",
    "test[system]",
    "test{system}",
    "test|system",
    "test\\system",
    "test'system",
    'test"system',
    "test`system",
    "test~system",
    "test^system",
    "test%system",
    "a".repeat(64),
  ];

  for (const slug of invalidSlugs) {
    const createSystemResponse = await client["/organizations/ORG_1/systems"].$post({
      param: {
        organizationId: "ORG_1",
      },
      json: {
        name: "Test System",
        slug: slug as string,
      },
    });

    assert(
      createSystemResponse.status === 400,
      `Status is not 400: ${createSystemResponse.status}`,
    );
    const createSystemBody = await createSystemResponse.json();

    expect(createSystemBody.success).toBe(false);
  }
});
