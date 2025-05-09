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
    item: {
      ...entry,
      filePath: entry.filePath?.replace("index.md", "___index.md"),
    },
  }));

docNavigationEntries.sort((a, b) => {
  return (a.item.filePath ?? "").localeCompare(b.item.filePath ?? "");
});

const intro = `# Rejot Documentation

Open source database to database replication for distributed architectures.
`;

export const GET: APIRoute = async () => {
  return new Response(
    `${intro}${docNavigationEntries
      .map((doc) => {
        if (doc.item.filePath?.includes("index.md")) {
          return `\n## ${doc.title}\n`;
        }
        return `- [${doc.title}](https://rejot.dev/docs/${doc.slug}/)\n`;
      })
      .join("")}`,
    { headers: { "Content-Type": "text/plain; charset=utf-8" } },
  );
};
