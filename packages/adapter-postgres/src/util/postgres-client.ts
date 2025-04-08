import { Client, DatabaseError } from "pg";
import type { QueryResult, QueryResultRow } from "pg";

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

export class PostgresClient {
  readonly #client: Client;

  #transactionDepth: number = 0;
  #savepointCounter: number = 0;

  #isConnecting: boolean = false;

  constructor(config: PostgresConfig) {
    this.#client = new Client(config);
  }

  get pgClient() {
    return this.#client;
  }

  async connect(): Promise<void> {
    if (this.#isConnecting) {
      return Promise.resolve();
    }

    this.#isConnecting = true;
    await this.#client.connect();
    this.#isConnecting = false;
  }

  async end(): Promise<void> {
    await this.#client.end();
  }

  async query<T extends QueryResultRow = QueryResultRow>(
    queryText: string,
    values?: unknown[],
  ): Promise<QueryResult<T>> {
    const obj: { stack?: string } = {};
    Error.captureStackTrace(obj);

    const dbError = new DatabaseError("", 0, "error");

    try {
      return await this.#client.query<T>(queryText, values);
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

  async beginTransaction(): Promise<void> {
    if (this.#transactionDepth === 0) {
      await this.query("BEGIN");
    } else {
      const savepointName = `sp_${this.#savepointCounter++}`;
      await this.query(`SAVEPOINT ${savepointName}`);
    }
    this.#transactionDepth++;
  }

  async commitTransaction(): Promise<void> {
    if (this.#transactionDepth === 0) {
      throw new Error("No transaction to commit");
    }

    this.#transactionDepth--;
    if (this.#transactionDepth === 0) {
      await this.query("COMMIT");
    } else {
      // For nested transactions, we don't need to do anything on commit
      // The changes will be committed when the outer transaction commits
    }
  }

  async rollbackTransaction(reason?: unknown): Promise<void> {
    if (this.#transactionDepth === 0) {
      throw new Error("No transaction to rollback");
    }

    this.#transactionDepth--;
    if (this.#transactionDepth === 0) {
      await this.query("ROLLBACK");
    } else if (this.#savepointCounter > 0) {
      const savepointName = `sp_${this.#savepointCounter - 1}`;
      await this.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
    } else {
      throw new Error("No savepoint to rollback to", { cause: reason });
    }
  }

  isInTransaction(): boolean {
    return this.#transactionDepth > 0;
  }

  getTransactionDepth(): number {
    return this.#transactionDepth;
  }
}
