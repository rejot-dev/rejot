import { test, expect, describe } from "bun:test";
import { PublicSchemaTransformer } from "./public-schema-transformer";
import type { IPublicSchemaTransformationAdapter } from "@rejot/contract/adapter";
import type { Transaction, TableOperation, TransformedOperation } from "@rejot/contract/sync";
import { SyncManifest } from "../../../contract/manifest/sync-manifest";
import type { PostgresPublicSchemaTransformationSchema } from "@rejot/adapter-postgres/schemas";
import { z } from "zod";

describe("PublicSchemaTransformer", () => {
  // Mock PostgreSQL transformation adapter
  class MockPostgresTransformationAdapter
    implements
      IPublicSchemaTransformationAdapter<z.infer<typeof PostgresPublicSchemaTransformationSchema>>
  {
    transformationType = "postgresql" as const;

    async applyPublicSchemaTransformation(
      _dataStoreSlug: string,
      operation: TableOperation,
      _transformation: z.infer<typeof PostgresPublicSchemaTransformationSchema>,
    ): Promise<TransformedOperation> {
      if (operation.type === "delete") {
        return {
          type: "delete",
          keyColumns: operation.keyColumns,
        };
      }
      return {
        type: operation.type,
        keyColumns: operation.keyColumns,
        object: operation.new,
      };
    }
  }

  const createTestManifest = () =>
    new SyncManifest([
      {
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
            publicationName: "test-publication",
            slotName: "test-slot",
          },
        ],
        eventStores: [],
        publicSchemas: [
          {
            name: "test-schema",
            source: {
              dataStoreSlug: "test-connection",
              tables: ["test_table"],
            },
            outputSchema: {
              type: "object",
              properties: {
                id: { type: "number" },
                name: { type: "string" },
              },
              required: ["id", "name"],
            },
            transformation: {
              transformationType: "postgresql" as const,
              table: "test_table",
              sql: "SELECT * FROM test_table WHERE id = $1",
            },
            version: {
              major: 1,
              minor: 0,
            },
          },
        ],
        consumerSchemas: [],
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
          tableSchema: "public",
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
          tableSchema: "public",
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
          tableSchema: "public",
          new: { id: 1, name: "test" },
        },
      ],
      ack: () => {},
    };

    await expect(
      transformer.transformToPublicSchema("test-connection", transaction),
    ).rejects.toThrow("No transformation adapter found for transformation type: postgresql");
  });
});
