import { useQuery } from "@tanstack/react-query";
import { fetchRoute } from "../fetch.ts";
import { connectionPublicationTableOverviewApi } from "@rejot/api-interface-controller/connection-tables";

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
  return fetchRoute(connectionPublicationTableOverviewApi, {
    params: { organizationId, connectionSlug, publicationName },
  });
}
