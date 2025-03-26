import { Client } from "pg";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

export function getClient(): Client {
  return new Client({
    connectionString: process.env["DATABASE_URL"],
  });
}

async function getMigrations(path: string): Promise<string[]> {
  const migrations = await readdir(path);
  return migrations.sort().filter((migration) => migration.endsWith(".sql"));
}

async function ensureMigrationsTable(client: Client) {
  await client.query(`CREATE TABLE IF NOT EXISTS migrations (
    id SERIAL PRIMARY KEY,
    version INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );`);
}

async function getMigrationVersion(client: Client): Promise<number | null> {
  // Return version of the last applied migration (0 indexed)
  const result = await client.query(`SELECT version FROM migrations ORDER BY id DESC LIMIT 1;`);
  if (result.rows.length === 0) {
    return null;
  }
  return parseInt(result.rows[0].version);
}

export async function initSchema(client: Client, migrationsPath: string) {
  await ensureMigrationsTable(client);
  const currentVersion = await getMigrationVersion(client);

  console.log(`Current database version: ${currentVersion}`);
  const migrations = await getMigrations(migrationsPath);

  for (const [index, migration] of migrations.entries()) {
    if (currentVersion !== null && currentVersion >= index) {
      continue;
    }
    console.log(`Applying migration ${index}: ${migration}`);
    const migrationPath = join(migrationsPath, migration);
    const migrationSQL = await readFile(migrationPath, "utf-8");
    await client.query(`BEGIN`);
    await client.query(migrationSQL);
    await client.query(`INSERT INTO migrations (version) VALUES (${index})`);
    await client.query(`COMMIT`);
  }
}
