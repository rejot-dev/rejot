export type ConnectionHealth = {
  status: "healthy" | "unhealthy";
  message?: string;
};

export type ConnectionTable = {
  schema: string;
  name: string;
};

export type ConnectionTableColumn = {
  columnName: string;
  dataType: string;
  isNullable: boolean;
  columnDefault: string | null;
  tableSchema: string;
};

export type ConnectionPublication = {
  name: string;
  allTables: boolean;
  tables?: ConnectionTable[];
};

export type IConnectionManager = {
  checkHealth(organizationId: string, connectionSlug: string): Promise<ConnectionHealth>;
  getTables(organizationId: string, connectionSlug: string): Promise<ConnectionTable[]>;
  getTableSchema(
    organizationId: string,
    connectionSlug: string,
    tableName: string,
  ): Promise<ConnectionTableColumn[]>;
  getPublications(organizationId: string, connectionSlug: string): Promise<ConnectionPublication[]>;
};
