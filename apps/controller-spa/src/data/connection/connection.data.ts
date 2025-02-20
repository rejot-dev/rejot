import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { type ApiResult, fetchRoute, fetchRouteThrowing } from "../fetch";
import {
  connectionCreateApi,
  ConnectionCreateRequest,
  connectionListApi,
} from "@rejot/api-interface-controller/connection";

type ConnectionListResponse = z.infer<
  (typeof connectionListApi.responses)[200]["content"]["application/json"]["schema"]
>;

type ConnectionCreateResponse = z.infer<
  (typeof connectionCreateApi.responses)[201]["content"]["application/json"]["schema"]
>;

export function getConnections(organizationId: string): Promise<ApiResult<ConnectionListResponse>> {
  return fetchRoute(connectionListApi, { params: { organizationId } });
}

export function useConnections(organizationId: string) {
  return useQuery({
    queryKey: ["connections", organizationId],
    queryFn: () => getConnections(organizationId),
    select: (result) => {
      if (result.status === "error") {
        throw new Error(result.message);
      }
      return result.data;
    },
    enabled: !!organizationId,
  });
}

export function createConnection(
  organizationId: string,
  data: z.infer<typeof ConnectionCreateRequest>,
): Promise<ConnectionCreateResponse> {
  return fetchRouteThrowing(connectionCreateApi, {
    params: { organizationId },
    body: data,
  });
}

export function useCreateConnectionMutation() {
  return useMutation({
    mutationFn: ({
      organizationId,
      data,
    }: {
      organizationId: string;
      data: z.infer<typeof ConnectionCreateRequest>;
    }) => createConnection(organizationId, data),
  });
}
