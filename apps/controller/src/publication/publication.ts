import { z } from "@hono/zod-openapi";

const BasePublicationSchema = z.object({
  publicationName: z.string(),
  schema: z.object({}),
  metadata: z.object({
    createdAt: z.number(),
    version: z.string(),
  }),
});

export const NewPublicationSchema = BasePublicationSchema;
export const PublicationSchema = BasePublicationSchema.extend({
  id: z.string(),
});

export type NewPublication = z.infer<typeof NewPublicationSchema>;
export type Publication = z.infer<typeof PublicationSchema>;

export default PublicationSchema;
