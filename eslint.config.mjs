// @ts-check

import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";
import eslintPluginReact from "eslint-plugin-react";
import eslintPluginTailwindcss from "eslint-plugin-tailwindcss";

const frontendAppFiles = ["apps/controller-spa/**/*.{ts,tsx}"];

export default tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.recommended,
  eslintConfigPrettier,
  {
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
