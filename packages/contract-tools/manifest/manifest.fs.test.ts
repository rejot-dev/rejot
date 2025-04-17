import { test, expect, beforeAll, afterAll } from "bun:test";
import { initManifest, readManifest, writeManifest } from "./manifest.fs";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

let tempDir: string;
let manifestPath: string;

beforeAll(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "rejot-test-"));
  manifestPath = join(tempDir, "rejot-manifest.json");
  await initManifest(manifestPath, "test-manifest");
});

afterAll(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

test("writeManifest - overrides manifest", async () => {
  const manifest = await readManifest(manifestPath);

  expect(manifest.slug).toBe("test-manifest");

  manifest.connections = [
    {
      slug: "test-connection",
      config: {
        connectionType: "postgres",
        host: "localhost",
        port: 5432,
        user: "test",
        password: "test",
        database: "test",
      },
    },
  ];

  await writeManifest(manifest, manifestPath);

  const manifest2 = await readManifest(manifestPath);

  expect(manifest2.connections).toEqual(manifest.connections);
});
