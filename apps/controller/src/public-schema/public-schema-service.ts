import type { Counter } from "@opentelemetry/api";
import { metrics } from "@opentelemetry/api";
import type { IPublicSchemaRepository } from "./public-schema-repository.ts";
import type { SchemaDefinition } from "./public-schema.ts";
import { generateCodeForEntity } from "@/codes/codes.ts";

export type PublicSchema = {
  id: string;
  name: string;
  version: string;
  schema: SchemaDefinition;
  dataStore: {
    slug: string;
  };
};

export type CreatePublicSchema = {
  name: string;
  dataStoreSlug: string;
  schema: SchemaDefinition;
};

export interface IPublicSchemaService {
  createPublicSchema(systemSlug: string, publicSchema: CreatePublicSchema): Promise<PublicSchema>;
  getPublicSchemaById(systemSlug: string, publicSchemaId: string): Promise<PublicSchema>;
  getPublicSchemasBySystemSlug(systemSlug: string): Promise<PublicSchema[]>;
}

export class PublicSchemaService implements IPublicSchemaService {
  static inject = ["publicSchemaRepository"] as const;

  #publicSchemaRepository: IPublicSchemaRepository;
  #createdCounter: Counter;

  constructor(publicSchemaRepository: IPublicSchemaRepository) {
    this.#publicSchemaRepository = publicSchemaRepository;

    // Metric Initialization
    const meter = metrics.getMeter("public-schema.service");
    this.#createdCounter = meter.createCounter("public_schemas_created");
  }

  async createPublicSchema(
    systemSlug: string,
    publicSchema: CreatePublicSchema,
  ): Promise<PublicSchema> {
    const { code, name, majorVersion, minorVersion, dataStoreSlug, schema } =
      await this.#publicSchemaRepository.create(systemSlug, {
        name: publicSchema.name,
        code: generateCodeForEntity("Public Schema"),
        connectionSlug: publicSchema.dataStoreSlug,
        schema: publicSchema.schema,
      });

    this.#createdCounter.add(1);

    return {
      id: code,
      name,
      version: `${majorVersion}.${minorVersion}`,
      dataStore: {
        slug: dataStoreSlug,
      },
      schema,
    };
  }

  async getPublicSchemaById(systemSlug: string, publicSchemaId: string): Promise<PublicSchema> {
    const { code, name, majorVersion, minorVersion, dataStoreSlug, schema } =
      await this.#publicSchemaRepository.get(systemSlug, publicSchemaId);

    return {
      id: code,
      name,
      version: `${majorVersion}.${minorVersion}`,
      dataStore: {
        slug: dataStoreSlug,
      },
      schema,
    };
  }

  async getPublicSchemasBySystemSlug(systemSlug: string): Promise<PublicSchema[]> {
    const schemas = await this.#publicSchemaRepository.getPublicSchemasBySystemSlug(systemSlug);

    return schemas.map(({ code, name, majorVersion, minorVersion, dataStoreSlug, schema }) => ({
      id: code,
      name,
      version: `${majorVersion}.${minorVersion}`,
      dataStore: {
        slug: dataStoreSlug,
      },
      schema,
    }));
  }
}
