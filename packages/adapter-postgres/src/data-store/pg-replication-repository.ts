import { getLogger } from "@rejot-dev/contract/logger";

import type { PostgresClient } from "../util/postgres-client";
import { isPostgresError, PG_DUPLICATE_OBJECT } from "../util/postgres-error-codes";

const log = getLogger(import.meta.url);

export interface ReplicationSlot {
  slotName: string;
  database: string;
  active: boolean;
}

export interface Publication {
  pubName: string;
  pubAllTables: boolean;
}

export async function checkLogicalReplication(client: PostgresClient): Promise<boolean> {
  const result = await client.query(`
    SELECT name, setting FROM pg_settings WHERE name = 'wal_level'
  `);

  return result.rows.length > 0 && result.rows[0]["setting"] === "logical";
}

export async function getAvailableReplicationSlots(
  client: PostgresClient,
): Promise<ReplicationSlot[]> {
  try {
    const result = await client.query(
      `
      SELECT slot_name, database, active 
      FROM pg_replication_slots 
      WHERE plugin = 'pgoutput'
      `,
    );

    return result.rows.map((row) => ({
      slotName: row["slot_name"],
      database: row["database"],
      active: row["active"],
    }));
  } catch (error) {
    throw new Error(`Failed to find replication slots: ${error}`);
  }
}

export async function getAvailablePublications(client: PostgresClient): Promise<Publication[]> {
  try {
    const result = await client.query(`
      SELECT pubname, puballtables
      FROM pg_publication
    `);

    return result.rows.map((row) => ({
      pubName: row["pubname"],
      pubAllTables: row["puballtables"],
    }));
  } catch (error) {
    throw new Error(`Failed to find publications: ${error}`);
  }
}

export async function ensureReplicationSlot(
  client: PostgresClient,
  slotName: string,
): Promise<void> {
  // Check if slot exists
  const slotResult = await client.query(
    `
    SELECT slot_name, plugin, database FROM pg_replication_slots WHERE slot_name = $1
  `,
    [slotName],
  );

  log.debug(`Slot result: ${JSON.stringify(slotResult.rows)}`);

  if (slotResult.rows.length === 1) {
    const { plugin, database } = slotResult.rows[0];

    if (client.config.database !== database) {
      throw new Error(
        `Replication slot '${slotName}' exists but is for a different database: '${database}'. ` +
          `Expected database: '${client.config.database}'. Please pick a different slot.`,
      );
    }

    if (plugin !== "pgoutput") {
      throw new Error(
        `Replication slot '${slotName}' exists but is using a different plugin: ${plugin}. Expected plugin: pgoutput`,
      );
    }
  }

  if (slotResult.rows.length === 0) {
    log.debug(`Creating replication slot '${slotName}'...`);
    try {
      await client.query(
        `
        SELECT pg_create_logical_replication_slot($1, 'pgoutput')
      `,
        [slotName],
      );
      log.debug(`Replication slot '${slotName}' created successfully`);
    } catch (error) {
      throw new Error(`Failed to create replication slot: ${error}`);
    }
  }
}

export async function ensurePublication(
  client: PostgresClient,
  publicationName: string,
  createPublication: boolean,
): Promise<void> {
  // Check if publication exists
  const pubResult = await client.query(
    `
    SELECT pubname, puballtables FROM pg_publication WHERE pubname = $1
  `,
    [publicationName],
  );

  log.debug(`Publication result: ${JSON.stringify(pubResult.rows)}`);

  if (pubResult.rows.length === 1 && pubResult.rows[0]["puballtables"]) {
    log.debug(`Publication '${publicationName}' exists FOR ALL TABLES.`);
  } else if (pubResult.rows.length === 0) {
    if (!createPublication) {
      throw new Error(
        `Publication '${publicationName}' does not exist and create-publication is set to false`,
      );
    }

    log.debug(`Creating publication '${publicationName}'...`);

    await client.query(`
        CREATE PUBLICATION ${publicationName} FOR ALL TABLES
      `);
    log.debug(`Publication '${publicationName}' created successfully`);
  } else {
    // Ensure watermarks table is in publication
    try {
      await client.query(`
        ALTER PUBLICATION ${publicationName} ADD TABLE rejot.watermarks
      `);
      log.debug(`Added rejot.watermarks table to publication '${publicationName}'`);
    } catch (error) {
      if (isPostgresError(error, PG_DUPLICATE_OBJECT)) {
        log.debug(`ReJot watermark table already in '${publicationName}' publication`);
      } else {
        throw error;
      }
    }
    log.debug(`Publication '${publicationName}' already exists`);
  }
}
