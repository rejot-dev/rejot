import { z } from "zod";

export const SlugSchema = z
  .string()
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug must contain only lowercase letters, numbers, and hyphens, and cannot start or end with a hyphen",
  )
  .min(1)
  .max(63);
