import { tokens } from "typed-inject";
import type { PostgresManager } from "@/postgres/postgres.ts";
import { schema } from "@/postgres/schema.ts";
import { eq } from "drizzle-orm";

export interface IPersonRepository {
  getPersonByCode(code: string): Promise<
    | {
        id: number;
        code: string;
        firstName: string;
        lastName: string;
        email: string;
        createdAt: Date;
      }
    | undefined
  >;
}

export class PersonRepository implements IPersonRepository {
  static inject = tokens("postgres");

  #postgres: PostgresManager;

  constructor(postgres: PostgresManager) {
    this.#postgres = postgres;
  }

  async getPersonByCode(code: string) {
    const results = await this.#postgres.db
      .select()
      .from(schema.person)
      .where(eq(schema.person.code, code));

    return results[0];
  }
}
