import {
  ClerkUserMetadata,
  replaceUserMetadataClerkPutApi,
  patchUserMetadataClerkPatchApi,
} from "@rejot-dev/api-interface-controller/clerk";
import { useUser } from "@clerk/clerk-react";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchRouteThrowing } from "../fetch.ts";

type ClerkMetadataResponse = z.infer<
  (typeof replaceUserMetadataClerkPutApi.responses)[200]["content"]["application/json"]["schema"]
>;

type ClerkMetadataRequest = z.infer<
  (typeof replaceUserMetadataClerkPutApi.request.body.content)["application/json"]["schema"]
>;

type ClerkMetadataPatchRequest = z.infer<
  (typeof patchUserMetadataClerkPatchApi.request.body.content)["application/json"]["schema"]
>;

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

export function useDefaultSystemSlug() {
  return useClerkPublicMetadata()?.defaultSystemSlug;
}

export async function replaceClerkMetadata(
  metadata: ClerkMetadataRequest,
): Promise<ClerkMetadataResponse> {
  return fetchRouteThrowing(replaceUserMetadataClerkPutApi, { body: metadata });
}

export async function patchClerkMetadata(
  metadata: ClerkMetadataPatchRequest,
): Promise<ClerkMetadataResponse> {
  return fetchRouteThrowing(patchUserMetadataClerkPatchApi, { body: metadata });
}

export function useReplaceClerkMetadataMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: replaceClerkMetadata,
    onSuccess: () => {
      // Invalidate the clerk user query to refetch the updated metadata
      queryClient.invalidateQueries({ queryKey: ["clerk", "current"] });
    },
  });
}

export function usePatchClerkMetadataMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: patchClerkMetadata,
    onSuccess: () => {
      // Invalidate the clerk user query to refetch the updated metadata
      queryClient.invalidateQueries({ queryKey: ["clerk", "current"] });
    },
  });
}
