#!/usr/bin/env bun

import { $ } from "bun";
import { glob } from "glob";
import { readFileSync } from "fs";
import { join, relative } from "path";

type CheckType = "types" | "test" | "install";
type TestFailure = {
  file: string;
  line: string;
  column: string;
  testName?: string;
  error?: string;
};

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

function parseTypeScriptOutput(output: string, packagePath: string): TestFailure[] {
  const failures: TestFailure[] = [];
  const lines = output.split("\n");

  for (const line of lines) {
    if (line.includes(".ts(") && line.includes("error TS")) {
      const match = line.match(/^(.+\.ts)\((\d+),(\d+)\)(.+)$/);
      if (match) {
        const [_, filePath, line, column, errorMessage] = match;
        const normalizedPath = relative(
          process.cwd(),
          filePath.startsWith("/") ? filePath : join(packagePath, filePath),
        );
        failures.push({
          file: normalizedPath,
          line,
          column,
          error: errorMessage.trim(),
        });
      }
    }
  }

  return failures;
}

function parseTestOutput(output: string, packagePath: string): TestFailure[] {
  const failures: TestFailure[] = [];
  const lines = output.split("\n");
  let currentTest = "";
  let currentError = "";

  for (const line of lines) {
    // Track current test
    if (line.startsWith("test") && line.includes("▶")) {
      currentTest = line.split("▶")[1].trim();
    }
    // Capture test name from failure line
    else if (line.includes("(fail)")) {
      const testMatch = line.match(/\(fail\)\s+([^[]+)/);
      if (testMatch) {
        currentTest = testMatch[1].trim();
      }
    }
    // Capture error message
    else if (line.includes("error:")) {
      currentError = line.trim();
    }
    // Look for stack trace with file location
    else if (line.includes(".test.ts:")) {
      const locationMatch = line.match(/\s*(?:at\s+)?([^(]+\.test\.ts):(\d+):(\d+)/);
      if (locationMatch) {
        const [_, filePath, lineNum, colNum] = locationMatch;
        const normalizedPath = relative(
          process.cwd(),
          filePath.startsWith("/") ? filePath : join(packagePath, filePath),
        );

        failures.push({
          file: normalizedPath,
          line: lineNum,
          column: colNum,
          testName: currentTest,
          error: currentError,
        });

        // Reset for next failure
        currentError = "";
      }
    }
  }

  return failures;
}

function printFailures(failures: TestFailure[]) {
  for (const failure of failures) {
    process.stdout.write(`\n❌ ${failure.file}:${failure.line}:${failure.column}\n`);
    if (failure.testName) {
      process.stdout.write(`   Test: ${failure.testName}\n`);
    }
    if (failure.error) {
      process.stdout.write(`   ${failure.error}\n`);
    }
  }
}

async function waitForRunCompletion(proc: {
  stdout: ReadableStream;
  stderr: ReadableStream;
  kill: () => void;
}): Promise<string> {
  let buffer = "";

  const processStream = async (stream: ReadableStream) => {
    for await (const chunk of stream) {
      const text = new TextDecoder().decode(chunk);
      buffer += text;

      // Check for completion markers
      if (text.includes("Ran") && text.includes("tests across") && text.includes("files")) {
        proc.kill(); // Stop watching
      } else if (text.includes("Found") && text.includes("error")) {
        proc.kill(); // Stop watching
      }
    }
  };

  // Process both stdout and stderr
  await Promise.all([processStream(proc.stdout), processStream(proc.stderr)]);

  return buffer;
}

async function checkPackage(packagePath: string, checkType: CheckType): Promise<boolean> {
  try {
    if (checkType === "install") {
      // For install type, just run bun install and return true
      const proc = Bun.spawn(["bun", "install"], {
        cwd: packagePath,
        stdout: "inherit",
        stderr: "inherit",
      });
      await proc.exited;
      return true;
    }

    // For types and test checks
    const command =
      checkType === "types"
        ? ["bunx", "tsc", "--noEmit", "--watch", "--pretty", "false"]
        : ["bun", "test", "--watch"];

    const proc = Bun.spawn(command, {
      cwd: packagePath,
      stdout: "pipe",
      stderr: "pipe",
    });

    // Show header for the package being checked
    const relativePackagePath = relative(process.cwd(), packagePath);
    const checkTypeDisplay =
      checkType === "types" ? "types" : checkType === "test" ? "tests" : "install";
    console.log(`\n=== Checking ${checkTypeDisplay} in ${relativePackagePath} ===\n`);

    // Wait for a complete run
    const output = await waitForRunCompletion(proc);

    // Parse the output based on check type
    const failures =
      checkType === "types"
        ? parseTypeScriptOutput(output, packagePath)
        : parseTestOutput(output, packagePath);

    // Print any failures found
    if (failures.length > 0) {
      printFailures(failures);
      return false;
    }

    return true;
  } catch (_error) {
    return false;
  }
}

async function main() {
  try {
    // Get check type and all flag from command line arguments
    const args = process.argv.slice(2);
    const checkType: CheckType = args.includes("test")
      ? "test"
      : args.includes("install")
        ? "install"
        : "types";
    const checkAll = args.includes("--all");

    const packages = await getWorkspacePackages();
    const packagesToCheck = checkAll ? packages : await getChangedPackages(packages);

    if (packagesToCheck.length === 0) {
      process.exit(0);
    }

    let hasErrors = false;
    for (const pkg of packagesToCheck) {
      const success = await checkPackage(pkg, checkType);
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
