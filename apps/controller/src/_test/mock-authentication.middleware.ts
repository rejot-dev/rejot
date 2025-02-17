import { tokens } from "typed-inject";
import { createMiddleware } from "hono/factory";

import type {
  IAuthenticationMiddleware,
  RequireLoginMiddleware,
} from "@/authentication/authentication.middleware.ts";
import type { IOrganizationService } from "@/organization/organization-service.ts";

export class MockAuthenticationMiddleware implements IAuthenticationMiddleware {
  static inject = tokens("organizationService");

  // eslint-disable-next-line no-unused-private-class-members
  #organizationService: IOrganizationService;

  constructor(organizationService: IOrganizationService) {
    this.#organizationService = organizationService;
  }

  requireLogin(): RequireLoginMiddleware {
    return createMiddleware(async (c, next) => {
      c.set("clerkUserId", "123");

      await next();
    });
  }

  requireOrganizationAccess(_clerkUserId: string, _organizationId: string): Promise<void> {
    return Promise.resolve();
  }

  requireOrganizationsAccess(_clerkUserId: string, _organizationIds: string[]): Promise<void> {
    return Promise.resolve();
  }
}
