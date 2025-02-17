import { NewPublicationSchema, PublicationSchema } from "../publication/publication.ts";
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";
import { appInjector } from "../injector.ts";

const app = new OpenAPIHono();
const publicationService = appInjector.resolve("publicationService");

const IdParam = z.object({
  id: z
    .string().nonempty()
    .openapi({
      param: {
        name: "id",
        in: "path",
      },
      example: "123",
    }),
});

const createPublishRoute = createRoute({
  method: "post",
  path: "/",
  request: {
    body: {
      content: {
        "application/json": {
          schema: NewPublicationSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            created: z.string(),
          }),
        },
      },
      description: "Publication created successfully",
    },
  },
  tags: ["publish"],
  description: "Create a new publication",
});

app.openapi(createPublishRoute, async (c) => {
  const newModel = c.req.valid("json");

  const id = await publicationService.createPublication(newModel);

  if (!id.success) {
    throw new HTTPException(500, {
      message: id.error,
    });
  }

  return c.json({
    success: true,
    created: id.data,
  });
});

const getPublishRoute = createRoute({
  method: "get",
  path: "/{id}",
  request: {
    params: IdParam,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: PublicationSchema,
        },
      },
      description: "Model retrieved successfully",
    },
  },
  tags: ["publish"],
  description: "Get a Publication by ID",
});

app.openapi(getPublishRoute, async (c) => {
  const { id } = c.req.valid("param");
  const pubResult = await publicationService.getPublicationById(id);
  if (!pubResult.success) {
    throw new HTTPException(404, {
      message: pubResult.error,
    });
  }
  return c.json(pubResult.data);
});

export default app;
