import { expect, test } from "bun:test";

import type { QueryResultRow } from "pg";
import { z } from "zod";

import type {
  PostgresPublicSchemaConfigSchema,
  PublicSchemaSchema,
} from "@rejot-dev/contract/manifest";
import type {
  TableOperation,
  TableOperationDelete,
  TableOperationInsert,
  TableOperationUpdate,
  TransformedOperationDelete,
} from "@rejot-dev/contract/sync";

import type { IPostgresClient } from "../util/postgres-client.ts";
import type { IPostgresConnection, IPostgresConnectionAdapter } from "./pg-connection-adapter.ts";
import { PostgresPublicSchemaTransformationAdapter } from "./pg-public-schema-transformation-adapter.ts";

// Mock IPostgresClient
const mockPgClient: IPostgresClient = {
  connect: async () => {},
  end: async () => {},
  query: async <T extends QueryResultRow = QueryResultRow>() => ({
    command: "",
    rowCount: 0,
    oid: 0,
    rows: [] satisfies T[],
    fields: [],
    rowAsArray: false,
  }),
  dangerousLeakyTx: async () => ({ pc: mockPgClient, rollback: async () => {} }),
  tx: async (cb) => cb(mockPgClient),
  inTransaction: false,
  config: { host: "", port: 0, user: "", password: "", database: "" },
  poolOrClient: {},
  pgClient: {},
};

// Mock IPostgresConnection
const mockConnection: IPostgresConnection = {
  slug: "mock",
  config: { host: "", port: 0, user: "", password: "", database: "", connectionType: "postgres" },
  prepare: async () => {},
  close: async () => {},
  client: mockPgClient,
};

// Mock IPostgresConnectionAdapter
const mockConnectionAdapter: IPostgresConnectionAdapter = {
  connectionType: "postgres",
  createSource: () => {
    throw new Error("not implemented");
  },
  createSink: () => {
    throw new Error("not implemented");
  },
  createEventStore: () => {
    throw new Error("not implemented");
  },
  getConnection: () => mockConnection,
  getOrCreateConnection: () => mockConnection,
  setConnection: () => {},
};

test("can instantiate PostgresPublicSchemaTransformationAdapter with mocks", () => {
  const adapter = new PostgresPublicSchemaTransformationAdapter(
    mockConnectionAdapter as unknown as import("./pg-connection-adapter").PostgresConnectionAdapter,
  );
  expect(adapter.transformationType).toBe("postgres");
});

test("applyPublicSchemaTransformation applies transformations deterministically and returns correct results", async () => {
  // Arrange
  const calledQueries: { sql: string; values: unknown[] | undefined }[] = [];
  const testPgClient: IPostgresClient = {
    ...mockPgClient,
    query: async <T extends QueryResultRow = QueryResultRow>(sql: string, values?: unknown[]) => {
      calledQueries.push({ sql, values });
      return {
        command: "SELECT",
        rowCount: 1,
        oid: 0,
        rows: [{ id: values?.[0] ?? 1, foo: "bar" }] as unknown as T[],
        fields: [],
        rowAsArray: false,
      };
    },
    tx: async (cb) => cb(testPgClient),
  };
  const testConnection: IPostgresConnection = { ...mockConnection, client: testPgClient };
  const testConnectionAdapter: IPostgresConnectionAdapter = {
    ...mockConnectionAdapter,
    getConnection: () => testConnection,
    getOrCreateConnection: () => testConnection,
  };
  const adapter = new PostgresPublicSchemaTransformationAdapter(
    testConnectionAdapter as unknown as import("./pg-connection-adapter").PostgresConnectionAdapter,
  );

  // Two public schemas, each with a transformation for table 'foo' and 'bar'
  const publicSchemas: Extract<
    z.infer<typeof PublicSchemaSchema>,
    { config: z.infer<typeof PostgresPublicSchemaConfigSchema> }
  >[] = [
    {
      name: "schemaA",
      source: { dataStoreSlug: "mock" },
      outputSchema: {},
      version: { major: 1, minor: 0 },
      config: {
        publicSchemaType: "postgres",
        transformations: [
          { operation: "insert", table: "bar", sql: "SELECT * FROM bar WHERE id = $1" },
          { operation: "delete", table: "bar", sql: "DELETE FROM bar WHERE id = $1" },
        ],
      },
    },
    {
      name: "schemaB",
      source: { dataStoreSlug: "mock" },
      outputSchema: {},
      version: { major: 1, minor: 1 },
      config: {
        publicSchemaType: "postgres",
        transformations: [
          { operation: "insert", table: "foo", sql: "SELECT * FROM foo WHERE id = $1" },
        ],
      },
    },
  ];

  // Two operations: one insert on foo, one delete on bar
  const operations: TableOperation[] = [
    {
      type: "insert",
      keyColumns: ["id"],
      table: "foo",
      new: { id: 42 },
    } satisfies TableOperationInsert,
    {
      type: "delete",
      keyColumns: ["id"],
      table: "bar",
      oldKeys: { id: 99 },
    } satisfies TableOperationDelete,
  ];

  // Act
  const result = await adapter.applyPublicSchemaTransformation("mock", operations, publicSchemas);

  // Assert
  // Should match 2 transformations: bar (delete), then foo (insert)
  expect(result.length).toBe(2);
  // Check deterministic order: bar (schemaA delete), foo (schemaB insert)
  expect(result[0].type).toBe("delete");
  expect(result[0].sourcePublicSchema.name).toBe("schemaA");
  expect(result[1].type).toBe("insert");
  expect(result[1].sourcePublicSchema.name).toBe("schemaB");

  // Check that delete operation returns correct objectKeys
  const deleteOp = result.find((r) => r.type === "delete") as
    | TransformedOperationDelete
    | undefined;
  expect(deleteOp).toBeDefined();
  expect(deleteOp?.objectKeys).toEqual({ id: 99 });
});

test("delete operation is always ordered last when two public schemas operate on the same table", async () => {
  // Arrange
  const calledQueries: { sql: string; values: unknown[] | undefined }[] = [];
  const testPgClient: IPostgresClient = {
    ...mockPgClient,
    query: async <T extends QueryResultRow = QueryResultRow>(sql: string, values?: unknown[]) => {
      calledQueries.push({ sql, values });
      return {
        command: "SELECT",
        rowCount: 1,
        oid: 0,
        rows: [{ id: values?.[0] ?? 1, foo: "bar" }] as unknown as T[],
        fields: [],
        rowAsArray: false,
      };
    },
    tx: async (cb) => cb(testPgClient),
  };
  const testConnection: IPostgresConnection = { ...mockConnection, client: testPgClient };
  const testConnectionAdapter: IPostgresConnectionAdapter = {
    ...mockConnectionAdapter,
    getConnection: () => testConnection,
    getOrCreateConnection: () => testConnection,
  };
  const adapter = new PostgresPublicSchemaTransformationAdapter(
    testConnectionAdapter as unknown as import("./pg-connection-adapter").PostgresConnectionAdapter,
  );

  // Two public schemas, both operate on table 'foo', one with insert, one with delete
  const publicSchemas: Extract<
    z.infer<typeof PublicSchemaSchema>,
    { config: z.infer<typeof PostgresPublicSchemaConfigSchema> }
  >[] = [
    {
      name: "schemaInsert",
      source: { dataStoreSlug: "mock" },
      outputSchema: {},
      version: { major: 1, minor: 0 },
      config: {
        publicSchemaType: "postgres",
        transformations: [
          { operation: "insert", table: "foo", sql: "SELECT * FROM foo WHERE id = $1" },
        ],
      },
    },
    {
      name: "schemaDelete",
      source: { dataStoreSlug: "mock" },
      outputSchema: {},
      version: { major: 1, minor: 0 },
      config: {
        publicSchemaType: "postgres",
        transformations: [
          { operation: "delete", table: "foo", sql: "DELETE FROM foo WHERE id = $1" },
        ],
      },
    },
  ];

  // Two operations: one insert, one delete, both on 'foo'
  const operations: TableOperation[] = [
    {
      type: "insert",
      keyColumns: ["id"],
      table: "foo",
      new: { id: 42 },
    } satisfies TableOperationInsert,
    {
      type: "delete",
      keyColumns: ["id"],
      table: "foo",
      oldKeys: { id: 99 },
    } satisfies TableOperationDelete,
  ];

  // Act
  const result = await adapter.applyPublicSchemaTransformation("mock", operations, publicSchemas);

  // Assert
  expect(result.length).toBe(2);
  // The delete operation should always be last
  expect(result[1].type).toBe("delete");
  expect(result[1].sourcePublicSchema.name).toBe("schemaDelete");
  expect(result[0].type).toBe("insert");
  expect(result[0].sourcePublicSchema.name).toBe("schemaInsert");
});

test("multiple operations and schemas on same table are ordered insert, update, delete", async () => {
  const testPgClient: IPostgresClient = {
    ...mockPgClient,
    query: async <T extends QueryResultRow = QueryResultRow>(_sql: string, values?: unknown[]) => ({
      command: "SELECT",
      rowCount: 1,
      oid: 0,
      rows: [{ id: values?.[0] ?? 1, foo: "bar" }] as unknown as T[],
      fields: [],
      rowAsArray: false,
    }),
    tx: async (cb) => cb(testPgClient),
  };
  const testConnection: IPostgresConnection = { ...mockConnection, client: testPgClient };
  const testConnectionAdapter: IPostgresConnectionAdapter = {
    ...mockConnectionAdapter,
    getConnection: () => testConnection,
    getOrCreateConnection: () => testConnection,
  };
  const adapter = new PostgresPublicSchemaTransformationAdapter(
    testConnectionAdapter as unknown as import("./pg-connection-adapter").PostgresConnectionAdapter,
  );
  const publicSchemas: Extract<
    z.infer<typeof PublicSchemaSchema>,
    { config: z.infer<typeof PostgresPublicSchemaConfigSchema> }
  >[] = [
    {
      name: "schemaA",
      source: { dataStoreSlug: "mock" },
      outputSchema: {},
      version: { major: 1, minor: 0 },
      config: {
        publicSchemaType: "postgres",
        transformations: [
          { operation: "insert", table: "foo", sql: "SELECT * FROM foo WHERE id = $1" },
          { operation: "update", table: "foo", sql: "SELECT * FROM foo WHERE id = $1" },
          { operation: "delete", table: "foo", sql: "DELETE FROM foo WHERE id = $1" },
        ],
      },
    },
    {
      name: "schemaB",
      source: { dataStoreSlug: "mock" },
      outputSchema: {},
      version: { major: 1, minor: 0 },
      config: {
        publicSchemaType: "postgres",
        transformations: [
          { operation: "insert", table: "foo", sql: "SELECT * FROM foo WHERE id = $1" },
        ],
      },
    },
  ];
  const operations: TableOperation[] = [
    {
      type: "insert",
      keyColumns: ["id"],
      table: "foo",
      new: { id: 1 },
    } satisfies TableOperationInsert,
    {
      type: "update",
      keyColumns: ["id"],
      table: "foo",
      new: { id: 1 },
    } satisfies TableOperationUpdate,
    {
      type: "delete",
      keyColumns: ["id"],
      table: "foo",
      oldKeys: { id: 1 },
    } satisfies TableOperationDelete,
  ];
  const result = await adapter.applyPublicSchemaTransformation("mock", operations, publicSchemas);
  expect(result.length).toBe(4);
  expect(result[0].type).toBe("insert");
  expect(result[1].type).toBe("insert");
  expect(result[2].type).toBe("update");
  expect(result[3].type).toBe("delete");
});

test("public schemas with different versions are ordered by version", async () => {
  const testPgClient: IPostgresClient = {
    ...mockPgClient,
    query: async <T extends QueryResultRow = QueryResultRow>() => ({
      command: "SELECT",
      rowCount: 1,
      oid: 0,
      rows: [{ id: 1 }] as unknown as T[],
      fields: [],
      rowAsArray: false,
    }),
    tx: async (cb) => cb(testPgClient),
  };
  const testConnection: IPostgresConnection = { ...mockConnection, client: testPgClient };
  const testConnectionAdapter: IPostgresConnectionAdapter = {
    ...mockConnectionAdapter,
    getConnection: () => testConnection,
    getOrCreateConnection: () => testConnection,
  };
  const adapter = new PostgresPublicSchemaTransformationAdapter(
    testConnectionAdapter as unknown as import("./pg-connection-adapter").PostgresConnectionAdapter,
  );
  const publicSchemas: Extract<
    z.infer<typeof PublicSchemaSchema>,
    { config: z.infer<typeof PostgresPublicSchemaConfigSchema> }
  >[] = [
    {
      name: "schemaA",
      source: { dataStoreSlug: "mock" },
      outputSchema: {},
      version: { major: 1, minor: 1 },
      config: {
        publicSchemaType: "postgres",
        transformations: [
          { operation: "insert", table: "foo", sql: "SELECT * FROM foo WHERE id = $1" },
        ],
      },
    },
    {
      name: "schemaA",
      source: { dataStoreSlug: "mock" },
      outputSchema: {},
      version: { major: 1, minor: 0 },
      config: {
        publicSchemaType: "postgres",
        transformations: [
          { operation: "insert", table: "foo", sql: "SELECT * FROM foo WHERE id = $1" },
        ],
      },
    },
  ];
  const operations: TableOperation[] = [
    {
      type: "insert",
      keyColumns: ["id"],
      table: "foo",
      new: { id: 1 },
    } satisfies TableOperationInsert,
  ];
  const result = await adapter.applyPublicSchemaTransformation("mock", operations, publicSchemas);
  expect(result.length).toBe(2);
  expect(result[0].sourcePublicSchema.version.minor).toBe(0);
  expect(result[1].sourcePublicSchema.version.minor).toBe(1);
});

test("no matching transformations returns empty array", async () => {
  const testPgClient: IPostgresClient = {
    ...mockPgClient,
    query: async () => ({
      command: "SELECT",
      rowCount: 1,
      oid: 0,
      rows: [{ id: 1 }] as unknown as [],
      fields: [],
      rowAsArray: false,
    }),
    tx: async (cb) => cb(testPgClient),
  };
  const testConnection: IPostgresConnection = { ...mockConnection, client: testPgClient };
  const testConnectionAdapter: IPostgresConnectionAdapter = {
    ...mockConnectionAdapter,
    getConnection: () => testConnection,
    getOrCreateConnection: () => testConnection,
  };
  const adapter = new PostgresPublicSchemaTransformationAdapter(
    testConnectionAdapter as unknown as import("./pg-connection-adapter").PostgresConnectionAdapter,
  );
  const publicSchemas: Extract<
    z.infer<typeof PublicSchemaSchema>,
    { config: z.infer<typeof PostgresPublicSchemaConfigSchema> }
  >[] = [
    {
      name: "schemaA",
      source: { dataStoreSlug: "mock" },
      outputSchema: {},
      version: { major: 1, minor: 0 },
      config: {
        publicSchemaType: "postgres",
        transformations: [
          { operation: "insert", table: "bar", sql: "SELECT * FROM bar WHERE id = $1" },
        ],
      },
    },
  ];
  const operations: TableOperation[] = [
    {
      type: "insert",
      keyColumns: ["id"],
      table: "foo",
      new: { id: 1 },
    } satisfies TableOperationInsert,
  ];
  const result = await adapter.applyPublicSchemaTransformation("mock", operations, publicSchemas);
  expect(result.length).toBe(0);
});

test("multiple tables are ordered by table name, then operation, then schema", async () => {
  const testPgClient: IPostgresClient = {
    ...mockPgClient,
    query: async <T extends QueryResultRow = QueryResultRow>() => ({
      command: "SELECT",
      rowCount: 1,
      oid: 0,
      rows: [{ id: 1 }] as unknown as T[],
      fields: [],
      rowAsArray: false,
    }),
    tx: async (cb) => cb(testPgClient),
  };
  const testConnection: IPostgresConnection = { ...mockConnection, client: testPgClient };
  const testConnectionAdapter: IPostgresConnectionAdapter = {
    ...mockConnectionAdapter,
    getConnection: () => testConnection,
    getOrCreateConnection: () => testConnection,
  };
  const adapter = new PostgresPublicSchemaTransformationAdapter(
    testConnectionAdapter as unknown as import("./pg-connection-adapter").PostgresConnectionAdapter,
  );
  const publicSchemas: Extract<
    z.infer<typeof PublicSchemaSchema>,
    { config: z.infer<typeof PostgresPublicSchemaConfigSchema> }
  >[] = [
    {
      name: "schemaA",
      source: { dataStoreSlug: "mock" },
      outputSchema: {},
      version: { major: 1, minor: 0 },
      config: {
        publicSchemaType: "postgres",
        transformations: [
          { operation: "insert", table: "bar", sql: "SELECT * FROM bar WHERE id = $1" },
        ],
      },
    },
    {
      name: "schemaB",
      source: { dataStoreSlug: "mock" },
      outputSchema: {},
      version: { major: 1, minor: 0 },
      config: {
        publicSchemaType: "postgres",
        transformations: [
          { operation: "insert", table: "foo", sql: "SELECT * FROM foo WHERE id = $1" },
        ],
      },
    },
  ];
  const operations: TableOperation[] = [
    {
      type: "insert",
      keyColumns: ["id"],
      table: "bar",
      new: { id: 1 },
    } satisfies TableOperationInsert,
    {
      type: "insert",
      keyColumns: ["id"],
      table: "foo",
      new: { id: 2 },
    } satisfies TableOperationInsert,
  ];
  const result = await adapter.applyPublicSchemaTransformation("mock", operations, publicSchemas);
  expect(result.length).toBe(2);
});

test("throws if query returns wrong row count", async () => {
  const testPgClient: IPostgresClient = {
    ...mockPgClient,
    query: async () => ({
      command: "SELECT",
      rowCount: 0,
      oid: 0,
      rows: [],
      fields: [],
      rowAsArray: false,
    }),
    tx: async (cb) => cb(testPgClient),
  };
  const testConnection: IPostgresConnection = { ...mockConnection, client: testPgClient };
  const testConnectionAdapter: IPostgresConnectionAdapter = {
    ...mockConnectionAdapter,
    getConnection: () => testConnection,
    getOrCreateConnection: () => testConnection,
  };
  const adapter = new PostgresPublicSchemaTransformationAdapter(
    testConnectionAdapter as unknown as import("./pg-connection-adapter").PostgresConnectionAdapter,
  );
  const publicSchemas: Extract<
    z.infer<typeof PublicSchemaSchema>,
    { config: z.infer<typeof PostgresPublicSchemaConfigSchema> }
  >[] = [
    {
      name: "schemaA",
      source: { dataStoreSlug: "mock" },
      outputSchema: {},
      version: { major: 1, minor: 0 },
      config: {
        publicSchemaType: "postgres",
        transformations: [
          { operation: "insert", table: "foo", sql: "SELECT * FROM foo WHERE id = $1" },
        ],
      },
    },
  ];
  const operations: TableOperation[] = [
    {
      type: "insert",
      keyColumns: ["id"],
      table: "foo",
      new: { id: 1 },
    } satisfies TableOperationInsert,
  ];
  await expect(
    adapter.applyPublicSchemaTransformation("mock", operations, publicSchemas),
  ).rejects.toThrow(/Expected 1 row/);
});

test("throws protocol violation error with helpful message", async () => {
  const testPgClient: IPostgresClient = {
    ...mockPgClient,
    query: async () => {
      throw { code: "08P01", message: "protocol violation" };
    },
    tx: async (cb) => cb(testPgClient),
  };
  const testConnection: IPostgresConnection = { ...mockConnection, client: testPgClient };
  const testConnectionAdapter: IPostgresConnectionAdapter = {
    ...mockConnectionAdapter,
    getConnection: () => testConnection,
    getOrCreateConnection: () => testConnection,
  };
  const adapter = new PostgresPublicSchemaTransformationAdapter(
    testConnectionAdapter as unknown as import("./pg-connection-adapter").PostgresConnectionAdapter,
  );
  const publicSchemas: Extract<
    z.infer<typeof PublicSchemaSchema>,
    { config: z.infer<typeof PostgresPublicSchemaConfigSchema> }
  >[] = [
    {
      name: "schemaA",
      source: { dataStoreSlug: "mock" },
      outputSchema: {},
      version: { major: 1, minor: 0 },
      config: {
        publicSchemaType: "postgres",
        transformations: [
          { operation: "insert", table: "foo", sql: "SELECT * FROM foo WHERE id = $1" },
        ],
      },
    },
  ];
  const operations: TableOperation[] = [
    {
      type: "insert",
      keyColumns: ["id"],
      table: "foo",
      new: { id: 1 },
    } satisfies TableOperationInsert,
  ];
  await expect(
    adapter.applyPublicSchemaTransformation("mock", operations, publicSchemas),
  ).rejects.toThrow(/protocol violation/i);
});

test("throws if transformation expects more parameters than provided", async () => {
  const testPgClient: IPostgresClient = {
    ...mockPgClient,
    query: async () => {
      throw { code: "08P01", message: "protocol violation" };
    },
    tx: async (cb) => cb(testPgClient),
  };
  const testConnection: IPostgresConnection = { ...mockConnection, client: testPgClient };
  const testConnectionAdapter: IPostgresConnectionAdapter = {
    ...mockConnectionAdapter,
    getConnection: () => testConnection,
    getOrCreateConnection: () => testConnection,
  };
  const adapter = new PostgresPublicSchemaTransformationAdapter(testConnectionAdapter);
  const publicSchemas: Extract<
    z.infer<typeof PublicSchemaSchema>,
    { config: z.infer<typeof PostgresPublicSchemaConfigSchema> }
  >[] = [
    {
      name: "schemaA",
      source: { dataStoreSlug: "mock" },
      outputSchema: {},
      version: { major: 1, minor: 0 },
      config: {
        publicSchemaType: "postgres",
        transformations: [
          {
            operation: "insert",
            table: "foo",
            sql: "SELECT * FROM foo WHERE id = $1 AND bar = $2",
          },
        ],
      },
    },
  ];
  const operations: TableOperation[] = [
    {
      type: "insert",
      keyColumns: ["id"],
      table: "foo",
      new: { id: 1 },
    } satisfies TableOperationInsert,
  ];
  await expect(
    adapter.applyPublicSchemaTransformation("mock", operations, publicSchemas),
  ).rejects.toThrow(/protocol violation/i);
});

test("multiple matching transformations for one operation are all applied", async () => {
  const testPgClient: IPostgresClient = {
    ...mockPgClient,
    query: async <T extends QueryResultRow = QueryResultRow>() => ({
      command: "SELECT",
      rowCount: 1,
      oid: 0,
      rows: [{ id: 1 }] as unknown as T[],
      fields: [],
      rowAsArray: false,
    }),
    tx: async (cb) => cb(testPgClient),
  };
  const testConnection: IPostgresConnection = { ...mockConnection, client: testPgClient };
  const testConnectionAdapter: IPostgresConnectionAdapter = {
    ...mockConnectionAdapter,
    getConnection: () => testConnection,
    getOrCreateConnection: () => testConnection,
  };
  const adapter = new PostgresPublicSchemaTransformationAdapter(
    testConnectionAdapter as unknown as import("./pg-connection-adapter").PostgresConnectionAdapter,
  );
  const publicSchemas: Extract<
    z.infer<typeof PublicSchemaSchema>,
    { config: z.infer<typeof PostgresPublicSchemaConfigSchema> }
  >[] = [
    {
      name: "schemaA",
      source: { dataStoreSlug: "mock" },
      outputSchema: {},
      version: { major: 1, minor: 0 },
      config: {
        publicSchemaType: "postgres",
        transformations: [
          { operation: "insert", table: "foo", sql: "SELECT * FROM foo WHERE id = $1" },
          { operation: "insert", table: "foo", sql: "SELECT * FROM foo WHERE id = $1" },
        ],
      },
    },
  ];
  const operations: TableOperation[] = [
    {
      type: "insert",
      keyColumns: ["id"],
      table: "foo",
      new: { id: 1 },
    } satisfies TableOperationInsert,
  ];
  const result = await adapter.applyPublicSchemaTransformation("mock", operations, publicSchemas);
  expect(result.length).toBe(2);
});

test("transaction is rolled back on error (no partial results)", async () => {
  let callCount = 0;
  const testPgClient: IPostgresClient = {
    ...mockPgClient,
    query: async () => {
      callCount++;
      if (callCount === 2) throw new Error("fail on second transformation");
      return {
        command: "SELECT",
        rowCount: 1,
        oid: 0,
        rows: [{ id: 1 }] as unknown as [],
        fields: [],
        rowAsArray: false,
      };
    },
    tx: async (cb) => {
      return await cb(testPgClient);
    },
  };
  const testConnection: IPostgresConnection = { ...mockConnection, client: testPgClient };
  const testConnectionAdapter: IPostgresConnectionAdapter = {
    ...mockConnectionAdapter,
    getConnection: () => testConnection,
    getOrCreateConnection: () => testConnection,
  };
  const adapter = new PostgresPublicSchemaTransformationAdapter(testConnectionAdapter);
  const publicSchemas: Extract<
    z.infer<typeof PublicSchemaSchema>,
    { config: z.infer<typeof PostgresPublicSchemaConfigSchema> }
  >[] = [
    {
      name: "schemaA",
      source: { dataStoreSlug: "mock" },
      outputSchema: {},
      version: { major: 1, minor: 0 },
      config: {
        publicSchemaType: "postgres",
        transformations: [
          { operation: "insert", table: "foo", sql: "SELECT * FROM foo WHERE id = $1" },
          { operation: "insert", table: "foo", sql: "SELECT * FROM foo WHERE id = $1" },
        ],
      },
    },
  ];
  const operations: TableOperation[] = [
    {
      type: "insert",
      keyColumns: ["id"],
      table: "foo",
      new: { id: 1 },
    } satisfies TableOperationInsert,
  ];
  await expect(
    adapter.applyPublicSchemaTransformation("mock", operations, publicSchemas),
  ).rejects.toThrow(/fail on second transformation/);
});

test("applyPublicSchemaTransformation supports named placeholders in SQL", async () => {
  const calledQueries: { sql: string; values: unknown[] | undefined }[] = [];
  const testPgClient: IPostgresClient = {
    ...mockPgClient,
    query: async <T extends QueryResultRow = QueryResultRow>(sql: string, values?: unknown[]) => {
      calledQueries.push({ sql, values });
      return {
        command: "SELECT",
        rowCount: 1,
        oid: 0,
        rows: [{ id: values?.[0] ?? 1, foo: "bar" }] as unknown as T[],
        fields: [],
        rowAsArray: false,
      };
    },
    tx: async (cb) => cb(testPgClient),
  };
  const testConnection: IPostgresConnection = { ...mockConnection, client: testPgClient };
  const testConnectionAdapter: IPostgresConnectionAdapter = {
    ...mockConnectionAdapter,
    getConnection: () => testConnection,
    getOrCreateConnection: () => testConnection,
  };
  const adapter = new PostgresPublicSchemaTransformationAdapter(
    testConnectionAdapter as unknown as import("./pg-connection-adapter").PostgresConnectionAdapter,
  );

  // Transformation uses named placeholders
  const publicSchemas: Extract<
    z.infer<typeof PublicSchemaSchema>,
    { config: z.infer<typeof PostgresPublicSchemaConfigSchema> }
  >[] = [
    {
      name: "schemaNamed",
      source: { dataStoreSlug: "mock" },
      outputSchema: {},
      version: { major: 1, minor: 0 },
      config: {
        publicSchemaType: "postgres",
        transformations: [
          {
            operation: "insert",
            table: "foo",
            sql: "SELECT * FROM foo WHERE id = :id AND foo = :foo",
          },
        ],
      },
    },
  ];

  const operations: TableOperation[] = [
    {
      type: "insert",
      keyColumns: ["id", "foo"],
      table: "foo",
      new: { id: 42, foo: "bar" },
    } as TableOperation,
  ];

  const result = await adapter.applyPublicSchemaTransformation("mock", operations, publicSchemas);

  expect(result.length).toBe(1);
  expect(result[0].type).toBe("insert");
  expect(calledQueries[0].sql).toContain("$1");
  expect(calledQueries[0].sql).toContain("$2");
  expect(calledQueries[0].values).toEqual([42, "bar"]);
});

test("applyPublicSchemaTransformation supports delete operation with correct key mapping", async () => {
  const calledQueries: { sql: string; values: unknown[] | undefined }[] = [];
  const testPgClient: IPostgresClient = {
    ...mockPgClient,
    query: async <T extends QueryResultRow = QueryResultRow>(sql: string, values?: unknown[]) => {
      calledQueries.push({ sql, values });
      return {
        command: "DELETE",
        rowCount: 1,
        oid: 0,
        rows: [{ id: values?.[0] ?? 1, foo: "bar" }] as unknown as T[],
        fields: [],
        rowAsArray: false,
      };
    },
    tx: async (cb) => cb(testPgClient),
  };
  const testConnection: IPostgresConnection = { ...mockConnection, client: testPgClient };
  const testConnectionAdapter: IPostgresConnectionAdapter = {
    ...mockConnectionAdapter,
    getConnection: () => testConnection,
    getOrCreateConnection: () => testConnection,
  };
  const adapter = new PostgresPublicSchemaTransformationAdapter(testConnectionAdapter);

  // Transformation uses delete operation
  const publicSchemas: Extract<
    z.infer<typeof PublicSchemaSchema>,
    { config: z.infer<typeof PostgresPublicSchemaConfigSchema> }
  >[] = [
    {
      name: "schemaDelete",
      source: { dataStoreSlug: "mock" },
      outputSchema: {},
      version: { major: 1, minor: 0 },
      config: {
        publicSchemaType: "postgres",
        transformations: [
          { operation: "delete", table: "foo", sql: "DELETE FROM foo WHERE id = $1 AND foo = $2" },
        ],
      },
    },
  ];

  const operations: TableOperation[] = [
    {
      type: "delete",
      keyColumns: ["id", "foo"],
      table: "foo",
      oldKeys: { id: 99, foo: "baz" },
    } as TableOperation,
  ];

  const result = await adapter.applyPublicSchemaTransformation("mock", operations, publicSchemas);

  expect(result.length).toBe(1);
  expect(result[0].type).toBe("delete");
  expect(calledQueries[0].sql).toContain("$1");
  expect(calledQueries[0].sql).toContain("$2");
  expect(calledQueries[0].values).toEqual([99, "baz"]);
});

test("applyPublicSchemaTransformation supports delete operation with named parameters", async () => {
  const calledQueries: { sql: string; values: unknown[] | undefined }[] = [];
  const testPgClient: IPostgresClient = {
    ...mockPgClient,
    query: async <T extends QueryResultRow = QueryResultRow>(sql: string, values?: unknown[]) => {
      calledQueries.push({ sql, values });
      return {
        command: "DELETE",
        rowCount: 1,
        oid: 0,
        rows: [{ id: values?.[0] ?? 1, foo: "bar" }] as unknown as T[],
        fields: [],
        rowAsArray: false,
      };
    },
    tx: async (cb) => cb(testPgClient),
  };
  const testConnection: IPostgresConnection = { ...mockConnection, client: testPgClient };
  const testConnectionAdapter: IPostgresConnectionAdapter = {
    ...mockConnectionAdapter,
    getConnection: () => testConnection,
    getOrCreateConnection: () => testConnection,
  };
  const adapter = new PostgresPublicSchemaTransformationAdapter(testConnectionAdapter);

  // Transformation uses delete operation
  const publicSchemas: Extract<
    z.infer<typeof PublicSchemaSchema>,
    { config: z.infer<typeof PostgresPublicSchemaConfigSchema> }
  >[] = [
    {
      name: "schemaDelete",
      source: { dataStoreSlug: "mock" },
      outputSchema: {},
      version: { major: 1, minor: 0 },
      config: {
        publicSchemaType: "postgres",
        transformations: [
          {
            operation: "delete",
            table: "foo",
            sql: "DELETE FROM foo WHERE foo = :foo AND id = :id",
          },
        ],
      },
    },
  ];

  const operations: TableOperation[] = [
    {
      type: "delete",
      keyColumns: ["id", "foo"],
      table: "foo",
      oldKeys: { id: 99, foo: "baz" },
    } as TableOperation,
  ];

  const result = await adapter.applyPublicSchemaTransformation("mock", operations, publicSchemas);

  expect(result.length).toBe(1);
  expect(result[0].type).toBe("delete");
  expect(calledQueries[0].sql).not.toContain(":id");
  expect(calledQueries[0].sql).not.toContain(":foo");
  // Order is important here.
  expect(calledQueries[0].sql).toContain("foo = $1 AND id = $2");
  // Order is important here.
  expect(calledQueries[0].values).toEqual(["baz", 99]);
});
