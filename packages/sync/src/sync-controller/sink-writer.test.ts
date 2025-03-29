import { test, expect, describe, mock } from "bun:test";
import { SinkWriter } from "./sink-writer";
import type {
  IConnectionAdapter,
  IConsumerSchemaTransformationAdapter,
} from "@rejot/contract/adapter";
import type { IDataSink, TransformedOperation } from "@rejot/contract/sync";
import type { TransformedOperationWithSource } from "@rejot/contract/event-store";
import { SyncManifest } from "../../../contract/manifest/sync-manifest";
import type { PostgresConsumerSchemaTransformationSchema } from "@rejot/adapter-postgres/schemas";
import type { IEventStore } from "@rejot/contract/event-store";
import type { IDataSource } from "@rejot/contract/sync";
import { z } from "zod";

describe("SinkWriter", () => {
  type PostgresConfig = {
    connectionType: "postgres";
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
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
    implements IConnectionAdapter<PostgresConfig, IDataSource, MockPostgresSink, IEventStore>
  {
    connectionType = "postgres" as const;
    createSink = mock((_connectionSlug: string, _config: PostgresConfig) => new MockPostgresSink());
    createSource = mock(() => {
      throw new Error("Not implemented");
    });
    createEventStore = mock(() => {
      throw new Error("Not implemented");
    });
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
        operation: TransformedOperationWithSource,
        _transformation: z.infer<typeof PostgresConsumerSchemaTransformationSchema>,
      ): Promise<TransformedOperationWithSource> => operation,
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
        consumerSchemas: [
          {
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
        sourceDataStoreSlug: "test-connection",
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
      operations[0],
      {
        transformationType: "postgresql",
        sql: "INSERT INTO test_table (id, name) VALUES ($1, $2)",
      },
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
        sourceDataStoreSlug: "test-connection",
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
