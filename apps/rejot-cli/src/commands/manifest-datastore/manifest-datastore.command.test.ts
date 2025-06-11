import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { initManifest } from "@rejot-dev/contract-tools/manifest";

import { runCommand } from "../../runTestCommand.ts";

describe("ManifestDataStore commands", () => {
  let tmpDir: string;
  let manifestPath: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), "rejot-test-"));
    manifestPath = path.join(tmpDir, "rejot-manifest.json");
    await initManifest(manifestPath, "test");

    // Add a test connection that we'll use
    await runCommand(
      `manifest:connection:add --manifest ${manifestPath} --slug test-connection --connection-string postgresql://user:pass@localhost:5432/testdb`,
    );
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true });
  });

  describe("add datastore", () => {
    test("add datastore with valid connection", async () => {
      const result = await runCommand(
        `manifest:datastore:add --manifest ${manifestPath} --connection test-connection --publication test_pub --slot test_slot`,
      );
      console.log(result.stderr);

      // Read and verify manifest contents
      const manifestContent = JSON.parse(await readFile(manifestPath, "utf-8"));
      expect(manifestContent.dataStores).toHaveLength(1);
      expect(manifestContent.dataStores[0]).toEqual({
        connectionSlug: "test-connection",
        config: {
          connectionType: "postgres",
          publicationName: "test_pub",
          slotName: "test_slot",
        },
      });
    });

    test("error on non-existent connection", async () => {
      const result = await runCommand(
        `manifest:datastore:add --manifest ${manifestPath} --connection non-existent --publication test_pub --slot test_slot`,
      );

      expect(result.error?.message).toContain("Connection 'non-existent' not found in manifest");
    });

    test("error on missing required flags", async () => {
      const result = await runCommand(`manifest:datastore:add --manifest ${manifestPath}`);

      expect(result.error?.message).toContain("--connection is required for add");
    });

    test("error on invalid publication name", async () => {
      const result = await runCommand(
        `manifest:datastore:add --manifest ${manifestPath} --connection test-connection --publication InvalidPub --slot test_slot`,
      );
      expect(result.error?.message).toContain(
        "--publication must be a valid PostgreSQL identifier. Only lowercase letters, numbers, and underscores are allowed.",
      );
    });

    test("error on invalid slot name", async () => {
      const result = await runCommand(
        `manifest:datastore:add --manifest ${manifestPath} --connection test-connection --publication test_pub --slot InvalidSlot`,
      );
      expect(result.error?.message).toContain(
        "--slot must be a valid PostgreSQL identifier. Only lowercase letters, numbers, and underscores are allowed.",
      );
    });

    test("add datastore with underscores and numbers in publication and slot", async () => {
      await runCommand(
        `manifest:datastore:add --manifest ${manifestPath} --connection test-connection --publication pub_123 --slot slot_456`,
      );
      const manifestContent = JSON.parse(await readFile(manifestPath, "utf-8"));
      expect(manifestContent.dataStores).toHaveLength(1);
      expect(manifestContent.dataStores[0]).toEqual({
        connectionSlug: "test-connection",
        config: {
          connectionType: "postgres",
          publicationName: "pub_123",
          slotName: "slot_456",
        },
      });
    });
  });

  describe("remove datastore", () => {
    beforeEach(async () => {
      // Add a test datastore that we'll remove
      await runCommand(
        `manifest:datastore:add --manifest ${manifestPath} --connection test-connection --publication test-pub`,
      );
    });

    test("remove existing datastore", async () => {
      await runCommand(`manifest:datastore:remove --manifest ${manifestPath} test-connection`);

      // Read and verify manifest contents
      const manifestContent = JSON.parse(await readFile(manifestPath, "utf-8"));
      expect(manifestContent.dataStores).toHaveLength(0);
    });

    test("error on removing non-existent datastore", async () => {
      const result = await runCommand(
        `manifest:datastore:remove --manifest ${manifestPath} non-existent`,
      );

      expect(result.error?.message).toContain(
        "Data store with connection 'non-existent' not found in manifest",
      );
    });
  });

  describe("list datastores", () => {
    test("list empty datastores", async () => {
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (message: string) => logs.push(message);

      await runCommand(`manifest:datastore:list --manifest ${manifestPath}`);

      // Restore console.log
      console.log = originalLog;

      const logString = logs.join("\n");

      expect(logString).toContain("No data stores configured");
    });

    test("list all datastores", async () => {
      // Add some test datastores
      await runCommand(
        `manifest:datastore:add --manifest ${manifestPath} --connection test-connection --publication test_pub1 --slot test_slot1`,
      );

      // Capture console output
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (message: string) => logs.push(message);

      await runCommand(`manifest:datastore:list --manifest ${manifestPath}`);

      // Restore console.log
      console.log = originalLog;

      const logString = logs.join("\n");

      expect(logString).toContain("Data Stores");
      expect(logString).toContain("test-connection");
      expect(logString).toContain("test_pub1");
    });
  });
});
