// @ts-check

import eslintConfigPrettier from "eslint-config-prettier";
import eslintPluginReact from "eslint-plugin-react";
import eslintPluginSimpleImportSort from "eslint-plugin-simple-import-sort";
import eslintPluginTailwindcss from "eslint-plugin-tailwindcss";
import eslintPluginUnicorn from "eslint-plugin-unicorn";
import tseslint from "typescript-eslint";

import eslint from "@eslint/js";

import localImportCheck from "./scripts/eslint-plugin-local-import-check.mjs";

const frontendAppFiles = ["apps/controller-spa/**/*.{ts,tsx}"];

// TODO: We might start using this at a later point. https://github.com/sindresorhus/eslint-plugin-unicorn/tree/main
const _unicornFixableRules = Object.fromEntries(
  Object.entries(eslintPluginUnicorn.rules ?? {}).map(([id, rule]) => [
    `unicorn/${id}`,
    rule.meta?.fixable ? "error" : "off",
  ]),
);

export default tseslint.config(
  {
    ignores: ["**/node_modules/**", "**/dist/**", "apps/docs/.astro/**"],
  },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    plugins: {
      "simple-import-sort": eslintPluginSimpleImportSort,
      unicorn: eslintPluginUnicorn,
      local: localImportCheck,
    },
    rules: {
      // ...unicornFixableRules,
      "local/require-local-package-deps": "error",
      "local/disallow-package-name-imports": "warn",
      "local/require-relative-import-extension": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^(_|log$)",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      "@typescript-eslint/no-unused-expressions": [
        "error",
        {
          allowShortCircuit: false,
        },
      ],
      "simple-import-sort/imports": [
        "warn",
        {
          groups: [
            // Side effect imports.
            [String.raw`^\u0000`],
            // Stuff related to test.
            ["test$"],
            // Node.js builtins prefixed with `node:`.
            ["^(node|bun):"],
            // Packages. Things that start with a letter (or digit or underscore).
            [String.raw`^\w`],
            // Packages with a leading `@rejot-dev`
            ["^@rejot-dev"],
            // Packages with a leading `@`
            ["^@"],
            // Absolute imports and other imports such as Vue-style `@/foo`.
            // Anything not matched in another group.
            ["^"],
            // Relative imports.
            // Anything that starts with a dot.
            [String.raw`^\\.`],
          ],
        },
      ],
      "simple-import-sort/exports": "warn",
    },
  },
  {
    // Disable the rule for apps/ and specific packages
    files: ["scripts/**/*", "apps/**/*", "packages/api-interface-controller/**/*"],
    rules: {
      "local/require-relative-import-extension": "off",
    },
  },
  {
    // React stuff
    files: frontendAppFiles,
    plugins: {
      react: eslintPluginReact,
    },
    rules: {
      ...eslintPluginReact.configs.recommended.rules,
      ...eslintPluginReact.configs["jsx-runtime"].rules,
      "react/react-in-jsx-scope": "off",
      "react/no-unknown-property": [
        "error",
        {
          ignore: ["x-chunk"],
        },
      ],
    },
    settings: {
      react: {
        version: "detect",
      },
    },
  },
  {
    // Tailwind stuff
    files: frontendAppFiles,
    plugins: {
      tailwindcss: eslintPluginTailwindcss,
    },
    rules: {
      ...eslintPluginTailwindcss.configs["recommended"].rules,
      // Fixed by prettier tailwind
      "tailwindcss/classnames-order": "off",
      "tailwindcss/no-custom-classname": [
        "warn",
        {
          whitelist: ["cf-turnstile"],
        },
      ],
    },
    settings: {
      tailwindcss: {
        config: "./apps/controller-spa/tailwind.config.cjs",
      },
    },
  },
);
