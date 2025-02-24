import { generateCode } from "@/codes/codes.ts";
import type { SystemRepository } from "./system-repository.ts";
import type { CreateSystem } from "@rejot/api-interface-controller/system";
import type { SchemaDefinition } from "@/public-schema/public-schema.ts";

export type UpsertDataStoreServiceParams = {
  organizationId: string;
  systemSlug: string;
  connectionSlug: string;
  publicationName: string;
};

export type UpsertDataStoreServiceResult = {
  connectionSlug: string;
  publicationName: string;
  publicationTables: string[];
};

export type OverviewPublicSchema = {
  id: string;
  name: string;
  version: number;
  schema: SchemaDefinition;
};

export type OverviewDataStores = {
  slug: string;
  publicationName: string;
  tables: string[];
  publicSchemas: OverviewPublicSchema[];
};

export type OverviewConsumerSchema = {
  id: string;
  name: string;
  status: "draft" | "backfill" | "active" | "archived";
  dataStore: {
    slug: string;
  };
  publicSchema: {
    code: string;
    name: string;
    status: "draft" | "active" | "archived";
  };
};

export type SystemOverview = {
  id: string;
  name: string;
  slug: string;

  organization: {
    id: string;
    name: string;
  };

  dataStores: OverviewDataStores[];
  consumerSchemas: OverviewConsumerSchema[];
};

export type System = {
  id: string;
  name: string;
  slug: string;

  organization: {
    id: string;
    name: string;
  };
};

export interface ISystemService {
  createSystem(organizationCode: string, system: CreateSystem): Promise<System>;
  getSystem(organizationId: string, systemSlug: string): Promise<SystemOverview>;
  getSystems(organizationId: string): Promise<System[]>;
  getSystemsForClerkUser(clerkUserId: string): Promise<System[]>;
  upsertDataStore(params: UpsertDataStoreServiceParams): Promise<UpsertDataStoreServiceResult>;
}

export class SystemService implements ISystemService {
  static inject = ["systemRepository"] as const;

  #systemRepository: SystemRepository;

  constructor(systemRepository: SystemRepository) {
    this.#systemRepository = systemRepository;
  }

  async createSystem(organizationId: string, { name, slug }: CreateSystem): Promise<System> {
    const system = await this.#systemRepository.create(organizationId, {
      name,
      code: generateCode("SYS"),
      slug,
    });

    return {
      id: system.code,
      name: system.name,
      slug: system.slug,
      organization: {
        id: system.organization.code,
        name: system.organization.name,
      },
    };
  }

  async getSystem(organizationId: string, systemSlug: string): Promise<SystemOverview> {
    const { id: _id, ...system } = await this.#systemRepository.get(organizationId, systemSlug);

    return {
      id: system.code,
      name: system.name,
      slug: system.slug,
      organization: {
        id: system.organization.code,
        name: system.organization.name,
      },
      dataStores: system.dataStores.map((dataStore) => ({
        ...dataStore,
        publicSchemas: dataStore.publicSchemas.map((pub) => ({
          ...pub,
          id: pub.code,
        })),
      })),
      consumerSchemas: system.consumerSchemas.map((consumerSchema) => ({
        ...consumerSchema,
        id: consumerSchema.code,
      })),
    };
  }

  async getSystems(organizationId: string): Promise<System[]> {
    const systems = await this.#systemRepository.getSystems(organizationId);

    return systems.map((system) => ({
      id: system.code,
      name: system.name,
      slug: system.slug,
      organization: {
        id: system.organization.code,
        name: system.organization.name,
      },
    }));
  }

  async getSystemsForClerkUser(clerkUserId: string): Promise<System[]> {
    const systems = await this.#systemRepository.getSystemsForClerkUser(clerkUserId);

    return systems.map((system) => ({
      id: system.code,
      name: system.name,
      slug: system.slug,
      organization: {
        id: system.organization.code,
        name: system.organization.name,
      },
    }));
  }

  async upsertDataStore(
    params: UpsertDataStoreServiceParams,
  ): Promise<UpsertDataStoreServiceResult> {
    const system = await this.#systemRepository.get(params.organizationId, params.systemSlug);

    const dataStore = await this.#systemRepository.upsertDataStore({
      systemCode: system.code,
      connectionSlug: params.connectionSlug,
      publicationName: params.publicationName,
    });

    return {
      connectionSlug: params.connectionSlug,
      publicationName: dataStore.publicationName,
      publicationTables: dataStore.publicationTables,
    };
  }
}
