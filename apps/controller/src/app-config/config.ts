import { z } from "zod";

// Using node compat so drizzle works properly
import { readFileSync } from "node:fs";
import { env } from "node:process";

export const BaseConnectionSchema = z.object({
  slug: z.string(),
});

export const PostgresConnectionSchema = BaseConnectionSchema.extend({
  connectionType: z.literal("postgres"),
  host: z.string(),
  port: z.number(),
  user: z.string(),
  password: z.string(),
  database: z.string(),
});

export const ConnectionSchema = z.discriminatedUnion("connectionType", [
  PostgresConnectionSchema,
]);

export const DataStoreSchema = z.object({
  connectionSlug: z.string(),
  publicationName: z.string(),
  publicationTables: z.array(z.string()).optional(),
  eventStoreConnectionSlug: z.string(),
});

export const EventStoreSchema = z.object({
  connectionSlug: z.string(),
});

export const ControllerSpecificConfigSchema = z.object({
  mainDataStoreConnectionSlug: z.string(),

  clerk: z.object({
    publishableKey: z.string(),
    secretKey: z.string(),
  }),
});

export const SyncServiceSpecificConfigSchema = z.object({
  syncEngineCode: z.string(),
  dataStores: z.array(DataStoreSchema),
  eventStores: z.array(EventStoreSchema),
});

export const BaseConfigSchema = z.object({
  applicationType: z.enum(["controller-sync-service", "controller", "sync-service"]),

  apiPort: z.number(),

  connections: z.array(ConnectionSchema),

  sslRootCertPath: z.string().optional(),

  drizzle: z.object({
    verbose: z.boolean().default(false),
    logging: z.boolean().default(false),
  }),
});

export const ControllerConfigSchema = BaseConfigSchema.extend({
  applicationType: z.literal("controller"),
  controller: ControllerSpecificConfigSchema,
});

export const SyncServiceConfigSchema = BaseConfigSchema.extend({
  applicationType: z.literal("sync-service"),
  syncService: SyncServiceSpecificConfigSchema,
});

export const ControllerSyncServiceConfigSchema = BaseConfigSchema.extend({
  applicationType: z.literal("controller-sync-service"),
  controller: ControllerSpecificConfigSchema,
  syncService: SyncServiceSpecificConfigSchema,
});

export const ApplicationConfigSchema = z.discriminatedUnion("applicationType", [
  ControllerConfigSchema,
  SyncServiceConfigSchema,
  ControllerSyncServiceConfigSchema,
]);

export type ApplicationConfig = z.infer<typeof ApplicationConfigSchema>;

let cachedConfig: ApplicationConfig | null = null;

export function getConfigPath(): string {
  let configPath = env["REJOT_CONTROLLER_CONFIG_PATH"];
  if (!configPath) {
    configPath = `./_config.local.json`;
  }
  return configPath;
}

export function getConfig(): ApplicationConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const configPath = getConfigPath();

  const config = readFileSync(configPath, "utf-8");
  cachedConfig = ApplicationConfigSchema.parse(JSON.parse(config));
  console.log(`Using config file: '${configPath}'`);
  return cachedConfig;
}

export class ConfigManager {
  #config: ApplicationConfig;

  #connections: Record<string, z.infer<typeof ConnectionSchema>> = {};

  #dataStores: Record<string, z.infer<typeof DataStoreSchema>> = {};

  #eventStores: Record<string, z.infer<typeof EventStoreSchema>> = {};

  #sslRootCert: string | undefined;

  constructor() {
    this.#config = getConfig();

    if (this.#config.sslRootCertPath) {
      this.#sslRootCert = readFileSync(this.#config.sslRootCertPath, "utf-8");
    }

    for (const connection of this.#config.connections) {
      if (this.#connections[connection.slug]) {
        throw new Error(`Duplicate connection slug: '${connection.slug}'`);
      }

      this.#connections[connection.slug] = connection;
    }

    this.#verifyControllerConfig();
    this.#verifySyncServiceConfig();
  }

  get connections(): Readonly<Record<string, z.infer<typeof ConnectionSchema>>> {
    return this.#connections;
  }

  get dataStores(): Readonly<Record<string, z.infer<typeof DataStoreSchema>>> {
    return this.#dataStores;
  }

  get eventStores(): Readonly<Record<string, z.infer<typeof EventStoreSchema>>> {
    return this.#eventStores;
  }

  get mainPostgresConnection(): z.infer<typeof PostgresConnectionSchema> {
    if (
      this.#config.applicationType !== "controller" &&
      this.#config.applicationType !== "controller-sync-service"
    ) {
      throw new Error(
        "Main Postgres connection is only available for controller and controller-sync-service",
      );
    }

    return this.#connections[this.#config.controller.mainDataStoreConnectionSlug];
  }

  get controller() {
    if (
      this.#config.applicationType !== "controller" &&
      this.#config.applicationType !== "controller-sync-service"
    ) {
      throw new Error(
        "Controller config is only available for controller and controller-sync-service",
      );
    }

    return this.#config.controller;
  }

  get drizzle(): {
    verbose: boolean;
    logging: boolean;
  } {
    return {
      verbose: this.#config.drizzle.verbose,
      logging: this.#config.drizzle.logging,
    };
  }

  get sslRootCert(): string | undefined {
    return this.#sslRootCert;
  }

  #verifyControllerConfig() {
    if (
      this.#config.applicationType !== "controller" &&
      this.#config.applicationType !== "controller-sync-service"
    ) {
      return;
    }

    const { controller } = this.#config;

    const { mainDataStoreConnectionSlug } = controller;

    if (!this.#connections[mainDataStoreConnectionSlug]) {
      throw new Error(`Main data store connection not found: '${mainDataStoreConnectionSlug}'`);
    }
  }

  #verifySyncServiceConfig() {
    if (
      this.#config.applicationType !== "sync-service" &&
      this.#config.applicationType !== "controller-sync-service"
    ) {
      return;
    }

    const { syncService } = this.#config;

    const { dataStores, eventStores } = syncService;

    for (const eventStore of eventStores) {
      if (!this.#connections[eventStore.connectionSlug]) {
        throw new Error(`Event store connection not found: '${eventStore.connectionSlug}'`);
      }

      this.#eventStores[eventStore.connectionSlug] = eventStore;
    }

    for (const dataStore of dataStores) {
      if (!this.#connections[dataStore.connectionSlug]) {
        throw new Error(`Data store connection not found: '${dataStore.connectionSlug}'`);
      }

      const { eventStoreConnectionSlug } = dataStore;

      if (!this.#eventStores[eventStoreConnectionSlug]) {
        throw new Error(`Event store connection not found: '${eventStoreConnectionSlug}'`);
      }

      this.#dataStores[dataStore.connectionSlug] = dataStore;
    }
  }
}
