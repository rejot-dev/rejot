export type PostgresTable = {
  schema: string;
  name: string;
};

export type PostgresPublication = {
  name: string;
} & (
  | {
      allTables: true;
      tables: undefined;
    }
  | {
      allTables: false;
      tables: PostgresTable[];
    }
);

export function normalizePostgresTable(table: string): PostgresTable {
  const parts = table.split(".");
  if (parts.length === 1) {
    return {
      schema: "public",
      name: parts[0],
    };
  }
  return {
    schema: parts[0],
    name: parts[1],
  };
}

export type ErrorWithSolution = {
  error: string;
  solution?: string;
};

export class PostgresPublicationState {
  #dbIdentifier: string;
  #configPublication: PostgresPublication;
  #databasePublication: PostgresPublication | null;

  constructor(
    dbIdentifier: string,
    configPublication: PostgresPublication,
    databasePublication: PostgresPublication | null,
  ) {
    this.#dbIdentifier = dbIdentifier;
    this.#configPublication = configPublication;
    this.#databasePublication = databasePublication;
  }

  verify(): ErrorWithSolution[] {
    const errors: ErrorWithSolution[] = [];

    const databasePublication = this.#databasePublication;
    const configPublication = this.#configPublication;

    if (databasePublication === null) {
      let solution: string | undefined;
      if (configPublication.allTables) {
        solution = `Run: CREATE PUBLICATION ${configPublication.name} FOR ALL TABLES;`;
      } else {
        solution = `Run: CREATE PUBLICATION ${configPublication.name} FOR TABLE ${configPublication.tables
          ?.map((t) => `${t.schema}.${t.name}`)
          .join(", ")};`;
      }

      errors.push({
        error: `Publication "${configPublication.name}" does not exist in database "${this.#dbIdentifier}"`,
        solution,
      });
      return errors;
    }

    if (configPublication.allTables && !databasePublication.allTables) {
      errors.push({
        error: `Publication "${configPublication.name}" in database "${this.#dbIdentifier}" is configured for all tables, but the database is not configured for all tables`,
      });
    }

    if (!configPublication.allTables && databasePublication.allTables) {
      errors.push({
        error: `Publication "${configPublication.name}" in database "${this.#dbIdentifier}" is configured for specific tables, but the database is configured for all tables`,
      });
    }

    if (!configPublication.allTables && !databasePublication.allTables) {
      const missingTables = configPublication.tables?.filter(
        (configTable) =>
          !databasePublication.tables?.some(
            (dbTable) => dbTable.schema === configTable.schema && dbTable.name === configTable.name,
          ),
      );

      if (missingTables.length > 0) {
        errors.push({
          error: `Publication "${configPublication.name}" in database "${this.#dbIdentifier}" is missing configured tables: ${missingTables
            .map((t) => `${t.schema}.${t.name}`)
            .join(", ")}`,
        });
      }
    }

    return errors;
  }

  toPlainObject(): {
    dbIdentifier: string;
    configPublication: PostgresPublication;
    databasePublication: PostgresPublication | null;
  } {
    return {
      dbIdentifier: this.#dbIdentifier,
      configPublication: this.#configPublication,
      databasePublication: this.#databasePublication,
    };
  }

  get dbIdentifier(): string {
    return this.#dbIdentifier;
  }
}
