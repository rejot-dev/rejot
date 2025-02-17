import { type Disposable, tokens } from "typed-inject";
import postgres from "postgres";

import type { ConfigManager } from "@/app-config/config.ts";

export type Connection = {
  slug: string;
  publicationName: string;
  publicationTables?: string[] | undefined;
  sql: postgres.Sql;
};

export class PostgresChangelogListenerConnectionManager implements Disposable {
  static inject = tokens("config");

  static #connections = new Map<string, Connection>();

  #config: ConfigManager;

  constructor(config: ConfigManager) {
    this.#config = config;

    if (PostgresChangelogListenerConnectionManager.#connections.size !== 0) {
      return;
    }
  }

  get connections(): Map<string, Connection> {
    return PostgresChangelogListenerConnectionManager.#connections;
  }

  connect(): void {
    const connections = this.#config.connections;
    for (
      const { publicationName, publicationTables, connectionSlug } of Object.values(
        this.#config.dataStores,
      )
    ) {
      const connection = connections[connectionSlug];

      if (!connection) {
        throw new Error(`Connection not found: ${connectionSlug}`);
      }

      const { slug, connectionType } = connection;

      if (connectionType !== "postgres") {
        continue;
      }

      const db = postgres(connection);
      PostgresChangelogListenerConnectionManager.#connections.set(slug, {
        slug,
        publicationName,
        publicationTables,
        sql: db,
      });

      console.log(`Connected to [${connectionType}] '${slug}'`);
    }
  }

  async dispose(): Promise<void> {
    await Promise.all(
      Array.from(PostgresChangelogListenerConnectionManager.#connections.values()).map(
        async ({ sql }) => {
          await sql.end();
        },
      ),
    );

    PostgresChangelogListenerConnectionManager.#connections.clear();
  }
}
