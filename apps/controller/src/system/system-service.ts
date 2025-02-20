import { generateCode } from "@/codes/codes.ts";
import type { SystemEntity, SystemRepository } from "./system-repository.ts";
import type { CreateSystem } from "@rejot/api-interface-controller/system";
import type { Publication } from "@rejot/api-interface-controller/publications";

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
    publications: Publication[];
  }[];
};

export type System = {
  code: string;
  name: string;
  slug: string;
};

export interface ISystemService {
  createSystem(organizationCode: string, system: CreateSystem): Promise<SystemEntity>;
  getSystem(organizationCode: string, systemSlug: string): Promise<SystemOverviewResponse>;
  getSystems(organizationCode: string): Promise<System[]>;
  upsertDataStore(params: UpsertDataStoreServiceParams): Promise<UpsertDataStoreServiceResult>;
}

export class SystemService implements ISystemService {
  static inject = ["systemRepository"] as const;

  #systemRepository: SystemRepository;

  constructor(systemRepository: SystemRepository) {
    this.#systemRepository = systemRepository;
  }

  createSystem(organizationCode: string, { name, slug }: CreateSystem): Promise<SystemEntity> {
    return this.#systemRepository.create(organizationCode, {
      name,
      code: generateCode("SYS"),
      slug,
    });
  }

  async getSystem(organizationCode: string, systemSlug: string): Promise<SystemOverviewResponse> {
    const { id: _id, ...system } = await this.#systemRepository.get(organizationCode, systemSlug);

    return {
      code: system.code,
      name: system.name,
      slug: system.slug,
      organization: {
        code: system.organization.code,
        name: system.organization.name,
      },
      dataStores: system.dataStores,
    };
  }

  async getSystems(organizationCode: string): Promise<System[]> {
    const systems = await this.#systemRepository.getSystems(organizationCode);

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
