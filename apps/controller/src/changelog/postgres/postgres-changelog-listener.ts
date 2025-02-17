import type { PostgresChangelogListenerConnectionManager } from "./postgres-changelog-listener-connection-manager.ts";
import {
  normalizePostgresTable,
  type PostgresPublication,
  PostgresPublicationState,
} from "./postgres-publication-state.ts";
import { tokens } from "typed-inject";

export class PostgresChangelogListener {
  static inject = tokens("postgresChangelogListenerConnectionManager");

  #publicationStates: PostgresPublicationState[] = [];
  #connectionManager: PostgresChangelogListenerConnectionManager;

  constructor(
    postgresChangelogListenerConnectionManager: PostgresChangelogListenerConnectionManager,
  ) {
    this.#connectionManager = postgresChangelogListenerConnectionManager;
  }

  async verifyConnections() {
    for (
      const { sql, slug, publicationName, publicationTables } of this
        .#connectionManager.connections.values()
    ) {
      const configPublicationTables = publicationTables == undefined
        ? undefined
        : publicationTables.map((table) => normalizePostgresTable(table));

      const configPublication: PostgresPublication = configPublicationTables === undefined
        ? {
          name: publicationName,
          allTables: true,
          tables: undefined,
        }
        : {
          name: publicationName,
          allTables: false,
          tables: configPublicationTables,
        };

      const result = await sql`
        WITH pub AS (
          SELECT pubname, puballtables
          FROM pg_publication 
          WHERE pubname = ${publicationName}
          LIMIT 1
        )
        SELECT 
          pub.puballtables,
          pt.schemaname,
          pt.tablename
        FROM pub
        LEFT JOIN pg_publication_tables pt ON pt.pubname = pub.pubname;
      `;

      const databaseAllTables = result.length > 0 ? result[0]["puballtables"] : undefined;
      const databaseTables = result
        .filter((row) => row["schemaname"] !== null) // Filter out null schema/table names from LEFT JOIN
        .map((table) => ({
          schema: table["schemaname"] + "",
          name: table["tablename"] + "",
        }));

      const databasePublication: PostgresPublication | null = result.length > 0
        ? {
          name: publicationName,
          allTables: databaseAllTables,
          tables: databaseTables,
        }
        : null;

      const publicationState = new PostgresPublicationState(
        slug,
        configPublication,
        databasePublication,
      );

      this.#publicationStates.push(publicationState);
      console.log(publicationState.toPlainObject());
      console.log(publicationState.verify());
      console.log("User", sql.options.user);
      console.log("--------------------------------");
    }
  }
}
