import { useMutation, useQuery } from "@tanstack/react-query";
import { type ApiResult, fetchRoute } from "../fetch";
import {
  type CreateSystem,
  type DataStoreRequest,
  DataStoreResponse,
  systemCreateApi,
  systemDataStorePutApi,
  systemGetApi,
  systemListApi,
} from "@rejot/api-interface-controller/system";
import type { ConnectionType } from "../connection/connection";
import type { SyncServiceStatus } from "../sync-service/sync-service.data";
import { z } from "zod";
import { useSelectedOrganizationCode as useSelectedOrganizationId } from "../clerk/clerk-meta.data";
import { getConnectionTableSchemaChanges } from "@/data/connection/connection-health.data";

type SystemResponse = z.infer<
  (typeof systemGetApi.responses)[200]["content"]["application/json"]["schema"]
>;
type SystemListResponse = z.infer<
  (typeof systemListApi.responses)[200]["content"]["application/json"]["schema"]
>;

export type SystemOverview = {
  code: string;
  name: string;
  slug: string;

  syncServices: {
    code: string;
    slug: string;
    status: SyncServiceStatus;
  }[];

  dataStores: {
    slug: string;
    type: ConnectionType;
    publication: {
      name: string;
      tables?: string[];
    };
  }[];
};

export type System = {
  code: string;
  name: string;
  slug: string;
};

export async function getSystem(
  organizationId: string,
  systemSlug: string,
): Promise<ApiResult<SystemResponse>> {
  return fetchRoute(systemGetApi, {
    params: { organizationId, systemSlug },
  });
}

export function useSystem(organizationId: string, systemId: string) {
  return useQuery({
    queryKey: ["system", organizationId, systemId],
    queryFn: () => getSystem(organizationId, systemId),
    select: (result) => {
      if (result.status === "error") {
        throw new Error(result.message);
      }
      return result.data;
    },
  });
}

export async function createSystem(
  organizationId: string,
  system: CreateSystem,
): Promise<ApiResult<SystemResponse>> {
  return fetchRoute(systemCreateApi, {
    params: { organizationId },
    body: system,
  });
}

export function useCreateSystemMutation() {
  return useMutation({
    mutationFn: ({ organizationId, ...system }: CreateSystem & { organizationId: string }) =>
      createSystem(organizationId, system),
  });
}

export async function getSystems(organizationId: string): Promise<ApiResult<SystemListResponse>> {
  return fetchRoute(systemListApi, {
    params: { organizationId },
  });
}

export function useSystems(organizationId: string) {
  return useQuery({
    queryKey: ["systems", organizationId],
    queryFn: () => getSystems(organizationId),
    select: (result) => {
      if (result.status === "error") {
        throw new Error(result.message);
      }
      return result.data;
    },
  });
}

export function useCurrentOrganizationSystems() {
  const organizationId = useSelectedOrganizationId();

  return useQuery({
    queryKey: ["organizations", organizationId, "systems"],
    queryFn: async () => {
      if (!organizationId) {
        return [];
      }

      const result = await getSystems(organizationId);

      if (result.status === "error") {
        throw new Error(result.message);
      }

      return result.data;
    },
  });
}

export async function getRealSystemOverview(
  organizationId: string,
  slug: string,
): Promise<SystemOverview> {
  const result = await getSystem(organizationId, slug);

  if (result.status === "error") {
    throw new Error(result.message);
  }

  const system = result.data;

  return {
    code: system.code,
    name: system.name,
    slug: system.slug,
    syncServices: [
      {
        code: "SYNC_123",
        slug: "default-sync",
        status: "active",
      },
    ], // This will need to be populated when sync service API is available
    dataStores: system.dataStores.map((ds) => ({
      slug: ds.connectionSlug,
      type: "postgres" as ConnectionType, // We might need to fetch the actual type from connections API
      publication: {
        name: ds.connectionSlug,
        tables: ds.tables,
      },
    })),
  };
}

export function useSystemOverview(slug: string) {
  const organizationId = useSelectedOrganizationId();

  return useQuery({
    queryKey: ["system-overview", organizationId, slug],
    queryFn: () => getRealSystemOverview(organizationId!, slug),
    enabled: !!organizationId,
  });
}

export async function addDataStore(
  organizationId: string,
  systemSlug: string,
  dataStore: DataStoreRequest,
): Promise<ApiResult<z.infer<typeof DataStoreResponse>>> {
  return fetchRoute(systemDataStorePutApi, {
    params: { organizationId, systemSlug },
    body: dataStore,
  });
}

export function useAddDataStoreMutation() {
  return useMutation({
    mutationFn: ({
      organizationId,
      systemSlug,
      dataStore,
    }: {
      organizationId: string;
      systemSlug: string;
      dataStore: DataStoreRequest;
    }) => addDataStore(organizationId, systemSlug, dataStore),
  });
}

export function useRecentSchemaChanges(
  organizationId: string,
  connectionSlug: string,
  schemaName: string,
  tableName: string,
) {
  return useQuery({
    queryKey: ["schema-changes", organizationId, connectionSlug, schemaName, tableName],
    queryFn: async () => {
      const result = await getConnectionTableSchemaChanges(
        organizationId,
        connectionSlug,
        tableName,
      );

      if (result.status === "error") {
        throw new Error(result.message);
      }

      return result.data;
    },
    enabled: !!organizationId && !!connectionSlug && !!tableName,
  });
}
