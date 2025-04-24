import { describe, expect, mock, test } from "bun:test";

import { z } from "zod";

import type {
  IConnectionAdapter,
  IConsumerSchemaTransformationAdapter,
  OperationTransformationPair,
} from "@rejot-dev/contract/adapter";
import type { TransformedOperationWithSource } from "@rejot-dev/contract/event-store";
import type { IEventStore } from "@rejot-dev/contract/event-store";
import type { PostgresConsumerSchemaTransformationSchema } from "@rejot-dev/contract/manifest";
import type { IDataSink, TransformedOperation } from "@rejot-dev/contract/sync";
import type { IDataSource } from "@rejot-dev/contract/sync";

import { SyncManifest } from "../../../contract/manifest/sync-manifest";
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
    implements
      IConsumerSchemaTransformationAdapter<
        z.infer<typeof PostgresConsumerSchemaTransformationSchema>
      >
  {
    transformationType = "postgresql" as const;
    connectionType = "postgres" as const;
    getCursors = mock(async (_destinationDataStoreSlug: string) => []);
    applyConsumerSchemaTransformation = mock(
      async (
        _destinationDataStoreSlug: string,
        _transactionId: string,
        operationTransformationPairs: OperationTransformationPair<
          z.infer<typeof PostgresConsumerSchemaTransformationSchema>
        >[],
      ): Promise<TransformedOperationWithSource[]> =>
        operationTransformationPairs.map((pair) => pair.operation),
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
            transformations: [
              {
                transformationType: "postgresql" as const,
                table: "test_table",
                sql: "SELECT * FROM test_table WHERE id = $1",
              },
            ],
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
            destinationDataStoreSlug: "test-connection",
            transformations: [
              {
                transformationType: "postgresql" as const,
                sql: "INSERT INTO test_table (id, name) VALUES ($1, $2)",
              },
            ],
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

    const operations: TransformedOperationWithSource[] = [
      {
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
      },
    ];

    await sinkWriter.write({ operations, transactionId: "test-transaction" });

    // The operation should be transformed
    expect(transformationAdapter.applyConsumerSchemaTransformation.mock.calls).toHaveLength(1);
    expect(transformationAdapter.applyConsumerSchemaTransformation.mock.calls[0]).toEqual([
      "test-connection",
      "test-transaction",
      [
        {
          operation: operations[0],
          transformations: [
            {
              transformationType: "postgresql",
              sql: "INSERT INTO test_table (id, name) VALUES ($1, $2)",
            },
          ],
        },
      ],
    ]);
  });

  test("should throw error for unsupported transformation type", async () => {
    const manifest = createTestManifest();
    const connectionAdapter = new MockPostgresConnectionAdapter();

    // Create sink writer without transformation adapters
    const sinkWriter = new SinkWriter(manifest, [connectionAdapter], []);

    const operations: TransformedOperationWithSource[] = [
      {
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
      },
    ];

    await expect(
      sinkWriter.write({ operations, transactionId: "test-transaction" }),
    ).rejects.toThrow("No transformation adapter found for transformation type: postgresql");
  });
});
