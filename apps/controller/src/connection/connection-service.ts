import { tokens } from "typed-inject";
import type { IConnectionRepository } from "./connection-repository.ts";
import { ConnectionError, ConnectionErrors } from "./connection.error.ts";
import type { OrganizationRepository } from "@/organization/organization-repository.ts";
import type { ConnectionConfig } from "./connection-manager.ts";

export type ConnectionWithoutPassword = {
  slug: string;
  config: Omit<ConnectionConfig, "password">;
};

export type ConnectionWithPassword = {
  slug: string;
  config: ConnectionConfig;
};

export interface IConnectionService {
  create(params: {
    organizationId: string;
    slug: string;
    config: ConnectionConfig;
  }): Promise<ConnectionWithoutPassword>;

  getBySlug(organizationId: string, connectionSlug: string): Promise<ConnectionWithoutPassword>;

  getBySlugWithPassword(
    organizationId: string,
    connectionSlug: string,
  ): Promise<ConnectionWithPassword>;

  getByOrganization(organizationId: string): Promise<ConnectionWithoutPassword[]>;
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
    config: ConnectionConfig;
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
      config: { ...configWithoutPassword, type: "postgres" as const },
    };
  }

  async getBySlug(
    organizationId: string,
    connectionSlug: string,
  ): Promise<ConnectionWithoutPassword> {
    const connection = await this.getBySlugWithPassword(organizationId, connectionSlug);
    const { password: _, ...configWithoutPassword } = connection.config;

    const response: ConnectionWithoutPassword = {
      slug: connection.slug,
      config: { ...configWithoutPassword, type: "postgres" as const },
    };

    return response;
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
      config: { ...connection.config, type: "postgres" as const },
    };
  }

  async getByOrganization(organizationId: string): Promise<ConnectionWithoutPassword[]> {
    const organization = await this.#organizationRepository.get(organizationId);
    const connections = await this.#connectionRepository.findByOrganization(organization.id);

    return connections.map((connection) => {
      const { password: _, ...configWithoutPassword } = connection.config;
      return {
        slug: connection.slug,
        type: "postgres",
        config: { ...configWithoutPassword, type: "postgres" as const },
      };
    });
  }
}
