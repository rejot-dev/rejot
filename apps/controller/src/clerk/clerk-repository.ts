import { tokens } from "typed-inject";
import type { PostgresManager } from "@/postgres/postgres.ts";
import { schema } from "@/postgres/schema.ts";
import { eq, sql } from "drizzle-orm";
import postgres from "postgres";

export type InsertPersonAndClerkUser = {
  clerkUserId: string;

  person: {
    code: string;
    firstName: string;
    lastName: string;
    email: string;
  };
};

export type Person = {
  id: number;
  code: string;
  firstName: string;
  lastName: string;
  email: string;
  createdAt: Date;
};

export interface IClerkRepository {
  insertPersonAndClerkUser: (params: InsertPersonAndClerkUser) => Promise<boolean>;
  getPersonByClerkUserId: (clerkUserId: string) => Promise<Person | null>;
}

export class ClerkRepository implements IClerkRepository {
  static inject = tokens("postgres");

  #db: PostgresManager["db"];

  constructor(postgres: PostgresManager) {
    this.#db = postgres.db;
  }

  async getPersonByClerkUserId(clerkUserId: string): Promise<Person | null> {
    const person = await this.#db.select().from(schema.clerkUser).where(
      eq(schema.clerkUser.clerkUserId, clerkUserId),
    ).leftJoin(schema.person, eq(schema.clerkUser.personId, schema.person.id));

    if (person.length === 0) {
      return null;
    }

    return person[0].person;
  }

  async insertPersonAndClerkUser(params: InsertPersonAndClerkUser): Promise<boolean> {
    // TODO: This is too complicated, this should simply be an insert with a `WHERE NOT EXISTS` clause.
    const person = this.#db.$with("person").as(
      this.#db.insert(schema.person).values(params.person).onConflictDoUpdate({
        target: [schema.person.code],
        set: {
          firstName: params.person.firstName,
          lastName: params.person.lastName,
          email: params.person.email,
        },
      }).returning(),
    );

    try {
      const clerkUser = await this.#db.with(person).insert(schema.clerkUser).values({
        clerkUserId: params.clerkUserId,
        personId: sql`(SELECT id FROM person)`,
      }).returning();

      return clerkUser.length === 1;
    } catch (error) {
      if (error instanceof postgres.PostgresError) {
        if (error.message.includes("duplicate key")) {
          return false;
        }
      }

      throw error;
    }
  }
}
