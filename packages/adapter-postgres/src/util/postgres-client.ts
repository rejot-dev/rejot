import { Client } from "pg";
import type { QueryResult, QueryResultRow } from "pg";

export class PostgresClient {
  readonly #client: Client;

  #transactionDepth: number = 0;
  #savepointCounter: number = 0;

  constructor(client: Client) {
    this.#client = client;
  }

  get pgClient() {
    return this.#client;
  }

  async connect(): Promise<void> {
    await this.#client.connect();
  }

  async end(): Promise<void> {
    await this.#client.end();
  }

  async query<T extends QueryResultRow = QueryResultRow>(
    queryText: string,
    values?: unknown[],
  ): Promise<QueryResult<T>> {
    return this.#client.query<T>(queryText, values);
  }

  async beginTransaction(): Promise<void> {
    if (this.#transactionDepth === 0) {
      await this.#client.query("BEGIN");
    } else {
      const savepointName = `sp_${this.#savepointCounter++}`;
      await this.#client.query(`SAVEPOINT ${savepointName}`);
    }
    this.#transactionDepth++;
  }

  async commitTransaction(): Promise<void> {
    if (this.#transactionDepth === 0) {
      throw new Error("No transaction to commit");
    }

    this.#transactionDepth--;
    if (this.#transactionDepth === 0) {
      await this.#client.query("COMMIT");
    } else {
      // For nested transactions, we don't need to do anything on commit
      // The changes will be committed when the outer transaction commits
    }
  }

  async rollbackTransaction(): Promise<void> {
    if (this.#transactionDepth === 0) {
      throw new Error("No transaction to rollback");
    }

    this.#transactionDepth--;
    if (this.#transactionDepth === 0) {
      await this.#client.query("ROLLBACK");
    } else {
      const savepointName = `sp_${this.#savepointCounter - 1}`;
      await this.#client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
    }
  }

  isInTransaction(): boolean {
    return this.#transactionDepth > 0;
  }

  getTransactionDepth(): number {
    return this.#transactionDepth;
  }
}
