import { useMutation, useQuery } from "@tanstack/react-query";
import { type ApiResult, fetchRoute } from "../fetch";
import {
  organizationListApi,
  organizationPostApi,
} from "@rejot/api-interface-controller/organizations";
import type { z } from "zod";

type OrganizationPostResponse = z.infer<
  (typeof organizationPostApi.responses)[200]["content"]["application/json"]["schema"]
>;

type OrganizationListResponse = z.infer<
  (typeof organizationListApi.responses)[200]["content"]["application/json"]["schema"]
>;

export function getOrganizations(): Promise<ApiResult<OrganizationListResponse>> {
  return fetchRoute(organizationListApi);
}

export function useOrganizations() {
  return useQuery({
    queryKey: ["organizations"],
    queryFn: getOrganizations,
    select: (result) => {
      if (result.status === "error") {
        throw new Error(result.message);
      }
      return result.data;
    },
  });
}

export function createOrganization(name: string): Promise<ApiResult<OrganizationPostResponse>> {
  return fetchRoute(organizationPostApi, {
    body: { name },
  });
}

export function useCreateOrganizationMutation() {
  return useMutation({
    mutationFn: createOrganization,
  });
}
