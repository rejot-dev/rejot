import { tokens } from "typed-inject";
import type { IConnectionRepository } from "./connection-repository.ts";
import { ConnectionError, ConnectionErrors } from "./connection.error.ts";
import type { OrganizationRepository } from "@/organization/organization-repository.ts";
import type { PostgresConnectionConfig } from "./connection-manager.ts";

export type ConnectionWithoutPassword = {
  slug: string;
  config: Omit<PostgresConnectionConfig, "password">;
};

export type ConnectionWithPassword = {
  slug: string;
  config: PostgresConnectionConfig;
};

export interface IConnectionService {
  create(params: {
    organizationId: string;
    slug: string;
    config: PostgresConnectionConfig;
  }): Promise<ConnectionWithoutPassword>;

  getBySlug(organizationId: string, connectionSlug: string): Promise<ConnectionWithoutPassword>;

  getBySlugWithPassword(
    organizationId: string,
    connectionSlug: string,
  ): Promise<ConnectionWithPassword>;

  getByOrganization(organizationId: string): Promise<ConnectionWithoutPassword[]>;

  update(params: {
    organizationId: string;
    connectionSlug: string;
    config: PostgresConnectionConfig;
  }): Promise<ConnectionWithoutPassword>;

  delete(organizationId: string, connectionSlug: string): Promise<void>;
}

export class ConnectionService implements IConnectionService {
  static inject = tokens("connectionRepository", "organizationRepository");

  #connectionRepository: IConnectionRepository;
  #organizationRepository: OrganizationRepository;

  constructor(
    connectionRepository: IConnectionRepository,
    organizationRepository: OrganizationRepository,
  ) {
    this.#connectionRepository = connectionRepository;
    this.#organizationRepository = organizationRepository;
  }

  async create(params: {
    organizationId: string;
    slug: string;
    config: PostgresConnectionConfig;
  }): Promise<ConnectionWithoutPassword> {
    const organization = await this.#organizationRepository.get(params.organizationId);

    const connection = await this.#connectionRepository.create({
      organizationId: organization.id,
      slug: params.slug,
      type: params.config.type,
      config: params.config,
    });

    const { password: _, ...configWithoutPassword } = params.config;

    return {
      slug: connection.slug,
      config: { ...configWithoutPassword },
    };
  }

  async getBySlug(
    organizationId: string,
    connectionSlug: string,
  ): Promise<ConnectionWithoutPassword> {
    const connection = await this.getBySlugWithPassword(organizationId, connectionSlug);
    const { password: _, ...configWithoutPassword } = connection.config;

    return {
      slug: connection.slug,
      config: { ...configWithoutPassword },
    };
  }

  async getBySlugWithPassword(
    organizationId: string,
    connectionSlug: string,
  ): Promise<ConnectionWithPassword> {
    const organization = await this.#organizationRepository.get(organizationId);

    const connection = await this.#connectionRepository.findBySlug(organization.id, connectionSlug);
    if (!connection) {
      throw new ConnectionError({
        ...ConnectionErrors.NOT_FOUND,
        context: { organizationId: organizationId, slug: connectionSlug },
      });
    }

    return {
      slug: connection.slug,
      config: connection.config,
    };
  }

  async getByOrganization(organizationId: string): Promise<ConnectionWithoutPassword[]> {
    const organization = await this.#organizationRepository.get(organizationId);
    const connections = await this.#connectionRepository.findByOrganization(organization.id);

    return connections.map((connection) => {
      const { password: _, ...configWithoutPassword } = connection.config;
      return {
        slug: connection.slug,
        config: { ...configWithoutPassword },
      };
    });
  }

  async update(params: {
    organizationId: string;
    connectionSlug: string;
    config: PostgresConnectionConfig;
  }): Promise<ConnectionWithoutPassword> {
    const connection = await this.#connectionRepository.update({
      organizationCode: params.organizationId,
      slug: params.connectionSlug,
      config: params.config,
    });

    const { password: _, ...configWithoutPassword } = params.config;

    return {
      slug: connection.slug,
      config: { ...configWithoutPassword },
    };
  }

  async delete(organizationId: string, connectionSlug: string): Promise<void> {
    await this.#connectionRepository.delete(organizationId, connectionSlug);
  }
}
