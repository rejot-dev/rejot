import { useQuery } from "@tanstack/react-query";
import { fetchRouteThrowing } from "../fetch.ts";
import { connectionSchemaOverviewApi } from "@rejot/api-interface-controller/connection-tables";

export function useConnectionSchemaOverview(organizationId: string, connectionSlug: string) {
  return useQuery({
    queryKey: ["connection-schema-overview", organizationId, connectionSlug],
    queryFn: () => getConnectionSchemaOverview(organizationId, connectionSlug),
  });
}

function getConnectionSchemaOverview(organizationId: string, connectionSlug: string) {
  return fetchRouteThrowing(connectionSchemaOverviewApi, {
    params: { organizationId, connectionSlug },
  });
}
