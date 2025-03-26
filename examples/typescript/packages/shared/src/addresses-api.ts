import { z } from "zod";

/* Create Address */

export const CreateAddressRequestSchema = z.object({
  account_id: z.number(),
  street_address: z.string(),
  city: z.string(),
  state: z.string(),
  postal_code: z.string(),
  country: z.string(),
});

export const CreateAddressResponseSchema = z.object({
  id: z.string(),
});

export type CreateAddressResponse = z.infer<typeof CreateAddressResponseSchema>;
export type CreateAddressRequest = z.infer<typeof CreateAddressRequestSchema>;

/* Get Address */
export const GetAddressRequestSchema = z.object({
  id: z.string(),
});

export const GetAddressResponseSchema = z.object({
  id: z.string(),
  account_id: z.number(),
  street_address: z.string(),
  city: z.string(),
  state: z.string(),
  postal_code: z.string(),
  country: z.string(),
});

export type GetAddressResponse = z.infer<typeof GetAddressResponseSchema>;
export type GetAddressRequest = z.infer<typeof GetAddressRequestSchema>;
