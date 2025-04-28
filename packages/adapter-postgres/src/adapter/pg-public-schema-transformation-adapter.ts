import { z } from "zod";

import type { IPublicSchemaTransformationAdapter } from "@rejot-dev/contract/adapter";
import { getLogger } from "@rejot-dev/contract/logger";
import type {
  PostgresPublicSchemaConfigSchema,
  PublicSchemaSchema,
} from "@rejot-dev/contract/manifest";
import type { TableOperation, TransformedOperation } from "@rejot-dev/contract/sync";

import { convertNamedToPositionalPlaceholders } from "../sql-transformer/sql-transformer.ts";
import { isPostgresError, PG_PROTOCOL_VIOLATION } from "../util/postgres-error-codes.ts";
import type { IPostgresConnectionAdapter } from "./pg-connection-adapter.ts";

const log = getLogger(import.meta.url);

export type Match = {
  operation: TableOperation;
  publicSchema: Extract<
    z.infer<typeof PublicSchemaSchema>,
    { config: z.infer<typeof PostgresPublicSchemaConfigSchema> }
  >;
  transformation: z.infer<typeof PostgresPublicSchemaConfigSchema>["transformations"][number];
};

const OP_ORDER = { insert: 0, update: 1, delete: 2 };

export class PostgresPublicSchemaTransformationAdapter
  implements IPublicSchemaTransformationAdapter<z.infer<typeof PostgresPublicSchemaConfigSchema>>
{
  #connectionAdapter: IPostgresConnectionAdapter;

  constructor(connectionAdapter: IPostgresConnectionAdapter) {
    this.#connectionAdapter = connectionAdapter;
  }

  get transformationType(): "postgres" {
    return "postgres";
  }

  static #sortMatches(a: Match, b: Match): number {
    // Sort by table name first
    if (a.operation.table !== b.operation.table) {
      return a.operation.table.localeCompare(b.operation.table);
    }

    // For non-delete operations, sort by OP_ORDER (insert < update)
    if (a.operation.type !== b.operation.type) {
      return OP_ORDER[a.operation.type] - OP_ORDER[b.operation.type];
    }

    // Then by public schema name
    if (a.publicSchema.name !== b.publicSchema.name) {
      return a.publicSchema.name.localeCompare(b.publicSchema.name);
    }

    // Then by version
    if (a.publicSchema.version.major !== b.publicSchema.version.major) {
      return a.publicSchema.version.major - b.publicSchema.version.major;
    }
    if (a.publicSchema.version.minor !== b.publicSchema.version.minor) {
      return a.publicSchema.version.minor - b.publicSchema.version.minor;
    }

    return 0;
  }

  async applyPublicSchemaTransformation(
    sourceDataStoreSlug: string,
    operations: TableOperation[],
    publicSchemas: Extract<
      z.infer<typeof PublicSchemaSchema>,
      { config: z.infer<typeof PostgresPublicSchemaConfigSchema> }
    >[],
  ): Promise<TransformedOperation[]> {
    const connection = this.#connectionAdapter.getConnection(sourceDataStoreSlug);
    if (!connection) {
      throw new Error(`Connection with slug ${sourceDataStoreSlug} not found`);
    }

    const matches: Match[] = [];
    for (const publicSchema of publicSchemas) {
      for (const transformation of publicSchema.config.transformations) {
        for (const operation of operations) {
          if (
            transformation.table === operation.table &&
            transformation.operation === operation.type
          ) {
            matches.push({ operation, publicSchema, transformation });
          }
        }
      }
    }

    // Deterministic sort the matches so we always execute operations in the same order. This
    // prevents potential dead locks. It also orders DELETEs last
    matches.sort(PostgresPublicSchemaTransformationAdapter.#sortMatches);

    // Run all transformations in a single transaction
    return await connection.client.tx(async (txClient) => {
      const transformedOps: TransformedOperation[] = [];
      for (const { operation, publicSchema, transformation } of matches) {
        log.trace(
          `Applying transformation for ${publicSchema.name}@${publicSchema.version.major}.${publicSchema.version.minor}` +
            ` on table ${operation.table}`,
          operation,
        );

        const { sql, values } = await convertNamedToPositionalPlaceholders(
          transformation.sql,
          operation.type === "insert" || operation.type === "update"
            ? operation.new
            : operation.oldKeys,
        );

        try {
          const result = await txClient.query(sql, values);
          if (result.rows.length !== 1) {
            throw new Error(
              `Expected 1 row from public schema transformation, got ${result.rows.length}, operation: ${JSON.stringify(operation)}`,
            );
          }

          if (operation.type === "insert" || operation.type === "update") {
            transformedOps.push({
              type: operation.type,
              object: result.rows[0],
              sourceManifestSlug: publicSchema.source.dataStoreSlug,
              sourcePublicSchema: {
                name: publicSchema.name,
                version: {
                  major: publicSchema.version.major,
                  minor: publicSchema.version.minor,
                },
              },
            });
          } else {
            transformedOps.push({
              type: "delete",
              objectKeys: operation.oldKeys,
              sourceManifestSlug: publicSchema.source.dataStoreSlug,
              sourcePublicSchema: {
                name: publicSchema.name,
                version: {
                  major: publicSchema.version.major,
                  minor: publicSchema.version.minor,
                },
              },
            });
          }
        } catch (error) {
          if (isPostgresError(error, PG_PROTOCOL_VIOLATION)) {
            throw new Error(
              `Protocol violation while applying public schema transformation: ${JSON.stringify(transformation)}. ` +
                `You probably forgot to add parameters to your query. Example: 'WHERE id = $1'. Underlying error: ${error.message}`,
            );
          }
          throw error;
        }
      }
      return transformedOps;
    });
  }
}
