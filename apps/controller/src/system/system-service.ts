import { generateCode } from "@/codes/codes.ts";
import type { SystemEntity, SystemRepository } from "./system-repository.ts";
import type { CreateSystem } from "@rejot/api-interface-controller/system";
import type { PublicSchema } from "@rejot/api-interface-controller/public-schema";

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

export type SystemOverviewResponse = {
  code: string;
  name: string;
  slug: string;

  organization: {
    code: string;
    name: string;
  };

  dataStores: {
    connectionSlug: string;
    // Postgres publication
    publicationName: string;
    tables: string[];
    // Rejot publications
    publications: PublicSchema[];
  }[];
};

export type System = {
  code: string;
  name: string;
  slug: string;
};

export interface ISystemService {
  createSystem(organizationCode: string, system: CreateSystem): Promise<SystemEntity>;
  getSystem(organizationId: string, systemSlug: string): Promise<SystemOverviewResponse>;
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

  createSystem(organizationId: string, { name, slug }: CreateSystem): Promise<SystemEntity> {
    return this.#systemRepository.create(organizationId, {
      name,
      code: generateCode("SYS"),
      slug,
    });
  }

  async getSystem(organizationId: string, systemSlug: string): Promise<SystemOverviewResponse> {
    const { id: _id, ...system } = await this.#systemRepository.get(organizationId, systemSlug);

    return {
      code: system.code,
      name: system.name,
      slug: system.slug,
      organization: {
        code: system.organization.code,
        name: system.organization.name,
      },
      dataStores: system.dataStores.map((dataStore) => ({
        ...dataStore,
        publications: dataStore.publications.map((pub) => ({
          ...pub,
          id: pub.code,
          dataStore: {
            slug: dataStore.connectionSlug,
          },
        })),
      })),
    };
  }

  async getSystems(organizationId: string): Promise<System[]> {
    const systems = await this.#systemRepository.getSystems(organizationId);

    return systems.map((system) => ({
      code: system.code,
      name: system.name,
      slug: system.slug,
    }));
  }

  async getSystemsForClerkUser(clerkUserId: string): Promise<System[]> {
    const systems = await this.#systemRepository.getSystemsForClerkUser(clerkUserId);

    return systems.map((system) => ({
      code: system.code,
      name: system.name,
      slug: system.slug,
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
