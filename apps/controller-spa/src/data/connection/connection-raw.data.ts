import { useMutation, useQuery } from "@tanstack/react-query";
import { type ApiResult, fetchRoute } from "../fetch.ts";
import { postCheckConnectionApi } from "@rejot/api-interface-controller/connection";
import type { ConnectionHealth } from "@rejot/api-interface-controller/connection-health";

type ConnectionConfig = {
  type: "postgres";
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
};

export function checkConnection(config: ConnectionConfig): Promise<ApiResult<ConnectionHealth>> {
  return fetchRoute(postCheckConnectionApi, {
    body: config,
  });
}

export function useCheckConnectionMutation() {
  return useMutation({
    mutationFn: checkConnection,
    mutationKey: ["connection-check"],
  });
}

export function useCheckConnectionHealth(config: ConnectionConfig) {
  return useQuery({
    queryKey: ["connection-health", config],
    queryFn: () => {
      return checkConnection(config);
    },
    refetchInterval: false,
    retry: false,
  });
}
