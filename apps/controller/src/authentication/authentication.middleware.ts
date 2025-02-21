import { createMiddleware } from "hono/factory";
import { getAuth } from "@hono/clerk-auth";
import type { MiddlewareHandler } from "hono/types";
import { tokens } from "typed-inject";
import type { IOrganizationService } from "@/organization/organization-service.ts";
import { AuthenticationError, AuthenticationErrors } from "./authentication.error.ts";
import type { ISystemService } from "@/system/system-service.ts";

export type RequireLoginMiddleware = MiddlewareHandler<
  {
    Variables: {
      clerkUserId: string;
    };
  },
  string
>;

export interface IAuthenticationMiddleware {
  requireLogin(): RequireLoginMiddleware;
  requireOrganizationAccess(clerkUserId: string, organizationId: string): Promise<void>;
  requireOrganizationsAccess(clerkUserId: string, organizationIds: string[]): Promise<void>;
  requireSystemAccess(clerkUserId: string, systemSlug: string): Promise<void>;
}

export class AuthenticationMiddleware implements IAuthenticationMiddleware {
  static inject = tokens("organizationService", "systemService");

  #organizationService: IOrganizationService;
  #systemService: ISystemService;

  constructor(organizationService: IOrganizationService, systemService: ISystemService) {
    this.#organizationService = organizationService;
    this.#systemService = systemService;
  }

  requireLogin(): RequireLoginMiddleware {
    return createMiddleware(async (c, next) => {
      const auth = getAuth(c);

      if (!auth?.userId) {
        throw new AuthenticationError(AuthenticationErrors.NOT_LOGGED_IN);
      }

      c.set("clerkUserId", auth.userId);

      await next();
    });
  }

  async requireSystemAccess(clerkUserId: string, systemSlug: string): Promise<void> {
    const systemSlugs = (await this.#systemService.getSystemsForClerkUser(clerkUserId)).map(
      (system) => system.slug,
    );

    if (!systemSlugs.includes(systemSlug)) {
      throw new AuthenticationError(AuthenticationErrors.UNAUTHORIZED).withContext({
        clerkUserId,
        systemSlug,
      });
    }
  }

  async requireOrganizationAccess(clerkUserId: string, organizationId: string): Promise<void> {
    const canAccess = await this.#organizationService.clerkUserCanAccessOrganizations(clerkUserId, [
      organizationId,
    ]);

    if (!canAccess) {
      throw new AuthenticationError(AuthenticationErrors.UNAUTHORIZED).withContext({
        clerkUserId,
        organizationId,
      });
    }
  }

  async requireOrganizationsAccess(clerkUserId: string, organizationIds: string[]): Promise<void> {
    const canAccess = await this.#organizationService.clerkUserCanAccessOrganizations(
      clerkUserId,
      organizationIds,
    );

    if (!canAccess) {
      throw new AuthenticationError(AuthenticationErrors.UNAUTHORIZED).withContext({
        clerkUserId,
        organizationIds,
      });
    }
  }
}
