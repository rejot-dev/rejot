import type { APIRoute } from "astro";
import { getCollection } from "astro:content";

import { normalizeSlug } from "../util/helpers";
const docs = await getCollection("docs");
const docNavigationEntries = docs
  .filter((entry) => {
    return entry.filePath?.endsWith("docs/index.md") === false;
  })
  .map((entry) => ({
    title: entry.data.title,
    slug: normalizeSlug(entry.id),
    body: entry.body,
    item: {
      ...entry,
      filePath: entry.filePath?.replace("index.md", "___index.md"),
    },
  }));

docNavigationEntries.sort((a, b) => {
  return (a.item.filePath ?? "").localeCompare(b.item.filePath ?? "");
});

export const GET: APIRoute = async () => {
  return new Response(
    `# Rejot Documentation\n\n${docNavigationEntries
      .map((doc) => {
        if (doc.item.filePath?.includes("index.md")) {
          return `\n## ${doc.title}\n`;
        }
        return `# ${doc.title}\n\n${doc.body || ""}\n\n`;
      })
      .join("")}`,
    { headers: { "Content-Type": "text/plain; charset=utf-8" } },
  );
};
