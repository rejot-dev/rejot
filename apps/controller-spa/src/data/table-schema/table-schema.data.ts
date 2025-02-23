import { useQuery } from "@tanstack/react-query";
import { fetchRoute } from "../fetch.ts";
import {
  connectionPublicationOverviewApi,
  connectionSchemaOverviewApi,
} from "@rejot/api-interface-controller/connection-tables";

export function useConnectionPublicationTableOverview(
  organizationId: string,
  connectionSlug: string,
  publicationName: string,
) {
  return useQuery({
    queryKey: [
      "connection-publication-table-overview",
      organizationId,
      connectionSlug,
      publicationName,
    ],
    queryFn: () =>
      getConnectionPublicationTableOverview(organizationId, connectionSlug, publicationName),
    select: (result) => {
      if (result.status === "error") {
        throw new Error(result.message);
      }
      return result.data;
    },
  });
}

function getConnectionPublicationTableOverview(
  organizationId: string,
  connectionSlug: string,
  publicationName: string,
) {
  return fetchRoute(connectionPublicationOverviewApi, {
    params: { organizationId, connectionSlug, publicationName },
  });
}

export function useConnectionSchemaOverview(
  organizationId: string,
  connectionSlug: string,
  schemaName: string,
) {
  return useQuery({
    queryKey: ["connection-schema-overview", organizationId, connectionSlug, schemaName],
    queryFn: () => getConnectionSchemaOverview(organizationId, connectionSlug, schemaName),
    select: (result) => {
      if (result.status === "error") {
        throw new Error(result.message);
      }
      return result.data;
    },
  });
}

function getConnectionSchemaOverview(
  organizationId: string,
  connectionSlug: string,
  schemaName: string,
) {
  return fetchRoute(connectionSchemaOverviewApi, {
    params: { organizationId, connectionSlug, schemaName },
  });
}
