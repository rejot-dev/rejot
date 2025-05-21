import path from "node:path";

import { $ } from "bun";
import { glob } from "glob";

// Determine the version bump type from command-line arguments (patch, minor, major).
const args = process.argv.slice(2);
const versionType = args[0];
if (!["patch", "minor", "major"].includes(versionType)) {
  console.error("Invalid version type. Use 'patch', 'minor', or 'major'.");
  process.exit(1);
}

console.log(`Bumping version type: ${versionType}`);

// Find all package.json files in the workspace
const packageJsonFiles = await glob("**/package.json", {
  ignore: "**/node_modules/**",
  absolute: true,
});

console.log(`Found ${packageJsonFiles.length} package.json files.`);

const publishablePackages: string[] = [];

// Filter for publishable packages (those not marked as private)
for (const file of packageJsonFiles) {
  try {
    const pkg = await Bun.file(file).json();
    if (pkg && pkg.private === false && pkg.name) {
      // Store the directory path, not the file path
      publishablePackages.push(path.dirname(file));
      console.log(`Found publishable package: ${pkg.name} in ${path.dirname(file)}`);
    }
  } catch (error) {
    console.error(`Error reading or parsing ${file}:`, error);
  }
}

console.log(`Identified ${publishablePackages.length} publishable packages.`);

// Bump the version for each publishable package
for (const packageDir of publishablePackages) {
  try {
    // Use npm version as Bun doesn't fully support it yet: https://github.com/oven-sh/bun/issues/5291
    const result = await $`npm version --no-fund ${versionType}`.cwd(packageDir).text();
    console.log(`${packageDir} -> ${result.split("\n")[1].trim()}`);
  } catch (error) {
    console.error(`Failed to bump version in ${packageDir}:`, error);
  }
}

// package-lock.json is automatically created, remove it
await $`rm -f package-lock.json`.quiet().text();

console.log("Updating bun.lock file...");

// Lock file needs to be updated, because Bun resolves the "workspace:*" versions
// during publishing based on the lockfile not the current package.json version.
await $`bun update`.text();

console.log("Bumping python version...");

// Bump the version for the python package, by updating the version in the pyproject.toml file
const pyprojectToml = await Bun.file("python/pyproject.toml").text();

const pyprojectTomlLines = pyprojectToml.split("\n");

for (let i = 0; i < pyprojectTomlLines.length; i++) {
  const line = pyprojectTomlLines[i];

  if (line.startsWith("version = ")) {
    const version = line.split("=")[1].replace(/"/g, "").trim();

    const versionParts = version.split(".");
    switch (versionType) {
      case "patch":
        versionParts[2] = (parseInt(versionParts[2]) + 1).toString();
        break;
      case "minor":
        versionParts[1] = (parseInt(versionParts[1]) + 1).toString();
        break;
      case "major":
        versionParts[0] = (parseInt(versionParts[0]) + 1).toString();
        break;
    }
    const newVersion = versionParts.join(".");

    pyprojectTomlLines[i] = `version = "${newVersion}"`;
  }
}

await Bun.write("python/pyproject.toml", pyprojectTomlLines.join("\n"));

console.log("Version bumping process completed.");
