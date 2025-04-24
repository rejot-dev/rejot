import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { CURRENT_MANIFEST_FILE_VERSION, DEFAULT_MANIFEST_FILENAME } from "./manifest.fs";
import { ManifestWorkspaceResolver } from "./manifest-workspace-resolver.ts";

// Helper function to create manifest files
const createManifestFile = async (
  dirPath: string,
  content: object,
  filename = DEFAULT_MANIFEST_FILENAME,
) => {
  await mkdir(dirPath, { recursive: true });
  await writeFile(join(dirPath, filename), JSON.stringify(content, null, 2));
};

describe("ManifestWorkspaceResolver", () => {
  let tmpDir: string;
  let resolver: ManifestWorkspaceResolver;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "manifest-resolver-test-"));
    resolver = new ManifestWorkspaceResolver();
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe("resolveWorkspace", () => {
    it("should return null if no manifest is found", async () => {
      const result = await resolver.resolveWorkspace({ startDir: tmpDir });
      expect(result).toBeNull();
    });

    it("should resolve only the ancestor if no workspaces field exists", async () => {
      const manifestContent = {
        slug: "root-project",
        manifestVersion: CURRENT_MANIFEST_FILE_VERSION,
      };
      await createManifestFile(tmpDir, manifestContent);

      const result = await resolver.resolveWorkspace({ startDir: tmpDir });

      expect(result).not.toBeNull();
      expect(result?.rootPath).toBe(tmpDir);
      expect(result?.ancestor.path).toBe(DEFAULT_MANIFEST_FILENAME);
      expect(result?.ancestor.manifest.slug).toBe("root-project");
      expect(result?.children).toEqual([]);
    });

    it("should resolve only the ancestor if workspaces field is empty", async () => {
      const manifestContent = {
        slug: "root-project",
        manifestVersion: CURRENT_MANIFEST_FILE_VERSION,
        workspaces: [],
      };
      await createManifestFile(tmpDir, manifestContent);

      const result = await resolver.resolveWorkspace({ startDir: tmpDir });

      expect(result).not.toBeNull();
      expect(result?.rootPath).toBe(tmpDir);
      expect(result?.ancestor.manifest.slug).toBe("root-project");
      expect(result?.children).toEqual([]);
    });

    it("should resolve ancestor and children with direct file paths", async () => {
      const rootManifest = {
        slug: "root",
        manifestVersion: CURRENT_MANIFEST_FILE_VERSION,
        workspaces: ["packages/pkg1/manifest.json", "packages/pkg2/manifest.json"],
      };
      const child1Manifest = { slug: "child1", manifestVersion: CURRENT_MANIFEST_FILE_VERSION };
      const child2Manifest = { slug: "child2", manifestVersion: CURRENT_MANIFEST_FILE_VERSION };

      await createManifestFile(tmpDir, rootManifest);
      const pkg1Dir = join(tmpDir, "packages", "pkg1");
      const pkg2Dir = join(tmpDir, "packages", "pkg2");
      await createManifestFile(pkg1Dir, child1Manifest, "manifest.json");
      await createManifestFile(pkg2Dir, child2Manifest, "manifest.json");

      const result = await resolver.resolveWorkspace({ startDir: tmpDir });

      expect(result).not.toBeNull();
      expect(result?.rootPath).toBe(tmpDir);
      expect(result?.ancestor.manifest.slug).toBe("root");
      expect(result?.children).toHaveLength(2);

      const childPaths = result?.children.map((c) => c.path).sort();
      expect(childPaths).toEqual([
        join("packages", "pkg1", "manifest.json"),
        join("packages", "pkg2", "manifest.json"),
      ]);

      const childSlugs = result?.children.map((c) => c.manifest.slug).sort();
      expect(childSlugs).toEqual(["child1", "child2"]);
    });

    it("should resolve correctly when startDir is a subdirectory", async () => {
      const rootManifest = {
        slug: "root",
        manifestVersion: CURRENT_MANIFEST_FILE_VERSION,
        workspaces: ["packages/pkg/manifest.json"],
      };
      const childManifest = { slug: "child", manifestVersion: CURRENT_MANIFEST_FILE_VERSION };

      const subDir = join(tmpDir, "some", "subdir");
      await createManifestFile(tmpDir, rootManifest);
      const pkgDir = join(tmpDir, "packages", "pkg");
      await createManifestFile(pkgDir, childManifest, "manifest.json");

      await mkdir(subDir, { recursive: true });

      const result = await resolver.resolveWorkspace({ startDir: subDir });

      expect(result).not.toBeNull();
      expect(result?.rootPath).toBe(tmpDir);
      expect(result?.ancestor.manifest.slug).toBe("root");
      expect(result?.ancestor.path).toBe(DEFAULT_MANIFEST_FILENAME);
      expect(result?.children).toHaveLength(1);
      expect(result?.children[0].manifest.slug).toBe("child");
      expect(result?.children[0].path).toBe(join("packages", "pkg", "manifest.json"));
    });

    it("should use custom filename if provided", async () => {
      const customFilename = "project.json";
      const rootManifest = { slug: "root-custom", manifestVersion: CURRENT_MANIFEST_FILE_VERSION };
      await createManifestFile(tmpDir, rootManifest, customFilename);

      const result = await resolver.resolveWorkspace({
        startDir: tmpDir,
        filename: customFilename,
      });

      expect(result).not.toBeNull();
      expect(result?.rootPath).toBe(tmpDir);
      expect(result?.ancestor.path).toBe(customFilename);
      expect(result?.ancestor.manifest.slug).toBe("root-custom");
      expect(result?.children).toEqual([]);
    });

    it("should handle direct file references that don't exist", async () => {
      const rootManifest = {
        slug: "root",
        manifestVersion: CURRENT_MANIFEST_FILE_VERSION,
        workspaces: ["packages/exists/manifest.json", "packages/nonexistent/custom.json"],
      };

      const existingManifest = { slug: "exists", manifestVersion: CURRENT_MANIFEST_FILE_VERSION };

      await createManifestFile(tmpDir, rootManifest);
      await createManifestFile(
        join(tmpDir, "packages", "exists"),
        existingManifest,
        "manifest.json",
      );

      const result = await resolver.resolveWorkspace({ startDir: tmpDir });

      expect(result).not.toBeNull();
      expect(result?.rootPath).toBe(tmpDir);
      expect(result?.ancestor.manifest.slug).toBe("root");
      expect(result?.children).toHaveLength(1);
      expect(result?.children[0].path).toBe(join("packages", "exists", "manifest.json"));
      expect(result?.children[0].manifest.slug).toBe("exists");
    });
  });

  // Add tests for getManifestInfo and workspaceToSyncManifest later if needed
});
