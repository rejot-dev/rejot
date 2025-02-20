import { z } from "zod";
import { ConnectionConfig } from "./connection-types";

export const ConnectionTypeSchema = z.enum(["postgres"]);

export const ConnectionStepSchema = z.enum(["select-type", "configure-connection", "overview"]);

export const ConnectionSearchParamsSchema = z.discriminatedUnion("step", [
  z.object({
    step: z.literal("select-type"),
  }),
  z.object({
    step: z.literal("configure-connection"),
    type: ConnectionTypeSchema,
  }),
  z.object({
    step: z.literal("overview"),
    type: ConnectionTypeSchema,
    config: z.string().transform((str, ctx) => {
      try {
        const parsed = JSON.parse(str);
        return ConnectionConfig.parse(parsed);
      } catch (_) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Invalid connection configuration",
        });
        return z.NEVER;
      }
    }),
  }),
]);

export type ConnectionSearchParams = z.infer<typeof ConnectionSearchParamsSchema>;
