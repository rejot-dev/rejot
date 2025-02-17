import { ClerkUserMetadata } from "@rejot/api-interface-controller/clerk";
import { useUser } from "@clerk/clerk-react";
import { z } from "zod";

export function useClerkPublicMetadata(): z.infer<typeof ClerkUserMetadata> | undefined {
  const { user } = useUser();

  if (!user) {
    return undefined;
  }

  const metadata = ClerkUserMetadata.safeParse(user.publicMetadata);

  if (!metadata.success) {
    return {
      organizationIds: [],
      finishedOnboarding: false,
    };
  }

  return metadata.data;
}

export function useSelectedOrganizationCode() {
  const metadata = useClerkPublicMetadata();

  if (!metadata) {
    return undefined;
  }

  if (!metadata.organizationIds.length) {
    return undefined;
  }

  if (!metadata.selectedOrganizationId) {
    return metadata.organizationIds[0];
  }

  return metadata.selectedOrganizationId;
}
