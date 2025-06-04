import { generateCodeForEntity } from "@/codes/codes.ts";
import type { Counter } from "@opentelemetry/api";
import { metrics } from "@opentelemetry/api";

import type { IConsumerSchemaRepository } from "./consumer-schema-repository.ts";

export type CreateConsumerSchema = {
  name: string;
  connectionSlug: string;
  publicSchemaCode: string;

  transformation: {
    details: SchemaTransformationDetails;
  };
};

export type Transformation = {
  majorVersion: number;
  details: SchemaTransformationDetails;
};

export type ConsumerSchema = {
  id: string;
  name: string;
  status: "draft" | "backfill" | "active" | "archived";
  connection: {
    slug: string;
  };
  transformations: Transformation[];
};

export type ConsumerSchemaListItem = {
  id: string;
  name: string;
  status: "draft" | "backfill" | "active" | "archived";
  connection: {
    slug: string;
  };
};

export type SchemaTransformationDetails = {
  type: "postgresql";
  sql: string;
};

export interface IConsumerSchemaService {
  createConsumerSchema(
    systemSlug: string,
    consumerSchema: CreateConsumerSchema,
  ): Promise<ConsumerSchema>;
  getConsumerSchemaById(systemSlug: string, consumerSchemaId: string): Promise<ConsumerSchema>;
  getConsumerSchemasBySystemSlug(systemSlug: string): Promise<ConsumerSchemaListItem[]>;
}

export class ConsumerSchemaService implements IConsumerSchemaService {
  static inject = ["consumerSchemaRepository"] as const;

  #consumerSchemaRepository: IConsumerSchemaRepository;
  #createdCounter: Counter;

  constructor(consumerSchemaRepository: IConsumerSchemaRepository) {
    this.#consumerSchemaRepository = consumerSchemaRepository;

    // Metric Initialization
    const meter = metrics.getMeter("consumer-schema.service");
    this.#createdCounter = meter.createCounter("rejot_consumer_schemas_created");
  }

  async createConsumerSchema(
    systemSlug: string,
    consumerSchema: CreateConsumerSchema,
  ): Promise<ConsumerSchema> {
    const { code, name, status, connection, transformations } =
      await this.#consumerSchemaRepository.create(systemSlug, {
        name: consumerSchema.name,
        code: generateCodeForEntity("Consumer Schema"),
        connectionSlug: consumerSchema.connectionSlug,
        publicSchemaCode: consumerSchema.publicSchemaCode,
        transformation: consumerSchema.transformation,
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

  async getConsumerSchemaById(
    systemSlug: string,
    consumerSchemaId: string,
  ): Promise<ConsumerSchema> {
    const { code, name, status, connection, transformations } =
      await this.#consumerSchemaRepository.get(systemSlug, consumerSchemaId);

    return {
      id: code,
      name,
      status,
      connection,
      transformations,
    };
  }

  async getConsumerSchemasBySystemSlug(systemSlug: string): Promise<ConsumerSchemaListItem[]> {
    const schemas = await this.#consumerSchemaRepository.getConsumerSchemasBySystemSlug(systemSlug);

    return schemas.map(({ code, name, status, connection }) => ({
      id: code,
      name,
      status,
      connection,
    }));
  }
}
