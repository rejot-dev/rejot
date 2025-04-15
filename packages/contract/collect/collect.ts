import { resolve } from "node:path";

import { existsSync } from "node:fs";

import { PublicSchema } from "../public-schema/public-schema.ts";
import { ConsumerSchema } from "../consumer-schema/consumer-schema.ts";

import { logger } from "../logger/logger.ts";

const log = logger.createLogger("collect");

export async function collectPublicSchemas(modulePath: string): Promise<PublicSchema[]> {
  const resolvedModulePath = resolve(process.cwd(), modulePath);
  if (!existsSync(resolvedModulePath)) {
    throw new Error(`Module path ${resolvedModulePath} does not exist`);
  }
  // TODO(Wilco): this imports Typescript directly, so will only work in Bun and Node from
  //              version >V22.6.0 with --experimental-strip-types
  //              In the future we can use ESBuild to transpile first.
  const module = await import(resolvedModulePath);

  const publicSchemas: PublicSchema[] = [];

  if (!module.default) {
    log.error(`No default export found in ${modulePath}`);
    return [];
  }

  if (module.default instanceof PublicSchema) {
    publicSchemas.push(module.default);
  } else {
    for (const item of Object.values(module.default)) {
      if (Array.isArray(item)) {
        for (const arrayItem of item) {
          if (arrayItem instanceof PublicSchema) {
            publicSchemas.push(arrayItem);
          }
        }
      } else if (item instanceof PublicSchema) {
        publicSchemas.push(item);
      } else {
        log.warn(`Found unidentified Public Schema in ${modulePath}: ${JSON.stringify(item)}`);
      }
    }
  }

  log.info(`Collected ${publicSchemas.length} public schemas`);

  return publicSchemas;
}

export async function collectConsumerSchemas(modulePath: string): Promise<ConsumerSchema[]> {
  const resolvedModulePath = resolve(process.cwd(), modulePath);
  if (!existsSync(resolvedModulePath)) {
    throw new Error(`Module path ${resolvedModulePath} does not exist`);
  }
  const module = await import(resolvedModulePath);

  const consumerSchemas: ConsumerSchema[] = [];

  if (!module.default) {
    log.warn(`No default export found in ${modulePath}`);
    return [];
  }
  if (module.default instanceof ConsumerSchema) {
    consumerSchemas.push(module.default);
  } else {
    for (const item of Object.values(module.default)) {
      if (Array.isArray(item)) {
        for (const arrayItem of item) {
          if (arrayItem instanceof ConsumerSchema) {
            consumerSchemas.push(arrayItem);
          }
        }
      } else if (item instanceof ConsumerSchema) {
        consumerSchemas.push(item);
      } else {
        log.warn(`Found unidentified Consumer Schema in ${modulePath}: ${JSON.stringify(item)}`);
      }
    }
  }

  log.info(`Collected ${consumerSchemas.length} consumer schemas`);

  return consumerSchemas;
}
