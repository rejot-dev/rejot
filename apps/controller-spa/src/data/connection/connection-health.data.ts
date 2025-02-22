import { useQuery } from "@tanstack/react-query";
import { type ApiResult, fetchRoute } from "../fetch.ts";
import {
  type ConnectionHealth,
  connectionHealthApi,
  type ConnectionPublication,
  connectionPublicationsApi,
  type ConnectionTable,
  connectionTablesApi,
  type ConnectionTableSchema,
  connectionTableSchemaApi,
  connectionTableSchemaChangesApi,
  type ConnectionTableSchemaChangesResponse,
} from "@rejot/api-interface-controller/connection-health";

export function getConnectionHealth(
  organizationId: string,
  connectionSlug: string,
): Promise<ApiResult<ConnectionHealth>> {
  return fetchRoute(connectionHealthApi, {
    params: { organizationId, connectionSlug },
  });
}

export function useConnectionHealth(organizationId: string, connectionSlug: string | undefined) {
  return useQuery({
    queryKey: ["connection-health", organizationId, connectionSlug],
    queryFn: () => getConnectionHealth(organizationId, connectionSlug!),
    select: (result) => {
      if (result.status === "error") {
        throw new Error(result.message);
      }
      return result.data;
    },
    enabled: !!connectionSlug,
  });
}

export function getConnectionTables(
  organizationId: string,
  connectionSlug: string,
): Promise<ApiResult<ConnectionTable[]>> {
  return fetchRoute(connectionTablesApi, {
    params: { organizationId, connectionSlug },
  });
}

export function useConnectionTables(organizationId: string, connectionSlug: string) {
  return useQuery({
    queryKey: ["connection-tables", organizationId, connectionSlug],
    queryFn: () => getConnectionTables(organizationId, connectionSlug),
    select: (result) => {
      if (result.status === "error") {
        throw new Error(result.message);
      }
      return result.data;
    },
  });
}

export function getConnectionTableSchema(
  organizationId: string,
  connectionSlug: string,
  tableName: string,
): Promise<ApiResult<ConnectionTableSchema>> {
  return fetchRoute(connectionTableSchemaApi, {
    params: { organizationId, connectionSlug, tableName },
  });
}

export function useConnectionTableSchema(
  organizationId: string | undefined,
  connectionSlug: string | undefined,
  tableName: string | undefined,
) {
  return useQuery({
    queryKey: ["connection-table-schema", organizationId, connectionSlug, tableName],
    queryFn: () => getConnectionTableSchema(organizationId!, connectionSlug!, tableName!),
    select: (result) => {
      if (result.status === "error") {
        throw new Error(result.message);
      }
      return result.data;
    },
    enabled: !!organizationId && !!connectionSlug && !!tableName,
  });
}

export function getConnectionPublications(
  organizationId: string,
  connectionSlug: string,
): Promise<ApiResult<ConnectionPublication[]>> {
  return fetchRoute(connectionPublicationsApi, {
    params: { organizationId, connectionSlug },
  });
}

export function useConnectionPublications(organizationId: string, connectionSlug: string) {
  return useQuery({
    queryKey: ["connection-publications", organizationId, connectionSlug],
    queryFn: () => getConnectionPublications(organizationId, connectionSlug),
    select: (result) => {
      if (result.status === "error") {
        throw new Error(result.message);
      }
      return result.data;
    },
  });
}

export async function getConnectionTableSchemaChanges(
  organizationId: string,
  connectionSlug: string,
  tableName: string,
): Promise<ApiResult<ConnectionTableSchemaChangesResponse>> {
  return fetchRoute(connectionTableSchemaChangesApi, {
    params: { organizationId, connectionSlug, tableName },
  });
}
