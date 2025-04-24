import { getCollection } from "astro:content";

import rss from "@astrojs/rss";

import { REJOT_TAG_LINE, REJOT_TITLE } from "../consts";

export async function GET(context) {
  const posts = await getCollection("blog");
  return rss({
    title: REJOT_TITLE,
    description: REJOT_TAG_LINE,
    site: context.site,
    items: posts.map((post) => ({
      ...post.data,
      link: `/blog/${post.id}/`,
    })),
  });
}
