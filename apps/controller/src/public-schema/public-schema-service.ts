import type { Counter } from "@opentelemetry/api";
import { metrics } from "@opentelemetry/api";
import type { IPublicSchemaRepository } from "./public-schema-repository.ts";
import type { SchemaDefinition } from "./public-schema.ts";
import { generateCodeForEntity } from "@/codes/codes.ts";

export type CreatePublicSchema = {
  name: string;
  connectionSlug: string;

  transformation: {
    baseTable: string;
    schema: SchemaDefinition;
    details: SchemaTransformationDetails;
  };
};

export type Transformation = {
  majorVersion: number;
  baseTable: string;
  schema: SchemaDefinition;
  details: SchemaTransformationDetails;
};

export type PublicSchema = {
  id: string;
  name: string;
  status: "draft" | "active" | "archived";
  connection: {
    slug: string;
  };
  transformations: Transformation[];
};

export type PublicSchemaListItem = {
  id: string;
  name: string;
  status: "draft" | "active" | "archived";
  connection: {
    slug: string;
  };
};

export type SchemaTransformationDetails = {
  type: "postgresql";
  sql: string;
};

export interface IPublicSchemaService {
  createPublicSchema(systemSlug: string, publicSchema: CreatePublicSchema): Promise<PublicSchema>;
  getPublicSchemaById(systemSlug: string, publicSchemaId: string): Promise<PublicSchema>;
  getPublicSchemasBySystemSlug(systemSlug: string): Promise<PublicSchemaListItem[]>;
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
    const { code, name, status, connection, transformations } =
      await this.#publicSchemaRepository.create(systemSlug, {
        name: publicSchema.name,
        code: generateCodeForEntity("Public Schema"),
        connectionSlug: publicSchema.connectionSlug,
        transformation: publicSchema.transformation,
      });

    this.#createdCounter.add(1);

    return {
      id: code,
      name,
      status,
      connection,
      transformations,
    };
  }

  async getPublicSchemaById(systemSlug: string, publicSchemaId: string): Promise<PublicSchema> {
    const { code, name, status, connection, transformations } =
      await this.#publicSchemaRepository.get(systemSlug, publicSchemaId);

    return {
      id: code,
      name,
      status,
      connection,
      transformations,
    };
  }

  async getPublicSchemasBySystemSlug(systemSlug: string): Promise<PublicSchemaListItem[]> {
    const schemas = await this.#publicSchemaRepository.getPublicSchemasBySystemSlug(systemSlug);

    return schemas.map(({ code, name, status, connection }) => ({
      id: code,
      name,
      status,
      connection,
    }));
  }
}
