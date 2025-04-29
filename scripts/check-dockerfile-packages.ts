#!/usr/bin/env bun

import { readFileSync } from "fs";
import { join } from "path";

import { getAllWorkspacePackages } from "./workspace-utils";

function getDockerfilePackages(dockerfilePath: string): string[] {
  const content = readFileSync(dockerfilePath, "utf-8");
  const packages: string[] = [];

  // Match COPY statements for package.json files
  const copyRegex = /COPY\s+([^/\s]+\/[^/\s]+)\/package\.json\s+\1\/package\.json/g;
  let match;

  while ((match = copyRegex.exec(content)) !== null) {
    packages.push(match[1]);
  }

  return packages;
}

async function main() {
  try {
    const args = process.argv.slice(2);
    const dockerfilePath = args[0] || join(process.cwd(), "Dockerfile");
    let hasErrors = false;

    const workspacePackages = getAllWorkspacePackages();
    const dockerfilePackages = getDockerfilePackages(dockerfilePath);

    // Check for missing packages
    const missingPackages = workspacePackages
      .map((pkg) => pkg.path)
      .filter((path) => !dockerfilePackages.includes(path));

    if (missingPackages.length > 0) {
      console.log("\n❌ Missing packages in Dockerfile:");
      for (const pkg of missingPackages) {
        console.log(`   COPY ${pkg}/package.json ${pkg}/package.json`);
      }
      hasErrors = true;
    }

    // Check for extra packages
    const extraPackages = dockerfilePackages.filter(
      (path) => !workspacePackages.some((pkg) => pkg.path === path),
    );

    if (extraPackages.length > 0) {
      console.log("\n⚠️  Extra packages in Dockerfile that may not be needed:");
      for (const pkg of extraPackages) {
        console.log(`   ${pkg}`);
      }
    }

    process.exit(hasErrors ? 1 : 0);
  } catch (error) {
    console.error(`Fatal error: ${error}`);
    process.exit(1);
  }
}

main();
