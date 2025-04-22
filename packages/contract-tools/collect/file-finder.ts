import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";

import type { GitIgnorePattern } from "./git-ignore";

export interface SearchResult {
  file: string;
  line: number;
  match: string;
}

export interface SearchOptions {
  ignorePatterns?: GitIgnorePattern[];
  caseSensitive?: boolean;
  fileExtensions?: string[]; // Array of file extensions to search (e.g., ['ts', 'js'])
}

/**
 * Searches for specified terms within files in a directory and its subdirectories.
 *
 * @param dir - The directory to search in. Can be absolute or relative path.
 * @param searchTerms - Array of terms to search for in the files.
 * @param options - Optional configuration for the search:
 *                 - ignorePatterns: Patterns to exclude from search (like .gitignore patterns)
 *                 - caseSensitive: Whether the search should be case-sensitive (default: false)
 *                 - fileExtensions: Array of file extensions to search (e.g., ['ts', 'js'])
 * @returns Promise<SearchResult[]> - Array of results containing:
 *          - file: Absolute path to the file where match was found
 *          - line: Line number of the match
 *          - match: The matched line content
 */
export async function searchInDirectory(
  dir: string,
  searchTerms: string[],
  options: SearchOptions = {},
): Promise<SearchResult[]> {
  return new Promise((resolve, reject) => {
    const isWindows = os.platform() === "win32";
    const results: SearchResult[] = [];

    const command = isWindows ? "findstr" : "grep";
    const args: string[] = [];

    if (isWindows) {
      // Windows findstr doesn't support excluding patterns directly
      // /S = recursive, /N = line numbers, /I = case-insensitive (unless caseSensitive is true)
      args.push("/S", "/N");
      if (!options.caseSensitive) {
        args.push("/I");
      }
      args.push(...searchTerms.map((term) => `"${term}"`));

      // Handle file extensions for Windows
      if (options.fileExtensions?.length) {
        // On Windows, we need to specify each extension pattern separately
        const patterns = options.fileExtensions.map((ext) => `*.${ext}`);
        args.push(...patterns);
      } else {
        args.push("*.*");
      }
    } else {
      // -r = recursive, -n = line numbers, -I = skip binary files
      // -e allows multiple patterns
      args.push("-rnI");

      // Add case sensitivity flag
      if (!options.caseSensitive) {
        args.push("-i");
      }

      // Add exclude patterns for grep
      if (options.ignorePatterns?.length) {
        for (const { pattern, isNegated } of options.ignorePatterns) {
          if (!isNegated) {
            // Convert gitignore pattern to grep pattern
            const grepPattern = pattern
              .replace(/\*\*/g, "*") // ** is same as * for grep
              .replace(/\?/g, "."); // ? is . in grep

            args.push("--exclude-dir", `"${grepPattern}"`);
            args.push("--exclude", `"${grepPattern}"`);
          }
        }
      }

      // Add file extension pattern for Unix
      if (options.fileExtensions?.length) {
        // Add each extension pattern separately for better compatibility
        options.fileExtensions.forEach((ext) => {
          args.push("--include", `"*.${ext}"`);
        });
      }

      // Add each search term with -e for proper pattern handling
      searchTerms.forEach((term) => {
        args.push("-e", term);
      });
      args.push(".");
    }

    const child = spawn(command, args, { cwd: path.resolve(dir), shell: true });

    child.stdout.on("data", (data: Buffer) => {
      const lines = data.toString().split("\n");
      for (const line of lines) {
        const match = line.trim();
        if (!match) continue;

        // Parse based on OS output format
        const regex = isWindows ? /^(.+):(\d+):(.*)$/ : /^(.+?):(\d+):(.*)$/;

        const parsed = match.match(regex);
        if (parsed) {
          const [, file, lineNum, content] = parsed;
          const absolutePath = path.resolve(dir, file);
          results.push({
            file: absolutePath,
            line: parseInt(lineNum, 10),
            match: content.trim(),
          });
        }
      }
    });

    child.stderr.on("data", (data) => {
      // Only log stderr if it's not the standard "no matches found" message
      const stderr = data.toString();
      if (!stderr.includes("No such file or directory") && !stderr.includes("no matches found")) {
        console.error(`stderr: ${stderr}`);
      }
    });

    child.on("error", reject);

    child.on("close", (code) => {
      // grep returns 1 when no matches are found, which is not an error for us
      if (code !== 0 && code !== 1) {
        reject(new Error(`Search process exited with code ${code}`));
      } else {
        resolve(results);
      }
    });
  });
}
