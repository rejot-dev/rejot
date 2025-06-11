import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { initManifest } from "@rejot-dev/contract-tools/manifest";

import { runCommand } from "../../runTestCommand.ts";

describe("ManifestConnection commands", () => {
  let tmpDir: string;
  let manifestPath: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), "rejot-test-"));
    manifestPath = path.join(tmpDir, "rejot-manifest.json");
    await initManifest(manifestPath, "test");
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true });
  });

  describe("add connection", () => {
    test("with connection string", async () => {
      await runCommand(
        `manifest:connection:add --manifest ${manifestPath} --slug test-db --connection-string postgresql://user:pass@localhost:5432/testdb`,
      );

      // Read and verify manifest contents
      const manifestContent = JSON.parse(await readFile(manifestPath, "utf-8"));
      expect(manifestContent.connections).toHaveLength(1);
      expect(manifestContent.connections[0]).toEqual({
        slug: "test-db",
        config: {
          connectionType: "postgres",
          host: "localhost",
          port: 5432,
          user: "user",
          password: "pass",
          database: "testdb",
        },
      });
    });

    test("with individual parameters", async () => {
      await runCommand(
        `manifest:connection:add --manifest ${manifestPath} --slug test-db --type postgres --host localhost --port 5432 --user user --password pass --database testdb`,
      );

      // Read and verify manifest contents
      const manifestContent = JSON.parse(await readFile(manifestPath, "utf-8"));
      expect(manifestContent.connections).toHaveLength(1);
      expect(manifestContent.connections[0]).toEqual({
        slug: "test-db",
        config: {
          connectionType: "postgres",
          host: "localhost",
          port: 5432,
          user: "user",
          password: "pass",
          database: "testdb",
        },
      });
    });
  });

  describe("update connection", () => {
    test("update existing connection", async () => {
      // First add a connection
      await runCommand(
        `manifest:connection:add --manifest ${manifestPath} --slug test-db --connection-string postgresql://user:pass@localhost:5432/testdb`,
      );

      // Then update it
      await runCommand(
        `manifest:connection:update --manifest ${manifestPath} test-db --connection-string postgresql://newuser:newpass@newhost:5433/newdb`,
      );

      // Read and verify manifest contents
      const manifestContent = JSON.parse(await readFile(manifestPath, "utf-8"));
      expect(manifestContent.connections).toHaveLength(1);
      expect(manifestContent.connections[0]).toEqual({
        slug: "test-db",
        config: {
          connectionType: "postgres",
          host: "newhost",
          port: 5433,
          user: "newuser",
          password: "newpass",
          database: "newdb",
        },
      });
    });
  });

  describe("remove connection", () => {
    test("remove existing connection", async () => {
      // First add a connection
      await runCommand(
        `manifest:connection:add --manifest ${manifestPath} --slug test-db --connection-string postgresql://user:pass@localhost:5432/testdb`,
      );

      // Then remove it
      await runCommand(`manifest:connection:remove --manifest ${manifestPath} test-db`);

      // Read and verify manifest contents
      const manifestContent = JSON.parse(await readFile(manifestPath, "utf-8"));
      expect(manifestContent.connections).toHaveLength(0);
    });
  });

  describe("list connections", () => {
    test("list all connections", async () => {
      // First add some connections
      await runCommand(
        `manifest:connection:add --manifest ${manifestPath} --slug db1 --connection-string postgresql://user1:pass1@host1:5432/db1`,
      );

      await runCommand(
        `manifest:connection:add --manifest ${manifestPath} --slug db2 --connection-string postgresql://user2:pass2@host2:5433/db2`,
      );

      // Capture console output
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (message: string) => logs.push(message);

      // List connections
      await runCommand(`manifest:connection:list --manifest ${manifestPath}`);

      // Restore console.log
      console.log = originalLog;

      // Verify output
      expect(logs).toContain("Connections:");
      expect(logs).toContain("  - db1 (postgres)");
      expect(logs).toContain("    Host: host1:5432");
      expect(logs).toContain("    Database: db1");
      expect(logs).toContain("    User: user1");
      expect(logs).toContain("  - db2 (postgres)");
      expect(logs).toContain("    Host: host2:5433");
      expect(logs).toContain("    Database: db2");
      expect(logs).toContain("    User: user2");
    });
  });

  describe("error handling", () => {
    test("error on duplicate slug", async () => {
      // First add a connection
      await runCommand(
        `manifest:connection:add --manifest ${manifestPath} --slug test-db --connection-string postgresql://user:pass@localhost:5432/testdb`,
      );

      // Try to add another connection with the same slug
      const result = await runCommand(
        `manifest:connection:add --manifest ${manifestPath} --slug test-db --connection-string postgresql://other:pass@localhost:5432/otherdb`,
      );

      expect(result.error?.message).toContain("Connection with slug 'test-db' already exists");
    });

    test("error on updating non-existent connection", async () => {
      const result = await runCommand(
        `manifest:connection:update --manifest ${manifestPath} non-existent --connection-string postgresql://user:pass@localhost:5432/testdb`,
      );

      expect(result.error?.message).toContain("Connection 'non-existent' not found in manifest");
    });

    test("error on removing non-existent connection", async () => {
      const result = await runCommand(
        `manifest:connection:remove --manifest ${manifestPath} non-existent`,
      );

      expect(result.error?.message).toContain("Connection 'non-existent' not found in manifest");
    });
  });
});
