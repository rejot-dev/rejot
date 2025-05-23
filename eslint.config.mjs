// @ts-check
import eslintConfigPrettier from "eslint-config-prettier";
import eslintPluginAstro from "eslint-plugin-astro";
import eslintPluginReact from "eslint-plugin-react";
import eslintPluginSimpleImportSort from "eslint-plugin-simple-import-sort";
import eslintPluginTailwindcss from "eslint-plugin-tailwindcss";
import eslintPluginUnicorn from "eslint-plugin-unicorn";
import tseslint from "typescript-eslint";

import eslint from "@eslint/js";

import localImportCheck from "./scripts/eslint-plugin-local-import-check.mjs";

const reactAppFiles = ["apps/controller-spa/**/*.{ts,tsx}"];
const astroAppFiles = ["apps/static-site/**/*.{astro,astro.config.mjs}"];

// TODO: We might start using this at a later point. https://github.com/sindresorhus/eslint-plugin-unicorn/tree/main
const _unicornFixableRules = Object.fromEntries(
  Object.entries(eslintPluginUnicorn.rules ?? {}).map(([id, rule]) => [
    `unicorn/${id}`,
    rule.meta?.fixable ? "error" : "off",
  ]),
);

export default tseslint.config(
  {
    name: "Base Ignore",
    ignores: ["**/node_modules/**", "**/dist/**", "**/.astro/**"],
  },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  eslintConfigPrettier,
  eslintPluginAstro.configs["flat/recommended"],
  {
    name: "General Rules",
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
    name: "Disable require-relative-import-extension for apps/ and specific packages",
    files: [
      "scripts/**/*",
      "apps/controller/**/*",
      "apps/controller-spa/**/*",
      "apps/static-site/**/*",
      "packages/api-interface-controller/**/*",
    ],
    rules: {
      "local/require-relative-import-extension": "off",
    },
  },
  {
    name: "Apps w/ React + Tailwind",
    files: reactAppFiles,
    plugins: {
      react: eslintPluginReact,
      tailwindcss: eslintPluginTailwindcss,
    },
    rules: {
      ...eslintPluginReact.configs.recommended.rules,
      ...eslintPluginReact.configs["jsx-runtime"].rules,
      ...eslintPluginTailwindcss.configs["recommended"].rules,
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
      tailwindcss: {
        config: "./apps/controller-spa/tailwind.config.cjs",
      },
    },
  },
  {
    name: "Apps w/ Astro + Tailwind",
    files: astroAppFiles,
    plugins: {
      tailwindcss: eslintPluginTailwindcss,
    },
    rules: {
      ...eslintPluginTailwindcss.configs["recommended"].rules,
      "tailwindcss/no-custom-classname": [
        "warn",
        {
          whitelist: [
            "cf-.*",
            "search-header",
            "search-container",
            "pagefind-ui",
            "svg-.*",
            "cls-.*",
            "rejot-.*",
          ],
        },
      ],
      "tailwindcss/classnames-order": "warn", // TODO: Change to error
    },
    settings: {
      astro: {
        version: "detect",
      },
      tailwindcss: {
        config: "./apps/static-site/tailwind.config.mjs",
      },
    },
  },
);
