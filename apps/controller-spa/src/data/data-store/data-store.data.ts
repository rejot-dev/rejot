import { useQuery } from "@tanstack/react-query";

import { fetchRouteThrowing } from "@/data/fetch.ts";
import { dataStoreListApi, dataStoreGetApi } from "@rejot-dev/api-interface-controller/data-store";

export function getSystemDataStores(systemSlug: string) {
  return fetchRouteThrowing(dataStoreListApi, {
    params: { systemSlug },
  });
}

export function useSystemDataStores(systemSlug: string) {
  return useQuery({
    queryKey: ["data-store", "list", systemSlug],
    queryFn: () => getSystemDataStores(systemSlug),
  });
}

export function getDataStore(systemSlug: string, dataStoreSlug: string) {
  return fetchRouteThrowing(dataStoreGetApi, {
    params: { systemSlug, dataStoreSlug },
  });
}

export function useDataStore(systemSlug: string | null, dataStoreSlug: string | null) {
  return useQuery({
    queryKey: ["data-store", "detail", systemSlug, dataStoreSlug],
    queryFn: () => getDataStore(systemSlug!, dataStoreSlug!),
    enabled: !!systemSlug && !!dataStoreSlug,
  });
}
