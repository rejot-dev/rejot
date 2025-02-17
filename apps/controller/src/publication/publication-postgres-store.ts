import type { Postgres, PostgresManager } from "../postgres/postgres.ts";
import type { PSResult, PublicationStore } from "./publication-store.ts";
import type { NewPublication, Publication } from "./publication.ts";
import { schema } from "../postgres/schema.ts";
import { eq } from "drizzle-orm";

export class PublicationPostgresStore implements PublicationStore {
  static inject = ["postgres"] as const;

  #db: Postgres;

  constructor(postgres: PostgresManager) {
    this.#db = postgres.db;
  }

  async createPublication(publication: NewPublication): Promise<PSResult<string>> {
    const res = await this.#db
      .insert(schema.publication)
      .values({
        name: publication.publicationName,
        version: publication.metadata.version,
        schema: publication.schema,
      })
      .returning();

    return {
      success: true,
      data: res[0].id + "",
    };
  }

  async getPublicationByName(publicationName: string): Promise<PSResult<Publication>> {
    const res = await this.#db
      .select()
      .from(schema.publication)
      .where(eq(schema.publication.name, publicationName));

    if (res.length === 0) {
      return {
        success: false,
        error: "publication_not_found",
      };
    }

    const { id, name, createdAt, version } = res[0];

    return {
      success: true,
      data: {
        id: id + "",
        publicationName: name,
        metadata: {
          createdAt: createdAt.getTime(),
          version,
        },
        schema: {},
      },
    };
  }

  async getPublicationById(id: string): Promise<PSResult<Publication>> {
    const idNum = parseInt(id);

    const res = await this.#db
      .select()
      .from(schema.publication)
      .where(eq(schema.publication.id, idNum));

    if (res.length === 0) {
      return {
        success: false,
        error: "publication_not_found",
      };
    }

    const { name, createdAt, version } = res[0];

    return {
      success: true,
      data: {
        id: id + "",
        publicationName: name,
        metadata: {
          createdAt: createdAt.getTime(),
          version,
        },
        schema: {},
      },
    };
  }
}
