// import { type RouteConfig } from "@hono/zod-openapi";
import { type z } from "zod";

type SuccessStatusCode = 200 | 201 | 204;

type SafeRouteConfig = {
  path: string;
  method: string;
  responses: {
    [K in SuccessStatusCode]?: {
      content?: {
        "application/json": {
          schema: z.ZodSchema;
        };
      };
      description: string;
    };
  };
};

type ExtractResponseType<T extends SafeRouteConfig> = T["responses"][200] extends {
  content: { "application/json": { schema: z.ZodSchema } };
}
  ? z.infer<T["responses"][200]["content"]["application/json"]["schema"]>
  : never;

type ExtractParamsType<T extends SafeRouteConfig> = T extends { request: { params: z.ZodSchema } }
  ? z.infer<T["request"]["params"]>
  : never;

type ExtractBodyType<T extends SafeRouteConfig> = T extends {
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.ZodSchema;
        };
      };
    };
  };
}
  ? z.infer<T["request"]["body"]["content"]["application/json"]["schema"]>
  : never;

type RequestOptions<T extends SafeRouteConfig> = {
  params?: ExtractParamsType<T>;
  body?: ExtractBodyType<T>;
};

export type ApiResult<T> =
  | { status: "success"; data: T; statusCode: number }
  | { status: "error"; message: string; statusCode: number; code: string };

function replacePathParams(path: string, params?: Record<string, string>): string {
  if (!params) return path;
  return path.replace(/{([^}]+)}/g, (_, param) => {
    const value = params[param];
    if (!value) {
      throw new Error(`Missing required path parameter: ${param}`);
    }
    return value;
  });
}

export async function fetchRoute<TConfig extends SafeRouteConfig>(
  route: TConfig,
  options?: RequestOptions<TConfig>,
): Promise<ApiResult<ExtractResponseType<TConfig>>> {
  const path = replacePathParams(route.path, options?.params);
  const url = `/api${path}`;

  const requestOptions: RequestInit = {
    method: route.method.toUpperCase(),
    headers: {
      "Content-Type": "application/json",
    },
  };

  if (route.method.toUpperCase() !== "GET" && route.method.toUpperCase() !== "HEAD") {
    requestOptions.body = JSON.stringify(options?.body ?? {});
  }

  try {
    const response = await fetch(url, requestOptions);
    const statusCode = response.status;

    if (!response.ok) {
      const data = await response.json();

      return {
        status: "error",
        message: data?.message ?? `Unknown error occurred. Status: ${statusCode}`,
        code: data?.code ?? "UNKNOWN_ERROR",
        statusCode,
      };
    }

    // Handle 204 No Content
    if (statusCode === 204) {
      return {
        status: "success",
        data: null as ExtractResponseType<TConfig>,
        statusCode,
      };
    }

    const data = await response.json();

    if (__APP_VERSION__ === "dev") {
      verifySchema(route, statusCode, data);
    }

    return {
      status: "success",
      data,
      statusCode,
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unknown error occurred",
      statusCode: 500,
      code: "UNKNOWN_ERROR",
    };
  }
}

function verifySchema<TConfig extends SafeRouteConfig>(
  route: TConfig,
  statusCode: number,
  data: unknown,
) {
  const definitionForStatus = route.responses[statusCode as SuccessStatusCode];

  if (!definitionForStatus) {
    console.error(
      `[${route.method} ${route.path}] verifySchema: No definition for status ${statusCode}`,
    );
    return;
  }

  const content = definitionForStatus.content;

  if (!content) {
    console.error(
      `[${route.method} ${route.path}] verifySchema: No content for status ${statusCode}`,
    );
    return;
  }

  const schema = content["application/json"]?.schema;

  if (!schema) {
    console.error(
      `[${route.method} ${route.path}] verifySchema: No schema for status ${statusCode}`,
    );
    return;
  }

  const result = schema.safeParse(data);

  if (!result.success) {
    console.warn(
      `[${route.method} ${route.path}] verifySchema: Invalid data for status ${statusCode}`,
    );
    console.warn(result.error);
  }
}

export class FetchError extends Error {
  #code: string;
  #statusCode: number;

  constructor(message: string, code: string, statusCode: number) {
    super(message);
    this.#code = code;
    this.#statusCode = statusCode;
  }

  get code() {
    return this.#code;
  }

  get statusCode() {
    return this.#statusCode;
  }
}

export async function fetchRouteThrowing<TConfig extends SafeRouteConfig>(
  route: TConfig,
  options?: RequestOptions<TConfig>,
): Promise<ExtractResponseType<TConfig>> {
  const result = await fetchRoute(route, options);

  if (result.status === "error") {
    throw new FetchError(result.message, result.code, result.statusCode);
  }

  return result.data;
}
