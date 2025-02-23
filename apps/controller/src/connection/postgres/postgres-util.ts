export type PostgresTable = {
  schema: string;
  name: string;
};

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
