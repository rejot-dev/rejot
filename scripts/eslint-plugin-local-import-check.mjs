// eslint-plugin-local-import-check.js
import console from "node:console";
import fs from "node:fs";
import path from "node:path";

/**
 * Find the closest package.json above `startDir`.
 * Stops at the filesystem root or on parse failure.
 */
function findPackageJson(startDir) {
  let currentDir = startDir;

  while (true) {
    const packagePath = path.join(currentDir, "package.json");

    if (fs.existsSync(packagePath)) {
      try {
        const content = JSON.parse(fs.readFileSync(packagePath, "utf8"));
        return { path: packagePath, name: content.name, content };
      } catch (error) {
        console.error(`Cannot parse package.json at ${packagePath}:`, error);
        return null; // Bail out on malformed JSON
      }
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      return null; // Reached filesystem root with no package.json
    }
    currentDir = parentDir;
  }
}

const rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Ensure local monorepo packages are declared in dependencies",
    },
    schema: [],
  },
  create(context) {
    const filename = context.getFilename();

    // Skip untitled buffers such as <input> or <text>
    if (!filename || filename.startsWith("<")) {
      return {};
    }

    const fileDir = path.dirname(filename);
    const packageInfo = findPackageJson(fileDir);

    if (!packageInfo || !packageInfo.name) {
      return {};
    }
    const currentPackageName = packageInfo.name;

    const deps = {
      ...(packageInfo.content.dependencies ?? {}),
      ...(packageInfo.content.devDependencies ?? {}),
      ...(packageInfo.content.peerDependencies ?? {}),
    };

    return {
      ImportDeclaration(node) {
        const importPath = node.source.value;

        if (typeof importPath === "string" && importPath.startsWith("@rejot-dev/")) {
          const [, scope, name] = importPath.match(/^(@[^/]+)\/([^/]+)/) ?? [];

          if (scope && name) {
            const packageName = `${scope}/${name}`;

            if (packageName === currentPackageName) {
              return;
            }

            if (!deps[packageName]) {
              context.report({
                node,
                message: `Import "${importPath}" relies on "${packageName}", which is missing from dependencies in ${packageInfo.path}.`,
              });
            }
          }
        }
      },
    };
  },
};

export default {
  rules: {
    "require-local-package-deps": rule,
  },
};
