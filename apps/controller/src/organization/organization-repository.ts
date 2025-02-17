import type { PostgresManager } from "../postgres/postgres.ts";
import { schema } from "../postgres/schema.ts";
import { eq } from "drizzle-orm";
import { OrganizationError, OrganizationErrors } from "./organization.error.ts";

export type CreateOrganizationEntity = {
  code: string;
  name: string;
};

export type OrganizationEntity = {
  id: number;
  code: string;
  name: string;
};

export interface IOrganizationRepository {
  get(organizationCode: string): Promise<OrganizationEntity>;
  getOrganizationsByClerkUserId(clerkUserId: string): Promise<OrganizationEntity[]>;
  create(organization: CreateOrganizationEntity): Promise<OrganizationEntity>;
  createOrganizationForClerkUserId(
    organization: CreateOrganizationEntity,
    clerkUserId: string,
  ): Promise<OrganizationEntity>;
}

export class OrganizationRepository implements IOrganizationRepository {
  static inject = ["postgres"] as const;

  #db: PostgresManager["db"];

  constructor(postgres: PostgresManager) {
    this.#db = postgres.db;
  }

  async get(organizationCode: string): Promise<OrganizationEntity> {
    const res = await this.#db.select().from(schema.organization).where(
      eq(schema.organization.code, organizationCode),
    );

    if (res.length === 0) {
      throw new OrganizationError(OrganizationErrors.NOT_FOUND)
        .withContext({ organizationCode });
    }

    return res[0];
  }

  async getOrganizationsByClerkUserId(clerkUserId: string): Promise<OrganizationEntity[]> {
    const res = await this.#db
      .select({
        id: schema.organization.id,
        code: schema.organization.code,
        name: schema.organization.name,
      })
      .from(schema.organization)
      .innerJoin(
        schema.personOrganization,
        eq(schema.organization.id, schema.personOrganization.organizationId),
      )
      .innerJoin(
        schema.person,
        eq(schema.personOrganization.personId, schema.person.id),
      )
      .innerJoin(
        schema.clerkUser,
        eq(schema.person.id, schema.clerkUser.personId),
      )
      .where(eq(schema.clerkUser.clerkUserId, clerkUserId));

    return res;
  }

  async create(organization: CreateOrganizationEntity): Promise<OrganizationEntity> {
    const res = await this.#db.insert(schema.organization).values({
      name: organization.name,
      code: organization.code,
    }).returning({
      id: schema.organization.id,
      code: schema.organization.code,
      name: schema.organization.name,
    });

    return res[0];
  }

  async createOrganizationForClerkUserId(
    organization: CreateOrganizationEntity,
    clerkUserId: string,
  ): Promise<OrganizationEntity> {
    // First find the person ID from clerk user
    const clerkUser = await this.#db
      .select()
      .from(schema.clerkUser)
      .where(eq(schema.clerkUser.clerkUserId, clerkUserId));

    if (clerkUser.length === 0) {
      throw new OrganizationError(OrganizationErrors.PERSON_ONBOARDING_NOT_COMPLETED)
        .withContext({ clerkUserId });
    }

    const personId = clerkUser[0].personId;

    // Create organization and link to person in a transaction
    return await this.#db.transaction(async (tx) => {
      // Create the organization
      const [newOrg] = await tx
        .insert(schema.organization)
        .values({
          name: organization.name,
          code: organization.code,
        })
        .returning({
          id: schema.organization.id,
          code: schema.organization.code,
          name: schema.organization.name,
        });

      // Create the person-organization link
      await tx.insert(schema.personOrganization).values({
        personId: personId,
        organizationId: newOrg.id,
      });

      return newOrg;
    });
  }
}
