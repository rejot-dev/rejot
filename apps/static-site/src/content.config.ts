import { glob } from "astro/loaders";
import { defineCollection, z } from "astro:content";

const blog = defineCollection({
  // Load Markdown and MDX files in the `src/content/blog/` directory.
  loader: glob({ base: "./src/content/blog", pattern: "**/*.{md,mdx}" }),
  // Type-check frontmatter using a schema
  schema: z.object({
    title: z.string(),
    author: z.string(),
    description: z.string(),
    // Transform string to Date object
    publicationDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    heroImage: z.string().optional(),
    useHeroImageAsHeadImage: z.boolean().optional(),
  }),
});

const docs = defineCollection({
  loader: glob({ base: "./src/content/docs", pattern: "**/*.{md,mdx}" }),
  schema: z.object({
    title: z.string(),
  }),
});

const product = defineCollection({
  loader: glob({ base: "./src/content/product", pattern: "*.{md,mdx}" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
  }),
});

const useCases = defineCollection({
  loader: glob({ base: "./src/content/use-cases", pattern: "*.{md,mdx}" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
  }),
});

const caseStudies = defineCollection({
  loader: glob({ base: "./src/content/case-studies", pattern: "*.{md,mdx}" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
  }),
});

const legalDocs = defineCollection({
  loader: glob({ base: "./src/content/", pattern: "(privacy-policy|terms-of-use).mdx" }),
  schema: z.object({
    publicationDate: z.coerce.date(),
  }),
});

const manifests = defineCollection({
  loader: glob({ base: "./src/content/manifests", pattern: "*.json" }),
  type: "content_layer",
});

export const collections = { blog, docs, product, useCases, caseStudies, legalDocs, manifests };
