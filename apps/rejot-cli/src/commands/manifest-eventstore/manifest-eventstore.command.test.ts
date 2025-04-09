import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { runCommand } from "@oclif/test";
import { initManifest } from "@rejot-dev/contract/manifest.fs";

describe("ManifestEventStore commands", () => {
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

  describe("add eventstore", () => {
    test("add eventstore with valid connection", async () => {
      await runCommand(
        `manifest:eventstore:add --manifest ${manifestPath} --connection test-connection`,
      );

      // Read and verify manifest contents
      const manifestContent = JSON.parse(await readFile(manifestPath, "utf-8"));
      expect(manifestContent.eventStores).toHaveLength(1);
      expect(manifestContent.eventStores[0]).toEqual({
        connectionSlug: "test-connection",
      });
    });

    test("error on non-existent connection", async () => {
      const result = await runCommand(
        `manifest:eventstore:add --manifest ${manifestPath} --connection non-existent`,
      );

      expect(result.error?.message).toContain("Connection 'non-existent' not found in manifest");
    });

    test("error on duplicate connection", async () => {
      // Add first eventstore
      await runCommand(
        `manifest:eventstore:add --manifest ${manifestPath} --connection test-connection`,
      );

      // Try to add duplicate
      const result = await runCommand(
        `manifest:eventstore:add --manifest ${manifestPath} --connection test-connection`,
      );

      expect(result.error?.message).toContain(
        "Event store with connection 'test-connection' already exists",
      );
    });
  });

  describe("remove eventstore", () => {
    beforeEach(async () => {
      // Add a test eventstore that we'll remove
      await runCommand(
        `manifest:eventstore:add --manifest ${manifestPath} --connection test-connection`,
      );
    });

    test("remove existing eventstore", async () => {
      await runCommand(`manifest:eventstore:remove --manifest ${manifestPath} test-connection`);

      // Read and verify manifest contents
      const manifestContent = JSON.parse(await readFile(manifestPath, "utf-8"));
      expect(manifestContent.eventStores).toHaveLength(0);
    });

    test("error on removing non-existent eventstore", async () => {
      const result = await runCommand(
        `manifest:eventstore:remove --manifest ${manifestPath} non-existent`,
      );

      expect(result.error?.message).toContain(
        "Event store with connection 'non-existent' not found in manifest",
      );
    });
  });

  describe("list eventstores", () => {
    test("list empty eventstores", async () => {
      // Capture console output
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (message: string) => logs.push(message);

      await runCommand(`manifest:eventstore:list --manifest ${manifestPath}`);

      // Restore console.log
      console.log = originalLog;

      expect(logs).toContain("No event stores found in manifest");
    });

    test("list all eventstores", async () => {
      // Add some test eventstores
      await runCommand(
        `manifest:eventstore:add --manifest ${manifestPath} --connection test-connection`,
      );

      // Capture console output
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (message: string) => logs.push(message);

      await runCommand(`manifest:eventstore:list --manifest ${manifestPath}`);

      // Restore console.log
      console.log = originalLog;

      expect(logs).toContain("Event Stores:");
      expect(logs).toContain("  - Connection: test-connection");
    });
  });
});
