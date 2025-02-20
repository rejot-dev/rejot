import { useMutation, useQuery } from "@tanstack/react-query";

import { type ApiResult, fetchRoute } from "../fetch";
import {
  clerkGetApi,
  createSelfUserClerkPostApi,
  replaceUserMetadataClerkPutApi,
} from "@rejot/api-interface-controller/clerk";
import type { z } from "zod";

type ClerkGetResponse = z.infer<
  (typeof clerkGetApi.responses)[200]["content"]["application/json"]["schema"]
>;

type ClerkPostResponse = z.infer<
  (typeof createSelfUserClerkPostApi.responses)[201]["content"]["application/json"]["schema"]
>;

type ClerkMetadataRequest = z.infer<
  (typeof replaceUserMetadataClerkPutApi.request.body.content)["application/json"]["schema"]
>;

type ClerkMetadataResponse = z.infer<
  (typeof replaceUserMetadataClerkPutApi.responses)[200]["content"]["application/json"]["schema"]
>;

export function getCurrentClerkUser(): Promise<ApiResult<ClerkGetResponse>> {
  return fetchRoute(clerkGetApi);
}

export function useCurrentClerkUser() {
  return useQuery({
    queryKey: ["clerk", "current"],
    queryFn: getCurrentClerkUser,
    select: (result) => {
      if (result.status === "error") {
        throw new Error(result.message);
      }
      return result.data;
    },
  });
}

export function createCurrentUser(): Promise<ApiResult<ClerkPostResponse>> {
  return fetchRoute(createSelfUserClerkPostApi);
}

export function useCreateCurrentUserMutation() {
  return useMutation({
    mutationFn: createCurrentUser,
  });
}

export function updateClerkMetadata(
  metadata: ClerkMetadataRequest,
): Promise<ApiResult<ClerkMetadataResponse>> {
  return fetchRoute(replaceUserMetadataClerkPutApi, {
    body: metadata,
  });
}

export function useUpdateClerkMetadataMutation() {
  return useMutation({
    mutationFn: updateClerkMetadata,
  });
}
