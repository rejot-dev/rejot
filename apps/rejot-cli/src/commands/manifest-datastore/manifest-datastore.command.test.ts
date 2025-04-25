import { runCommand } from "@oclif/test";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { initManifest } from "@rejot-dev/contract-tools/manifest";

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
      await runCommand(
        `manifest:datastore:add --manifest ${manifestPath} --connection test-connection --publication test-pub --slot test-slot`,
      );

      // Read and verify manifest contents
      const manifestContent = JSON.parse(await readFile(manifestPath, "utf-8"));
      expect(manifestContent.dataStores).toHaveLength(1);
      expect(manifestContent.dataStores[0]).toEqual({
        connectionSlug: "test-connection",
        config: {
          connectionType: "postgres",
          publicationName: "test-pub",
          slotName: "test-slot",
        },
      });
    });

    test("error on non-existent connection", async () => {
      const result = await runCommand(
        `manifest:datastore:add --manifest ${manifestPath} --connection non-existent --publication test-pub --slot test-slot`,
      );

      expect(result.error?.message).toContain("Connection 'non-existent' not found in manifest");
    });

    test("error on missing required flags", async () => {
      const result = await runCommand(`manifest:datastore:add --manifest ${manifestPath}`);

      expect(result.error?.message).toContain("--connection is required for add");
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
        `manifest:datastore:add --manifest ${manifestPath} --connection test-connection --publication test-pub1 --slot test-slot1`,
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
      expect(logString).toContain("test-pub1");
    });
  });
});
