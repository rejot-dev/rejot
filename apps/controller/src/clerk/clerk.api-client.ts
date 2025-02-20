import { tokens } from "typed-inject";
import { createClerkClient } from "@clerk/backend";
import type { ConfigManager } from "@/app-config/config.ts";
import { ClerkError, ClerkErrors } from "./clerk.error.ts";
import { z } from "zod";

export const ClerkUserMetadataSchema = z.object({
  organizationIds: z.array(z.string()),
  selectedOrganizationId: z.string(),
  finishedOnboarding: z.boolean(),
  defaultSystemSlug: z.string().optional(),
});

export type ClerkUserMetadata = z.infer<typeof ClerkUserMetadataSchema>;

export interface IClerkApiClient {
  getUser(clerkUserId: string): Promise<{
    clerkUserId: string;
    firstName: string;
    lastName: string;
    email: string;
  }>;
  setUserPublicMetadata(clerkUserId: string, metadata: ClerkUserMetadata): Promise<void>;
  /** Deep merges metadata */
  mergeUserPublicMetadata(clerkUserId: string, metadata: Partial<ClerkUserMetadata>): Promise<void>;
  /** Get user's public metadata */
  getUserPublicMetadata(clerkUserId: string): Promise<ClerkUserMetadata>;
}

export class ClerkApiClient implements IClerkApiClient {
  static inject = tokens("config");

  #clerk;

  constructor(config: ConfigManager) {
    this.#clerk = createClerkClient({
      secretKey: config.controller.clerk.secretKey,
      publishableKey: config.controller.clerk.publishableKey,
    });
  }

  async getUser(clerkUserId: string) {
    const user = await this.#clerk.users.getUser(clerkUserId);

    if (!user) {
      throw new ClerkError(ClerkErrors.USER_NOT_FOUND).withContext({ clerkUserId });
    }

    const missingFields: string[] = [];
    if (!user.firstName) {
      missingFields.push("firstName");
    }
    if (!user.lastName) {
      missingFields.push("lastName");
    }
    if (user.emailAddresses.length === 0) {
      missingFields.push("emailAddresses");
    }

    if (missingFields.length > 0) {
      throw new ClerkError(ClerkErrors.INCOMPLETE_PROFILE).withContext({
        clerkUserId,
        missingFields,
      });
    }

    return {
      clerkUserId: user.id,
      firstName: user.firstName!,
      lastName: user.lastName!,
      email: user.emailAddresses[0].emailAddress,
    };
  }

  async setUserPublicMetadata(clerkUserId: string, metadata: ClerkUserMetadata): Promise<void> {
    const user = await this.#clerk.users.getUser(clerkUserId);

    if (!user) {
      throw new ClerkError(ClerkErrors.USER_NOT_FOUND).withContext({ clerkUserId });
    }

    try {
      await this.#clerk.users.updateUser(clerkUserId, {
        publicMetadata: metadata,
      });
    } catch (error) {
      throw new ClerkError(ClerkErrors.CLERK_API_ERROR)
        .withContext({ clerkUserId })
        .withCause(error);
    }
  }

  async mergeUserPublicMetadata(
    clerkUserId: string,
    metadata: Partial<ClerkUserMetadata>,
  ): Promise<void> {
    const user = await this.#clerk.users.getUser(clerkUserId);

    if (!user) {
      throw new ClerkError(ClerkErrors.USER_NOT_FOUND).withContext({ clerkUserId });
    }

    try {
      await this.#clerk.users.updateUserMetadata(clerkUserId, {
        publicMetadata: metadata,
      });
    } catch (error) {
      throw new ClerkError(ClerkErrors.CLERK_API_ERROR)
        .withContext({ clerkUserId })
        .withCause(error);
    }
  }

  async getUserPublicMetadata(clerkUserId: string): Promise<ClerkUserMetadata> {
    const user = await this.#clerk.users.getUser(clerkUserId);

    if (!user) {
      throw new ClerkError(ClerkErrors.USER_NOT_FOUND).withContext({ clerkUserId });
    }

    const metadata = user.publicMetadata as ClerkUserMetadata;
    return ClerkUserMetadataSchema.parse(metadata);
  }
}
