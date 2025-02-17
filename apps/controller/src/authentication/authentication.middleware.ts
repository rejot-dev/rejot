import { createMiddleware } from "hono/factory";
import { getAuth } from "@hono/clerk-auth";
import type { MiddlewareHandler } from "hono/types";
import { tokens } from "typed-inject";
import type { IOrganizationService } from "@/organization/organization-service.ts";
import { AuthenticationError, AuthenticationErrors } from "./authentication.error.ts";

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
}

export class AuthenticationMiddleware implements IAuthenticationMiddleware {
  static inject = tokens("organizationService");

  #organizationService: IOrganizationService;

  constructor(organizationService: IOrganizationService) {
    this.#organizationService = organizationService;
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
