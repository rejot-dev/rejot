import { z } from "zod";

export const UserSubjectSchema = z.object({
  code: z.string(),
});
