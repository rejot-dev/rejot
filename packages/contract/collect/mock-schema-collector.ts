import type { ISchemaCollector } from "./collect";
import type { ConsumerSchemaData } from "../consumer-schema/consumer-schema";
import type { PublicSchemaData } from "../public-schema/public-schema";

export function createMockPublicSchema(name: string): PublicSchemaData {
  return {
    name,
    source: {
      dataStoreSlug: `${name}_store`,
      tables: [`${name}_table`],
    },
    outputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        name: { type: "string" },
      },
      required: ["id", "name"],
    },
    transformations: [],
    version: {
      major: 1,
      minor: 0,
    },
    definitionFile: `${name}.ts`,
  };
}

export function createMockConsumerSchema(
  name: string,
  sourceManifestSlug: string,
  publicSchemaName: string,
  destinationDataStoreSlug: string,
): ConsumerSchemaData {
  return {
    transformations: [],
    sourceManifestSlug,
    publicSchema: {
      name: publicSchemaName,
      majorVersion: 1,
    },
    destinationDataStoreSlug,
    definitionFile: `${name}.ts`,
  };
}

export class MockSchemaCollector implements ISchemaCollector {
  private schemaMap = new Map<
    string,
    { public: PublicSchemaData[]; consumer: ConsumerSchemaData[] }
  >();

  setSchemas(
    filePath: string,
    schemas: {
      public?: PublicSchemaData[];
      consumer?: ConsumerSchemaData[];
    },
  ) {
    this.schemaMap.set(filePath, {
      public: schemas.public || [],
      consumer: schemas.consumer || [],
    });
  }

  async collectPublicSchemas(
    manifestPath: string,
    _modulePath: string,
  ): Promise<PublicSchemaData[]> {
    const schemas = this.schemaMap.get(manifestPath);
    return schemas?.public || [];
  }

  async collectConsumerSchemas(
    manifestPath: string,
    _modulePath: string,
  ): Promise<ConsumerSchemaData[]> {
    const schemas = this.schemaMap.get(manifestPath);
    return schemas?.consumer || [];
  }
}
