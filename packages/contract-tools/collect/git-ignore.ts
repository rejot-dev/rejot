import { readFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";

export interface GitIgnorePattern {
  pattern: string;
  isNegated: boolean;
  isDirectory: boolean;
}

/**
 * Parses a single .gitignore line into a pattern object
 */
function parseGitIgnoreLine(line: string): GitIgnorePattern | null {
  // Remove comments and trim whitespace
  const trimmed = line.split("#")[0].trim();
  if (!trimmed) return null;

  const isNegated = trimmed.startsWith("!");
  const pattern = isNegated ? trimmed.slice(1) : trimmed;
  const isDirectory = pattern.endsWith("/");

  // Remove leading and trailing slashes
  const cleanPattern = pattern.replace(/^\/+|\/+$/g, "");

  return {
    pattern: cleanPattern,
    isNegated,
    isDirectory,
  };
}

/**
 * Reads and parses a .gitignore file
 */
async function readGitIgnoreFile(filePath: string): Promise<GitIgnorePattern[]> {
  try {
    await access(filePath, constants.R_OK);
    const content = await readFile(filePath, "utf-8");
    return content
      .split("\n")
      .map(parseGitIgnoreLine)
      .filter((pattern): pattern is GitIgnorePattern => pattern !== null);
  } catch (_error) {
    // File doesn't exist or isn't readable
    return [];
  }
}

/**
 * Collects all gitignore patterns from a directory and its parent directories
 */
export async function collectGitIgnore(startDir: string): Promise<GitIgnorePattern[]> {
  const patterns: GitIgnorePattern[] = [];
  let currentDir = path.resolve(startDir);
  const root = path.parse(currentDir).root;

  // Collect patterns from all .gitignore files up to root
  while (currentDir !== root) {
    const gitignorePath = path.join(currentDir, ".gitignore");
    const newPatterns = await readGitIgnoreFile(gitignorePath);
    patterns.push(...newPatterns);
    currentDir = path.dirname(currentDir);
  }

  return patterns;
}

/**
 * Checks if a file path should be ignored based on gitignore patterns
 */
export function shouldIgnorePath(filePath: string, patterns: GitIgnorePattern[]): boolean {
  // Normalize path to use forward slashes and remove leading ./
  const normalizedPath = filePath.replace(/\\/g, "/").replace(/^\.\//, "");

  let shouldIgnore = false;

  for (const { pattern, isNegated, isDirectory } of patterns) {
    // Convert gitignore pattern to regex
    const regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, "\\$&") // escape special regex chars
      .replace(/\*/g, ".*") // * matches any string
      .replace(/\?/g, "."); // ? matches single char

    const regex = new RegExp(`^${regexPattern}${isDirectory ? "(?:/|$)" : "$"}`);

    if (regex.test(normalizedPath)) {
      shouldIgnore = !isNegated;
    }
  }

  return shouldIgnore;
}
