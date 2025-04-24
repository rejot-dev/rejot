// @ts-check
import { defineConfig } from "astro/config";

import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwind from "@astrojs/tailwind";

// https://astro.build/config
export default defineConfig({
  site: "https://rejot.dev",
  integrations: [mdx(), sitemap(), tailwind()],
  vite: {
    ssr: {
      external: ["node:util", "node:path"],
    },
  },
  markdown: {
    // For some reason none of this actually works.
    syntaxHighlight: "shiki",
    shikiConfig: {
      themes: {
        light: "github-light",
        dark: "github-dark",
      },
    },
  },
});
