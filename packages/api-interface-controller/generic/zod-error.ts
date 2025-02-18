import { z } from "zod";

export const ZodErrorSchema = z.object({
  success: z.literal(false),
  name: z.literal("ZodError"),
  error: z.object({
    issues: z.array(
      z.object({
        validation: z.string(),
        message: z.string(),
        code: z.string(),
        path: z.array(z.string()),
      }),
    ),
  }),
});

export type ZodError = z.infer<typeof ZodErrorSchema>;
