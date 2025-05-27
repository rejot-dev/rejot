import { describe, expect, test } from "bun:test";

import { z } from "zod";

import type { AnyIPublicSchemaTransformationAdapter } from "@rejot-dev/contract/adapter";
import { PublicSchemaSchema } from "@rejot-dev/contract/manifest";
import type { TableOperation, Transaction, TransformedOperation } from "@rejot-dev/contract/sync";
import { SyncManifest } from "@rejot-dev/contract/sync-manifest";

import { PublicSchemaTransformer } from "./public-schema-transformer.ts";

describe("PublicSchemaTransformer", () => {
  // Mock Postgres transformation adapter
  class MockPostgresTransformationAdapter implements AnyIPublicSchemaTransformationAdapter {
    transformationType = "postgres" as const;

    async applyPublicSchemaTransformation(
      _sourceDataStoreSlug: string,
      operations: TableOperation[],
      publicSchemas: Array<z.infer<typeof PublicSchemaSchema>>,
    ): Promise<TransformedOperation[]> {
      // For each operation, return a transformed operation with required fields
      return operations.map((operation) => {
        const publicSchema = publicSchemas[0];
        if (operation.type === "delete") {
          return {
            type: "delete",
            sourceManifestSlug: "test-manifest",
            sourcePublicSchema: {
              name: publicSchema.name,
              version: publicSchema.version,
            },
            objectKeys: operation.oldKeys || {},
          };
        }
        return {
          type: operation.type,
          sourceManifestSlug: "test-manifest",
          sourcePublicSchema: {
            name: publicSchema.name,
            version: publicSchema.version,
          },
          object: operation.new,
        };
      });
    }
  }

  const createTestManifest = () =>
    new SyncManifest([
      {
        path: "test-manifest.json",
        manifest: {
          slug: "test-manifest",
          manifestVersion: 1,
          connections: [
            {
              slug: "test-connection",
              config: {
                connectionType: "postgres" as const,
                host: "localhost",
                port: 5432,
                database: "test",
                user: "test",
                password: "test",
              },
            },
          ],
          dataStores: [
            {
              connectionSlug: "test-connection",
              config: {
                connectionType: "postgres" as const,
                publicationName: "test-publication",
                slotName: "test-slot",
              },
            },
          ],
          eventStores: [],
          publicSchemas: [
            {
              name: "test-schema",
              source: {
                dataStoreSlug: "test-connection",
              },
              outputSchema: {
                type: "object",
                properties: {
                  id: { type: "number" },
                  name: { type: "string" },
                },
                required: ["id", "name"],
              },
              version: {
                major: 1,
                minor: 0,
              },
              config: {
                publicSchemaType: "postgres",
                transformations: [
                  {
                    operation: "insert",
                    table: "test_table",
                    sql: "SELECT * FROM test_table WHERE id = $1",
                  },
                  {
                    operation: "delete",
                    table: "test_table",
                    sql: "DELETE FROM test_table WHERE id = $1",
                  },
                ],
              },
            },
          ],
          consumerSchemas: [],
        },
      },
    ]);

  test("should transform insert operation to public schema", async () => {
    const manifest = createTestManifest();
    const transformer = new PublicSchemaTransformer(manifest, [
      new MockPostgresTransformationAdapter(),
    ]);

    const transaction: Transaction = {
      id: "test-1",
      operations: [
        {
          type: "insert",
          keyColumns: ["id"],
          table: "test_table",
          new: { id: 1, name: "test" },
        },
      ],
      ack: () => {},
    };

    const result = await transformer.transformToPublicSchema("test-connection", transaction);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      type: "insert",
      sourceManifestSlug: "test-manifest",
      sourcePublicSchema: {
        name: "test-schema",
        version: {
          major: 1,
          minor: 0,
        },
      },
      object: { id: 1, name: "test" },
    });
  });

  test("should transform delete operation to public schema", async () => {
    const manifest = createTestManifest();
    const transformer = new PublicSchemaTransformer(manifest, [
      new MockPostgresTransformationAdapter(),
    ]);

    const transaction: Transaction = {
      id: "test-2",
      operations: [
        {
          type: "delete",
          keyColumns: ["id"],
          table: "test_table",
          oldKeys: { id: 1 },
        },
      ],
      ack: () => {},
    };

    const result = await transformer.transformToPublicSchema("test-connection", transaction);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      type: "delete",
      sourceManifestSlug: "test-manifest",
      sourcePublicSchema: {
        name: "test-schema",
        version: {
          major: 1,
          minor: 0,
        },
      },
      objectKeys: { id: 1 },
    });
  });

  test("should throw error for unsupported transformation type", async () => {
    const manifest = createTestManifest();
    // Create transformer with empty adapter array
    const transformer = new PublicSchemaTransformer(manifest, []);

    const transaction: Transaction = {
      id: "test-3",
      operations: [
        {
          type: "insert",
          keyColumns: ["id"],
          table: "test_table",
          new: { id: 1, name: "test" },
        },
      ],
      ack: () => {},
    };

    await expect(
      transformer.transformToPublicSchema("test-connection", transaction),
    ).rejects.toThrow("No transformation adapter found for transformation type: postgres");
  });
});
