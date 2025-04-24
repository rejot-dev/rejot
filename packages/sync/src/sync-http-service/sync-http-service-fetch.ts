import { z } from "zod";

import type { RequestParams, RouteConfig } from "../http-controller/http-controller.ts";
import { publicSchemasRoute, syncServiceReadRoute } from "./sync-http-service-routes.ts";

function getFetchForRoute<T extends RouteConfig>(
  route: T,
): (host: string, ssl: boolean, request: RequestParams<T>) => Promise<z.infer<T["response"]>> {
  return async (host: string, ssl: boolean, request: RequestParams<T>) => {
    const protocol = ssl ? "https" : "http";
    const url = new URL(`${protocol}://${host}${route.path}`);

    // Add query parameters if they exist
    if (request.queryParams) {
      Object.entries(request.queryParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          try {
            url.searchParams.append(key, JSON.stringify(value));
          } catch {
            url.searchParams.append(key, String(value));
          }
        }
      });
    }

    const init: RequestInit = {
      method: route.method,
      headers: {
        "Content-Type": "application/json",
      },
    };

    // Add JSON body if it exists
    if (request.jsonBody) {
      init.body = JSON.stringify(request.jsonBody);
    }

    const response = await fetch(url.toString(), init);
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

export const fetchRead = getFetchForRoute(syncServiceReadRoute);
export const fetchPublicSchemas = getFetchForRoute(publicSchemasRoute);
