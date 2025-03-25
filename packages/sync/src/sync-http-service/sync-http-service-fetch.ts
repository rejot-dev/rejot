import type {
  RouteConfig,
  SyncControllerReadRequest,
  SyncControllerReadResponse,
} from "./sync-http-service-routes";

import { syncServiceReadRoute } from "./sync-http-service-routes";

function getFetchForRoute<TRequest, TResponse>(
  route: RouteConfig,
): (host: string, request: TRequest) => Promise<TResponse> {
  return async (host: string, request: TRequest) => {
    const response = await fetch(`${host}${route.path}`, {
      method: route.method,
      body: JSON.stringify(request),
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.statusText}`);
    }
    const responseBody = await response.json();
    const parsedResponse = route.response.safeParse(responseBody);
    if (!parsedResponse.success) {
      throw new Error(`Invalid response: ${JSON.stringify(parsedResponse.error)}`);
    }
    return parsedResponse.data;
  };
}

export const fetchRead = getFetchForRoute<SyncControllerReadRequest, SyncControllerReadResponse>(
  syncServiceReadRoute,
);
