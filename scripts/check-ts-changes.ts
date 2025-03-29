#!/usr/bin/env bun

import { $ } from "bun";
import { glob } from "glob";
import { readFileSync } from "fs";
import { join, relative } from "path";

async function getWorkspacePackages(): Promise<string[]> {
  const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf-8"));
  const workspacePatterns = packageJson.workspaces || [];

  const packages: string[] = [];
  for (const pattern of workspacePatterns) {
    const matches = await glob(pattern, { absolute: true });
    packages.push(...matches);
  }
  return packages;
}

async function getChangedPackages(packages: string[]): Promise<string[]> {
  // Get both staged and unstaged changes
  const result = await $`git status --porcelain`.quiet();
  const stdout = await result.text();
  const changedFiles = stdout
    .split("\n")
    .filter(Boolean)
    .map((line: string) => line.slice(3)); // Remove status prefix

  return packages.filter((pkg) => {
    const relPath = relative(process.cwd(), pkg);
    return changedFiles.some((file: string) => file.startsWith(relPath));
  });
}

async function checkTypeScript(packagePath: string): Promise<boolean> {
  try {
    const tsc = Bun.spawn(["bunx", "tsc", "--noEmit", "--watch", "--pretty", "false"], {
      cwd: packagePath,
      stdout: "pipe",
      stderr: "pipe",
    });

    let buffer = "";
    let isFirstOutput = true;

    // Show header for the package being checked
    const relativePackagePath = relative(process.cwd(), packagePath);
    console.log(`\n=== Checking types in ${relativePackagePath} ===\n`);

    for await (const chunk of tsc.stdout) {
      const text = new TextDecoder().decode(chunk);
      buffer += text;

      // Clear console when new compiler output starts (indicated by "File change detected")
      if (text.includes("File change detected.") || isFirstOutput) {
        console.clear();
        // Re-print the header after clearing
        console.log(`\n=== Checking types in ${relativePackagePath} ===\n`);
        isFirstOutput = false;
      }

      // Transform and output each line
      const lines = text.split("\n");
      for (const line of lines) {
        if (line.includes(".ts(") && line.includes("error TS")) {
          // Extract file path and position
          const match = line.match(/^(.+\.ts)\((\d+),(\d+)\)(.+)$/);
          if (match) {
            const [_, filePath, line, column, _errorMessage] = match;
            // Normalize the path relative to cwd
            const absolutePath = join(packagePath, filePath);
            const normalizedPath = relative(process.cwd(), absolutePath);
            process.stdout.write(`${normalizedPath}:${line}:${column}\n`);
          }
        }
      }

      if (buffer.includes("Found 0 errors")) {
        tsc.kill();
        return true;
      }

      // If we found errors and have processed them all, show the message
      if (buffer.includes("Found") && buffer.includes("error")) {
        console.log("\nFound errors in the following files, Cursor agent, please fix them!");
      }
    }

    return false;
  } catch (_error) {
    return false;
  }
}

async function main() {
  try {
    const packages = await getWorkspacePackages();
    const changedPackages = await getChangedPackages(packages);
    if (changedPackages.length === 0) {
      process.exit(0);
    }

    let hasErrors = false;
    for (const pkg of changedPackages) {
      const success = await checkTypeScript(pkg);
      if (!success) {
        hasErrors = true;
      }
    }

    process.exit(hasErrors ? 1 : 0);
  } catch (_error) {
    process.exit(1);
  }
}

main();
