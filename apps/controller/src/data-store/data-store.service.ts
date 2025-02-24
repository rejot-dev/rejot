import { tokens } from "typed-inject";

import type { IDataStoreRepository } from "./data-store.repository.ts";

type ConnectionConfig = {
  type: "postgres";
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl: boolean;
};

type Organization = {
  id: string;
  name: string;
};

type DataStoreWithConnection = {
  slug: string;
  publicationName: string;
  connectionConfig: ConnectionConfig;
  organization: Organization;
};

export interface IDataStoreService {
  getByConnectionSlug(params: { connectionSlug: string }): Promise<DataStoreWithConnection>;
  getAll(systemSlug: string): Promise<DataStoreWithConnection[]>;
}

export class DataStoreService implements IDataStoreService {
  static inject = tokens("dataStoreRepository");

  #dataStoreRepository: IDataStoreRepository;

  constructor(dataStoreRepository: IDataStoreRepository) {
    this.#dataStoreRepository = dataStoreRepository;
  }

  async getAll(systemSlug: string): Promise<DataStoreWithConnection[]> {
    const dataStores = await this.#dataStoreRepository.getBySystemSlug(systemSlug);

    return dataStores.map((dataStore) => ({
      ...dataStore,
      organization: {
        id: dataStore.organization.code,
        name: dataStore.organization.name,
      },
    }));
  }

  async getByConnectionSlug(params: { connectionSlug: string }): Promise<DataStoreWithConnection> {
    const dataStore = await this.#dataStoreRepository.getByConnectionSlug(params);

    return {
      ...dataStore,
      organization: {
        id: dataStore.organization.code,
        name: dataStore.organization.name,
      },
    };
  }
}
