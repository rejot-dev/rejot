import { tokens } from "typed-inject";
import type { IConnectionRepository } from "./connection-repository.ts";
import { ConnectionError, ConnectionErrors } from "./connection.error.ts";
import type { OrganizationRepository } from "@/organization/organization-repository.ts";

export type ConnectionConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
};

export type ConnectionConfigWithoutPassword = Omit<ConnectionConfig, "password">;

type ConnectionResponse = {
  slug: string;
  type: "postgres";
};

type ConnectionResponseWithPassword = ConnectionResponse & {
  config: ConnectionConfig;
};

type ConnectionResponseWithoutPassword = ConnectionResponse & {
  config: ConnectionConfigWithoutPassword;
};

export interface IConnectionService {
  create(params: {
    organizationCode: string;
    slug: string;
    type: "postgres";
    config: ConnectionConfig;
  }): Promise<ConnectionResponseWithoutPassword>;

  getBySlug(
    organizationCode: string,
    connectionSlug: string,
  ): Promise<ConnectionResponseWithoutPassword>;

  getBySlugWithPassword(
    organizationCode: string,
    connectionSlug: string,
  ): Promise<ConnectionResponseWithPassword>;

  getByOrganization(organizationCode: string): Promise<ConnectionResponseWithoutPassword[]>;
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
    organizationCode: string;
    slug: string;
    type: "postgres";
    config: ConnectionConfig;
  }) {
    const organization = await this.#organizationRepository.get(params.organizationCode);

    const connection = await this.#connectionRepository.create({
      organizationId: organization.id,
      slug: params.slug,
      type: params.type,
      config: params.config,
    });

    const { password: _, ...configWithoutPassword } = params.config;

    return {
      id: connection.id,
      organizationId: organization.code,
      slug: connection.slug,
      type: connection.type,
      config: configWithoutPassword,
    };
  }

  async getBySlug(organizationCode: string, connectionSlug: string) {
    const connection = await this.getBySlugWithPassword(organizationCode, connectionSlug);
    const { password: _, ...configWithoutPassword } = connection.config;

    return {
      ...connection,
      config: configWithoutPassword,
    };
  }

  async getBySlugWithPassword(organizationCode: string, connectionSlug: string) {
    const organization = await this.#organizationRepository.get(organizationCode);

    const connection = await this.#connectionRepository.findBySlug(organization.id, connectionSlug);
    if (!connection) {
      throw new ConnectionError({
        ...ConnectionErrors.NOT_FOUND,
        context: { organizationId: organizationCode, slug: connectionSlug },
      });
    }

    return {
      slug: connection.slug,
      type: connection.type,
      config: connection.config,
    };
  }

  async getByOrganization(organizationCode: string): Promise<ConnectionResponseWithoutPassword[]> {
    const organization = await this.#organizationRepository.get(organizationCode);
    const connections = await this.#connectionRepository.findByOrganization(organization.id);

    return connections.map((connection) => {
      const { password: _, ...configWithoutPassword } = connection.config;
      return {
        slug: connection.slug,
        type: connection.type,
        config: configWithoutPassword,
      };
    });
  }
}
