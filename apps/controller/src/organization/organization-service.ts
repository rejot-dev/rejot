import type { OrganizationEntity, OrganizationRepository } from "./organization-repository.ts";
import { generateCode } from "../codes/codes.ts";

export type CreateOrganization = {
  name: string;
};

export interface IOrganizationService {
  createOrganization(organization: CreateOrganization): Promise<OrganizationEntity>;
  createOrganizationForClerkUserId(
    organization: CreateOrganization,
    clerkUserId: string,
  ): Promise<OrganizationEntity>;
  getOrganization(organizationId: string): Promise<OrganizationEntity>;
  getOrganizationsByClerkUserId(clerkUserId: string): Promise<OrganizationEntity[]>;
  clerkUserCanAccessOrganizations(
    clerkUserId: string,
    organizationIds: string[],
  ): Promise<boolean>;
}

export class OrganizationService implements IOrganizationService {
  static inject = ["organizationRepository"] as const;

  #organizationRepository: OrganizationRepository;

  constructor(organizationRepository: OrganizationRepository) {
    this.#organizationRepository = organizationRepository;
  }

  createOrganization({ name }: CreateOrganization): Promise<OrganizationEntity> {
    return this.#organizationRepository.create({
      name,
      code: generateCode("ORG"),
    });
  }

  createOrganizationForClerkUserId(
    { name }: CreateOrganization,
    clerkUserId: string,
  ): Promise<OrganizationEntity> {
    return this.#organizationRepository.createOrganizationForClerkUserId({
      name,
      code: generateCode("ORG"),
    }, clerkUserId);
  }

  getOrganization(organizationId: string): Promise<OrganizationEntity> {
    return this.#organizationRepository.get(organizationId);
  }

  getOrganizationsByClerkUserId(clerkUserId: string): Promise<OrganizationEntity[]> {
    return this.#organizationRepository.getOrganizationsByClerkUserId(clerkUserId);
  }

  async clerkUserCanAccessOrganizations(
    clerkUserId: string,
    organizationIds: string[],
  ): Promise<boolean> {
    const organizations = await this.getOrganizationsByClerkUserId(clerkUserId);
    return organizationIds.every((organizationId) =>
      organizations.some((organization) => organization.code === organizationId)
    );
  }
}
