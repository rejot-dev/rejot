export type PostgresConnectionConfig = {
  type: "postgres";
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl: boolean;
};

export type ConnectionConfig = PostgresConnectionConfig;

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
  foreignKey?: {
    constraintName: string;
    referencedTableSchema: string;
    referencedTableName: string;
    referencedColumnName: string;
  };
};

export type TableToColumnsMap = Map<string, ConnectionTableColumn[]>;

export type ConnectionPublication = {
  name: string;
  allTables: boolean;
  tables?: ConnectionTable[];
};

export type IConnectionManager = {
  checkHealth(config: ConnectionConfig): Promise<ConnectionHealth>;
  getTables(config: ConnectionConfig): Promise<ConnectionTable[]>;
  getTableSchema(config: ConnectionConfig, tableName: string): Promise<ConnectionTableColumn[]>;
  getAllTableSchemas(config: ConnectionConfig, schemaName: string): Promise<TableToColumnsMap>;
  getPublicationTableSchemas(
    config: ConnectionConfig,
    publicationName: string,
  ): Promise<TableToColumnsMap>;
  getPublications(config: ConnectionConfig): Promise<ConnectionPublication[]>;
};
