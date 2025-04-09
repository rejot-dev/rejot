import type { IDataSource, IDataSink } from "@rejot-dev/contract/sync";
import { StdoutSink } from "./sinks/stdout-sink.ts";
import { FileSink } from "./sinks/file-sink.ts";
import { SUPPORTED_SCHEMES, type ConnectionScheme } from "./rejot-cli-consts.ts";
import { PostgresSource } from "@rejot-dev/adapter-postgres/source";
import { PostgresSink } from "@rejot-dev/adapter-postgres/sink";
import { PostgresClient } from "@rejot-dev/adapter-postgres/postgres-client";

/**
 * Create a source and sink based on the connection strings
 * @param sourceConn The connection string for the source
 * @param sinkConn The connection string for the sink
 * @param options Additional options for the source and sink
 * @returns An object containing the source and sink
 */
export function createSourceAndSink(
  sourceConn: string,
  sinkConn: string,
  publicSchemaSQL: string,
  consumerSchemaSQL?: string,
  options: {
    publicationName?: string;
    createPublication?: boolean;
  } = {},
): { source: IDataSource; sink: IDataSink } {
  // Create source
  const source = createSource(sourceConn, publicSchemaSQL, {
    publicationName: options.publicationName,
    createPublication: options.createPublication,
  });

  // Create sink
  const sink = createSink(sinkConn, consumerSchemaSQL);

  return { source, sink };
}

/**
 * Create a data source based on the connection string
 * @param connectionString The connection string for the source
 * @param options Additional options for the source
 * @returns A data source instance
 */
export function createSource(
  connectionString: string,
  publicSchemaSQL: string,
  options: {
    publicationName?: string;
    createPublication?: boolean;
  } = {},
): IDataSource {
  const connection = parseConnectionString(connectionString);

  switch (connection.scheme) {
    case "postgresql":
      return new PostgresSource({
        client: PostgresClient.fromConnectionString(connectionString),
        publicSchemaSql: publicSchemaSQL,
        options: {
          publicationName: options.publicationName,
          createPublication: options.createPublication,
        },
      });
    default:
      throw new Error(`Unsupported source scheme: ${connection.scheme}`);
  }
}

/**
 * Create a data sink based on the connection string
 * @param connectionString The connection string for the sink
 * @returns A data sink instance
 */
export function createSink(
  connectionString: string,
  consumerSchemaSQL: string | undefined,
): IDataSink {
  const connection = parseConnectionString(connectionString);

  switch (connection.scheme) {
    case "postgresql":
      if (!consumerSchemaSQL) {
        throw new Error("Consumer schema SQL is required for PostgreSQL sink");
      }
      return new PostgresSink({
        client: PostgresClient.fromConnectionString(connectionString),
        consumerSchemaSQL,
      });
    case "stdout":
      return new StdoutSink();
    case "file":
      if (!connection.path) {
        throw new Error("File path is required for file sink");
      }
      return new FileSink({
        filePath: connection.path,
      });
    default:
      throw new Error(`Unsupported sink scheme: ${connection.scheme}`);
  }
}

type ParsedConnection = {
  scheme: ConnectionScheme;
  path?: string;
};

/**
 * Parse a connection string to determine its scheme and path
 * @param connectionString The connection string to parse
 * @returns The scheme and path of the connection string
 */
export function parseConnectionString(connectionString: string): ParsedConnection {
  const url = new URL(connectionString);
  const scheme = url.protocol.slice(0, -1); // strip trailing colon

  if (!SUPPORTED_SCHEMES.includes(scheme)) {
    throw new Error(`Unsupported connection scheme: ${scheme}`);
  }

  return {
    scheme: scheme as ConnectionScheme,
    path: url.pathname === "" ? undefined : url.pathname,
  };
}
