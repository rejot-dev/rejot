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

const PATH_HAS_EXT_RE = /\.[a-z0-9]+$/i;

const packageRule = {
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

const relativeImportRule = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow imports using the current package name; use relative paths instead.",
      recommended: "warn",
    },
    schema: [], // No options for this rule
  },
  create(context) {
    const filename = context.getFilename();
    // For virtual file paths used in some testing environments
    if (!path.isAbsolute(filename) && !filename.startsWith(".")) {
      return {};
    }
    const packageInfo = findPackageJson(path.dirname(filename));

    if (!packageInfo || !packageInfo.name) {
      // Could not find package.json or it lacks a name, skip this file
      return {};
    }

    const packageName = packageInfo.name;
    const packagePrefix = `${packageName}/`;

    return {
      ImportDeclaration(node) {
        const importSource = node.source.value;

        // Check if the import path starts with the package name + '/'
        if (typeof importSource === "string" && importSource.startsWith(packagePrefix)) {
          context.report({
            node: node.source, // Report the error on the source string literal
            message: `Importing from the current package "${packageName}" using its name is disallowed. Use relative path instead.`,
          });
        }
      },
    };
  },
};

const relativeImportExtensionRule = {
  meta: {
    type: "problem",
    docs: {
      description: "Force relative import and export paths to include `.ts`",
    },
    fixable: "code",
    schema: [],
  },

  create(context) {
    /** @param {import("estree").Literal} literal */
    function checkLiteral(literal) {
      if (typeof literal.value !== "string") return;

      const value = literal.value;
      const isRelative = value.startsWith("./") || value.startsWith("../");
      const hasExt = PATH_HAS_EXT_RE.test(value);

      if (isRelative && !hasExt) {
        context.report({
          node: literal,
          message: "Add '.ts' extension to relative path '{{path}}'",
          data: { path: value },
          fix(fixer) {
            return fixer.replaceText(literal, `'${value}.ts'`);
          },
        });
      }
    }

    return {
      ImportDeclaration(node) {
        if (node.source?.type === "Literal") checkLiteral(node.source);
      },
      ExportAllDeclaration(node) {
        if (node.source?.type === "Literal") checkLiteral(node.source);
      },
      ExportNamedDeclaration(node) {
        if (node.source?.type === "Literal") checkLiteral(node.source);
      },
    };
  },
};
export default {
  rules: {
    "require-local-package-deps": packageRule,
    "disallow-package-name-imports": relativeImportRule,
    "require-relative-import-extension": relativeImportExtensionRule,
  },
};
