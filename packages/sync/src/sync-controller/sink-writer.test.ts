import { describe, expect, mock, test } from "bun:test";

import { z } from "zod";

import type {
  IConnectionAdapter,
  IConsumerSchemaTransformationAdapter,
} from "@rejot-dev/contract/adapter";
import type { TransformedOperationWithSource } from "@rejot-dev/contract/event-store";
import type { IEventStore } from "@rejot-dev/contract/event-store";
import type {
  ConsumerSchemaConfigSchema,
  ConsumerSchemaSchema,
} from "@rejot-dev/contract/manifest";
import type { IDataSink, TransformedOperation } from "@rejot-dev/contract/sync";
import type { IDataSource } from "@rejot-dev/contract/sync";
import { SyncManifest } from "@rejot-dev/contract/sync-manifest";

import { SinkWriter } from "./sink-writer.ts";

describe("SinkWriter", () => {
  type PostgresConfig = {
    connectionType: "postgres";
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  };

  type PostgresDataStoreConfig = {
    connectionType: "postgres";
    slotName: string;
    publicationName: string;
  };

  // Mock PostgreSQL sink
  class MockPostgresSink implements IDataSink {
    connectionType = "postgres" as const;
    writeData = mock(async (_operation: TransformedOperation) => {});
    prepare = mock(async () => {});
    close = mock(async () => {});
  }

  // Mock PostgreSQL connection adapter
  class MockPostgresConnectionAdapter
    implements
      IConnectionAdapter<
        PostgresConfig,
        PostgresDataStoreConfig,
        IDataSource,
        MockPostgresSink,
        IEventStore
      >
  {
    connectionType = "postgres" as const;
    createSink = mock((_connectionSlug: string, _config: PostgresConfig) => new MockPostgresSink());
    createSource = mock(() => {
      throw new Error("Not implemented");
    });
    createEventStore = mock(() => {
      throw new Error("Not implemented");
    });
    getOrCreateConnection = mock((_connectionSlug: string, _config: PostgresConfig) => ({
      slug: _connectionSlug,
      config: _config,
      prepare: async () => {},
      close: async () => {},
    }));
  }

  // Mock PostgreSQL transformation adapter
  class MockPostgresTransformationAdapter
    implements IConsumerSchemaTransformationAdapter<z.infer<typeof ConsumerSchemaConfigSchema>>
  {
    transformationType = "postgres" as const;
    connectionType = "postgres" as const;
    getCursors = mock(async (_destinationDataStoreSlug: string) => []);
    applyConsumerSchemaTransformation = mock(
      async (
        _destinationDataStoreSlug: string,
        _transactionId: string,
        operations: TransformedOperation[],
        _consumerSchemas: z.infer<typeof ConsumerSchemaSchema>[],
      ): Promise<TransformedOperationWithSource[]> =>
        operations.map((operation) => ({
          ...operation,
          sourceManifestSlug: "test-manifest",
          sourcePublicSchema: {
            name: "test-schema",
            version: {
              major: 1,
              minor: 0,
            },
          },
        })),
    );
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
            config: {
              publicSchemaType: "postgres" as const,
              transformations: [
                {
                  operation: "insert" as const,
                  table: "test_table",
                  sql: "SELECT * FROM test_table WHERE id = $1",
                },
              ],
            },
            version: {
              major: 1,
              minor: 0,
            },
          },
        ],
        consumerSchemas: [
          {
            name: "test-consumer-schema",
            sourceManifestSlug: "test-manifest",
            publicSchema: {
              name: "test-schema",
              majorVersion: 1,
            },
            config: {
              consumerSchemaType: "postgres" as const,
              destinationDataStoreSlug: "test-connection",
              sql: "INSERT INTO test_table (id, name) VALUES ($1, $2)",
            },
          },
        ],
      },
    ]);

  test("should create sinks on initialization", () => {
    const manifest = createTestManifest();
    const connectionAdapter = new MockPostgresConnectionAdapter();

    const sinkWriter = new SinkWriter(
      manifest,
      [connectionAdapter],
      [new MockPostgresTransformationAdapter()],
    );

    expect(sinkWriter.hasSinks).toBe(true);
    expect(connectionAdapter.createSink.mock.calls).toHaveLength(1);
    expect(connectionAdapter.createSink.mock.calls[0]).toEqual([
      "test-connection",
      {
        connectionType: "postgres",
        host: "localhost",
        port: 5432,
        database: "test",
        user: "test",
        password: "test",
      },
    ]);
  });

  test("should prepare and close all sinks", async () => {
    const manifest = createTestManifest();
    const connectionAdapter = new MockPostgresConnectionAdapter();
    const sink = new MockPostgresSink();
    connectionAdapter.createSink = mock(() => sink);

    const sinkWriter = new SinkWriter(
      manifest,
      [connectionAdapter],
      [new MockPostgresTransformationAdapter()],
    );

    await sinkWriter.prepare();
    expect(sink.prepare.mock.calls).toHaveLength(1);

    await sinkWriter.close();
    expect(sink.close.mock.calls).toHaveLength(1);
  });

  test("should transform operations", async () => {
    const manifest = createTestManifest();
    const connectionAdapter = new MockPostgresConnectionAdapter();
    const transformationAdapter = new MockPostgresTransformationAdapter();

    const sinkWriter = new SinkWriter(manifest, [connectionAdapter], [transformationAdapter]);

    const operations: TransformedOperation[] = [
      {
        type: "insert",
        object: { id: 1, name: "test" },
        sourceManifestSlug: "test-manifest",
        sourcePublicSchema: {
          name: "test-schema",
          version: {
            major: 1,
            minor: 0,
          },
        },
      },
    ];

    await sinkWriter.write({ operations, transactionId: "test-transaction" });

    // The operation should be transformed
    expect(transformationAdapter.applyConsumerSchemaTransformation.mock.calls).toHaveLength(1);
    const [destSlug, txId, ops, schemas] =
      transformationAdapter.applyConsumerSchemaTransformation.mock.calls[0];
    expect(destSlug).toBe("test-connection");
    expect(txId).toBe("test-transaction");
    expect(ops).toEqual(operations);
    expect(schemas).toEqual([manifest.getConsumerSchemasForPublicSchema(operations[0])[0]]);
  });

  test("should throw error for unsupported transformation type", async () => {
    const manifest = createTestManifest();
    const connectionAdapter = new MockPostgresConnectionAdapter();

    // Create sink writer without transformation adapters
    const sinkWriter = new SinkWriter(manifest, [connectionAdapter], []);

    const operations: TransformedOperation[] = [
      {
        type: "insert",
        object: { id: 1, name: "test" },
        sourceManifestSlug: "test-manifest",
        sourcePublicSchema: {
          name: "test-schema",
          version: {
            major: 1,
            minor: 0,
          },
        },
      },
    ];

    await expect(
      sinkWriter.write({ operations, transactionId: "test-transaction" }),
    ).rejects.toThrow("No consumer schema adapter found for consumer schema type: postgres");
  });
});
