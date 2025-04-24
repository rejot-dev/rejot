/** @type {import('prettier').Config} */
const prettierConfig = {
  singleQuote: false,
  semi: true,
  tabWidth: 2,
  useTabs: false,
  printWidth: 100,
  trailingComma: "all",
  plugins: [
    "prettier-plugin-embed",
    "prettier-plugin-sql",
    "prettier-plugin-tailwindcss",
    "prettier-plugin-astro",
  ],
  // static-site
  proseWrap: "always",
  overrides: [
    {
      files: "*.astro",
      options: {
        parser: "astro",
      },
    },
    {
      files: "*.mdx",
      options: {
        parser: "mdx",
      },
    },
  ],
};

/** @type {import('prettier-plugin-embed').PrettierPluginEmbedOptions} */
const prettierPluginEmbedConfig = {
  // TODO(Wilco): we can try using https://gist.github.com/Sharaal/742b0537035720dba7bc85b6bc7854c5 to support node-postgres better.
  embeddedSqlTags: ["sql"],
};

/** @type {import('prettier-plugin-sql').SqlBaseOptions} */
const prettierPluginSqlConfig = {
  language: "postgresql",
  keywordCase: "upper",
};

export default {
  ...prettierConfig,
  ...prettierPluginEmbedConfig,
  ...prettierPluginSqlConfig,
};
