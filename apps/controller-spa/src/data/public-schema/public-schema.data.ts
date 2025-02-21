import { useMutation, useQuery, type UseQueryResult } from "@tanstack/react-query";
import { z } from "zod";
import { type ApiResult, fetchRoute, fetchRouteThrowing } from "../fetch";
import {
  publicSchemaGetApi,
  publicSchemaListApi,
  publicSchemaPostApi,
  PublicSchemaPostRequest,
  type PublicSchema,
} from "@rejot/api-interface-controller/public-schema";

export type PublicSchemaCreateResponse = z.infer<
  (typeof publicSchemaPostApi.responses)[201]["content"]["application/json"]["schema"]
>;

export function getPublicSchemas(systemSlug: string): Promise<ApiResult<PublicSchema[]>> {
  return fetchRoute(publicSchemaListApi, { params: { systemSlug } });
}

export function usePublicSchemas(systemSlug: string | null): UseQueryResult<PublicSchema[]> {
  return useQuery({
    queryKey: ["publicSchemas", systemSlug],
    queryFn: () => getPublicSchemas(systemSlug!),
    select: (result) => {
      if (result.status === "error") {
        throw new Error(result.message);
      }
      return result.data;
    },
    enabled: !!systemSlug,
  });
}

export function getPublicSchema(systemSlug: string, publicSchemaId: string): Promise<PublicSchema> {
  return fetchRouteThrowing(publicSchemaGetApi, { params: { systemSlug, publicSchemaId } });
}

export function usePublicSchema(
  organizationId: string,
  publicationSlug: string,
): UseQueryResult<PublicSchema> {
  return useQuery({
    queryKey: ["publicSchema", organizationId, publicationSlug],
    queryFn: () => getPublicSchema(organizationId, publicationSlug),
    enabled: !!organizationId && !!publicationSlug,
  });
}

export function createPublicSchema(
  systemSlug: string,
  dataStoreSlug: string,
  data: z.infer<typeof PublicSchemaPostRequest>,
): Promise<PublicSchemaCreateResponse> {
  return fetchRouteThrowing(publicSchemaPostApi, {
    params: { systemSlug, dataStoreSlug },
    body: data,
  });
}

export function useCreatePublicSchemaMutation() {
  return useMutation({
    mutationFn: ({
      systemSlug,
      dataStoreSlug,
      data,
    }: {
      systemSlug: string;
      dataStoreSlug: string;
      data: z.infer<typeof PublicSchemaPostRequest>;
    }) => createPublicSchema(systemSlug, dataStoreSlug, data),
  });
}
