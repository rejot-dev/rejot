import { spawn } from "node:child_process";
import path from "node:path";
import os from "node:os";
import type { GitIgnorePattern } from "./git-ignore";

export interface SearchResult {
  file: string;
  line: number;
  match: string;
}

export interface SearchOptions {
  ignorePatterns?: GitIgnorePattern[];
}

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
      // /S = recursive, /N = line numbers, /I = case-insensitive
      args.push("/S", "/N", "/I");
      args.push(...searchTerms.map((term) => `"${term}"`));
      args.push("*.*");
    } else {
      // -r = recursive, -n = line numbers, -I = skip binary files
      // -e allows multiple patterns
      args.push("-rniI");

      // Add exclude patterns for grep
      if (options.ignorePatterns?.length) {
        for (const { pattern, isNegated } of options.ignorePatterns) {
          if (!isNegated) {
            // Convert gitignore pattern to grep exclude pattern
            const grepPattern = pattern
              .replace(/\*\*/g, "*") // ** is same as * for grep
              .replace(/\?/g, "."); // ? is . in grep

            args.push("--exclude-dir", grepPattern);
            args.push("--exclude", grepPattern);
          }
        }
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
