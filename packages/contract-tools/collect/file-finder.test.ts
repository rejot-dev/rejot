import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { searchInDirectory } from "./file-finder";
import type { GitIgnorePattern } from "./git-ignore";

describe("file-finder", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "file-finder-test-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe("searchInDirectory", () => {
    it("should find text in files", async () => {
      await mkdir(join(tmpDir, "src"), { recursive: true });
      await writeFile(join(tmpDir, "src", "file1.ts"), "console.log('hello');");
      await writeFile(join(tmpDir, "src", "file2.ts"), "console.error('world');");

      const results = await searchInDirectory(tmpDir, ["console"]);
      expect(results).toHaveLength(2);
      expect(results.map((r) => r.match.trim())).toEqual([
        "console.log('hello');",
        "console.error('world');",
      ]);
    });

    it("should handle multiple search terms", async () => {
      await writeFile(
        join(tmpDir, "test.ts"),
        `
        function test() {
          const x = 1;
          const y = 2;
        }
      `,
      );

      const results = await searchInDirectory(tmpDir, ["const", "="]);
      expect(results).toHaveLength(2);
      expect(results.every((r) => r.file.endsWith("test.ts"))).toBe(true);
    });

    it("should return empty array when no matches found", async () => {
      await writeFile(join(tmpDir, "empty.ts"), "// Empty file");
      const results = await searchInDirectory(tmpDir, ["nonexistent"]);
      expect(results).toEqual([]);
    });

    it("should handle nested directories", async () => {
      await mkdir(join(tmpDir, "deep", "nested", "dir"), { recursive: true });
      await writeFile(join(tmpDir, "deep", "nested", "dir", "file.ts"), "findMe();");

      const results = await searchInDirectory(tmpDir, ["findMe"]);
      expect(results).toHaveLength(1);
      expect(results[0].match.trim()).toBe("findMe();");
    });

    it("should respect gitignore patterns on Unix", async () => {
      // Skip on Windows since it doesn't support exclude patterns
      if (process.platform === "win32") {
        return;
      }

      await mkdir(join(tmpDir, "node_modules"), { recursive: true });
      await mkdir(join(tmpDir, "src"), { recursive: true });

      await writeFile(join(tmpDir, "node_modules", "file.ts"), "findMe();");
      await writeFile(join(tmpDir, "src", "file.ts"), "findMe();");

      const ignorePatterns: GitIgnorePattern[] = [
        { pattern: "node_modules", isNegated: false, isDirectory: true },
      ];

      const results = await searchInDirectory(tmpDir, ["findMe"], { ignorePatterns });
      expect(results).toHaveLength(1);
      expect(results[0].file).toMatch(/src[/\\]file\.ts$/);
    });

    it("should handle binary files", async () => {
      // Create a "binary" file with some non-text content
      const buffer = Buffer.from([0x00, 0x01, 0x02, 0x03]);
      await writeFile(join(tmpDir, "binary.bin"), buffer);
      await writeFile(join(tmpDir, "text.txt"), "findMe");

      const results = await searchInDirectory(tmpDir, ["findMe"]);
      expect(results).toHaveLength(1);
      expect(results[0].file).toMatch(/text\.txt$/);
    });

    it("should include line numbers in results", async () => {
      const content = `line1
        findMe
        line3
        findMe again
        line5`;
      await writeFile(join(tmpDir, "test.txt"), content);

      const results = await searchInDirectory(tmpDir, ["findMe"]);
      expect(results).toHaveLength(2);
      expect(results[0].line).toBe(2);
      expect(results[1].line).toBe(4);
    });

    it("should handle files with special characters in path", async () => {
      const specialDir = join(tmpDir, "special chars");
      await mkdir(specialDir, { recursive: true });
      await writeFile(join(specialDir, "test.txt"), "findMe");

      const results = await searchInDirectory(tmpDir, ["findMe"]);
      expect(results).toHaveLength(1);
      expect(results[0].match.trim()).toBe("findMe");
    });
  });
});
