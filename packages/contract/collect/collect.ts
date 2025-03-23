import { resolve } from "node:path";

import { z } from "zod";

import { PublicSchemaSchema, ConsumerSchemaSchema } from "../manifest/manifest.ts";
import { PublicSchema } from "../public-schema/public-schema.ts";
import { ConsumerSchema } from "../consumer-schema/consumer-schema.ts";

export async function collectPublicSchemas(
  modulePath: string,
): Promise<z.infer<typeof PublicSchemaSchema>[]> {
  // TODO(Wilco): this imports Typescript directly, so will only work in Bun and Node from
  //              version >V22.6.0 with --experimental-strip-types
  //              In the future we can use ESBuild to transpile first.
  const module = await import(resolve(process.cwd(), modulePath));

  const publicSchemas: PublicSchema[] = [];

  if (!module.default) {
    console.warn(`No default export found in ${modulePath}`);
    return [];
  }

  for (const item of Object.values(module.default)) {
    if (Array.isArray(item)) {
      for (const arrayItem of item) {
        if (arrayItem instanceof PublicSchema) {
          publicSchemas.push(arrayItem);
        }
      }
    } else if (item instanceof PublicSchema) {
      publicSchemas.push(item);
    }
  }

  return publicSchemas.map((schema) => schema.data);
}

export async function collectConsumerSchemas(
  modulePath: string,
): Promise<z.infer<typeof ConsumerSchemaSchema>[]> {
  const module = await import(resolve(process.cwd(), modulePath));

  const consumerSchemas: ConsumerSchema[] = [];

  if (!module.default) {
    console.warn(`No default export found in ${modulePath}`);
    return [];
  }

  for (const item of Object.values(module.default)) {
    if (Array.isArray(item)) {
      for (const arrayItem of item) {
        if (arrayItem instanceof ConsumerSchema) {
          consumerSchemas.push(arrayItem);
        }
      }
    } else if (item instanceof ConsumerSchema) {
      consumerSchemas.push(item);
    }
  }

  return consumerSchemas.map((schema) => schema.data);
}
