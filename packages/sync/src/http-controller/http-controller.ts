import { type z, ZodError, ZodType } from "zod";

import { HTTPBadRequestError, HTTPBaseError } from "./http-service-errors.ts";

export interface ServerConfig {
  hostname?: string;
  port?: number;
}

// TODO: the undefined shouldn't be in this object at all.
export type RequestParams<T extends RouteConfig> = {
  queryParams: T["queryParams"] extends ZodType ? z.infer<T["queryParams"]> : undefined;
  jsonBody: T["jsonBody"] extends ZodType ? z.infer<T["jsonBody"]> : undefined;
};

export type RouteHandler<T extends RouteConfig> = (
  params: RequestParams<T>,
) => Promise<z.infer<T["response"]>>;

export type RouteConfig = {
  method: "POST" | "GET" | "PUT" | "DELETE";
  path: string;
  queryParams?: ZodType;
  jsonBody?: ZodType;
  response: ZodType;
};

export abstract class HttpController {
  protected readonly requestedHostname: string;
  protected readonly requestedPort: number;

  readonly routeHandlers: Map<RouteConfig, RouteHandler<RouteConfig>> = new Map();

  constructor({ hostname, port }: ServerConfig) {
    this.requestedHostname = hostname ?? "localhost";
    this.requestedPort = port ?? 0;
  }

  createRequest<T extends RouteConfig>(routeConfig: T, callback: RouteHandler<T>): this {
    this.routeHandlers.set(routeConfig, callback);
    return this;
  }

  get routeConfigs(): RouteConfig[] {
    return Array.from(this.routeHandlers.keys());
  }

  /** Resolves when the server is stopped using stop() */
  abstract get promise(): Promise<void>;
  abstract get assignedPort(): number;
  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;

  /**
   * Safely parses a JSON request body against the supplied Zod schema.
   * Throws an HTTPBadRequestError if parsing fails.
   */
  protected async parseJSONRequest<T>(request: Request, schema: ZodType<T>): Promise<T> {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new HTTPBadRequestError("Invalid JSON");
    }

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new HTTPBadRequestError(parsed.error.message);
    }

    return parsed.data;
  }

  /**
   * Safely parses query parameters against the supplied Zod schema.
   * Throws an HTTPBadRequestError if parsing fails.
   */
  static parseQueryParams<T>(url: string, schema: ZodType<T>): T {
    const urlObj = new URL(url);

    const obj: Record<string, unknown> = {};

    for (const [key, value] of urlObj.searchParams.entries()) {
      try {
        obj[key] = JSON.parse(value);
      } catch {
        obj[key] = value;
      }
    }

    const parsed = schema.safeParse(obj);
    if (!parsed.success) {
      throw new HTTPBadRequestError(parsed.error.message);
    }

    return parsed.data;
  }

  protected async wrapRequest<T extends RouteConfig>(
    req: Request,
    routeConfig: T,
    callback: RouteHandler<T>,
  ): Promise<Response> {
    if (req.method !== routeConfig.method) {
      return new Response("Method not allowed", { status: 405 });
    }

    try {
      const requestData = {} as RequestParams<T>;
      if (routeConfig.queryParams) {
        requestData.queryParams = HttpController.parseQueryParams(req.url, routeConfig.queryParams);
      }
      if (routeConfig.jsonBody) {
        requestData.jsonBody = await this.parseJSONRequest(req, routeConfig.jsonBody);
      }

      const responseObject = await callback(requestData);
      const parsedResponse = routeConfig.response.parse(responseObject);
      return Response.json(parsedResponse);
    } catch (error) {
      if (error instanceof HTTPBaseError) {
        return new Response(error.message, { status: error.status });
      }

      if (error instanceof ZodError) {
        console.error("Zod error when validating RESPONSE. Programming error.", { error });
        return new Response("Something went wrong creating the response.", { status: 500 });
      }

      return new Response("Internal server error", { status: 500 });
    }
  }

  protected createRoutes(): Record<string, { [key: string]: (req: Request) => Promise<Response> }> {
    const routes: Record<string, { [key: string]: (req: Request) => Promise<Response> }> = {};

    for (const routeConfig of this.routeHandlers.keys()) {
      const handler = this.routeHandlers.get(routeConfig);
      if (!handler) {
        throw new Error(`No handler found for route: ${routeConfig.path}`);
      }

      routes[routeConfig.path] = {
        [routeConfig.method]: async (req: Request) => {
          return this.wrapRequest(req, routeConfig, handler);
        },
      };
    }

    return routes;
  }
}
