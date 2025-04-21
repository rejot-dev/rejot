// @ts-check

import eslint from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import eslintPluginReact from "eslint-plugin-react";
import eslintPluginSimpleImportSort from "eslint-plugin-simple-import-sort";
import eslintPluginTailwindcss from "eslint-plugin-tailwindcss";
import tseslint from "typescript-eslint";

const frontendAppFiles = ["apps/controller-spa/**/*.{ts,tsx}"];

export default tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    plugins: {
      "simple-import-sort": eslintPluginSimpleImportSort,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
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
            ["^\\u0000"],
            // Node.js builtins prefixed with `node:`.
            ["^node:"],
            // Packages.
            // Things that start with a letter (or digit or underscore), or `@` followed by a letter.
            ["^@?\\w"],
            // Absolute imports and other imports such as Vue-style `@/foo`.
            // Anything not matched in another group.
            ["^"],
            // Relative imports.
            // Anything that starts with a dot.
            ["^\\."],
          ],
        },
      ],
      "simple-import-sort/exports": "warn",
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
    },
    settings: {
      tailwindcss: {
        config: "./apps/controller-spa/tailwind.config.cjs",
      },
    },
  },
);
