import { describe, expect, test } from "bun:test";

import { z } from "zod";

import { HttpController } from "./http-controller.ts";

describe("HttpController", () => {
  describe("parseQueryParams", () => {
    test("should parse query params correctly", () => {
      const url = "http://localhost:3000/test?name=John&age=25";

      const queryParams = HttpController.parseQueryParams(
        url,
        z.object({
          name: z.string(),
          age: z.number(),
        }),
      );

      expect(queryParams).toEqual({ name: "John", age: 25 });
    });

    test("should NOT parse if hostname is omitted.", () => {
      const incompleteUrl = "/test?name=John&age=25";

      expect(() =>
        HttpController.parseQueryParams(
          incompleteUrl,
          z.object({
            name: z.string(),
            age: z.number(),
          }),
        ),
      ).toThrow();
    });

    test("should parse complex query params correctly", () => {
      const Schema = z.object({
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
      });

      const queryObject: z.infer<typeof Schema>["data"] = {
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

      const queryParams = HttpController.parseQueryParams(
        `http://localhost:3000/test?${queryString}`,
        Schema,
      );

      expect(queryParams).toEqual({
        someNumber: 10,
        someString: "test",
        data: {
          filters: [
            { field: "age", operator: "gt", value: 25 },
            { field: "score", operator: "eq", value: 100 },
          ],
          sort: { field: "name", direction: "asc" },
        },
      });
    });
  });
});
