import type { z } from "zod";

export type InferApiSchema<T> = T extends { content: { "application/json": { schema: infer S } } }
  ? z.infer<S extends z.ZodType ? S : never>
  : never;

export type InferRouteConfig<T> = {
  params: T extends { request: { params: infer P extends z.ZodSchema } } ? z.infer<P> : never;
  body: T extends {
    request: {
      body: {
        content: {
          "application/json": {
            schema: infer B extends z.ZodSchema;
          };
        };
      };
    };
  }
    ? z.infer<B>
    : never;
  response: T extends {
    responses: {
      [K in 200 | 201 | 204]: {
        content?: {
          "application/json": {
            schema: infer R extends z.ZodSchema;
          };
        };
      };
    };
  }
    ? z.infer<R>
    : never;
  method: T extends { method: infer M } ? M : never;
  path: T extends { path: infer P } ? P : never;
};
