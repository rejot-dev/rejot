import { describe, expect, test as bunTest } from "bun:test";

import { z } from "zod";

import { BunHttpController } from "./bun-http-controller.ts";
import { FastifyHttpController } from "./fastify-http-controller.ts";
import { type HttpController, type RouteConfig } from "./http-controller.ts";

const TEST_HOSTNAME = "localhost";

const test = bunTest.todoIf(process.env["SKIP_SYNC_HTTP_SERVICE_TESTS"] === "true");

describe.each([
  ["BunHttpController", BunHttpController],
  ["FastifyHttpController", FastifyHttpController],
])("%s", (_name, HttpController) => {
  function createHttpController(): HttpController {
    return new HttpController({ hostname: "localhost" });
  }

  describe("JSON body handling", () => {
    const testRoute = {
      method: "POST",
      path: "/test-json",
      jsonBody: z.object({
        name: z.string(),
        age: z.number(),
      }),
      response: z.object({
        message: z.string(),
      }),
    } satisfies RouteConfig;

    test("successfully handles valid JSON body", async () => {
      // setLogger(new ConsoleLogger(LogLevel.TRACE));
      const controller = createHttpController();
      controller.createRequest(testRoute, async ({ jsonBody }) => {
        expect(jsonBody).toEqual({ name: "Test User", age: 25 });
        return { message: "Success" };
      });

      await controller.start();

      const response = await fetch(
        `http://${TEST_HOSTNAME}:${controller.assignedPort}${testRoute.path}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Test User", age: 25 }),
        },
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({ message: "Success" });

      await controller.stop();
    });

    test("returns 400 for invalid JSON", async () => {
      const controller = createHttpController();
      controller.createRequest(testRoute, async () => ({ message: "Should not reach here" }));

      await controller.start();

      const response = await fetch(
        `http://${TEST_HOSTNAME}:${controller.assignedPort}${testRoute.path}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "invalid json",
        },
      );

      expect(response.status).toBe(400);

      await controller.stop();
    });

    test("returns 400 for JSON not matching schema", async () => {
      const controller = createHttpController();
      controller.createRequest(testRoute, async () => ({ message: "Should not reach here" }));

      await controller.start();

      const response = await fetch(
        `http://${TEST_HOSTNAME}:${controller.assignedPort}${testRoute.path}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Test User", age: "25" }), // age should be number
        },
      );

      expect(response.status).toBe(400);

      await controller.stop();
    });
  });

  describe("Query parameters handling", () => {
    const testRoute = {
      method: "GET",
      path: "/test-query",
      queryParams: z.object({
        search: z.string(),
        limit: z.coerce.number().min(1).max(1000),
      }),
      response: z.object({
        results: z.array(z.string()),
      }),
    } satisfies RouteConfig;

    test("successfully handles valid query parameters", async () => {
      const controller = createHttpController();
      controller.createRequest(testRoute, async ({ queryParams }) => {
        expect(queryParams).toEqual({ search: "test", limit: 5 });
        return { results: ["test"] };
      });

      await controller.start();

      const response = await fetch(
        `http://${TEST_HOSTNAME}:${controller.assignedPort}${testRoute.path}?search=test&limit=5`,
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({ results: ["test"] });

      await controller.stop();
    });

    test("returns 400 for missing required query parameters", async () => {
      const controller = createHttpController();
      controller.createRequest(testRoute, async () => ({ results: [] }));

      await controller.start();

      const response = await fetch(
        `http://${TEST_HOSTNAME}:${controller.assignedPort}${testRoute.path}?search=test`,
      ); // missing limit

      expect(response.status).toBe(400);

      await controller.stop();
    });

    test("returns 400 for invalid query parameters", async () => {
      const controller = createHttpController();
      controller.createRequest(testRoute, async () => ({ results: [] }));

      await controller.start();

      const response = await fetch(
        `http://${TEST_HOSTNAME}:${controller.assignedPort}${testRoute.path}?search=test&limit=invalid`,
      );

      expect(response.status).toBe(400);

      await controller.stop();
    });

    test("handles complex objects in query parameters", async () => {
      const complexQueryRoute = {
        method: "GET",
        path: "/complex-query",
        queryParams: z.object({
          someNumber: z.coerce.number().min(1).max(100),
          someString: z.string(),
          data: z.object({
            filters: z.array(
              z.object({
                field: z.string(),
                operator: z.enum(["eq", "gt", "lt"]),
                value: z.coerce.number(),
              }),
            ),
            sort: z.object({
              field: z.string(),
              direction: z.enum(["asc", "desc"]),
            }),
          }),
        }),
        response: z.object({
          applied: z.object({
            filters: z.array(z.any()),
            sort: z.any(),
          }),
        }),
      } satisfies RouteConfig;

      const controller = createHttpController();
      controller.createRequest(complexQueryRoute, async ({ queryParams }) => {
        console.log("queryParams", queryParams);
        return {
          applied: queryParams.data,
        };
      });

      await controller.start();

      const queryObject: z.infer<typeof complexQueryRoute.queryParams>["data"] = {
        filters: [
          { field: "age", operator: "gt", value: 25 },
          { field: "score", operator: "eq", value: 100 },
        ],
        sort: { field: "name", direction: "asc" },
      };

      const queryString = new URLSearchParams({
        someNumber: "10",
        someString: "test",
        data: JSON.stringify(queryObject),
      }).toString();
      console.log("queryString", queryString);

      const response = await fetch(
        `http://${TEST_HOSTNAME}:${controller.assignedPort}${complexQueryRoute.path}?${queryString}&wilco=123`,
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({
        applied: queryObject,
      });

      await controller.stop();
    });
  });

  describe("Response validation", () => {
    const testRoute = {
      method: "GET",
      path: "/test-response",
      response: z.object({
        message: z.string(),
      }),
    } satisfies RouteConfig;

    test("returns 500 for invalid response from handler", async () => {
      const controller = createHttpController();
      // Using type assertion to intentionally create an invalid response
      controller.createRequest(testRoute, async () => ({
        message: 123 as unknown as string,
      }));

      await controller.start();

      const response = await fetch(
        `http://${TEST_HOSTNAME}:${controller.assignedPort}${testRoute.path}`,
      );

      expect(response.status).toBe(500);

      await controller.stop();
    });
  });

  describe("Route handling", () => {
    test("handles multiple routes", async () => {
      const controller = createHttpController();
      const route1 = {
        method: "GET",
        path: "/route1",
        response: z.object({ message: z.string() }),
      } satisfies RouteConfig;

      const route2 = {
        method: "POST",
        path: "/route2",
        jsonBody: z.object({ data: z.string() }),
        response: z.object({ message: z.string() }),
      } satisfies RouteConfig;

      controller
        .createRequest(route1, async () => ({ message: "route1" }))
        .createRequest(route2, async () => ({ message: "route2" }));

      await controller.start();

      const response1 = await fetch(
        `http://${TEST_HOSTNAME}:${controller.assignedPort}${route1.path}`,
      );
      expect(response1.status).toBe(200);
      const data1 = await response1.json();
      expect(data1).toEqual({ message: "route1" });

      const response2 = await fetch(
        `http://${TEST_HOSTNAME}:${controller.assignedPort}${route2.path}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: "test" }),
        },
      );
      expect(response2.status).toBe(200);
      const data2 = await response2.json();
      expect(data2).toEqual({ message: "route2" });

      await controller.stop();
    });

    test("returns 404 for unknown route", async () => {
      const controller = createHttpController();
      await controller.start();

      const response = await fetch(`http://${TEST_HOSTNAME}:${controller.assignedPort}/unknown`);
      expect(response.status).toBe(404);

      await controller.stop();
    });
  });

  describe("Optional parameters handling", () => {
    test("handles route with no query params or json body", async () => {
      const controller = createHttpController();
      const simpleRoute = {
        method: "GET",
        path: "/simple",
        response: z.object({ message: z.string() }),
      } satisfies RouteConfig;

      controller.createRequest(simpleRoute, async () => {
        return { message: "simple response" };
      });

      await controller.start();

      const response = await fetch(
        `http://${TEST_HOSTNAME}:${controller.assignedPort}${simpleRoute.path}`,
      );
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({ message: "simple response" });

      await controller.stop();
    });

    test("handles route with only query params", async () => {
      const controller = createHttpController();
      const queryOnlyRoute = {
        method: "GET",
        path: "/query-only",
        queryParams: z.object({ filter: z.string() }),
        response: z.object({ filtered: z.string() }),
      } satisfies RouteConfig;

      controller.createRequest(queryOnlyRoute, async ({ queryParams }) => {
        // TypeScript should know queryParams.filter exists and is string
        return { filtered: `filtered by ${queryParams!.filter}` };
      });

      await controller.start();

      const response = await fetch(
        `http://${TEST_HOSTNAME}:${controller.assignedPort}${queryOnlyRoute.path}?filter=test`,
      );
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({ filtered: "filtered by test" });

      await controller.stop();
    });

    test("handles route with only json body", async () => {
      const controller = createHttpController();
      const jsonOnlyRoute = {
        method: "POST",
        path: "/json-only",
        jsonBody: z.object({ data: z.string() }),
        response: z.object({ processed: z.string() }),
      } satisfies RouteConfig;

      controller.createRequest(jsonOnlyRoute, async ({ jsonBody }) => {
        // TypeScript should know jsonBody.data exists and is string
        return { processed: `processed ${jsonBody!.data}` };
      });

      await controller.start();

      const response = await fetch(
        `http://${TEST_HOSTNAME}:${controller.assignedPort}${jsonOnlyRoute.path}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: "test data" }),
        },
      );
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({ processed: "processed test data" });

      await controller.stop();
    });

    test("ignores query params when schema not defined", async () => {
      const controller = createHttpController();
      const noQueryParamsRoute = {
        method: "GET",
        path: "/no-query",
        response: z.object({ message: z.string() }),
      } satisfies RouteConfig;

      controller.createRequest(noQueryParamsRoute, async () => {
        return { message: "ok" };
      });

      await controller.start();

      // Should work even with query params present
      const response = await fetch(
        `http://${TEST_HOSTNAME}:${controller.assignedPort}${noQueryParamsRoute.path}?unused=param`,
      );
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({ message: "ok" });

      await controller.stop();
    });

    test("rejects json body when schema not defined", async () => {
      const controller = createHttpController();
      const noJsonBodyRoute = {
        method: "POST",
        path: "/no-json",
        response: z.object({ message: z.string() }),
      } satisfies RouteConfig;

      controller.createRequest(noJsonBodyRoute, async () => {
        return { message: "ok" };
      });

      await controller.start();

      const response = await fetch(
        `http://${TEST_HOSTNAME}:${controller.assignedPort}${noJsonBodyRoute.path}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ some: "data" }),
        },
      );

      // Since no JSON body schema is defined, the request should be handled without parsing the body
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({ message: "ok" });

      await controller.stop();
    });
  });
});
