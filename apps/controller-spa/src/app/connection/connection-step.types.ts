import { z } from "zod";

export const ConnectionTypeSchema = z.enum(["postgres"]);

export const ConnectionStepSchema = z.enum(["select-type", "configure-connection"]);

export const ConnectionSearchParamsSchema = z.discriminatedUnion("step", [
  z.object({
    step: z.literal("select-type"),
  }),
  z.object({
    step: z.literal("configure-connection"),
    type: ConnectionTypeSchema,
  }),
]);

export type ConnectionSearchParams = z.infer<typeof ConnectionSearchParamsSchema>;
