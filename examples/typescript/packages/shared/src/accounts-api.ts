import { z } from "zod";

/* Create Account */
export const CreateAccountRequestSchema = z.object({
  email: z.string().email(),
  name: z.string(),
});

export const CreateAccountResponseSchema = z.object({
  id: z.string(),
});

export type CreateAccountResponse = z.infer<typeof CreateAccountResponseSchema>;
export type CreateAccountRequest = z.infer<typeof CreateAccountRequestSchema>;

/* Get Account */
export const GetAccountRequestSchema = z.object({
  id: z.string(),
});

export const GetAccountResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export type GetAccountResponse = z.infer<typeof GetAccountResponseSchema>;
export type GetAccountRequest = z.infer<typeof GetAccountRequestSchema>;
