import type { PostgresClient } from "../util/postgres-client";
import type { TransformedOperationWithSource } from "@rejot-dev/contract/event-store";
import type { PublicSchemaReference } from "@rejot-dev/contract/cursor";

type EventRow = {
  operation: "insert" | "update" | "delete";
  transactionId: string;
  publicSchemaName: string;
  publicSchemaMajorVersion: number;
  publicSchemaMinorVersion: number;
  manifestSlug: string;
  object: Record<string, unknown>;
};

export class PostgresEventStoreRepository {
  async insertDataStore(client: PostgresClient, slug: string): Promise<number> {
    const result = await client.query(
      `INSERT INTO rejot_events.data_store (slug)
       VALUES ($1)
       ON CONFLICT (slug) DO UPDATE SET slug = EXCLUDED.slug
       RETURNING id`,
      [slug],
    );
    return result.rows[0]["id"];
  }

  async writeEvents(
    client: PostgresClient,
    transactionId: string,
    operations: Array<{
      index: number;
      operation: TransformedOperationWithSource;
    }>,
  ): Promise<void> {
    for (const { index, operation: op } of operations) {
      await client.query(
        `INSERT INTO rejot_events.events (
          transaction_id,
          operation_idx,
          operation, 
          public_schema_name,
          public_schema_major_version,
          public_schema_minor_version,
          manifest_slug,
          object
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT DO NOTHING`,
        [
          transactionId,
          index,
          op.type,
          op.sourcePublicSchema.name,
          op.sourcePublicSchema.version.major,
          op.sourcePublicSchema.version.minor,
          op.sourceManifestSlug,
          op.type === "delete" ? null : op.object,
        ],
      );
    }
  }

  async getLastTransactionId(
    client: PostgresClient,
    { schema }: PublicSchemaReference,
  ): Promise<string | null> {
    const result = await client.query<{ transaction_id: string }>(
      `SELECT transaction_id
       FROM rejot_events.events
       WHERE public_schema_name = $1
       AND public_schema_major_version = $2
       ORDER BY transaction_id DESC
       LIMIT 1`,
      [schema.name, schema.version.major],
    );

    return result.rows.length > 0 ? result.rows[0]["transaction_id"] : null;
  }

  async readEvents(
    client: PostgresClient,
    { schema }: PublicSchemaReference,
    transactionId: string | null,
    limit: number,
  ): Promise<EventRow[]> {
    let query: string;
    let params: (string | number)[];

    if (transactionId) {
      query = `
        SELECT 
          operation,
          transaction_id,
          public_schema_name,
          public_schema_major_version,
          public_schema_minor_version,
          manifest_slug,
          object
        FROM rejot_events.events
        WHERE transaction_id > $1
        AND public_schema_name = $2
        AND public_schema_major_version = $3
        ORDER BY transaction_id, operation_idx
        LIMIT $4
      `;

      params = [transactionId, schema.name, schema.version.major, limit];
    } else {
      query = `
        SELECT 
          operation,
          transaction_id,
          public_schema_name,
          public_schema_major_version,
          public_schema_minor_version,
          manifest_slug,
          object
        FROM rejot_events.events
        WHERE public_schema_name = $1
        AND public_schema_major_version = $2
        ORDER BY transaction_id, operation_idx
        LIMIT $3
      `;

      params = [schema.name, schema.version.major, limit];
    }

    const result = await client.query(query, params);
    return result.rows.map((row) => ({
      operation: row["operation"],
      transactionId: row["transaction_id"],
      publicSchemaName: row["public_schema_name"],
      publicSchemaMajorVersion: row["public_schema_major_version"],
      publicSchemaMinorVersion: row["public_schema_minor_version"],
      manifestSlug: row["manifest_slug"],
      object: row["object"],
    }));
  }
}
