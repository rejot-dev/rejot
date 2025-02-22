import { testClient } from "hono/testing";
import { createInjector } from "typed-inject";
import { test, expect } from "bun:test";
import { assert } from "@std/assert/assert";

import type { ISystemService, System } from "./system-service.ts";
import { SystemRoutes } from "./system-routes.ts";
import { MockAuthenticationMiddleware } from "@/_test/mock-authentication.middleware.ts";
import type { CreateSystem } from "@rejot/api-interface-controller/system";
import type { SystemOverview } from "./system-service.ts";
import type { ClerkUserMetadata, IClerkApiClient } from "@/clerk/clerk.api-client.ts";
import { ClerkErrors } from "@/clerk/clerk.error.ts";
import { ClerkError } from "@/clerk/clerk.error.ts";

class MockSystemService implements ISystemService {
  getSystemsForClerkUser(_clerkUserId: string): Promise<System[]> {
    return Promise.resolve([]);
  }

  createSystem(organizationCode: string, { name, slug }: CreateSystem): Promise<System> {
    return Promise.resolve({
      id: "SYS_1",
      name,
      slug,
      organization: {
        id: organizationCode,
        name: "Test Organization",
      },
    });
  }

  getSystem(organizationCode: string, systemSlug: string): Promise<SystemOverview> {
    return Promise.resolve({
      id: "SYS_1",
      name: "Test System",
      slug: systemSlug,
      organization: {
        code: organizationCode,
        name: "Test Organization",
      },
      dataStores: [],
    });
  }

  getSystems(_organizationCode: string): Promise<System[]> {
    return Promise.resolve([
      {
        id: "SYS_1",
        name: "Test System",
        slug: "test-system",
        organization: {
          id: "ORG_1",
          name: "Test Organization",
        },
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

class MockClerkApiClient implements IClerkApiClient {
  getUserPublicMetadata(_clerkUserId: string): Promise<ClerkUserMetadata> {
    return Promise.reject(new Error("Method not implemented."));
  }
  getUser(
    _clerkUserId: string,
  ): Promise<{ clerkUserId: string; firstName: string; lastName: string; email: string }> {
    return Promise.reject(new Error("Method not implemented."));
  }
  setUserPublicMetadata(_clerkUserId: string, _metadata: ClerkUserMetadata): Promise<void> {
    return Promise.resolve();
  }
  mergeUserPublicMetadata(
    _clerkUserId: string,
    _metadata: Partial<ClerkUserMetadata>,
  ): Promise<void> {
    return Promise.resolve();
  }
}

test("System Routes - Create System", async () => {
  const systemRoutes = createInjector()
    .provideClass("systemService", MockSystemService)
    .provideClass("authenticationMiddleware", MockAuthenticationMiddleware)
    .provideClass("clerkApiClient", MockClerkApiClient)
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
  expect(createSystemBody.id).toBe("SYS_1");
});

test("System Routes - Create System - Invalid Slugs", async () => {
  const systemRoutes = createInjector()
    .provideClass("systemService", MockSystemService)
    .provideClass("authenticationMiddleware", MockAuthenticationMiddleware)
    .provideClass("clerkApiClient", MockClerkApiClient)
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

test("System Routes - Create System - Clerk API Error should not fail the request", async () => {
  class ThrowingClerkApiClient extends MockClerkApiClient {
    mergeUserPublicMetadata(
      _clerkUserId: string,
      _metadata: Partial<ClerkUserMetadata>,
    ): Promise<void> {
      return Promise.reject(new ClerkError(ClerkErrors.CLERK_API_ERROR));
    }
  }

  const systemRoutes = createInjector()
    .provideClass("systemService", MockSystemService)
    .provideClass("authenticationMiddleware", MockAuthenticationMiddleware)
    .provideClass("clerkApiClient", ThrowingClerkApiClient)
    .injectClass(SystemRoutes);

  const routes = systemRoutes.routes;
  const client = testClient(routes);

  const createSystemResponse = await client["/organizations/ORG_1/systems"].$post({
    param: {
      organizationId: "ORG_1",
    },
    json: {
      name: "Test System",
      slug: "test-system",
    },
  });

  expect(createSystemResponse.ok).toBe(true);
  if (createSystemResponse.ok) {
    expect(createSystemResponse.status).toBe(201);
    const createSystemBody = await createSystemResponse.json();
    expect(createSystemBody.id).toBe("SYS_1");
  }
});
