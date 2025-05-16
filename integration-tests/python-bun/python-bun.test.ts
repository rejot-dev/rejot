import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { $ } from "bun";
import { rm } from "fs/promises";

import {
  parsePostgresConnectionString,
  PostgresClient,
} from "@rejot-dev/adapter-postgres/postgres-client";
import { readManifest } from "@rejot-dev/contract-tools/manifest/manifest.fs";

import {
  pollForResult,
  printSyncProcessOutput,
  waitForProcessExitOrTimeout,
} from "./test-helpers.ts";

describe("Integration Test - Python and Bun", () => {
  let connectionString: string;
  let client: PostgresClient;
  let shouldCleanUp = true;

  beforeAll(async () => {
    // Get connection string.
    if (!process.env["REJOT_SYNC_CLI_TEST_CONNECTION"]) {
      throw new Error("REJOT_SYNC_CLI_TEST_CONNECTION is not set");
    }
    await rm("rejot-manifest.json", { force: true });

    connectionString = process.env["REJOT_SYNC_CLI_TEST_CONNECTION"];

    shouldCleanUp = !process.env["NO_CLEANUP"];

    // Install python dependencies
    await $`python -m venv venv`.text();
    await $`venv/bin/pip install ../../python`.text(); // Relative path to our python package

    // Create the test schema and tables
    const postgresConfig = parsePostgresConnectionString(connectionString);
    client = PostgresClient.fromConfig(postgresConfig);
    await client.connect();

    try {
      await client.query(
        `DELETE FROM rejot_data_store.public_schema_state WHERE manifest_slug = 'python-bun'`,
      );
    } catch {
      // ignore if the table doesn't exist
    }

    await client.tx(async (tx) => {
      await tx.query(`DROP SCHEMA IF EXISTS rejot_integration_tests_python_bun CASCADE`);
      await tx.query(`DROP PUBLICATION IF EXISTS rejot_integration_tests_python_bun`);

      const hasReplicationSlot = await tx.query(
        `SELECT EXISTS (SELECT 1 FROM pg_replication_slots WHERE slot_name = 'rejot_integration_tests_python_bun_data_store')`,
      );

      if (hasReplicationSlot.rows[0]["exists"]) {
        await tx.query(
          `SELECT pg_drop_replication_slot('rejot_integration_tests_python_bun_data_store')`,
        );
      }

      await tx.query(`CREATE SCHEMA rejot_integration_tests_python_bun`);
      await tx.query(
        `
        CREATE TABLE rejot_integration_tests_python_bun.person (
          id SERIAL PRIMARY KEY,
          first_name TEXT,
          last_name TEXT
        )
        `,
      );
      await tx.query(
        `
        CREATE TABLE rejot_integration_tests_python_bun.person_email (
          id SERIAL PRIMARY KEY,
          person_id INTEGER REFERENCES rejot_integration_tests_python_bun.person(id) ON DELETE CASCADE,
          email TEXT
        )
        `,
      );

      await tx.query(
        `
        CREATE TABLE rejot_integration_tests_python_bun.destination_person_email (
          id SERIAL PRIMARY KEY,
          name TEXT,
          emails TEXT
        )
        `,
      );
    });
  });

  afterAll(async () => {
    if (shouldCleanUp) {
      await rm("rejot-manifest.json", { force: true });
      await rm("venv", { recursive: true, force: true });

      await client.tx(async (tx) => {
        await tx.query(`DROP SCHEMA IF EXISTS rejot_integration_tests_python_bun CASCADE`);
        await tx.query(`DROP PUBLICATION IF EXISTS rejot_integration_tests_python_bun`);
        await tx.query(
          `SELECT pg_drop_replication_slot('rejot_integration_tests_python_bun_data_store')`,
        );
      });
    } else {
      const manifest = await readManifest("rejot-manifest.json");
      console.dir(manifest, { depth: null });
      console.log("  (skipped cleanup)");
    }

    await client.end();
  });

  test("Initialize Manifest", async () => {
    const manifest = await $`bunx rejot-cli manifest init --slug python-bun`.text();
    expect(manifest).toBeDefined();
  });

  test("Add a database connection", async () => {
    const connector =
      await $`bunx rejot-cli manifest connection add --slug main-connection --connection-string ${connectionString}`.text();
    expect(connector).toBeDefined();
  });

  test("Add a data store", async () => {
    const dataStore =
      await $`bunx rejot-cli manifest datastore add --connection main-connection --publication rejot_integration_tests_python_bun --slot rejot_integration_tests_python_bun_data_store`.text();
    expect(dataStore).toBeDefined();
  });

  test("Add an event store", async () => {
    const eventStore =
      await $`bunx rejot-cli manifest eventstore add --connection main-connection`.text();
    expect(eventStore).toBeDefined();
  });

  test("Collect Schemas", async () => {
    const collect =
      await $`bunx rejot-cli collect --print --check --write schemas.allschemas.py`.text();
    expect(collect).toContain("Successfully validated 1 schema pairs.");
  });

  test(
    "Sync Data",
    async () => {
      // Start the sync process in the background
      const syncProcess = Bun.spawn({
        cmd: [
          "bunx",
          "rejot-cli",
          "manifest",
          "sync",
          "--log-level=trace",
          "./rejot-manifest.json",
        ],
        stdout: "pipe",
        stderr: "pipe",
      });

      try {
        // Insert a person and two emails in a single transaction
        await client.tx(async (tx) => {
          const personResult = await tx.query(
            `INSERT INTO rejot_integration_tests_python_bun.person (first_name, last_name) VALUES ($1, $2) RETURNING id`,
            ["Alice", "Smith"],
          );
          const personId = personResult.rows[0]["id"];
          await tx.query(
            `INSERT INTO rejot_integration_tests_python_bun.person_email (person_id, email) VALUES ($1, $2), ($1, $3)`,
            [personId, "alice@example.com", "alice@work.com"],
          );
        });

        const result = await pollForResult(
          () =>
            client.query(
              `SELECT * FROM rejot_integration_tests_python_bun.destination_person_email`,
            ),
          (res) => res.rows.length > 0,
        );

        if (result === null) {
          await printSyncProcessOutput(syncProcess);
        }

        expect(result).not.toBeNull();
        expect(result!.rows.length).toBeGreaterThan(0);
      } finally {
        // Ensure the sync process is stopped (gracefully)
        syncProcess.kill("SIGINT");
        const exitedGracefully = await waitForProcessExitOrTimeout(syncProcess, 2000);
        if (!exitedGracefully) {
          await printSyncProcessOutput(syncProcess);
        }
        await syncProcess.exited;
      }
    },
    { timeout: 2000 },
  );
});
