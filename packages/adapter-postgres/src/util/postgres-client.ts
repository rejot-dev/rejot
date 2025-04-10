import { DatabaseError, Pool } from "pg";
import type { ClientBase, QueryResult, QueryResultRow } from "pg";

export interface PostgresConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

/**
 * Parses a Postgres connection string into a PostgresConfig object.
 * Supports both 'postgres://' and 'postgresql://' protocols.
 *
 * @param connectionString - Connection string in format: postgres://user:password@host:port/database
 * @returns PostgresConfig object
 * @throws Error if the connection string is invalid
 */
export function parsePostgresConnectionString(connectionString: string): PostgresConfig {
  try {
    const url = new URL(connectionString);

    if (!url.protocol.match(/^postgres(ql)?:$/)) {
      throw new Error("Invalid protocol. Must be postgres:// or postgresql://");
    }

    const port = url.port ? parseInt(url.port, 10) : 5432;
    const database = url.pathname.slice(1); // Remove leading slash

    if (!database) {
      throw new Error("Database name is required");
    }

    return {
      host: url.hostname,
      port,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Invalid connection string: ${error.message}`);
    }
    throw error;
  }
}

type PoolOrClient =
  | {
      type: "pool";
      pool: Pool;
    }
  | {
      type: "client";
      client: ClientBase;
      savepointDepth: number;
    };

type ConstructorObject = (PoolOrClient & { config: PostgresConfig }) | { config: PostgresConfig };

export class PostgresClient {
  readonly #poolOrClient: PoolOrClient;
  readonly #config: PostgresConfig;

  private constructor(poolOrClient: ConstructorObject) {
    this.#config = poolOrClient.config;

    if ("type" in poolOrClient) {
      this.#poolOrClient = poolOrClient;
    } else {
      this.#poolOrClient = { type: "pool", pool: new Pool(this.#config) };
    }
  }

  static fromConfig(config: PostgresConfig): PostgresClient {
    return new PostgresClient({ config });
  }

  static fromConnectionString(connectionString: string): PostgresClient {
    return new PostgresClient({ config: parsePostgresConnectionString(connectionString) });
  }

  get inTransaction(): boolean {
    return this.#poolOrClient.type === "client";
  }

  get config(): PostgresConfig {
    return this.#config;
  }

  get poolOrClient(): PoolOrClient {
    return this.#poolOrClient;
  }

  get pgClient() {
    return this.#poolOrClient.type === "pool" ? this.#poolOrClient.pool : this.#poolOrClient.client;
  }

  async connect(): Promise<void> {
    // No-op
  }

  async end(): Promise<void> {
    if (this.#poolOrClient.type === "pool") {
      await this.#poolOrClient.pool.end();
      return;
    }

    throw new Error("End call unexpected in PostgresClient transaction.");
  }

  async query<T extends QueryResultRow = QueryResultRow>(
    queryText: string,
    values?: unknown[],
  ): Promise<QueryResult<T>> {
    const poolOrClient = this.#poolOrClient;

    if (poolOrClient.type === "pool") {
      const client = await poolOrClient.pool.connect();
      try {
        return await this.#query(client, queryText, values);
      } finally {
        client.release();
      }
    }

    return await this.#query(poolOrClient.client, queryText, values);
  }

  async #query<T extends QueryResultRow = QueryResultRow>(
    client: ClientBase,
    queryText: string,
    values?: unknown[],
  ): Promise<QueryResult<T>> {
    const obj: { stack?: string } = {};
    Error.captureStackTrace(obj);

    const dbError = new DatabaseError("", 0, "error");

    try {
      return await client.query<T>(queryText, values);
    } catch (e) {
      if (e instanceof DatabaseError) {
        dbError.message = e.message;
        // @ts-expect-error length is read-only
        dbError.length = e.length;
        dbError.code = e.code;
        dbError.severity = e.severity;
        dbError.detail = e.detail;
        dbError.hint = e.hint;
        dbError.position = e.position;
        dbError.internalPosition = e.internalPosition;
        dbError.internalQuery = e.internalQuery;
        dbError.where = e.where;
        dbError.schema = e.schema;
        dbError.table = e.table;
        dbError.dataType = e.dataType;
        dbError.constraint = e.constraint;
        dbError.file = e.file;
        dbError.routine = e.routine;

        // We purposely don't copy dbError.stack, column, and line because that somehow
        // screws with the stack trace.

        throw dbError;
      }

      if (e instanceof Error && obj.stack) {
        e.stack = obj.stack;
        // For some reason the old stack is printed instead of the new stack. By adding a new field
        // to the object, we can at least see the stack trace.
        (e as Error & { newStack: string }).newStack = obj.stack;
      }

      throw e;
    }
  }

  async dangerousLeakyTx(): Promise<{ pc: PostgresClient; rollback: () => Promise<void> }> {
    if (this.poolOrClient.type !== "pool") {
      throw new Error("Can only open leakyTx on top-level PostgresClient.");
    }

    const client = await this.poolOrClient.pool.connect();
    await client.query("BEGIN");
    return {
      pc: new PostgresClient({
        type: "client",
        client,
        savepointDepth: 0,
        config: this.#config,
      }),
      rollback: async () => {
        await client.query("ROLLBACK");
        client.release();
      },
    };
  }

  async tx<T>(cb: (client: PostgresClient) => Promise<T>): Promise<T> {
    const poolOrClient = this.#poolOrClient;

    if (poolOrClient.type === "pool") {
      const client = await poolOrClient.pool.connect();
      try {
        await client.query("BEGIN");
        const result = await cb(
          new PostgresClient({
            type: "client",
            client,
            savepointDepth: 0,
            config: this.#config,
          }),
        );
        return result;
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    }

    // Nested transaction.
    const newSavepointDepth = poolOrClient.savepointDepth + 1;
    const savepointName = `sp_${newSavepointDepth}`;

    try {
      await poolOrClient.client.query(`SAVEPOINT ${savepointName}`);
      return await cb(
        new PostgresClient({
          type: "client",
          client: poolOrClient.client,
          savepointDepth: newSavepointDepth,
          config: this.#config,
        }),
      );
    } catch (e) {
      await poolOrClient.client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
      throw e;
    }
  }
}
