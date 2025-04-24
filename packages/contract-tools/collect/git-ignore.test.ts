import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { collectGitIgnore, shouldIgnorePath } from "./git-ignore.ts";

describe("git-ignore", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "git-ignore-test-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe("collectGitIgnore", () => {
    it("should return empty array when no .gitignore exists", async () => {
      const patterns = await collectGitIgnore(tmpDir);
      expect(patterns).toEqual([]);
    });

    it("should parse single .gitignore file", async () => {
      await writeFile(join(tmpDir, ".gitignore"), "node_modules/\n*.log\n!important.log");

      const patterns = await collectGitIgnore(tmpDir);
      expect(patterns).toHaveLength(3);
      expect(patterns).toEqual([
        { pattern: "node_modules", isNegated: false, isDirectory: true },
        { pattern: "*.log", isNegated: false, isDirectory: false },
        { pattern: "important.log", isNegated: true, isDirectory: false },
      ]);
    });

    it("should handle empty lines and comments", async () => {
      const content = `
        # This is a comment
        node_modules/
        
        # Another comment
        *.log
      `;
      await writeFile(join(tmpDir, ".gitignore"), content);

      const patterns = await collectGitIgnore(tmpDir);
      expect(patterns).toHaveLength(2);
      expect(patterns).toEqual([
        { pattern: "node_modules", isNegated: false, isDirectory: true },
        { pattern: "*.log", isNegated: false, isDirectory: false },
      ]);
    });

    it("should collect patterns from parent directories", async () => {
      const subDir = join(tmpDir, "sub", "dir");
      await mkdir(subDir, { recursive: true });

      await writeFile(join(tmpDir, ".gitignore"), "*.log");
      await writeFile(join(tmpDir, "sub", ".gitignore"), "node_modules/");
      await writeFile(join(subDir, ".gitignore"), "*.tmp");

      const patterns = await collectGitIgnore(subDir);
      expect(patterns).toHaveLength(3);
      expect(patterns.map((p) => p.pattern)).toEqual(["*.tmp", "node_modules", "*.log"]);
    });
  });

  describe("shouldIgnorePath", () => {
    it("should match simple patterns", () => {
      const patterns = [
        { pattern: "node_modules", isNegated: false, isDirectory: true },
        { pattern: "*.log", isNegated: false, isDirectory: false },
      ];

      expect(shouldIgnorePath("node_modules/file.txt", patterns)).toBe(true);
      expect(shouldIgnorePath("error.log", patterns)).toBe(true);
      expect(shouldIgnorePath("src/file.txt", patterns)).toBe(false);
    });

    it("should handle negated patterns", () => {
      const patterns = [
        { pattern: "*.log", isNegated: false, isDirectory: false },
        { pattern: "important.log", isNegated: true, isDirectory: false },
      ];

      expect(shouldIgnorePath("error.log", patterns)).toBe(true);
      expect(shouldIgnorePath("important.log", patterns)).toBe(false);
    });

    it("should handle directory patterns", () => {
      const patterns = [{ pattern: "node_modules", isNegated: false, isDirectory: true }];

      expect(shouldIgnorePath("node_modules", patterns)).toBe(true);
      expect(shouldIgnorePath("node_modules/", patterns)).toBe(true);
      expect(shouldIgnorePath("node_modules/file.txt", patterns)).toBe(true);
      expect(shouldIgnorePath("not_node_modules", patterns)).toBe(false);
    });

    it("should handle glob patterns", () => {
      const patterns = [
        { pattern: "**/*.test.ts", isNegated: false, isDirectory: false },
        { pattern: "temp?", isNegated: false, isDirectory: false },
      ];

      expect(shouldIgnorePath("src/file.test.ts", patterns)).toBe(true);
      expect(shouldIgnorePath("test.ts", patterns)).toBe(false);
      expect(shouldIgnorePath("temp1", patterns)).toBe(true);
      expect(shouldIgnorePath("temp", patterns)).toBe(false);
    });

    it("should normalize paths", () => {
      const patterns = [{ pattern: "build", isNegated: false, isDirectory: true }];

      expect(shouldIgnorePath("build\\file.txt", patterns)).toBe(true);
      expect(shouldIgnorePath("./build/file.txt", patterns)).toBe(true);
      expect(shouldIgnorePath("build/", patterns)).toBe(true);
    });
  });
});
