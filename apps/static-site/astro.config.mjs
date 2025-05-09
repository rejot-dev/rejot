// @ts-check
import { defineConfig } from "astro/config";
import pagefind from "astro-pagefind";

import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwind from "@astrojs/tailwind";

// https://astro.build/config
export default defineConfig({
  site: "https://rejot.dev",
  integrations: [mdx(), sitemap(), tailwind(), pagefind()],
  vite: {
    ssr: {
      external: ["node:util", "node:path"],
    },
    server: {
      allowedHosts: ["localhost", ".trycloudflare.com"],
    },
  },
  markdown: {
    syntaxHighlight: "shiki",
    shikiConfig: {
      themes: {
        light: "github-light",
        dark: "github-dark",
      },
    },
  },
});
