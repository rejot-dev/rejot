import type { PostgresClient } from "../util/postgres-client";

export type PublicSchemaReference = {
  manifestSlug: string;
  name: string;
  majorVersion: number;
};

export type PublicSchemaState = {
  reference: PublicSchemaReference;
  lastSeenTransactionId: string | null;
};

export async function getPublicSchemaStates(client: PostgresClient): Promise<PublicSchemaState[]> {
  const result = await client.query(
    `SELECT manifest_slug, public_schema_name, public_schema_major_version, last_seen_transaction_id
     FROM rejot_data_store.public_schema_state`,
  );

  return result.rows.map((row) => ({
    reference: {
      manifestSlug: row["manifest_slug"],
      name: row["public_schema_name"],
      majorVersion: row["public_schema_major_version"],
      dataStore: row["public_schema_name"],
    },
    lastSeenTransactionId: row["last_seen_transaction_id"],
  }));
}

export async function updatePublicSchemaState(
  client: PostgresClient,
  reference: PublicSchemaReference,
  lastSeenTransactionId: string,
): Promise<boolean> {
  const result = await client.query(
    `INSERT INTO rejot_data_store.public_schema_state
       (manifest_slug, public_schema_name, public_schema_major_version, last_seen_transaction_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (manifest_slug, public_schema_name, public_schema_major_version)
     DO UPDATE SET
       last_seen_transaction_id = $4,
       updated_at = CURRENT_TIMESTAMP
     WHERE $4 >= rejot_data_store.public_schema_state.last_seen_transaction_id
     RETURNING id`,
    [reference.manifestSlug, reference.name, reference.majorVersion, lastSeenTransactionId],
  );

  return result.rows.length > 0;
}
