import { useMutation, useQuery, type UseQueryResult } from "@tanstack/react-query";
import { z } from "zod";
import { type ApiResult, fetchRoute, fetchRouteThrowing } from "../fetch";
import {
  connectionCreateApi,
  ConnectionCreateRequest,
  connectionListApi,
  type ConnectionSchema,
} from "@rejot/api-interface-controller/connection";

export type Connection = z.infer<typeof ConnectionSchema>;

export type ConnectionCreateResponse = z.infer<
  (typeof connectionCreateApi.responses)[201]["content"]["application/json"]["schema"]
>;

export function getConnections(organizationId: string): Promise<ApiResult<Connection[]>> {
  return fetchRoute(connectionListApi, { params: { organizationId } });
}

export function useConnections(organizationId: string): UseQueryResult<Connection[]> {
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
